const lotesRepository = require('../repositories/lotes.repository');
const gestoresRepository = require('../repositories/gestores.repository');
const empresaRepository = require('../repositories/empresa.repository');
const empresaWhatsAppRepository = require('../repositories/empresaWhatsApp.repository');
const whatsappBotConfigRepository = require('../repositories/whatsappBotConfig.repository');
const whatsappProvider = require('./whatsappProvider.service');
const whatsappBotEscalamiento = require('./whatsappBotEscalamiento.service');
const { getFechaHoyApp, partesAhoraApp } = require('../utils/fechaDisplay.util');
const { normalizarTelefonoWhatsApp } = require('../utils/telefonoWhatsApp.util');

const CLAVE_CONTROL = 'INVENTARIO_CONTROL_VENCIMIENTO';
const CLAVE_AVISO_WA = 'INVENTARIO_AVISO_WHATSAPP_VENCIMIENTO';
const CLAVE_DIAS = 'INVENTARIO_DIAS_AVISO_VENCIMIENTO';
const CLAVE_ULTIMO = 'INVENTARIO_AVISO_VENCIMIENTO_ULTIMO';
const CLAVE_CELULAR_AVISO = 'INVENTARIO_CELULAR_AVISO_CADUCIDAD';
const CLAVE_CELULAR_AVISO_LEGACY = 'VENTAS_CELULAR_ENCARGADO';
const MAX_LINEAS = 12;

function getConfig(rows, clave, def) {
  const found = (rows || []).find((c) => c.clave === clave);
  return found && found.valor != null && String(found.valor).trim() !== ''
    ? String(found.valor).trim()
    : def;
}

function esTrue(valor, def = true) {
  if (valor == null || String(valor).trim() === '') {
    return def;
  }
  return String(valor).toLowerCase() === 'true' || String(valor) === '1';
}

function fmtFecha(ymd) {
  const s = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s || '—';
  }
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function lineaLote(r) {
  const dias = Number(r.dias);
  const cuando = Number.isFinite(dias)
    ? (dias < 0 ? `venció ${fmtFecha(r.fechaVencimiento)}` : dias === 0 ? 'vence hoy' : `vence ${fmtFecha(r.fechaVencimiento)} (${dias} d)`)
    : fmtFecha(r.fechaVencimiento);
  const lote = r.numeroLote ? String(r.numeroLote).trim() : 's/n';
  const cant = Math.round(Number(r.cantidadDisponible) || 0);
  const nom = String(r.descripcion || r.codigo || 'Producto').trim().slice(0, 48);
  const suc = r.sucursal ? ` · ${String(r.sucursal).trim()}` : '';
  return `• ${nom} | Lote ${lote} | ${cant} und | ${cuando}${suc}`;
}

function resolverDestinoAviso(botConfig, telefonoVinculado, celularEmpresa, celularEncargadoVentas) {
  const propio = normalizarTelefonoWhatsApp(telefonoVinculado).digitos;
  const encargado = normalizarTelefonoWhatsApp(celularEncargadoVentas).digitos;
  if (encargado && encargado !== propio) {
    return encargado;
  }
  const asesor = normalizarTelefonoWhatsApp(botConfig?.numeroEscalamiento).digitos;
  if (asesor && asesor !== propio) {
    return asesor;
  }
  return whatsappBotEscalamiento.resolverNumeroVendedor(botConfig, telefonoVinculado, {
    celularEmpresa
  });
}

