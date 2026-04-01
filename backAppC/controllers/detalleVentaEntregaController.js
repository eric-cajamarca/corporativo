const sql = require('mssql');
const dbConfig = require('../dbconfig');
const DetalleVentaEntregaService = require('../services/detalleVentaEntrega.service');

/**
 * GET /api/ventas/:idVenta/entregas
 */
const listarPorVenta = async (req, res) => {
  try {
    const idVenta = parseInt(req.params.idVenta, 10);
    if (isNaN(idVenta)) {
      return res.status(400).json({ message: 'idVenta inválido' });
    }
    const pool = await sql.connect(dbConfig);
    const lista = await DetalleVentaEntregaService.listarPorVentaService(pool, idVenta, req.user);
    return res.status(200).json({ message: 'Entregas de la venta', data: lista });
  } catch (error) {
    if (error.message === 'USUARIO_NO_VALIDO') {
      return res.status(401).json({ message: 'Usuario no válido' });
    }
    console.error('detalleVentaEntrega.listarPorVenta:', error);
    return res.status(500).json({ message: 'Error al listar entregas' });
  }
};

/**
 * POST /api/ventas/entregas
 * Body: { idVenta, idDetalle, cantidad, notas? }
 */
const crear = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const idEntrega = await DetalleVentaEntregaService.crearService(pool, req.body, req.user);
    return res.status(201).json({ message: 'Entrega registrada', data: { idEntrega } });
  } catch (error) {
    if (error.message === 'USUARIO_NO_VALIDO') {
      return res.status(401).json({ message: 'Usuario no válido' });
    }
    if (error.message === 'FALTAN_DATOS') {
      return res.status(400).json({ message: 'Faltan idVenta, idDetalle o cantidad' });
    }
    if (error.message && error.message !== 'VALIDACION_FALLO') {
      return res.status(400).json({ message: error.message });
    }
    console.error('detalleVentaEntrega.crear:', error);
    return res.status(500).json({ message: 'Error al registrar entrega' });
  }
};

module.exports = {
  listarPorVenta,
  crear
};
