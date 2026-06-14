const CreditosServices = require('../services/creditos.service');
const { withPool } = require('../utils/dbPool.util');

function handleEmpresaOpError(res, error) {
  if (error.message === 'EMPRESA_OPERACION_NO_PERMITIDA') {
    return res.status(403).send({ message: 'Empresa de operación no permitida', data: undefined });
  }
  return false;
}

const obtenerCreditosClienteTodos = async (req, res) => {
  try {
    const creditos = await withPool((pool) =>
      CreditosServices.obtenerCreditosClienteService(pool, req.user, '', req.query.idEmpresaOperacion)
    );
    res.status(200).send({ data: creditos });
  } catch (error) {
    if (handleEmpresaOpError(res, error)) return;
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('Error obtener créditos:', error);
    res.status(500).send({ message: 'Error al obtener los créditos', data: undefined });
  }
};

const obtenerCreditosCliente = async (req, res) => {
  try {
    const { idCliente } = req.params;
    const creditos = await withPool((pool) =>
      CreditosServices.obtenerCreditosClienteService(pool, req.user, idCliente, req.query.idEmpresaOperacion)
    );
    res.status(200).send({ data: creditos });
  } catch (error) {
    if (handleEmpresaOpError(res, error)) return;
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('Error obtener créditos cliente:', error);
    res.status(500).send({ message: 'Error al obtener los créditos del cliente', data: undefined });
  }
};

const crearCredito = async (req, res) => {
  try {
    const {
      idCliente,
      idVenta,
      montoTotal,
      plazoDias,
      tasaInteres,
      fechaInicio,
      observaciones,
      fechaCredito
    } = req.body;

    if (!idCliente || !montoTotal || montoTotal <= 0) {
      return res.status(400).send({
        message: 'Datos inválidos: idCliente y montoTotal son requeridos',
        data: undefined
      });
    }

    const result = await withPool((pool) =>
      CreditosServices.crearCreditoService(pool, req.user, {
        idCliente,
        idVenta,
        montoTotal,
        plazoDias: plazoDias || 30,
        tasaInteres,
        fechaInicio,
        observaciones,
        fechaCredito
      })
    );

    res.status(200).send({
      message: 'Crédito creado exitosamente',
      data: result
    });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    if (error.message === 'CLIENTE_NO_ENCONTRADO') {
      return res.status(404).send({ message: 'Cliente no encontrado', data: undefined });
    }
    if (error.message === 'VENTA_NO_ENCONTRADA') {
      return res.status(404).send({ message: 'Venta no encontrada', data: undefined });
    }
    console.error('Error crear crédito:', error);
    res.status(500).send({ message: 'Error al crear el crédito', data: undefined });
  }
};

const obtenerCuotasCredito = async (req, res) => {
  try {
    const { idCredito } = req.params;
    const cuotas = await withPool((pool) =>
      CreditosServices.obtenerCuotasCreditoService(pool, req.user, idCredito, req.query.idEmpresaOperacion)
    );
    res.status(200).send({ data: cuotas });
  } catch (error) {
    if (handleEmpresaOpError(res, error)) return;
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('Error obtener cuotas crédito:', error);
    res.status(500).send({ message: 'Error al obtener las cuotas del crédito', data: undefined });
  }
};

const pagarCuota = async (req, res) => {
  try {
    const { idCuota } = req.params;
    const {
      montoPagado,
      idMediosPago,
      idMoneda,
      numeroRecibo,
      observaciones,
      idApertura,
      idEmpresaOperacion,
      fechaPago
    } = req.body;

    if (!montoPagado || montoPagado <= 0) {
      return res.status(400).send({
        message: 'El monto pagado es requerido y debe ser mayor a cero',
        data: undefined
      });
    }

    const result = await withPool((pool) =>
      CreditosServices.pagarCuotaService(pool, req.user, {
        idCuota,
        montoPagado,
        idMediosPago,
        idMoneda,
        numeroRecibo,
        observaciones,
        idApertura,
        idEmpresaOperacion,
        fechaPago
      })
    );

    res.status(200).send({
      message: 'Pago registrado exitosamente',
      data: result
    });
  } catch (error) {
    if (handleEmpresaOpError(res, error)) return;
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    if (error.message === 'CUOTA_NO_ENCONTRADA') {
      return res.status(404).send({
        message: 'Cuota no encontrada o ya está pagada',
        data: undefined
      });
    }
    console.error('Error pagar cuota:', error);
    res.status(500).send({ message: 'Error al procesar el pago', data: undefined });
  }
};

const obtenerResumenCreditos = async (req, res) => {
  try {
    const resumen = await withPool((pool) =>
      CreditosServices.obtenerResumenCreditosService(pool, req.user, req.query.idEmpresaOperacion)
    );
    res.status(200).send({ data: resumen });
  } catch (error) {
    if (handleEmpresaOpError(res, error)) return;
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    console.error('Error obtener resumen créditos:', error);
    res.status(500).send({ message: 'Error al obtener el resumen de créditos', data: undefined });
  }
};

const obtenerCuotasPendientes = async (req, res) => {
  try {
    const { dias } = req.query;
    const d = dias != null && dias !== '' ? parseInt(String(dias), 10) : 7;
    const cuotas = await withPool((pool) =>
      CreditosServices.obtenerCuotasPendientesService(
        pool,
        req.user,
        Number.isNaN(d) ? 7 : d,
        req.query.idEmpresaOperacion
      )
    );
    res.status(200).send({ data: cuotas });
  } catch (error) {
    if (handleEmpresaOpError(res, error)) return;
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    console.error('Error obtener cuotas pendientes:', error);
    res.status(500).send({ message: 'Error al obtener las cuotas pendientes', data: undefined });
  }
};

const obtenerEficienciaCobros = async (req, res) => {
  try {
    const eficiencia = await withPool((pool) =>
      CreditosServices.obtenerEficienciaCobrosService(pool, req.user, req.query.idEmpresaOperacion)
    );
    res.status(200).send({ data: eficiencia });
  } catch (error) {
    if (handleEmpresaOpError(res, error)) return;
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    console.error('Error obtener eficiencia cobros:', error);
    res.status(500).send({ message: 'Error al obtener la eficiencia de cobros', data: undefined });
  }
};

module.exports = {
  obtenerCreditosClienteTodos,
  obtenerCreditosCliente,
  crearCredito,
  obtenerCuotasCredito,
  pagarCuota,
  obtenerResumenCreditos,
  obtenerCuotasPendientes,
  obtenerEficienciaCobros
};
