const detalleVentaEntregaRepository = require('../repositories/detalleVentaEntrega.repository');

exports.listarPorVentaService = async (pool, idVenta, user) => {
  if (!user || !user.empresa) throw new Error('USUARIO_NO_VALIDO');
  return await detalleVentaEntregaRepository.listarPorVentaRepo(pool, idVenta, user.empresa);
};

exports.crearService = async (pool, body, user) => {
  if (!user || !user.empresa || !user.sub) throw new Error('USUARIO_NO_VALIDO');
  const { idVenta, idDetalle, cantidad, notas } = body;
  if (!idVenta || !idDetalle || cantidad == null) throw new Error('FALTAN_DATOS');
  const cantidadNum = Number(cantidad);
  const validacion = await detalleVentaEntregaRepository.validarDetalleParaEntregaRepo(
    pool, idVenta, idDetalle, cantidadNum, user.empresa
  );
  if (!validacion.valido) throw new Error(validacion.mensaje || 'VALIDACION_FALLO');
  return await detalleVentaEntregaRepository.crearRepo(pool, {
    idVenta,
    idDetalle,
    cantidad: cantidadNum,
    idUsuario: user.sub,
    notas: notas || null,
    idEmpresa: user.empresa
  });
};
