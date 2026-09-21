const { randomUUID } = require('crypto');
const recetaVentaRepository = require('../repositories/recetaVenta.repository');

const CONDICIONES_RECETA = new Set(['RECETA', 'RETENIDA', 'ESPECIAL']);

function normalizarCondicionVenta(valor) {
  const s = String(valor || 'LIBRE').trim().toUpperCase();
  if (s === 'LIBRE' || s === 'RECETA' || s === 'RETENIDA' || s === 'ESPECIAL') return s;
  return 'LIBRE';
}

function requiereReceta(condicionVenta) {
  return CONDICIONES_RECETA.has(normalizarCondicionVenta(condicionVenta));
}

function texto(valor, max) {
  const s = String(valor || '').trim();
  if (!s) return '';
  return s.length > max ? s.slice(0, max) : s;
}

function fechaSolo(valor) {
  const s = String(valor || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  return s;
}

function textoOpcional(valor, max) {
  const s = String(valor == null ? '' : valor).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function camposFichaProductoDesdeBody(body) {
  const src = body && typeof body === 'object' ? body : {};
  return {
    principioActivo: textoOpcional(src.principioActivo, 150),
    concentracion: textoOpcional(src.concentracion, 40),
    formaFarmaceutica: textoOpcional(src.formaFarmaceutica, 80),
    registroSanitario: textoOpcional(src.registroSanitario, 30),
    laboratorio: textoOpcional(src.laboratorio, 120),
    condicionVenta: normalizarCondicionVenta(src.condicionVenta),
    codigoEan: textoOpcional(src.codigoEan, 14),
    controlado: src.controlado === true || src.controlado === 1 || src.controlado === 'true' || src.controlado === '1'
  };
}

/**
 * Si hay líneas recetadas, exige payload.receta y la persiste en la misma transacción de la venta.
 * @param {object} transaction
 * @param {{ idEmpresa: string, idVenta: number, receta: object|null, lineas: Array<{ idProducto: string, condicionVenta?: string, cantidad: number, consumosPorLote?: Array<{ idLote?: string, cantidadTomada?: number }> }>, idUsuario?: string }} params
 */
async function assertYRegistrarRecetaVenta(transaction, params) {
  const { idEmpresa, idVenta, receta, lineas, idUsuario } = params || {};
  const queRequieren = (lineas || []).filter((l) => requiereReceta(l.condicionVenta));
  if (queRequieren.length === 0) return null;
  if (!idEmpresa || !idVenta) {
    throw new Error('No se pudo asociar la receta a la venta.');
  }
  if (!receta || typeof receta !== 'object') {
    throw new Error('Hay medicamentos que requieren receta. Complete los datos de la receta para cobrar.');
  }

  const pacienteNombre = texto(receta.pacienteNombre, 150);
  const medicoNombre = texto(receta.medicoNombre, 150);
  const cmp = texto(receta.cmp, 20);
  const numeroReceta = texto(receta.numeroReceta, 40);
  const fechaReceta = fechaSolo(receta.fechaReceta);
  const tipoRaw = normalizarCondicionVenta(receta.tipo || queRequieren[0].condicionVenta);
  const tipo = tipoRaw === 'LIBRE' ? 'RECETA' : tipoRaw;

  if (!pacienteNombre || !medicoNombre || !cmp || !numeroReceta || !fechaReceta) {
    throw new Error('La receta debe incluir paciente, médico, CMP, número y fecha.');
  }

  const idReceta = randomUUID();
  await recetaVentaRepository.insertarCabecera(transaction, {
    idReceta,
    idEmpresa,
    idVenta,
    tipo,
    pacienteNombre,
    pacienteDoc: texto(receta.pacienteDoc, 20) || null,
    medicoNombre,
    cmp,
    numeroReceta,
    fechaReceta,
    idUsuario: idUsuario || null
  });

  for (const linea of queRequieren) {
    const consumos = Array.isArray(linea.consumosPorLote) ? linea.consumosPorLote : [];
    if (consumos.length > 0) {
      for (const c of consumos) {
        const cant = Number(c.cantidadTomada) || 0;
        if (cant <= 0) continue;
        await recetaVentaRepository.insertarDetalle(transaction, {
          idRecetaDetalle: randomUUID(),
          idReceta,
          idDetalle: null,
          idProducto: linea.idProducto,
          idLote: c.idLote || null,
          cantidad: cant
        });
      }
    } else {
      const cant = Number(linea.cantidad) || 0;
      if (cant <= 0) continue;
      await recetaVentaRepository.insertarDetalle(transaction, {
        idRecetaDetalle: randomUUID(),
        idReceta,
        idDetalle: null,
        idProducto: linea.idProducto,
        idLote: null,
        cantidad: cant
      });
    }
  }

  return idReceta;
}

module.exports = {
  CONDICIONES_RECETA,
  normalizarCondicionVenta,
  requiereReceta,
  camposFichaProductoDesdeBody,
  assertYRegistrarRecetaVenta
};
