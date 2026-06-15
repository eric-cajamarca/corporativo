const GastosRepository = require('../repositories/gastos.repository');
const { getFechaHoyApp, partesAhoraApp } = require('../utils/fechaDisplay.util');

exports.listarPorPeriodo = async (pool, user, fechaDesde, fechaHasta) => {
  if (!user || !user.empresa) throw new Error('NO_ACCESS');
  const { y, m } = partesAhoraApp();
  const fechaInicio = fechaDesde || `${y}-${m}-01`;
  const fechaFin = fechaHasta || getFechaHoyApp();
  return GastosRepository.listarPorEmpresaYPeriodo(pool, user.empresa, fechaInicio, fechaFin);
};

exports.crear = async (pool, user, datos) => {
  if (!user || !user.empresa) throw new Error('NO_ACCESS');
  const monto = Number(datos.monto);
  if (isNaN(monto) || monto <= 0) throw new Error('El monto debe ser mayor a cero.');
  const tipo = (datos.tipo || 'ADMINISTRACION').toUpperCase();
  if (!['ADMINISTRACION', 'VENTAS', 'FINANCIERO'].includes(tipo)) throw new Error('Tipo de gasto no válido.');
  return GastosRepository.crear(pool, user.empresa, {
    fecha: datos.fecha,
    tipo,
    monto,
    descripcion: datos.descripcion || null
  }, user.sub);
};

exports.eliminar = async (pool, user, idGasto) => {
  if (!user || !user.empresa) throw new Error('NO_ACCESS');
  await GastosRepository.eliminar(pool, idGasto, user.empresa);
};
