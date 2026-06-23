const AuditoriaService = require('../services/auditoria.service');
const { withPool } = require('../utils/dbPool.util');

/**
 * GET /api/auditoria
 * Query: idUsuario, accion, fechaDesde, fechaHasta, pagina, porPagina
 */
const listar = async (req, res) => {
  try {
    const resultado = await withPool((pool) =>
      AuditoriaService.listarService(pool, req.user, req.query)
    );
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
    const msg = String(error?.message || '');
    if (msg.includes('AuditoriaOperaciones') || msg.includes('Invalid object name')) {
      return res.status(503).json({
        message:
          'La tabla AuditoriaOperaciones no existe. Ejecute la migración backAppC/migrations/create_auditoria_operaciones.sql en SQL Server.'
      });
    }
    return res.status(500).json({ message: 'Error al obtener log de auditoría' });
  }
};

module.exports = {
  listar
};
