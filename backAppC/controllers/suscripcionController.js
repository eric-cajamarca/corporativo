const sql = require('mssql');
const dbConfig = require('../dbconfig');
const suscripcionService = require('../services/suscripcion.service');

const crearPagoSuscripcion = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const data = await suscripcionService.crearPagoSuscripcion(pool, req.user, req.body || {});
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

module.exports = {
  crearPagoSuscripcion
};
