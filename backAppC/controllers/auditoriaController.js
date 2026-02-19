const pool = require('../dbConnection');
const AuditoriaService = require('../services/auditoria.service');

/**
 * GET /api/auditoria
 * Query: idUsuario, accion, fechaDesde, fechaHasta, pagina, porPagina
 */
const listar = async (req, res) => {
  try {
    const resultado = await AuditoriaService.listarService(pool, req.user, req.query);
    return res.status(200).json({
      message: 'Log de auditoría',
      data: resultado.lista,
      total: resultado.total
    });
  } catch (error) {
    if (error.message === 'USUARIO_NO_VALIDO') {
      return res.status(401).json({ message: 'Usuario no válido' });
    }
    console.error('auditoria.listar:', error);
    return res.status(500).json({ message: 'Error al obtener log de auditoría' });
  }
};

module.exports = {
  listar
};
