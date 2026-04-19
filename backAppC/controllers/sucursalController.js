const sucursalService = require('../services/sucursal.service');
const { withPool } = require('../utils/dbPool.util');
const { errores: E } = sucursalService;

const obtener_sucursal_idempresa = async (req, res) => {
  try {
    const data = await withPool((pool) => sucursalService.obtenerSucursalResumen(pool, req.user));
    res.status(200).send({ message: 'succes', data });
  } catch (error) {
    if (error.message === E.NO_PERMISO) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    if (error.message === E.NO_ACCESS || error.message === E.FALTA_EMPRESA) {
      return res.status(500).send({ message: 'No Access', data: undefined });
    }
    console.error('obtener_sucursal_idempresa:', error);
    res.status(500).send({ message: 'Error al obtener los sucursal', data: undefined });
  }
};

const obtener_sucursal_todos = async (req, res) => {
  try {
    const data = await withPool((pool) => sucursalService.obtenerSucursalTodos(pool, req.user));
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === E.NO_PERMISO) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    if (error.message === E.NO_ACCESS || error.message === E.FALTA_EMPRESA) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    console.error('obtener_sucursal_todos:', error);
    res.status(500).send({ message: 'Error al obtener las sucursales', data: undefined });
  }
};

const establecer_sucursal_principal = async (req, res) => {
  try {
    await withPool((pool) => sucursalService.establecerPrincipal(pool, req.user, req.params.id));
    res.status(200).send({ message: 'Sucursal principal actualizada', data: { idSucursal: req.params.id } });
  } catch (error) {
    if (error.message === E.NO_ACCESS) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    if (error.message === E.FALTA_EMPRESA) {
      return res.status(403).send({ message: 'No autorizado: falta empresa en token', data: undefined });
    }
    if (error.message === E.NO_PERMISO_403) {
      return res.status(403).send({ message: 'Sin permisos', data: undefined });
    }
    if (error.message === E.BAD_REQUEST) {
      return res.status(400).send({ message: 'Falta id sucursal', data: undefined });
    }
    if (error.message === E.NOT_FOUND) {
      return res.status(404).send({ message: 'Sucursal no encontrada o no pertenece a su empresa', data: undefined });
    }
    console.error('establecer_sucursal_principal:', error);
    res.status(500).send({ message: 'Error al establecer sucursal principal', data: undefined });
  }
};

const editar_sucursal_idEmpresa = async (req, res) => {
  try {
    const rows = await withPool((pool) => sucursalService.editarSucursal(pool, req.user, req.body));
    res.status(200).send({ message: 'Sucursal editada correctamente', data: rows });
  } catch (error) {
    if (error.message === E.NO_PERMISO) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    if (error.message === E.NO_ACCESS || error.message === E.FALTA_EMPRESA) {
      return res.status(500).send({ message: 'No Access', data: undefined });
    }
    if (error.message === E.BAD_REQUEST) {
      return res.status(400).send({ message: 'Datos incompletos', data: undefined });
    }
    console.error('editar_sucursal_idEmpresa:', error);
    res.status(500).send({ message: 'Error al editar la sucursal', data: undefined });
  }
};

const editar_estado_idsucursal = async (req, res) => {
  try {
    const rows = await withPool((pool) =>
      sucursalService.editarEstadoSucursal(pool, req.user, req.params.id, req.body)
    );
    res.status(200).send({ message: 'Estado de la sucursal editado correctamente', data: rows });
  } catch (error) {
    if (error.message === E.NO_ACCESS) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    if (error.message === E.NO_PERMISO_403) {
      return res.status(403).send({ message: 'No tiene permisos', data: undefined });
    }
    if (error.message === E.FALTA_EMPRESA) {
      return res.status(403).send({ message: 'No autorizado: falta empresa en token', data: undefined });
    }
    if (error.message === E.NOT_FOUND) {
      return res.status(404).send({ message: 'Sucursal no encontrada o no pertenece a su empresa', data: undefined });
    }
    console.error('editar_estado_idsucursal:', error);
    res.status(500).send({ message: 'Error al editar la sucursal', data: undefined });
  }
};

const eliminar_sucursal_idempresa = async (req, res) => {
  try {
    const rows = await withPool((pool) => sucursalService.eliminarTodasSucursalesEmpresa(pool, req.user));
    res.status(200).send({ message: 'Sucursal eliminada correctamente', data: rows });
  } catch (error) {
    if (error.message === E.NO_PERMISO) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    if (error.message === E.NO_ACCESS || error.message === E.FALTA_EMPRESA) {
      return res.status(500).send({ message: 'No Access', data: undefined });
    }
    console.error('eliminar_sucursal_idempresa:', error);
    res.status(500).send({ message: 'Error al eliminar la sucursal', data: undefined });
  }
};

