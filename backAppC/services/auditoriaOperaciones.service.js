const config = require('../config/auditoriaOperaciones.config');
const auditoriaOperacionesRepository = require('../repositories/auditoriaOperaciones.repository');
const { obtenerIpCliente } = require('../utils/clientIp.util');
const { withPool } = require('../utils/dbPool.util');
const { resolveFechaHoraClienteSql } = require('../utils/fechaHoraLocal.util');

exports.MODULOS = {
  VENTAS: 'VENTAS',
  COMPRAS: 'COMPRAS',
  INVENTARIO: 'INVENTARIO',
  CAJA: 'CAJA',
  DESPACHOS: 'DESPACHOS'
};

exports.contextoDesdeReq = (req) => ({
  ipCliente: obtenerIpCliente(req),
  userAgent: req?.headers?.['user-agent'] ? String(req.headers['user-agent']).slice(0, 500) : null
});

/**
 * Fecha/hora de la operación (reloj del cliente o del documento), no GETDATE() del servidor.
 * Prioridad: fecha explícita → body de la operación → header X-Fecha-Hora-Cliente → APP_TIMEZONE.
 */
function fechaOperacionDesdeReq(req, fechaExplicit) {
  const body = req?.body || {};
  const compra = body.compra && typeof body.compra === 'object' ? body.compra : null;
  const venta = body.venta && typeof body.venta === 'object' ? body.venta : null;
  const candidatos = [
    fechaExplicit,
    body.fechaHoraCliente,
    body.fEmision,
    body.fechaEmision,
    body.fechaCompra,
    body.fechaMovimiento,
    body.fechaDespacho,
    body.fechaApertura,
    body.fechaCierre,
    compra?.fEmision,
    compra?.fechaEmision,
    compra?.fechaCompra,
    venta?.fEmision,
    venta?.fechaEmision,
    req?.headers?.['x-fecha-hora-cliente']
  ];
  for (const c of candidatos) {
    const sql = resolveFechaHoraClienteSql(c, false);
    if (sql) return sql;
  }
  return resolveFechaHoraClienteSql(null, true);
}

/**
 * Registra auditoría sin interrumpir la operación principal si falla.
 */
exports.registrar = async (pool, datos) => {
  if (!config.enabled) return;
  if (!datos?.idEmpresa || !datos?.modulo || !datos?.accion) return;
  try {
    await auditoriaOperacionesRepository.insertar(pool, datos);
  } catch (err) {
    console.error('auditoriaOperaciones.registrar:', err.message || err);
  }
};

function registrarEnBackground(fn) {
  if (!config.enabled) return;
  void fn().catch((err) => {
    console.error('auditoriaOperaciones background:', err.message || err);
  });
}

exports.registrarEnBackground = registrarEnBackground;

exports.auditarVentasCreadas = (req, resultado) => {
  const ventas = resultado?.ventasEmpresa;
  if (!ventas?.length || !req?.user?.empresa) return;
  const ctx = exports.contextoDesdeReq(req);
  const idUsuario = req.user.sub || req.user.idUsuario || null;
  const fechaFallback = fechaOperacionDesdeReq(req);
  registrarEnBackground(async () => {
    await withPool(async (pool) => {
      for (const v of ventas) {
        await exports.registrar(pool, {
          idEmpresa: v.idEmpresa || req.user.empresa,
          idUsuario,
          modulo: exports.MODULOS.VENTAS,
          accion: 'CREAR',
          idRegistro: v.idVenta != null ? String(v.idVenta) : null,
          referencia: v.compVenta || null,
          fecha: resolveFechaHoraClienteSql(v.fEmision, false) || fechaFallback,
          ...ctx
        });
      }
    });
  });
};

