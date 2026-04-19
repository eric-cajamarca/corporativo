const { withPool } = require('../utils/dbPool.util');
const devolucionesDespachoService = require('../services/devolucionesDespacho.service');

const crearDevolucionDespacho = async (req, res) => {
  try {
    const { idDespacho } = req.params;
    const { observaciones, items } = req.body;
    if (!idDespacho) {
      return res.status(400).send({ message: 'idDespacho es requerido', data: undefined });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).send({ message: 'Debe incluir items de devolución', data: undefined });
    }
    const result = await withPool(async (pool) =>
      devolucionesDespachoService.crearDevolucionDespachoService(pool, req.user, {
        idDespacho,
        observaciones,
        items
      })
    );
    if (result?.ok === false) {
      return res.status(400).send({ message: result.error || 'No se pudo registrar', data: undefined });
    }
    return res.status(200).send({ message: 'Devolución registrada', data: result });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    if (error.message === 'DESPACHO_NO_ENCONTRADO') {
      return res.status(404).send({ message: 'Despacho no encontrado', data: undefined });
    }
    if (error.message === 'DATOS_INVALIDOS') {
      return res.status(400).send({ message: 'Datos inválidos', data: undefined });
    }
    console.error('Error crear devolución despacho:', error);
    return res.status(500).send({ message: 'Error al registrar devolución', data: undefined });
  }
};

const listarDevolucionesPorDespacho = async (req, res) => {
  try {
    const { idDespacho } = req.params;
    const data = await withPool(async (pool) =>
      devolucionesDespachoService.listarDevolucionesPorDespachoService(pool, req.user, idDespacho)
    );
    return res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    console.error('Error listar devoluciones despacho:', error);
    return res.status(500).send({ message: 'Error al listar devoluciones', data: undefined });
  }
};

const obtenerDetalleDevolucion = async (req, res) => {
  try {
    const { idDevolucionDespacho } = req.params;
    const data = await withPool(async (pool) =>
      devolucionesDespachoService.obtenerDetalleDevolucionService(pool, req.user, idDevolucionDespacho)
    );
    return res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    console.error('Error obtener detalle devolución:', error);
    return res.status(500).send({ message: 'Error al obtener detalle', data: undefined });
  }
};

module.exports = {
  crearDevolucionDespacho,
  listarDevolucionesPorDespacho,
  obtenerDetalleDevolucion
};
