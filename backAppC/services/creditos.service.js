const CreditosRepository = require('../repositories/creditos.repository');
const {
  resolverIdEmpresaOperacionCaja,
  obtenerEmpresasPermitidasOperacionCaja
} = require('../utils/cajaOperacionEmpresa.util');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');

async function idsEmpresaCreditosDesdeQuery(pool, user, idEmpresaOperacion) {
  if (idEmpresaOperacion != null && String(idEmpresaOperacion).trim() !== "") {
    const idE = await resolverIdEmpresaOperacionCaja(pool, user, idEmpresaOperacion);
    return [idE];
  }
  const lista = await obtenerEmpresasPermitidasOperacionCaja(pool, user.empresa);
  return (lista || []).map((x) => x.idEmpresa).filter(Boolean);
}

exports.obtenerCreditosClienteService = async (pool, user, idCliente, idEmpresaOperacion) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertAlgunoPermiso(pool, user, 'VER_CREDITOS', 'CREAR_CREDITOS', 'REGISTRAR_PAGOS');

  const ids = await idsEmpresaCreditosDesdeQuery(pool, user, idEmpresaOperacion);
  if (ids.length === 0) {
    throw new Error("NO_ACCESS");
  }
  const creditos = await CreditosRepository.obtenerCreditosClienteRepo(pool, ids, idCliente);
  return creditos;
};

exports.crearCreditoService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertAlgunoPermiso(pool, user, 'CREAR_CREDITOS');

  const clienteValido = await CreditosRepository.validarClienteEmpresaRepo(pool, datos.idCliente, user.empresa);
  if (!clienteValido) {
    throw new Error("CLIENTE_NO_ENCONTRADO");
  }

  if (datos.idVenta) {
    const ventaValida = await CreditosRepository.validarVentaEmpresaRepo(pool, datos.idVenta, user.empresa);
    if (!ventaValida) {
      throw new Error("VENTA_NO_ENCONTRADA");
    }
  }

  const result = await CreditosRepository.crearCreditoRepo(pool, user, datos);
  return result;
};

exports.obtenerCuotasCreditoService = async (pool, user, idCredito, idEmpresaOperacion) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertAlgunoPermiso(pool, user, 'VER_CREDITOS', 'CREAR_CREDITOS', 'REGISTRAR_PAGOS');

  const idE = await resolverIdEmpresaOperacionCaja(pool, user, idEmpresaOperacion);
  const cuotas = await CreditosRepository.obtenerCuotasCreditoRepo(pool, idE, idCredito);
  return cuotas;
};

exports.pagarCuotaService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertAlgunoPermiso(pool, user, 'REGISTRAR_PAGOS', 'CREAR_CREDITOS');

  const idE = await resolverIdEmpresaOperacionCaja(pool, user, datos.idEmpresaOperacion);
  const userOp = { ...user, empresa: idE };

  const cuotaValida = await CreditosRepository.validarCuotaPendienteRepo(pool, datos.idCuota, idE);
  if (!cuotaValida) {
    throw new Error("CUOTA_NO_ENCONTRADA");
  }

  const result = await CreditosRepository.pagarCuotaRepo(pool, userOp, datos);
  return result;
};

exports.pagarCuotasMasivoService = async (pool, user, datos) => {
  if (!user) {
    throw new Error('NO_ACCESS');
  }

  await assertAlgunoPermiso(pool, user, 'REGISTRAR_PAGOS', 'CREAR_CREDITOS');

  const pagos = Array.isArray(datos?.pagos) ? datos.pagos : [];
  if (!pagos.length) {
    throw new Error('PAGOS_VACIOS');
  }

  const resultados = [];
  for (const pago of pagos) {
    const monto = Number(pago.montoPagado);
    if (!pago.idCuota || !(monto > 0)) {
      throw new Error('PAGO_INVALIDO');
    }
    const idE = await resolverIdEmpresaOperacionCaja(
      pool,
      user,
      pago.idEmpresaOperacion || datos.idEmpresaOperacion
    );
    const userOp = { ...user, empresa: idE };
    const cuotaValida = await CreditosRepository.validarCuotaPendienteRepo(pool, pago.idCuota, idE);
    if (!cuotaValida) {
      throw new Error('CUOTA_NO_ENCONTRADA');
    }
    const result = await CreditosRepository.pagarCuotaRepo(pool, userOp, {
      idCuota: pago.idCuota,
      montoPagado: monto,
      idMediosPago: pago.idMediosPago ?? datos.idMediosPago,
      idMoneda: pago.idMoneda ?? datos.idMoneda,
      numeroRecibo: pago.numeroRecibo ?? datos.numeroRecibo,
      observaciones: pago.observaciones ?? datos.observaciones,
      idApertura: pago.idApertura ?? datos.idApertura,
      fechaPago: pago.fechaPago ?? datos.fechaPago
    });
    resultados.push(result);
  }

  return { procesados: resultados.length, resultados };
};

exports.obtenerResumenCreditosService = async (pool, user, idEmpresaOperacion) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertAlgunoPermiso(pool, user, 'VER_CREDITOS', 'CREAR_CREDITOS', 'REGISTRAR_PAGOS');

  const ids = await idsEmpresaCreditosDesdeQuery(pool, user, idEmpresaOperacion);
  if (ids.length === 0) {
    throw new Error("NO_ACCESS");
  }
  const resumen = await CreditosRepository.obtenerResumenCreditosRepo(pool, ids);
  return resumen;
};

exports.obtenerCuotasPendientesService = async (pool, user, dias = 7, idEmpresaOperacion) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertAlgunoPermiso(pool, user, 'VER_CREDITOS', 'CREAR_CREDITOS', 'REGISTRAR_PAGOS');

  const idE = await resolverIdEmpresaOperacionCaja(pool, user, idEmpresaOperacion);
  const cuotas = await CreditosRepository.obtenerCuotasPendientesRepo(pool, idE, dias);
  return cuotas;
};

exports.obtenerEficienciaCobrosService = async (pool, user, idEmpresaOperacion) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertAlgunoPermiso(pool, user, 'VER_CREDITOS', 'CREAR_CREDITOS', 'REGISTRAR_PAGOS');

  const idE = await resolverIdEmpresaOperacionCaja(pool, user, idEmpresaOperacion);
  const eficiencia = await CreditosRepository.obtenerEficienciaCobrosRepo(pool, idE);
  return eficiencia;
};
