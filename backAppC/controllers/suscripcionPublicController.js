const { isSaas } = require('../config/deployment.config');
const saasPlanesService = require('../services/saasPlanes.service');
const suscripcionPublicService = require('../services/suscripcionPublic.service');
const { withPool } = require('../utils/dbPool.util');

const listarPlanes = async (req, res) => {
  try {
    if (!isSaas()) {
      return res.status(404).json({ message: 'No disponible en modo enterprise' });
    }
    const data = await withPool((pool) => saasPlanesService.listarPlanesCatalogoAsync(pool));
    res.status(200).json({ data });
  } catch (error) {
    console.error('listarPlanes:', error);
    res.status(500).json({ message: 'Error al listar planes' });
  }
};

const iniciarCheckout = async (req, res) => {
  try {
    const data = await withPool((pool) => suscripcionPublicService.iniciarCheckout(pool, req.body || {}));
    res.status(201).json({ data, message: 'Checkout iniciado' });
  } catch (error) {
    if (error.message === 'MODO_NO_SAAS') {
      return res.status(404).json({ message: 'No disponible en modo enterprise' });
    }
    if (error.message === 'PLAN_INVALIDO' || error.message === 'CICLO_FACTURACION_INVALIDO') {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === 'NO_PRINCIPAL') {
      return res.status(503).json({ message: 'Plataforma sin empresa principal configurada (esPrincipal).' });
    }
    if (error.message === 'CULQI_NO_CONFIGURADO') {
      return res.status(503).json({ message: 'Culqi no está configurado en la empresa principal.' });
    }
    console.error('iniciarCheckout:', error);
    res.status(500).json({ message: 'Error al iniciar checkout' });
  }
};

const confirmarDemo = async (req, res) => {
  try {
    const orderNumber = (req.body?.orderNumber || '').trim();
    const data = await withPool((pool) =>
      suscripcionPublicService.confirmarDemoCheckout(pool, orderNumber)
    );
    res.status(200).json({ data, message: 'Demo activada' });
  } catch (error) {
    if (error.message === 'MODO_NO_SAAS') {
      return res.status(404).json({ message: 'No disponible en modo enterprise' });
    }
    if (error.message === 'CHECKOUT_INVALIDO' || error.message === 'CHECKOUT_NO_ENCONTRADO') {
      return res.status(400).json({ message: error.message });
    }
    console.error('confirmarDemo:', error);
    res.status(500).json({ message: 'Error' });
  }
};

const confirmarCulqi = async (req, res) => {
  try {
    const data = await withPool((pool) =>
      suscripcionPublicService.confirmarCulqiCheckout(pool, req.body || {})
    );
    res.status(200).json({ data, message: 'Pago registrado' });
  } catch (error) {
    if (error.message === 'MODO_NO_SAAS') {
      return res.status(404).json({ message: 'No disponible en modo enterprise' });
    }
    if (
      error.message === 'DATOS_INCOMPLETOS' ||
      error.message === 'CHECKOUT_NO_ENCONTRADO' ||
      error.message === 'USAR_CONFIRMACION_DEMO' ||
      error.message === 'CULQI_SECRET_FALTANTE' ||
      error.message === 'MONTO_CHECKOUT_INCONSISTENTE'
    ) {
      return res.status(400).json({ message: error.message });
    }
    console.error('confirmarCulqi:', error);
    res.status(400).json({ message: error.message || 'Culqi rechazó el cargo' });
  }
};

const estadoCheckout = async (req, res) => {
  try {
    const orderNumber = (req.params.orderNumber || '').trim();
    const data = await withPool((pool) => suscripcionPublicService.estadoCheckout(pool, orderNumber));
    res.status(200).json({ data });
  } catch (error) {
    if (error.message === 'CHECKOUT_NO_ENCONTRADO') {
      return res.status(404).json({ message: error.message });
    }
    console.error('estadoCheckout:', error);
    res.status(500).json({ message: 'Error' });
  }
};

module.exports = {
  listarPlanes,
  iniciarCheckout,
  confirmarDemo,
  confirmarCulqi,
  estadoCheckout
};
