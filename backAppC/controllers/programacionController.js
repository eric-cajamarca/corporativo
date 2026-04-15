const sql = require('mssql');
const dbConfig = require('../dbconfig');
const programacionService = require('../services/programacion.service');

async function obtener_programacion(req, res) {
  if (!req.user) return res.status(401).json({ message: 'No autorizado' });
  try {
    const pool = await sql.connect(dbConfig);
    const data = await programacionService.obtenerProgramacion(pool, req.user, req.query);
    res.json({ data });
  } catch (error) {
    console.error('obtener_programacion error:', error);
    res.status(500).json({ message: error.message });
  }
}

async function obtener_programacion_id(req, res) {
  if (!req.user) {
    return res.status(401).json({ message: 'No autorizado' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const data = await programacionService.obtenerProgramacionPorRol(pool, req.user);
    res.json({ data });
  } catch (error) {
    if (error.message === 'NO_PERM') {
      return res.status(403).json({ message: 'No tiene permisos' });
    }
    console.error('obtener_programacion_id error:', error);
    res.status(500).send(error.message);
  }
}

module.exports = {
  obtener_programacion,
  obtener_programacion_id
};
