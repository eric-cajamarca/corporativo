const suscripcionService = require('../services/suscripcion.service');
const empresaSuscripcionBootstrap = require('../services/empresaSuscripcionBootstrap.service');
const empresaSuscripcionEstadoService = require('../services/empresaSuscripcionEstado.service');
const { isSaas } = require('../config/deployment.config');
const suscripcionPublicService = require('../services/suscripcionPublic.service');
const { withPool } = require('../utils/dbPool.util');
const suscripcionCatalogoAdminService = require('../services/suscripcionCatalogoAdmin.service');

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
    const data = await withPool((pool) => empresaSuscripcionEstadoService.obtenerMiEstado(pool, idEmpresa));
    res.status(200).json({ data });
  } catch (error) {
    console.error('miEstado:', error);
    res.status(500).json({ message: 'Error' });
  }
};

/**
 * Fase 3: solicitud de upgrade/downgrade — crea un nuevo checkout público (mismo flujo que /public/suscripcion/iniciar-checkout).
 */
const planesCatalogoEditor = async (req, res) => {
  try {
    if (!isSaas()) {
      return res.status(404).json({ message: 'No disponible en modo enterprise' });
    }
    if (!req.user?.empresa && !req.user?.idEmpresa) {
      return res.status(200).json({ data: { puedeEditar: false } });
    }
    const puedeEditar = await withPool((pool) =>
      suscripcionCatalogoAdminService.puedeEditarCatalogoPlanes(pool, req.user)
    );
    res.status(200).json({ data: { puedeEditar } });
  } catch (error) {
    console.error('planesCatalogoEditor:', error);
    res.status(500).json({ message: 'Error' });
  }
};

const actualizarPlanCatalogo = async (req, res) => {
  try {
    if (!isSaas()) {
      return res.status(404).json({ message: 'No disponible en modo enterprise' });
    }
    const planCode = (req.params.planCode || '').toString().trim().toLowerCase();
    if (!planCode) {
      return res.status(400).json({ message: 'planCode inválido' });
    }
    await withPool((pool) =>
      suscripcionCatalogoAdminService.actualizarPlanCatalogoPublico(pool, req.user, planCode, req.body || {})
    );
    res.status(200).json({ message: 'Plan actualizado' });
  } catch (error) {
    if (error.message === 'NO_AUTORIZADO_CATALOGO') {
      return res.status(403).json({
        message: 'Solo el superAdmin de la empresa principal de la plataforma puede editar el catálogo de planes.'
      });
    }
    if (
      error.message === 'DESCRIPCION_REQUERIDA' ||
      error.message === 'DESCRIPCION_LARGA' ||
      error.message === 'PRECIO_MENSUAL_INVALIDO' ||
      error.message === 'PRECIO_ANUAL_INVALIDO' ||
      error.message === 'MAX_USUARIOS_INVALIDO' ||
      error.message === 'MAX_SUCURSALES_INVALIDO'
    ) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === 'PLAN_NO_EDITABLE_EN_BD') {
      return res.status(400).json({
        message:
          'No se actualizó ninguna fila. Ejecute la migración de SaasPlan o el plan no pertenece al catálogo público.'
      });
    }
    console.error('actualizarPlanCatalogo:', error);
    res.status(500).json({ message: 'Error al actualizar el plan' });
  }
};

const solicitarUpgrade = async (req, res) => {
  try {
    if (!isSaas()) {
      return res.status(404).json({ message: 'No disponible en modo enterprise' });
    }
    const data = await withPool((pool) =>
      suscripcionPublicService.iniciarCheckout(pool, req.body || {}, req.user)
    );
    res.status(201).json({
      data,
      message:
        'Use el orderNumber en la página de pago para completar el cambio de plan. Con sesión iniciada, el plan se aplicará al confirmar el pago o al notificar la pasarela.'
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
  planesCatalogoEditor,
  actualizarPlanCatalogo,
  miEstado,
  solicitarUpgrade
};
