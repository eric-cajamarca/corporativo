const suscripcionService = require('../services/suscripcion.service');
const empresaSuscripcionBootstrap = require('../services/empresaSuscripcionBootstrap.service');
const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');
const { getDeploymentMode, isSaas } = require('../config/deployment.config');
const suscripcionPublicService = require('../services/suscripcionPublic.service');
const { withPool } = require('../utils/dbPool.util');

const crearPagoSuscripcion = async (req, res) => {
  try {
    const data = await withPool((pool) => suscripcionService.crearPagoSuscripcion(pool, req.user, req.body || {}));
    res.status(201).json({
      data,
      message: 'Pago de suscripción creado. Use orderNumber para redirigir a la pasarela de pago.'
    });
  } catch (error) {
    if (error.message === 'NO_AUTH') {
      return res.status(401).json({ message: 'No autorizado: empresa no identificada' });
    }
    if (error.message === 'MONTO_INVALIDO') {
      return res.status(400).json({ message: 'monto es requerido y debe ser mayor a 0' });
    }
    if (error.message === 'NO_PRINCIPAL') {
      return res.status(503).json({
        message: 'No hay empresa principal configurada para recibir pagos. Contacte al administrador.'
      });
    }
    console.error('Error crear pago suscripción:', error?.message || error);
    res.status(500).json({ message: 'Error al crear el pago de suscripción' });
  }
};

const vincularCheckout = async (req, res) => {
  try {
    if (!isSaas()) {
      return res.status(404).json({ message: 'No disponible en modo enterprise' });
    }
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const orderNumber = (req.body?.orderNumber || '').trim();
    if (!orderNumber) {
      return res.status(400).json({ message: 'orderNumber es requerido' });
    }
    const data = await withPool((pool) =>
      empresaSuscripcionBootstrap.vincularCheckoutPagado(pool, idEmpresa, orderNumber)
    );
    res.status(200).json({ data, message: 'Suscripción activada' });
  } catch (error) {
    if (error.message === 'CHECKOUT_NO_ENCONTRADO') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'CHECKOUT_NO_PAGADO' || error.message === 'CHECKOUT_YA_VINCULADO') {
      return res.status(400).json({ message: error.message });
    }
    console.error('vincularCheckout:', error);
    res.status(500).json({ message: 'Error al vincular pago' });
  }
};

const miEstado = async (req, res) => {
  try {
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const suscripcion = await withPool((pool) => empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa));
    res.status(200).json({
      data: {
        deploymentMode: getDeploymentMode(),
        suscripcion
      }
    });
  } catch (error) {
    console.error('miEstado:', error);
    res.status(500).json({ message: 'Error' });
  }
};

/**
 * Fase 3: solicitud de upgrade/downgrade — crea un nuevo checkout público (mismo flujo que /public/suscripcion/iniciar-checkout).
 */
const solicitarUpgrade = async (req, res) => {
  try {
    if (!isSaas()) {
      return res.status(404).json({ message: 'No disponible en modo enterprise' });
    }
    const data = await withPool((pool) => suscripcionPublicService.iniciarCheckout(pool, req.body || {}));
    res.status(201).json({
      data,
      message: 'Use el orderNumber en la página de pago para completar el cambio de plan. Luego vincule desde su cuenta si aplica.'
    });
  } catch (error) {
    if (error.message === 'PLAN_INVALIDO' || error.message === 'CICLO_FACTURACION_INVALIDO') {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === 'CULQI_NO_CONFIGURADO' || error.message === 'NO_PRINCIPAL') {
      return res.status(503).json({ message: error.message });
    }
    console.error('solicitarUpgrade:', error);
    res.status(500).json({ message: 'Error al solicitar cambio de plan' });
  }
};

module.exports = {
  crearPagoSuscripcion,
  vincularCheckout,
  miEstado,
  solicitarUpgrade
};
