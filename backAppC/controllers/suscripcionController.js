const sql = require('mssql');
const dbConfig = require('../dbconfig');
const { construirOrderNumber } = require('../services/integraciones.service');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/suscripcion/crear-pago
 * Body: { monto, periodo, origen } donde origen = 'izipay' | 'culqi', periodo = 'MENSUAL' | 'ANUAL'
 * Crea registro en PagosSuscripcionEmpresa y devuelve orderNumber para que el frontend redirija a la pasarela.
 */
const crearPagoSuscripcion = async (req, res) => {
  try {
    const idEmpresaCliente = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresaCliente) {
      return res.status(401).json({ message: 'No autorizado: empresa no identificada' });
    }
    const { monto, periodo, origen } = req.body || {};
    const montoNum = Number(monto);
    if (!montoNum || montoNum <= 0) {
      return res.status(400).json({ message: 'monto es requerido y debe ser mayor a 0' });
    }
    const periodoValido = (periodo || '').toUpperCase() === 'ANUAL' ? 'ANUAL' : 'MENSUAL';
    const origenValido = (origen || '').toLowerCase() === 'culqi' ? 'culqi' : 'izipay';

    const pool = await sql.connect(dbConfig);
    const principal = await pool.request().query(`
      SELECT idEmpresa FROM Empresas WHERE esPrincipal = 1
    `);
    const idEmpresaPrincipal = principal.recordset[0]?.idEmpresa;
    if (!idEmpresaPrincipal) {
      return res.status(503).json({
        message: 'No hay empresa principal configurada para recibir pagos. Contacte al administrador.'
      });
    }

    const orderNumber = construirOrderNumber(idEmpresaCliente);
    const idPago = uuidv4();
    await pool.request()
      .input('idPago', sql.UniqueIdentifier, idPago)
      .input('idEmpresaPrincipal', sql.UniqueIdentifier, idEmpresaPrincipal)
      .input('idEmpresaCliente', sql.UniqueIdentifier, idEmpresaCliente)
      .input('orderNumber', sql.VarChar(100), orderNumber)
      .input('monto', sql.Decimal(18, 2), montoNum)
      .input('periodo', sql.VarChar(20), periodoValido)
      .input('origen', sql.VarChar(20), origenValido)
      .query(`
        INSERT INTO PagosSuscripcionEmpresa (idPago, idEmpresaPrincipal, idEmpresaCliente, orderNumber, monto, moneda, periodo, origen, estado)
        VALUES (@idPago, @idEmpresaPrincipal, @idEmpresaCliente, @orderNumber, @monto, 'PEN', @periodo, @origen, 'PENDIENTE')
      `);

    res.status(201).json({
      data: {
        idPago,
        orderNumber,
        monto: montoNum,
        periodo: periodoValido,
        origen: origenValido
      },
      message: 'Pago de suscripción creado. Use orderNumber para redirigir a la pasarela de pago.'
    });
  } catch (error) {
    console.error('Error crear pago suscripción:', error?.message || error);
    res.status(500).json({ message: 'Error al crear el pago de suscripción' });
  }
};

module.exports = {
  crearPagoSuscripcion
};
