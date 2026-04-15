const sql = require('mssql');
const dbConfig = require('../dbconfig');
const renviosService = require('../services/renvios.service');

const obtenerEnvios = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const data = await renviosService.listarEnvios(pool);
    res.json(data);
  } catch (error) {
    console.error('Error al obtener envíos:', error);
    res.status(500).send('Error al obtener los usuarios');
  }
};

const getCompEnvio = async function (req, res) {
  const codicion = req.params.id;
  try {
    const pool = await sql.connect(dbConfig);
    const data = await renviosService.obtenerPorCodigo(pool, codicion);
    res.json(data);
  } catch (error) {
    console.error('Error al obtener la venta:', error);
    res.status(500).send('Error al obtener la venta por id');
  }
};

const createCompEnvio = async (req, res) => {
  const raw = req.body;
  const data = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  if (!req.user) {
    return res.status(200).send({ message: 'No Access', data: undefined });
  }
  try {
    const pool = await sql.connect(dbConfig);
    await renviosService.crearCompEnvio(pool, req.user, data);
    res.status(200).send({ message: 'Registros guardados correctamente', data: 1 });
  } catch (err) {
    if (err.code === 'COMP_DUPLICADO') {
      return res.status(400).json({ message: 'El comprobante ya existe.' });
    }
    if (err.message === 'NO_AUTH') {
      return res.status(401).json({ message: 'No autorizado' });
    }
    if (err.message === 'DATOS_INVALIDOS') {
      return res.status(400).json({ message: 'Se requiere un arreglo de líneas con Alias.' });
    }
    if (err.message === 'ALIAS_INVALIDO') {
      return res.status(400).json({ message: 'Alias de comprobante no válido.' });
    }
    if (err.message === 'COMPROBANTE_NO_ENCONTRADO') {
      return res.status(404).json({ message: 'No se encontró configuración del comprobante.' });
    }
    console.error('createCompEnvio:', err);
    res.status(500).json({ message: err.message || 'Error al guardar' });
  }
};

const updateCompEnvio = async (req, res) => {
  const { CompVentas, FEnvio, Descripcion, Presentacion, Cantidad } = req.body;
  const CompEnvio = req.params.id;
  try {
    const pool = await sql.connect(dbConfig);
    await renviosService.actualizarCompEnvio(pool, CompEnvio, {
      CompVentas,
      FEnvio,
      Descripcion,
      Presentacion,
      Cantidad
    });
    res.json({ message: 'Registro actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar el registro:', error);
    res.status(500).send('Error al actualizar el registro');
  }
};

const deleteCompEnvio = async function (req, res) {
  const codicion = req.params.id;
  try {
    const pool = await sql.connect(dbConfig);
    await renviosService.eliminarCompEnvio(pool, codicion);
    res.json({ message: 'El registro se eliminó correctamente' });
  } catch (error) {
    console.error('Error al eliminar el registro de envio :', error);
    res.status(500).send('Error al eliminar el registro');
  }
};

module.exports = {
  obtenerEnvios,
  getCompEnvio,
  createCompEnvio,
  deleteCompEnvio,
  updateCompEnvio
};
