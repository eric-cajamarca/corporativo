const clientesService = require('../services/clientes.service');
const { withPool } = require('../utils/dbPool.util');

const crearCliente = async function (req, res) {
  if (!req.user) {
    return res.status(500).send({ message: 'No Access' });
  }
  try {
    const cliente = await withPool((pool) => clientesService.crearCliente(pool, req.user, req.body));
    const existente = cliente && cliente.existente === true;
    res.status(200).send({
      message: existente ? 'Cliente ya existía, se reutiliza el registro' : 'Cliente creado',
      data: cliente,
      existente
    });
  } catch (err) {
    if (err.code === 'RUC_REQUERIDO') {
      return res.status(400).send({ message: 'Debe ingresar un RUC/DNI válido', data: undefined });
    }
    if ((err.message === 'NO_PERM' || err.message === 'NO_PERMISSIONS')) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('crearCliente:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const listarClientes = async function (req, res) {
  if (!req.user) {
    return res.status(401).send({ message: 'No Access' });
  }
  try {
    const { parsePaginacion } = require('../utils/paginacion.util');
    const pag = parsePaginacion(req.query || {});
    if (pag.activa) {
      const result = await withPool((pool) => clientesService.listarClientesPaginado(pool, req.user, req.query));
      return res.status(200).send({ data: result.rows, total: result.total, pagina: result.pagina, porPagina: result.porPagina });
    }
    const data = await withPool((pool) => clientesService.listarClientes(pool, req.user));
    res.status(200).send({ message: 'Lista de clientes', data });
  } catch (err) {
    if ((err.message === 'NO_PERM' || err.message === 'NO_PERMISSIONS') || err.message === 'NO_EMPRESA') {
      return res.status(403).send({ message: (err.message === 'NO_PERM' || err.message === 'NO_PERMISSIONS') ? 'No tiene permisos para realizar esta acción' : 'No autorizado: falta empresa en token' });
    }
    console.error('listarClientes:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const buscarClientesRapido = async function (req, res) {
  if (!req.user) {
    return res.status(401).send({ message: 'No Access' });
  }
  try {
    const result = await withPool((pool) => clientesService.buscarClientesRapido(pool, req.user, req.query || {}));
    return res.status(200).send({ data: result.rows, total: result.total, origen: 'redis' });
  } catch (err) {
    if (err.code === 'TERMINO_CORTO') {
      return res.status(400).send({ message: 'Ingrese al menos 3 caracteres para la búsqueda rápida', data: undefined });
    }
    if ((err.message === 'NO_PERM' || err.message === 'NO_PERMISSIONS') || err.message === 'NO_EMPRESA') {
      return res.status(403).send({ message: (err.message === 'NO_PERM' || err.message === 'NO_PERMISSIONS') ? 'No tiene permisos para realizar esta acción' : 'No autorizado: falta empresa en token' });
    }
    console.error('buscarClientesRapido:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const listarClientes_ruc = async function (req, res) {
  const ruc = req.params.id;
  if (!req.user || !(req.user.empresa || req.user.idEmpresa)) {
    return res.status(401).send({ message: 'No Access' });
  }
  try {
    const data = await withPool((pool) => clientesService.listarPorRuc(pool, req.user, ruc));
    res.status(200).send({ message: 'Lista de clientes', data });
  } catch (err) {
    if ((err.message === 'NO_PERM' || err.message === 'NO_PERMISSIONS')) {
      return res.status(403).send({ message: 'No tiene permisos para realizar esta acción' });
    }
    console.error('listarClientes_ruc:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const listarClientes_id = async function (req, res) {
  const idCliente = req.params.id;
  if (!req.user || !(req.user.empresa || req.user.idEmpresa)) {
    return res.status(401).send({ message: 'No Access' });
  }
  try {
    const data = await withPool((pool) => clientesService.listarPorId(pool, req.user, idCliente));
    res.status(200).send({ message: 'Lista de clientes', data });
  } catch (err) {
    if ((err.message === 'NO_PERM' || err.message === 'NO_PERMISSIONS')) {
      return res.status(403).send({ message: 'No tiene permisos para realizar esta acción' });
    }
    console.error('listarClientes_id:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const actualizarCliente = async function (req, res) {
  const idCliente = req.params.id;
  if (!req.user || !(req.user.empresa || req.user.idEmpresa)) {
    return res.status(401).send({ message: 'No Access' });
  }
  try {
    const data = await withPool((pool) => clientesService.actualizarCliente(pool, req.user, idCliente, req.body));
    res.status(200).send({ message: 'Cliente actualizado', data });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).send({ message: 'Cliente no encontrado o no pertenece a su empresa', data: undefined });
    }
    if ((err.message === 'NO_PERM' || err.message === 'NO_PERMISSIONS')) {
      return res.status(403).send({ message: 'No tiene permisos para realizar esta acción' });
    }
    console.error('actualizarCliente:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const eliminarCliente = async function (req, res) {
  const idCliente = req.params.id;
  if (!req.user || !(req.user.empresa || req.user.idEmpresa)) {
    return res.status(401).send({ message: 'No Access' });
  }
  try {
    const n = await withPool((pool) => clientesService.eliminarCliente(pool, req.user, idCliente));
    res.status(200).send({ message: 'Cliente eliminado', data: n });
  } catch (err) {
    if ((err.message === 'NO_PERM' || err.message === 'NO_PERMISSIONS')) {
      return res.status(403).send({ message: 'No tiene permisos para realizar esta acción' });
    }
    console.error('eliminarCliente:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

const cambiarEstadoCliente = async function (req, res) {
  const idCliente = req.params.id;
  const { estado } = req.body;
  if (!req.user) {
    return res.status(500).send({ message: 'No Access' });
  }
  try {
    const rows = await withPool((pool) => clientesService.cambiarEstado(pool, req.user, idCliente, estado));
    res.status(200).send({ message: 'Cliente eliminado', data: rows });
  } catch (err) {
    if ((err.message === 'NO_PERM' || err.message === 'NO_PERMISSIONS')) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('cambiarEstadoCliente:', err);
    res.status(500).send({ message: err.message, data: undefined });
  }
};

module.exports = {
  crearCliente,
  listarClientes,
  buscarClientesRapido,
  actualizarCliente,
  eliminarCliente,
  listarClientes_ruc,
  cambiarEstadoCliente,
  listarClientes_id
};
