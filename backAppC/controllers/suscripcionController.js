const suscripcionService = require('../services/suscripcion.service');
const empresaSuscripcionBootstrap = require('../services/empresaSuscripcionBootstrap.service');
const empresaSuscripcionEstadoService = require('../services/empresaSuscripcionEstado.service');
const { isSaas } = require('../config/deployment.config');
const suscripcionPublicService = require('../services/suscripcionPublic.service');
const { withPool } = require('../utils/dbPool.util');
const suscripcionCatalogoAdminService = require('../services/suscripcionCatalogoAdmin.service');
const suscripcionConciliacionService = require('../services/suscripcionConciliacion.service');

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
        message: 'El pago no está disponible en este momento. Contacte al soporte.'
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
      return res.status(404).json({
        message: 'CHECKOUT_NO_ENCONTRADO',
        detail: 'No se encontró esa orden de pago.'
      });
    }
    if (error.message === 'CHECKOUT_NO_PAGADO') {
      return res.status(400).json({
        message: 'CHECKOUT_NO_PAGADO',
        detail:
          'El pago aún no está confirmado. Si pagó con Culqi, espere la confirmación. Si pagó con Yape, Plin o BCP, un administrador de la plataforma debe validar el voucher (estado PENDIENTE_VALIDACION). Cuando pase a PAGADO, el plan se habilita automáticamente si la orden ya está asociada a su empresa.'
      });
    }
    if (error.message === 'CHECKOUT_YA_VINCULADO') {
      return res.status(400).json({
        message: 'CHECKOUT_YA_VINCULADO',
        detail: 'Esa orden ya está vinculada a otra empresa.'
      });
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
        message: 'No tiene permisos para editar el catálogo de planes.'
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
      return res.status(503).json({
        message: 'El pago en línea no está disponible en este momento. Intente más tarde o contacte a soporte.'
      });
    }
    console.error('solicitarUpgrade:', error);
    res.status(500).json({ message: 'Error al solicitar cambio de plan' });
  }
};

const conciliacionCulqi = async (req, res) => {
  try {
    if (!isSaas()) {
      return res.status(404).json({ message: 'No disponible en modo enterprise' });
    }
    const filtros = {
      fechaDesde: req.query?.fechaDesde || null,
      fechaHasta: req.query?.fechaHasta || null,
      estado: req.query?.estado || null
    };
    const data = await withPool((pool) =>
      suscripcionConciliacionService.listarConciliacion(pool, req.user, filtros)
    );
    return res.status(200).json({ data });
  } catch (error) {
    if (error.message === 'NO_AUTORIZADO_CONCILIACION') {
      return res.status(403).json({ message: 'No autorizado para conciliación de pasarela.' });
    }
    console.error('conciliacionCulqi:', error);
    return res.status(500).json({ message: 'Error al consultar conciliación Culqi' });
  }
};

const conciliacionCulqiCsv = async (req, res) => {
  try {
    if (!isSaas()) {
      return res.status(404).json({ message: 'No disponible en modo enterprise' });
    }
    const filtros = {
      fechaDesde: req.query?.fechaDesde || null,
      fechaHasta: req.query?.fechaHasta || null,
      estado: req.query?.estado || null
    };
    const rows = await withPool((pool) =>
      suscripcionConciliacionService.listarConciliacion(pool, req.user, filtros)
    );
    const csv = suscripcionConciliacionService.convertirCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="conciliacion-culqi.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    if (error.message === 'NO_AUTORIZADO_CONCILIACION') {
      return res.status(403).json({ message: 'No autorizado para conciliación de pasarela.' });
    }
    console.error('conciliacionCulqiCsv:', error);
    return res.status(500).json({ message: 'Error al exportar conciliación Culqi' });
  }
};

const listarPagosManuales = async (req, res) => {
  try {
    if (!isSaas()) {
      return res.status(404).json({ message: 'No disponible en modo enterprise' });
    }
    const filtros = {
      fechaDesde: req.query?.fechaDesde || null,
      fechaHasta: req.query?.fechaHasta || null,
      estado: req.query?.estado || null
    };
    const data = await withPool((pool) =>
      suscripcionConciliacionService.listarPagosManualesPendientes(pool, req.user, filtros)
    );
    return res.status(200).json({ data });
  } catch (error) {
    if (error.message === 'NO_AUTORIZADO_CONCILIACION') {
      return res.status(403).json({ message: 'No autorizado para validar pagos de suscripción.' });
    }
    console.error('listarPagosManuales:', error);
    return res.status(500).json({ message: 'Error al listar pagos manuales' });
  }
};

