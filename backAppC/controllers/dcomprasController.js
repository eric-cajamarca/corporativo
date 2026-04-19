const detalleComprasService = require('../services/detalleCompras.service');
const { withPool } = require('../utils/dbPool.util');

const obtener_detalle_compras_idcompra = async function (req, res) {
  const idCompra = req.params.id;
  if (!idCompra || idCompra === 'undefined' || idCompra === 'null') {
    return res.status(400).send({ message: 'idCompra es requerido', data: undefined });
  }
  if (!req.user) {
    return res.status(500).send({ message: 'No Access', data: undefined });
  }
  try {
    const data = await withPool((pool) => detalleComprasService.obtenerDetallePorCompra(pool, req.user, idCompra));
    res.status(200).send({ data });
  } catch (err) {
    if (err.message === 'NO_PERM') {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('obtener_detalle_compras_idcompra:', err);
    res.status(500).send({ message: 'Error al obtener los detallecompras', data: undefined });
  }
};

const crear_detalle_compras_idcompra = async function (req, res) {
  if (!req.user) {
    return res.status(403).send({ message: 'No Access', data: undefined });
  }
  try {
    const result = await withPool((pool) => detalleComprasService.crearDetalleCompraCompleto(pool, req.user, req.body));
    res.status(200).send({
      data: 1,
      message: result.asignarUbicacionDefecto
        ? 'Detalle de compra registrado. Lote y ubicación por defecto creados.'
        : 'Detalle de compra registrado. Lote creado. Asigne ubicaciones desde Inventario.',
      numeroLote: result.numeroLote,
      idLote: result.idLote
    });
  } catch (err) {
    if (err.message === 'NO_PERM') {
      return res.status(403).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('crear_detalle_compras_idcompra error:', err);
    res.status(500).send({ message: 'Error al crear detalle de compra', data: undefined });
  }
};

const editar_detalle_compras_idcompra = async (req, res) => {
  if (!req.user) {
    return res.status(500).send({ message: 'No Access', data: undefined });
  }
  if (req.user.rol !== 'Administrador') {
    return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
  }
  const DetalleCompra = Array.isArray(req.body) ? req.body : [];
  const dCompra = DetalleCompra.map((detalleCompra) => {
    const { idDetalleCompra, idSucursal, cantidad, idProducto, idPresentacion, pUnitario, total } = detalleCompra;
    return {
      idDetalleCompra,
      idSucursal,
      cantidad,
      idProducto,
      idPresentacion,
      pUnitario,
      total,
      idCompra: req.params.id,
      idEmpresa: req.user.empresa,
      idUsuario: req.user.sub || req.user.idUsuario
    };
  });
  try {
    await withPool(async (pool) => {
      for (const detalle of dCompra) {
        if (detalle.idDetalleCompra) {
          await detalleComprasService.actualizarDetalleInterno(pool, detalle);
        } else {
          await detalleComprasService.crearDetalleInterno(pool, detalle);
        }
      }
    });
    res.status(200).send({ data: 1, message: 'Detalle de compra actualizado correctamente' });
  } catch (error) {
    console.error('editar_detalle_compras_idcompra:', error);
    res.status(500).send({ message: 'Error al crear detallecompras', data: undefined });
  }
};

module.exports = {
  obtener_detalle_compras_idcompra,
  crear_detalle_compras_idcompra,
  editar_detalle_compras_idcompra
};
