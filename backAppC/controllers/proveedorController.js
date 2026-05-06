const proveedorService = require('../services/proveedor.service');
const { withPool } = require('../utils/dbPool.util');

function sinPermProveedor(msg) {
  return msg === 'NO_PERM' || msg === 'NO_PERMISSIONS';
}

const crearProveedor = async function (req, res) {
  if (!req.user) {
    return res.status(500).send({ message: 'No Access' });
  }
  try {
    const rows = await withPool((pool) => proveedorService.crearProveedor(pool, req.user, req.body));
    res.status(200).send({ message: 'Proveedor creado', data: rows });
  } catch (err) {
    if (err.code === 'RUC_DUPLICADO') {
      return res.status(409).send({ message: 'El RUC ya existe en su empresa', data: undefined });
    }
    if (sinPermProveedor(err.message) || err.message === 'NO_EMPRESA') {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('crearProveedor:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const listarProveedores = async function (req, res) {
  if (!req.user) {
    return res.status(401).send({ message: 'No Access' });
  }
  try {
    const data = await withPool((pool) => proveedorService.listarProveedores(pool, req.user));
    res.status(200).send({ message: 'Lista de proveedores', data });
  } catch (err) {
    if (sinPermProveedor(err.message) || err.message === 'NO_EMPRESA') {
      return res.status(403).send({
        message: sinPermProveedor(err.message) ? 'No tiene permisos para realizar esta acción' : 'No autorizado: falta empresa en token'
      });
    }
    console.error('listarProveedores:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const listarProveedores_ruc = async function (req, res) {
  const ruc = req.params.id;
  if (!req.user || !req.user.empresa) {
    return res.status(401).send({ message: 'No Access' });
  }
  try {
    const data = await withPool((pool) => proveedorService.listarPorRuc(pool, req.user, ruc));
    res.status(200).send({ message: 'Lista de Proveedores', data });
  } catch (err) {
    if (sinPermProveedor(err.message)) {
      return res.status(403).send({ message: 'No tiene permisos para realizar esta acción' });
    }
    console.error('listarProveedores_ruc:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const listarProveedores_id = async function (req, res) {
  const idProveedor = req.params.id;
  if (!req.user || !req.user.empresa) {
    return res.status(401).send({ message: 'No Access' });
  }
  try {
    const data = await withPool((pool) => proveedorService.listarPorId(pool, req.user, idProveedor));
    res.status(200).send({ message: 'Lista de proveedores', data });
  } catch (err) {
    if (sinPermProveedor(err.message)) {
      return res.status(403).send({ message: 'No tiene permisos para realizar esta acción' });
    }
    console.error('listarProveedores_id:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const actualizarProveedor = async function (req, res) {
  const idProveedor = req.params.idProveedor || req.params.id;
  if (!req.user || !(req.user.empresa || req.user.idEmpresa)) {
    return res.status(401).send({ message: 'No Access' });
  }
  try {
    await withPool((pool) => proveedorService.actualizarProveedor(pool, req.user, idProveedor, req.body));
    res.status(200).send({ message: 'Proveedor actualizado', data: 1 });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).send({ message: 'Proveedor no encontrado o no pertenece a su empresa', data: undefined });
    }
    if (sinPermProveedor(err.message)) {
      return res.status(403).send({ message: 'No tiene permisos para realizar esta acción' });
    }
    console.error('actualizarProveedor:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const eliminarProveedor = async function (req, res) {
  const idProveedor = req.params.id;
  if (!req.user || !(req.user.empresa || req.user.idEmpresa)) {
    return res.status(401).send({ message: 'No Access' });
  }
  try {
    const n = await withPool((pool) => proveedorService.eliminarProveedor(pool, req.user, idProveedor));
    res.status(200).send({ message: 'Proveedor eliminado', data: n });
  } catch (err) {
    if (err.code === 'TIENE_COMPRAS') {
      return res.status(400).send({ message: 'El proveedor tiene compras asociadas, no se puede eliminar', data: undefined });
    }
    if (sinPermProveedor(err.message)) {
      return res.status(403).send({ message: 'No tiene permisos para realizar esta acción' });
    }
    console.error('eliminarProveedor:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const cambiarEstadoProveedor = async function (req, res) {
  const idProveedor = req.params.id;
  const { estado } = req.body;
  if (!req.user) {
    return res.status(500).send({ message: 'No Access' });
  }
  try {
    const rows = await withPool((pool) => proveedorService.cambiarEstado(pool, req.user, idProveedor, estado));
    res.status(200).send({ message: 'Proveedor eliminado', data: rows });
  } catch (err) {
    if (sinPermProveedor(err.message)) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('cambiarEstadoProveedor:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const crearDireccionProveedor = async function (req, res) {
  if (!req.user) {
    return res.status(500).send({ message: 'No Access' });
  }
  try {
    const r = await withPool((pool) => proveedorService.crearDireccion(pool, req.user, req.body));
    res.status(200).send({ message: 'DireccionProveedor creado', data: r.rowsAffected });
  } catch (err) {
    if (sinPermProveedor(err.message)) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('crearDireccionProveedor:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const listarDireccionProveedores = async function (req, res) {
  if (!req.user) {
    return res.status(500).send({ message: 'No Access' });
  }
  try {
    const data = await withPool((pool) => proveedorService.listarDireccionesEmpresa(pool, req.user));
    res.status(200).send({ message: 'Lista de DireccionProveedores', data });
  } catch (err) {
    if (sinPermProveedor(err.message)) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('listarDireccionProveedores:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const listarDirecciones_idProveedor = async function (req, res) {
  const idProveedor = req.params.id;
  if (!req.user) {
    return res.status(500).send({ message: 'No Access' });
  }
  try {
    const data = await withPool((pool) =>
      proveedorService.listarDireccionesPorProveedor(pool, req.user, idProveedor)
    );
    res.status(200).send({ message: 'Lista de DireccionProveedores', data });
  } catch (err) {
    if (sinPermProveedor(err.message)) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('listarDirecciones_idProveedor:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const actualizarDireccionProveedor = async function (req, res) {
  const idDireccionProveedor = req.params.id || req.params.idDireccionProveedor;
  if (!req.user) {
    return res.status(500).send({ message: 'No Access' });
  }
  try {
    await withPool((pool) =>
      proveedorService.actualizarDireccion(pool, req.user, idDireccionProveedor, req.body)
    );
    res.status(200).send({ message: 'DireccionProveedor actualizado', data: 1 });
  } catch (err) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).send({ message: 'Dirección no encontrada', data: undefined });
    }
    if (sinPermProveedor(err.message)) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('actualizarDireccionProveedor:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const eliminarDireccionProveedor = async function (req, res) {
  const idDireccionProveedor = req.params.id || req.params.idDireccionProveedor;
  if (!req.user) {
    return res.status(500).send({ message: 'No Access' });
  }
  try {
    await withPool((pool) => proveedorService.eliminarDireccion(pool, req.user, idDireccionProveedor));
    res.status(200).send({ message: 'DireccionProveedor eliminado', data: 1 });
  } catch (err) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).send({ message: 'Dirección no encontrada', data: undefined });
    }
    if (sinPermProveedor(err.message)) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('eliminarDireccionProveedor:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

module.exports = {
  crearProveedor,
  listarProveedores,
  actualizarProveedor,
  eliminarProveedor,
  listarProveedores_ruc,
  cambiarEstadoProveedor,
  listarProveedores_id,
  crearDireccionProveedor,
  listarDireccionProveedores,
  listarDirecciones_idProveedor,
  actualizarDireccionProveedor,
  eliminarDireccionProveedor
};
