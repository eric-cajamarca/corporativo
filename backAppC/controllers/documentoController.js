const sql = require('mssql');
const dbConfig = require('../dbconfig');
const documentoService = require('../services/documento.service');

async function crearDocumento(req, res) {
  try {
    const pool = await sql.connect(dbConfig);
    const data = await documentoService.crearDocumento(pool, req.user, req.body);
    res.status(200).send({ message: 'Documento creado', data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(500).send({ message: 'No Access' });
    }
    if (error.message === 'NO_PERMISOS') {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('documento.crearDocumento:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
}

async function listarDocumentos(req, res) {
  try {
    const pool = await sql.connect(dbConfig);
    const data = await documentoService.listarDocumentos(pool, req.user);
    res.status(200).send({ message: 'Lista de documentos', data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(500).send({ message: 'No Access' });
    }
    if (error.message === 'NO_PERMISOS') {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('documento.listarDocumentos:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
}

async function actualizarDocumento(req, res) {
  try {
    const pool = await sql.connect(dbConfig);
    const idDocumento = req.params.idDocumento;
    const data = await documentoService.actualizarDocumento(pool, req.user, idDocumento, req.body);
    res.status(200).send({ message: 'Documento actualizado', data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(500).send({ message: 'No Access' });
    }
    if (error.message === 'NO_PERMISOS') {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('documento.actualizarDocumento:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
}

async function eliminarDocumento(req, res) {
  try {
    const pool = await sql.connect(dbConfig);
    const idDocumento = req.params.idDocumento;
    const data = await documentoService.eliminarDocumento(pool, req.user, idDocumento);
    res.status(200).send({ message: 'Documento eliminado', data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(500).send({ message: 'No Access' });
    }
    if (error.message === 'NO_PERMISOS') {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('documento.eliminarDocumento:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
}

async function listarFormasPago(req, res) {
  try {
    const pool = await sql.connect(dbConfig);
    const data = await documentoService.listarFormasPago(pool, req.user);
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(500).send({ message: 'No Access' });
    }
    console.error('documento.listarFormasPago:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
}

module.exports = {
  listarDocumentos,
  crearDocumento,
  actualizarDocumento,
  eliminarDocumento,
  listarFormasPago
};
