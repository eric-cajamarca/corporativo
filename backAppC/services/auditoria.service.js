const auditoriaRepository = require('../repositories/auditoria.repository');

/**
 * Lista log de auditoría. Solo lectura. Valida empresa del token.
 */
exports.listarService = async (pool, user, query) => {
  if (!user || !user.empresa) {
    throw new Error('USUARIO_NO_VALIDO');
  }
  const filtros = {
    idUsuario: query.idUsuario || null,
    accion: query.accion || null,
    modulo: query.modulo || null,
    fechaDesde: query.fechaDesde || null,
    fechaHasta: query.fechaHasta || null,
    pagina: query.pagina || 1,
    porPagina: query.porPagina || 50
  };
  return await auditoriaRepository.listarRepo(pool, user.empresa, filtros);
};