exports.auditarVenta = (req, accion, idVenta, referencia, detalle, fechaExplicit) => {
  if (!req?.user?.empresa || idVenta == null) return;
  const ctx = exports.contextoDesdeReq(req);
  const fecha = fechaOperacionDesdeReq(req, fechaExplicit);
  registrarEnBackground(async () => {
    await withPool((pool) =>
      exports.registrar(pool, {
        idEmpresa: req.user.empresa,
        idUsuario: req.user.sub || req.user.idUsuario || null,
        modulo: exports.MODULOS.VENTAS,
        accion,
        idRegistro: String(idVenta),
        referencia: referencia || null,
        detalle: detalle || null,
        fecha,
        ...ctx
      })
    );
  });
};

exports.auditarCompra = (req, accion, idCompra, referencia, fechaExplicit) => {
  if (!req?.user?.empresa || !idCompra) return;
  const ctx = exports.contextoDesdeReq(req);
  const fecha = fechaOperacionDesdeReq(req, fechaExplicit);
  registrarEnBackground(async () => {
    await withPool((pool) =>
      exports.registrar(pool, {
        idEmpresa: req.user.empresa,
        idUsuario: req.user.sub || req.user.idUsuario || null,
        modulo: exports.MODULOS.COMPRAS,
        accion,
        idRegistro: String(idCompra),
        referencia: referencia || null,
        fecha,
        ...ctx
      })
    );
  });
};

exports.auditarInventario = (req, accion, idMovimiento, referencia, detalle, fechaExplicit) => {
  if (!req?.user?.empresa) return;
  const ctx = exports.contextoDesdeReq(req);
  const fecha = fechaOperacionDesdeReq(req, fechaExplicit);
  registrarEnBackground(async () => {
    await withPool((pool) =>
      exports.registrar(pool, {
        idEmpresa: req.user.empresa,
        idUsuario: req.user.sub || req.user.idUsuario || null,
        modulo: exports.MODULOS.INVENTARIO,
        accion,
        idRegistro: idMovimiento != null ? String(idMovimiento) : null,
        referencia: referencia || null,
        detalle: detalle || null,
        fecha,
        ...ctx
      })
    );
  });
};

exports.auditarCaja = (req, accion, idRegistro, referencia, detalle, fechaExplicit) => {
  if (!req?.user?.empresa) return;
  const ctx = exports.contextoDesdeReq(req);
  const fecha = fechaOperacionDesdeReq(req, fechaExplicit);
  registrarEnBackground(async () => {
    await withPool((pool) =>
      exports.registrar(pool, {
        idEmpresa: req.user.empresa,
        idUsuario: req.user.sub || req.user.idUsuario || null,
        modulo: exports.MODULOS.CAJA,
        accion,
        idRegistro: idRegistro != null ? String(idRegistro) : null,
        referencia: referencia || null,
        detalle: detalle || null,
        fecha,
        ...ctx
      })
    );
  });
};

exports.auditarDespacho = (req, idDespacho, idVenta, referencia, fechaExplicit) => {
  if (!req?.user?.empresa) return;
  const ctx = exports.contextoDesdeReq(req);
  const fecha = fechaOperacionDesdeReq(req, fechaExplicit);
  registrarEnBackground(async () => {
    await withPool((pool) =>
      exports.registrar(pool, {
        idEmpresa: req.user.empresa,
        idUsuario: req.user.sub || req.user.idUsuario || null,
        modulo: exports.MODULOS.DESPACHOS,
        accion: 'CREAR',
        idRegistro: idDespacho != null ? String(idDespacho) : (idVenta != null ? String(idVenta) : null),
        referencia: referencia || (idVenta != null ? `Venta ${idVenta}` : null),
        fecha,
        ...ctx
      })
    );
  });
};

exports.purgarAntiguos = async (pool) => {
  if (!config.enabled) return { eliminados: 0 };
  try {
    const eliminados = await auditoriaOperacionesRepository.purgarAntiguos(pool, config.retentionMonths);
    return { eliminados };
  } catch (err) {
    console.error('auditoriaOperaciones.purgarAntiguos:', err.message || err);
    throw err;
  }
};

exports.getConfig = () => ({ ...config });
