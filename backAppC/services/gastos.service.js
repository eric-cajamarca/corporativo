const GastosRepository = require('../repositories/gastos.repository');
const { getFechaHoyApp, partesAhoraApp } = require('../utils/fechaDisplay.util');

const TIPOS_VALIDOS = ['ADMINISTRACION', 'VENTAS', 'FINANCIERO'];

function validarTipo(tipo) {
  const t = (tipo || 'ADMINISTRACION').toUpperCase();
  if (!TIPOS_VALIDOS.includes(t)) throw new Error('Tipo de gasto no válido.');
  return t;
}

function validarMonto(monto) {
  const m = Number(monto);
  if (isNaN(m) || m <= 0) throw new Error('El monto debe ser mayor a cero.');
  return m;
}

exports.listarPorPeriodo = async (pool, user, fechaDesde, fechaHasta) => {
  if (!user || !user.empresa) throw new Error('NO_ACCESS');
  const { y, m } = partesAhoraApp();
  const fechaInicio = fechaDesde || `${y}-${m}-01`;
  const fechaFin = fechaHasta || getFechaHoyApp();
  const [delPeriodo, recurrentes, totalPeriodo] = await Promise.all([
    GastosRepository.listarPorEmpresaYPeriodo(pool, user.empresa, fechaInicio, fechaFin),
    GastosRepository.listarRecurrentes(pool, user.empresa),
    GastosRepository.obtenerTotalGastosPeriodo(pool, user.empresa, fechaInicio, fechaFin)
  ]);
  return { delPeriodo, recurrentes, totalPeriodo, fechaInicio, fechaFin };
};

exports.crear = async (pool, user, datos) => {
  if (!user || !user.empresa) throw new Error('NO_ACCESS');
  const monto = validarMonto(datos.monto);
  const tipo = validarTipo(datos.tipo);
  const esRecurrente = !!datos.esRecurrente;
  if (!datos.fecha) throw new Error('La fecha es obligatoria.');
  if (datos.fechaFin && String(datos.fechaFin) < String(datos.fecha)) {
    throw new Error('La fecha fin no puede ser menor que la fecha de inicio.');
  }
  return GastosRepository.crear(pool, user.empresa, {
    fecha: datos.fecha,
    fechaFin: esRecurrente ? (datos.fechaFin || null) : null,
    tipo,
    monto,
    descripcion: datos.descripcion || null,
    esRecurrente,
    activo: datos.activo !== false
  }, user.sub);
};

exports.actualizar = async (pool, user, idGasto, datos) => {
  if (!user || !user.empresa) throw new Error('NO_ACCESS');
  if (!idGasto) throw new Error('Id de gasto requerido.');
  const monto = validarMonto(datos.monto);
  const tipo = validarTipo(datos.tipo);
  if (!datos.fecha) throw new Error('La fecha es obligatoria.');
  if (datos.fechaFin && String(datos.fechaFin) < String(datos.fecha)) {
    throw new Error('La fecha fin no puede ser menor que la fecha de inicio.');
  }
  return GastosRepository.actualizar(pool, idGasto, user.empresa, {
    fecha: datos.fecha,
    fechaFin: datos.fechaFin || null,
    tipo,
    monto,
    descripcion: datos.descripcion || null,
    activo: datos.activo !== false
  });
};

exports.eliminar = async (pool, user, idGasto) => {
  if (!user || !user.empresa) throw new Error('NO_ACCESS');
  await GastosRepository.eliminar(pool, idGasto, user.empresa);
};
