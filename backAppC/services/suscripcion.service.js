const { v4: uuidv4 } = require('uuid');
const suscripcionRepository = require('../repositories/suscripcion.repository');
const { construirOrderNumber } = require('./integraciones.service');

async function crearPagoSuscripcion(pool, user, body) {
  const idEmpresaCliente = user?.empresa || user?.idEmpresa;
  if (!idEmpresaCliente) throw new Error('NO_AUTH');
  const { monto, periodo, origen } = body || {};
  const montoNum = Number(monto);
  if (!montoNum || montoNum <= 0) throw new Error('MONTO_INVALIDO');
  const periodoValido = (periodo || '').toUpperCase() === 'ANUAL' ? 'ANUAL' : 'MENSUAL';
  const origenValido = (origen || '').toLowerCase() === 'culqi' ? 'culqi' : 'izipay';

  const idEmpresaPrincipal = await suscripcionRepository.obtenerIdEmpresaPrincipal(pool);
  if (!idEmpresaPrincipal) throw new Error('NO_PRINCIPAL');

  const orderNumber = construirOrderNumber(idEmpresaCliente);
  const idPago = uuidv4();
  await suscripcionRepository.insertarPagoSuscripcion(pool, {
    idPago,
    idEmpresaPrincipal,
    idEmpresaCliente,
    orderNumber,
    monto: montoNum,
    periodo: periodoValido,
    origen: origenValido
  });

  return {
    idPago,
    orderNumber,
    monto: montoNum,
    periodo: periodoValido,
    origen: origenValido
  };
}

module.exports = {
  crearPagoSuscripcion
};
