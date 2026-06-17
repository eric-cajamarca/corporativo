const config = require('../config/auditoriaOperaciones.config');
const auditoriaOperacionesRepository = require('../repositories/auditoriaOperaciones.repository');
const { obtenerIpCliente } = require('../utils/clientIp.util');
const { withPool } = require('../utils/dbPool.util');

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
          ...ctx
        });
      }
    });
  });
};

exports.auditarVenta = (req, accion, idVenta, referencia, detalle) => {
  if (!req?.user?.empresa || idVenta == null) return;
  const ctx = exports.contextoDesdeReq(req);
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
        ...ctx
      })
    );
  });
};

exports.auditarCompra = (req, accion, idCompra, referencia) => {
  if (!req?.user?.empresa || !idCompra) return;
  const ctx = exports.contextoDesdeReq(req);
  registrarEnBackground(async () => {
    await withPool((pool) =>
      exports.registrar(pool, {
        idEmpresa: req.user.empresa,
        idUsuario: req.user.sub || req.user.idUsuario || null,
        modulo: exports.MODULOS.COMPRAS,
        accion,
        idRegistro: String(idCompra),
        referencia: referencia || null,
        ...ctx
      })
    );
  });
};

exports.auditarInventario = (req, accion, idMovimiento, referencia, detalle) => {
  if (!req?.user?.empresa) return;
  const ctx = exports.contextoDesdeReq(req);
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
        ...ctx
      })
    );
  });
};

exports.auditarCaja = (req, accion, idRegistro, referencia, detalle) => {
  if (!req?.user?.empresa) return;
  const ctx = exports.contextoDesdeReq(req);
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
        ...ctx
      })
    );
  });
};

exports.auditarDespacho = (req, idDespacho, idVenta, referencia) => {
  if (!req?.user?.empresa) return;
  const ctx = exports.contextoDesdeReq(req);
  registrarEnBackground(async () => {
    await withPool((pool) =>
      exports.registrar(pool, {
        idEmpresa: req.user.empresa,
        idUsuario: req.user.sub || req.user.idUsuario || null,
        modulo: exports.MODULOS.DESPACHOS,
        accion: 'CREAR',
        idRegistro: idDespacho != null ? String(idDespacho) : (idVenta != null ? String(idVenta) : null),
        referencia: referencia || (idVenta != null ? `Venta ${idVenta}` : null),
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
