const { v4: uuidv4 } = require('uuid');
const { getFechaSoloSQLString } = require('../utils/fechaHoraLocal.util');
const { withPool } = require('../utils/dbPool.util');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');
const comprasRepository = require('../repositories/compras.repository');
const comprobantesCompraSunatRepository = require('../repositories/comprobantesCompraSunat.repository');
const cuotasCompraSunatRepository = require('../repositories/cuotasCompraSunat.repository');

function negocio(msg) {
  const e = new Error(msg);
  e.statusCode = 400;
  return e;
}

function parseDecimal(v) {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function esMonedaSolesCodigo(codigoMoneda) {
  const c = String(codigoMoneda || '').toUpperCase().trim();
  return !c || c.startsWith('PEN');
}

function normalizarCuotasDesdeSnap(snap) {
  const raw = Array.isArray(snap.cuotas) ? snap.cuotas : [];
  return raw
    .map((x, i) => {
      const fv = getFechaSoloSQLString(x.fechaVencimiento);
      return {
        numeroCuota: Number(x.numeroCuota) > 0 ? Number(x.numeroCuota) : i + 1,
        fechaVencimiento: fv ? String(fv).trim().slice(0, 10) : '',
        montoCuota: parseDecimal(x.montoCuota)
      };
    })
    .filter((x) => x.fechaVencimiento && x.montoCuota > 0)
    .sort((a, b) => a.numeroCuota - b.numeroCuota);
}

/**
 * Registra totales reales del CPE (SUNAT) asociados a una compra ya insertada.
 * @param {import('mssql').Transaction} transaction
 * @param {string} idEmpresa UUID empresa del token
 * @param {string} idUsuario UUID usuario
 * @param {string} idCompra UUID compra recién creada
 * @param {object} snap Payload validado desde el cliente (datos normalizados de consulta SUNAT + condición de pago)
 */
exports.registrarDespuesCompra = async (transaction, idEmpresa, idUsuario, idCompra, snap) => {
  if (!snap || typeof snap !== 'object') {
    throw negocio('Datos de comprobante SUNAT inválidos');
  }

  const condicion = String(snap.condicionPago || '').toUpperCase().trim();
  if (condicion !== 'CONTADO' && condicion !== 'CREDITO') {
    throw negocio('La condición de pago debe ser CONTADO o CREDITO');
  }

  const codigoMoneda = snap.codigoMoneda != null ? String(snap.codigoMoneda).toUpperCase().substring(0, 3) : null;
  const monedaSoles = esMonedaSolesCodigo(codigoMoneda);

  if (condicion === 'CREDITO' && !monedaSoles) {
    const tc = parseDecimal(snap.tipoCambio);
    if (!Number.isFinite(tc) || tc <= 0) {
      throw negocio('En compras al crédito en moneda extranjera debe indicar el tipo de cambio (mayor a 0)');
    }
  }

  const rows = await comprasRepository.listarComprasPorIdCompraIdEmpresa(transaction, idEmpresa, idCompra);
  if (!rows || rows.length === 0) {
    throw negocio('La compra no existe o no pertenece a su empresa');
  }

  const rucEmisor = String(snap.rucEmisor || '').replace(/\D/g, '').slice(0, 11);
  if (rucEmisor.length !== 11) {
    throw negocio('RUC emisor inválido');
  }

  const tipoDocumento = String(snap.tipoDocumento || '').trim().padStart(2, '0').slice(0, 2);
  if (!tipoDocumento) {
    throw negocio('Tipo de documento SUNAT es obligatorio');
  }

  const serie = String(snap.serie || '').trim().substring(0, 10);
  const numero = String(snap.numero || '').trim().substring(0, 20);
  if (!serie || !numero) {
    throw negocio('Serie y número del comprobante SUNAT son obligatorios');
  }

  const fechaEmisionStr = getFechaSoloSQLString(snap.fechaEmision);
  if (!fechaEmisionStr || String(fechaEmisionStr).trim().length < 8) {
    throw negocio('Fecha de emisión del comprobante SUNAT es obligatoria');
  }

  const fechaEmision10 = String(fechaEmisionStr).trim().slice(0, 10);

  let tipoCambioVal = null;
  if (condicion === 'CREDITO' && !monedaSoles) {
    tipoCambioVal = parseDecimal(snap.tipoCambio);
  }

  let fechaVencimientoCab = null;
  let cuotasNorm = [];

  if (condicion === 'CREDITO') {
    cuotasNorm = normalizarCuotasDesdeSnap(snap);
    const fvSnap = getFechaSoloSQLString(snap.fechaVencimiento);
    const fv10 = fvSnap ? String(fvSnap).trim().slice(0, 10) : '';

    if (cuotasNorm.length === 0) {
      if (!fv10) {
        throw negocio('En compras al crédito debe indicar la fecha de vencimiento (y cuotas si el comprobante las tiene)');
      }
      cuotasNorm = [
        {
          numeroCuota: 1,
          fechaVencimiento: fv10,
          montoCuota: parseDecimal(snap.total)
        }
      ];
      fechaVencimientoCab = fv10;
    } else {
      fechaVencimientoCab = fv10 || cuotasNorm[cuotasNorm.length - 1].fechaVencimiento;
    }

    const sumCuotas = cuotasNorm.reduce((s, c) => s + c.montoCuota, 0);
    const tot = parseDecimal(snap.total);
    if (tot > 0 && Math.abs(sumCuotas - tot) > 0.05) {
      throw negocio('La suma de las cuotas debe coincidir con el total del comprobante SUNAT');
    }
  }

  let razonSocialEmisor = snap.razonSocialEmisor != null ? String(snap.razonSocialEmisor).trim() : '';
  if (razonSocialEmisor) {
    razonSocialEmisor = razonSocialEmisor.substring(0, 500);
  } else {
    const prov = await comprasRepository.obtenerProveedorRucRSocialPorCompra(transaction, idEmpresa, idCompra);
    if (prov?.rSocial) {
      razonSocialEmisor = String(prov.rSocial).trim().substring(0, 500);
    }
  }

  const idComprobanteCompraSunat = uuidv4();

  await comprobantesCompraSunatRepository.insertar(transaction, {
    idComprobanteCompraSunat,
    idCompra,
    rucEmisor,
    razonSocialEmisor: razonSocialEmisor || null,
    tipoDocumento,
    serie,
    numero,
    fechaEmision: fechaEmision10,
    codigoMoneda,
    condicionPago: condicion,
    fechaVencimiento: fechaVencimientoCab,
    tipoCambio: tipoCambioVal,
    subTotal: parseDecimal(snap.subTotal),
    igv: parseDecimal(snap.igv),
    exonerado: parseDecimal(snap.exonerado),
    total: parseDecimal(snap.total),
    idUsuario
  });

  if (condicion === 'CREDITO' && cuotasNorm.length > 0) {
    for (const c of cuotasNorm) {
      await cuotasCompraSunatRepository.insertar(transaction, {
        idCuota: uuidv4(),
        idComprobanteCompraSunat,
        numeroCuota: c.numeroCuota,
        fechaVencimiento: c.fechaVencimiento,
        montoCuota: c.montoCuota,
        saldoPendiente: c.montoCuota
      });
    }
  }
};

/**
 * Listado de comprobantes SUNAT de compras (solo Administrador / Almacenero).
 * @param {object} user req.user (JWT)
 * @param {object} query req.query
 */
exports.listarPorEmpresaParaUsuario = async (user, query) => {
  if (!user?.empresa) {
    const e = new Error('No autorizado');
    e.statusCode = 401;
    throw e;
  }
  const opts = {
    rucEmisor: query.rucEmisor,
    razonSocial: query.razonSocial,
    fechaDesde: query.fechaDesde,
    fechaHasta: query.fechaHasta,
    condicionPago: query.condicionPago,
    tipoDocumento: query.tipoDocumento
  };
  return withPool(async (pool) => {
    await assertAlgunoPermiso(pool, user, 'VER_COMPRAS', 'CREAR_COMPRAS', 'EDITAR_COMPRAS', 'GESTIONAR_LOTES');
    return comprobantesCompraSunatRepository.listarPorIdEmpresa(pool, user.empresa, opts);
  });
};