function armarMensaje(aliasEmpresa, fechaHoy, vencidos, porVencer, diasVentana) {
  const nombre = String(aliasEmpresa || 'Su empresa').trim() || 'Su empresa';
  const lineas = [
    `*Caducidad de lotes* — ${nombre}`,
    `Hoy ${fmtFecha(fechaHoy)}`,
    ''
  ];
  if (vencidos.length) {
    lineas.push(`*Vencidos (${vencidos.length})* — dar de baja (Salidas / merma):`);
    vencidos.slice(0, MAX_LINEAS).forEach((r) => lineas.push(lineaLote(r)));
    if (vencidos.length > MAX_LINEAS) {
      lineas.push(`… y ${vencidos.length - MAX_LINEAS} más`);
    }
    lineas.push('');
  }
  if (porVencer.length) {
    lineas.push(`*Por vencer en ${diasVentana} días (${porVencer.length})* — ofertar o bajar precio:`);
    porVencer.slice(0, MAX_LINEAS).forEach((r) => lineas.push(lineaLote(r)));
    if (porVencer.length > MAX_LINEAS) {
      lineas.push(`… y ${porVencer.length - MAX_LINEAS} más`);
    }
  }
  lineas.push('');
  lineas.push('Revise Gestión de Lotes (Inventario).');
  return lineas.join('\n');
}

async function ejecutarCiclo(pool) {
  const partes = partesAhoraApp();
  const hora = parseInt(partes.h, 10);
  if (!Number.isFinite(hora) || hora < 8) {
    return { enviados: 0, omitidos: 0, errores: 0 };
  }

  const fechaHoy = getFechaHoyApp();
  const ids = await lotesRepository.listarEmpresasConLotesCaducidad(pool);
  let enviados = 0;
  let omitidos = 0;
  let errores = 0;

  for (const idEmpresa of ids) {
    try {
      const configRows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, idEmpresa);
      if (!esTrue(getConfig(configRows, CLAVE_CONTROL, 'true'), true)) {
        omitidos += 1;
        continue;
      }
      if (!esTrue(getConfig(configRows, CLAVE_AVISO_WA, 'true'), true)) {
        omitidos += 1;
        continue;
      }
      const ultimo = getConfig(configRows, CLAVE_ULTIMO, '');
      if (ultimo === fechaHoy) {
        omitidos += 1;
        continue;
      }
      const diasVentana = parseInt(getConfig(configRows, CLAVE_DIAS, '30'), 10) || 30;
      const filas = await lotesRepository.listarCaducidadEmpresa(pool, idEmpresa, fechaHoy, diasVentana);
      const vencidos = filas.filter((r) => Number(r.dias) < 0);
      const porVencer = filas.filter((r) => Number(r.dias) >= 0);
      if (!vencidos.length && !porVencer.length) {
        omitidos += 1;
        continue;
      }

      const empresa = await empresaRepository.obtenerBasicaPorId(pool, idEmpresa);
      const sesionWa = await empresaWhatsAppRepository.getByEmpresa(pool, idEmpresa);
      const botConfig = await whatsappBotConfigRepository.getByEmpresa(pool, idEmpresa);
      const destino = resolverDestinoAviso(
        botConfig,
        sesionWa?.telefonoVinculado,
        empresa?.celular,
        getConfig(configRows, CLAVE_CELULAR_AVISO, getConfig(configRows, CLAVE_CELULAR_AVISO_LEGACY, ''))
      );
      const propio = normalizarTelefonoWhatsApp(sesionWa?.telefonoVinculado).digitos;
      if (!destino || (propio && destino === propio)) {
        omitidos += 1;
        continue;
      }

      const alias =
        (empresa && (empresa.nombreComercial || empresa.razon_Social)) || 'Su empresa';
      const texto = armarMensaje(alias, fechaHoy, vencidos, porVencer, diasVentana);
      await whatsappProvider.sendText(idEmpresa, destino, texto);
      await gestoresRepository.guardarConfiguracion(
        pool,
        idEmpresa,
        CLAVE_ULTIMO,
        fechaHoy,
        'Último día en que se envió el aviso WhatsApp de caducidad',
        'STRING'
      );
      enviados += 1;
    } catch (err) {
      errores += 1;
      console.error('caducidadAvisos empresa:', err.message || err);
    }
  }

  return { enviados, omitidos, errores, candidatas: ids.length };
}

module.exports = {
  ejecutarCiclo
};