const confirmarPagoManual = async (req, res) => {
  try {
    if (!isSaas()) {
      return res.status(404).json({ message: 'No disponible en modo enterprise' });
    }
    const orderNumber = (req.body?.orderNumber || '').trim();
    const data = await withPool((pool) =>
      suscripcionConciliacionService.confirmarPagoManualAdmin(pool, req.user, orderNumber)
    );
    return res.status(200).json({
      data,
      message: 'Pago confirmado. Plan aplicado a la empresa vinculada a la orden (si existe).'
    });
  } catch (error) {
    if (error.message === 'NO_AUTORIZADO_CONCILIACION') {
      return res.status(403).json({ message: 'No autorizado para validar pagos de suscripción.' });
    }
    if (error.message === 'CHECKOUT_SIN_EMPRESA') {
      return res.status(400).json({
        message: 'CHECKOUT_SIN_EMPRESA',
        detail:
          'El pago está PAGADO pero la orden no tiene empresa vinculada. El cliente debe iniciar sesión o crear empresa con ese número de orden.'
      });
    }
    if (
      error.message === 'DATOS_INCOMPLETOS' ||
      error.message === 'CHECKOUT_NO_ENCONTRADO' ||
      error.message === 'USAR_CONFIRMACION_DEMO' ||
      error.message === 'CHECKOUT_NO_PERMITE_CONFIRMAR'
    ) {
      return res.status(400).json({ message: error.message });
    }
    console.error('confirmarPagoManual:', error);
    return res.status(500).json({ message: 'Error al confirmar pago manual' });
  }
};

const eliminarPagoManual = async (req, res) => {
  try {
    if (!isSaas()) {
      return res.status(404).json({ message: 'No disponible en modo enterprise' });
    }
    const orderNumber = (req.body?.orderNumber || req.params?.orderNumber || '').trim();
    const data = await withPool((pool) =>
      suscripcionConciliacionService.eliminarSolicitudPagoManualAdmin(pool, req.user, orderNumber)
    );
    return res.status(200).json({ data, message: 'Solicitud de pago eliminada' });
  } catch (error) {
    if (error.message === 'NO_AUTORIZADO_CONCILIACION') {
      return res.status(403).json({
        message: 'NO_AUTORIZADO_CONCILIACION',
        detail: 'No autorizado para eliminar pagos de suscripción.'
      });
    }
    if (error.message === 'NO_ELIMINAR_PAGADO') {
      return res.status(400).json({
        message: 'NO_ELIMINAR_PAGADO',
        detail: 'No se pueden eliminar órdenes ya marcadas como PAGADO (historial de cobro).'
      });
    }
    if (error.message === 'NO_ELIMINAR_DEMO') {
      return res.status(400).json({ message: 'NO_ELIMINAR_DEMO', detail: 'No se eliminan checkouts demo desde este panel.' });
    }
    if (error.message === 'DATOS_INCOMPLETOS' || error.message === 'CHECKOUT_NO_ENCONTRADO') {
      return res.status(400).json({
        message: error.message,
        detail:
          error.message === 'CHECKOUT_NO_ENCONTRADO'
            ? 'No se encontró la orden o ya no se puede eliminar.'
            : 'Falta el número de orden.'
      });
    }
    console.error('eliminarPagoManual:', error);
    return res.status(500).json({
      message: 'ERROR_ELIMINAR',
      detail: error?.message ? String(error.message).slice(0, 180) : 'Error al eliminar la solicitud de pago'
    });
  }
};

module.exports = {
  crearPagoSuscripcion,
  vincularCheckout,
  planesCatalogoEditor,
  actualizarPlanCatalogo,
  miEstado,
  solicitarUpgrade,
  conciliacionCulqi,
  conciliacionCulqiCsv,
  listarPagosManuales,
  confirmarPagoManual,
  eliminarPagoManual
};