const obtener_stock_sucursal_idProducto = async (req, res) => {
  const idProducto = req.params.id;
  const idSucursal = req.body.idSucursal;
  try {
    const data = await withPool((pool) =>
      sucursalService.obtenerStockSucursalProducto(pool, req.user, idProducto, idSucursal)
    );
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === E.NO_PERMISO) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    if (error.message === E.NO_ACCESS || error.message === E.BAD_REQUEST) {
      return res.status(500).send({ message: 'No Access', data: undefined });
    }
    console.error('obtener_stock_sucursal_idProducto:', error.message);
    res.status(500).send({ message: 'Error al obtener el stock', data: undefined });
  }
};

const obtener_stock_sucursales_idempresa = async (req, res) => {
  try {
    const data = await withPool((pool) => sucursalService.obtenerStockSucursalesEmpresa(pool, req.user));
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === E.NO_PERMISO) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    if (error.message === E.NO_ACCESS || error.message === E.FALTA_EMPRESA) {
      return res.status(500).send({ message: 'No Access', data: undefined });
    }
    console.error('obtener_stock_sucursales_idempresa:', error.message);
    res.status(500).send({ message: 'Error al obtener el stock', data: undefined });
  }
};

const crear_stock_sucursal_idEmpresa = async (req, res) => {
  const { idLote } = req.body;
  if (idLote) {
    try {
      await withPool((pool) => sucursalService.editarStockLote(pool, req.user, idLote, req.body));
      return res.status(200).send({ success: true });
    } catch (error) {
      if (error.message === E.BAD_REQUEST) {
        return res.status(400).send({ message: 'ID de lote y cantidad válida son requeridos' });
      }
      if (error.message === E.NOT_FOUND) {
        return res.status(404).send({ message: 'Lote no encontrado' });
      }
      console.error('crear_stock_sucursal_idEmpresa (editar lote):', error.message);
      return res.status(500).send({ message: 'Error al actualizar el lote', data: undefined });
    }
  }
  try {
    await withPool((pool) => sucursalService.crearStockLote(pool, req.user, req.body));
    res.status(200).send({ data: 1, message: 'Lote creado correctamente' });
  } catch (error) {
    if (error.message === E.NO_PERMISO) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    if (error.message === E.NO_ACCESS || error.message === E.BAD_REQUEST) {
      return res.status(500).send({ message: 'No Access', data: undefined });
    }
    console.error('crear_stock_sucursal_idEmpresa:', error.message);
    res.status(500).send({ message: 'Error al crear el lote', data: undefined });
  }
};

const editar_stock_sucursal = async (req, res) => {
  try {
    await withPool((pool) => sucursalService.editarStockLote(pool, req.user, req.params.id, req.body));
    res.status(200).send({ success: true });
  } catch (error) {
    if (error.message === E.BAD_REQUEST) {
      return res.status(400).send({ message: 'ID de lote y cantidad válida son requeridos' });
    }
    if (error.message === E.NOT_FOUND) {
      return res.status(404).send({ message: 'Lote no encontrado' });
    }
    console.error('editar_stock_sucursal:', error.message);
    res.status(500).send({ message: 'Error al actualizar el lote', data: undefined });
  }
};

const eliminar_stock_sucursal = async (req, res) => {
  try {
    const n = await withPool((pool) => sucursalService.eliminarStockLote(pool, req.user, req.params.id));
    res.status(200).send({ data: n });
  } catch (error) {
    if (error.message === E.NO_PERMISO) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    if (error.message === E.NO_ACCESS) {
      return res.status(500).send({ message: 'No Access', data: undefined });
    }
    console.error('eliminar_stock_sucursal:', error.message);
    res.status(500).send({ message: 'Error al eliminar el lote', data: undefined });
  }
};

module.exports = {
  obtener_sucursal_idempresa,
  obtener_sucursal_todos,
  establecer_sucursal_principal,
  editar_sucursal_idEmpresa,
  eliminar_sucursal_idempresa,
  editar_estado_idsucursal,
  obtener_stock_sucursal_idProducto,
  obtener_stock_sucursales_idempresa,
  crear_stock_sucursal_idEmpresa,
  editar_stock_sucursal,
  eliminar_stock_sucursal
};
