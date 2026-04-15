const sql = require('mssql');
const dbConfig = require('../dbconfig');
const direccionClientesService = require('../services/direccionClientes.service');
const { errores: DE } = direccionClientesService;

const crearDireccionCliente = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const data = await direccionClientesService.crear(pool, req.user, req.body);
    res.status(200).send({ message: 'DireccionCliente creado', data });
  } catch (error) {
    if (error.message === DE.NO_AUTH) {
      return res.status(500).send({ message: 'No Access' });
    }
    if (error.message === DE.NO_ROL) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('direccionClientes.crear:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

const listarDireccionClientes = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const data = await direccionClientesService.listar(pool, req.user);
    res.status(200).send({ message: 'Lista de DireccionClientes', data });
  } catch (error) {
    if (error.message === DE.NO_AUTH) {
      return res.status(500).send({ message: 'No Access' });
    }
    if (error.message === DE.NO_ROL) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('direccionClientes.listar:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

const listarDireccionesClientes_idCliente = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const data = await direccionClientesService.listarPorCliente(pool, req.user, req.params.id);
    res.status(200).send({ message: 'Lista de DireccionClientes', data });
  } catch (error) {
    if (error.message === DE.NO_AUTH) {
      return res.status(500).send({ message: 'No Access' });
    }
    if (error.message === DE.NO_ROL) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('direccionClientes.listarPorCliente:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

const actualizarDireccionCliente = async (req, res) => {
  const idDireccionCliente = req.params.id || req.params.idDireccionCliente;
  try {
    const pool = await sql.connect(dbConfig);
    const data = await direccionClientesService.actualizar(pool, req.user, idDireccionCliente, req.body);
    res.status(200).send({ message: 'DireccionCliente actualizado', data });
  } catch (error) {
    if (error.message === DE.NO_AUTH) {
      return res.status(500).send({ message: 'No Access' });
    }
    if (error.message === DE.NO_ROL) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('direccionClientes.actualizar:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

const eliminarDireccionCliente = async (req, res) => {
  const idDireccionCliente = req.params.id || req.params.idDireccionCliente;
  try {
    const pool = await sql.connect(dbConfig);
    const data = await direccionClientesService.eliminar(pool, req.user, idDireccionCliente);
    res.status(200).send({ message: 'DireccionCliente eliminado', data });
  } catch (error) {
    if (error.message === DE.NO_AUTH) {
      return res.status(500).send({ message: 'No Access' });
    }
    if (error.message === DE.NO_ROL) {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('direccionClientes.eliminar:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

module.exports = {
  crearDireccionCliente,
  listarDireccionClientes,
  actualizarDireccionCliente,
  eliminarDireccionCliente,
  listarDireccionesClientes_idCliente
};
