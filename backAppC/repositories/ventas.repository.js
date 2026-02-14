// repositories/ventas.repository.js
const sql = require('mssql');

exports.insertar = async (transaction, datosVenta, idEmpresa, idUsuario) => {
  const {
    idSucursal,
    serie,
    numero,
    compVenta,
    idComprobante,
    fEmision,
    fVencimiento,
    idCliente,
    idMoneda,
    tCambio,
    subtotal,
    igv,
    exonerado,
    gratuito,
    otrosCargos,
    descuentos,
    total,
    idMediosPago,
    idEstadoSunat,
    compRelacionado
  } = datosVenta;

  const result = await transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('serie', sql.VarChar(4), serie)
    .input('numero', sql.VarChar(8), numero)
    .input('compVenta', sql.VarChar(13), compVenta)
    .input('idComprobante', sql.Int, idComprobante)
    .input('fEmision', sql.DateTime, fEmision)
    .input('fVencimiento', sql.DateTime, fVencimiento)
    .input('idCliente', sql.Int, idCliente)
    .input('idMoneda', sql.Int, idMoneda)
    .input('tCambio', sql.Decimal(10, 4), tCambio)
    .input('subtotal', sql.Decimal(18, 2), subtotal)
    .input('igv', sql.Decimal(18, 2), igv)
    .input('exonerado', sql.Decimal(18, 2), exonerado)
    .input('gratuito', sql.Decimal(18, 2), gratuito)
    .input('otrosCargos', sql.Decimal(18, 2), otrosCargos)
    .input('descuentos', sql.Decimal(18, 2), descuentos)
    .input('total', sql.Decimal(18, 2), total)
    .input('idMediosPago', sql.VarChar(20), idMediosPago)
    .input('idEstadoSunat', sql.Int, idEstadoSunat)
    .input('compRelacionado', sql.VarChar(30), compRelacionado)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .query(`INSERT INTO Ventas 
      (idEmpresa, idSucursal, serie, numero, compVenta, idComprobante, fEmision, fVencimiento, idCliente, idMoneda, tCambio, subtotal, igv, exonerado, gratuito, otrosCargos, descuentos, total, idMediosPago, idEstadoSunat, compRelacionado, idUsuario) 
      OUTPUT INSERTED.idVenta
      VALUES 
      (@idEmpresa, @idSucursal, @serie, @numero, @compVenta, @idComprobante, @fEmision, @fVencimiento, @idCliente, @idMoneda, @tCambio, @subtotal, @igv, @exonerado, @gratuito, @otrosCargos, @descuentos, @total, @idMediosPago, @idEstadoSunat, @compRelacionado, @idUsuario)`);

  return result;
};

/** Actualiza el número correlativo del comprobante usado en la venta (incrementa en BD para la siguiente). */
exports.actualizarNumeroComprobante = async (transaction, idEmpresa, idComprobante, numeroUsado) => {
  const num = parseInt(String(numeroUsado || '0').replace(/^0+/, '') || '0', 10);
  if (isNaN(num) || num < 0) return;
  await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idComprobante', sql.Int, idComprobante)
    .input('numero', sql.Int, num)
    .query('UPDATE Comprobantes SET numero = @numero WHERE idEmpresa = @idEmpresa AND idComprobante = @idComprobante');
};

/** Inserta el desglose de pagos de una venta (ej: 40 efectivo + 40 yape). Requiere tabla DetallePagoVenta. */
exports.insertarDetallePagoVenta = async (transaction, idVenta, detallePago) => {
  if (!detallePago || detallePago.length === 0) return;
  for (const pago of detallePago) {
    const idMediosPago = pago.idMediosPago != null ? Number(pago.idMediosPago) : null;
    const monto = Number(pago.monto);
    if (idMediosPago == null || monto <= 0) continue;
    const req = transaction.request();
    await req
      .input('idVenta', sql.Int, idVenta)
      .input('idMediosPago', sql.Int, idMediosPago)
      .input('monto', sql.Decimal(18, 2), monto)
      .query('INSERT INTO DetallePagoVenta (idVenta, idMediosPago, monto) VALUES (@idVenta, @idMediosPago, @monto)');
  }
};

/** Lista comprobantes de venta de la empresa con nombre de comprobante y cliente. Fechas en formato ISO. */
exports.listarPorEmpresa = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        v.idVenta,
        v.compVenta,
        CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
        v.total,
        v.idEstadoSunat,
        v.serie,
        v.numero,
        v.idComprobante,
        v.idCliente,
        c.nombre AS nombreComprobante,
        cl.rSocial AS clienteRazonSocial,
        cl.ruc AS clienteRuc
      FROM Ventas v
      LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
      LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
      WHERE v.idEmpresa = @idEmpresa
      ORDER BY v.fEmision DESC
    `);
  return result.recordset || [];
};

/** Datos completos de una venta para generar comprobante PDF (cabecera, empresa, cliente, items). */
exports.obtenerComprobanteParaPdf = async (pool, idVenta, idEmpresa) => {
  const cabecera = await pool
    .request()
    .input('idVenta', sql.Int, idVenta)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        v.idVenta, v.compVenta, v.serie, v.numero,
        CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
        v.subtotal, v.igv, v.exonerado, v.descuentos, v.total,
        c.nombre AS nombreComprobante,
        cl.rSocial AS clienteRazonSocial, cl.ruc AS clienteRuc, cl.direccion AS clienteDireccion
      FROM Ventas v
      LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
      LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
      WHERE v.idVenta = @idVenta AND v.idEmpresa = @idEmpresa
    `);

  const empresa = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT razon_Social AS nombre, ruc
      FROM Empresas WHERE idEmpresa = @idEmpresa
    `);

  const items = await pool
    .request()
    .input('idVenta', sql.Int, idVenta)
    .query(`
      SELECT dv.cantidad, dv.pVenta, dv.subtotal, dv.total, p.descripcion
      FROM DetalleVenta dv
      INNER JOIN Productos p ON p.idProducto = dv.idProducto
      WHERE dv.idVenta = @idVenta
    `);

  const cab = cabecera.recordset && cabecera.recordset[0] ? cabecera.recordset[0] : null;
  const emp = empresa.recordset && empresa.recordset[0] ? empresa.recordset[0] : null;
  const detalle = items.recordset || [];

  if (!cab) return null;

  return {
    venta: {
      compVenta: cab.compVenta,
      nombreComprobante: cab.nombreComprobante,
      fEmision: cab.fEmision,
      subtotal: cab.subtotal,
      igv: cab.igv,
      descuentos: cab.descuentos,
      total: cab.total
    },
    empresa: emp ? { nombre: emp.nombre, ruc: emp.ruc, direccion: '', telefono: '' } : {},
    cliente: {
      rSocial: cab.clienteRazonSocial,
      razonSocial: cab.clienteRazonSocial,
      ruc: cab.clienteRuc,
      direccion: cab.clienteDireccion
    },
    items: detalle.map(d => ({
      descripcion: d.descripcion,
      cantidad: d.cantidad,
      pVenta: d.pVenta,
      subtotal: d.subtotal,
      total: d.total
    }))
  };
};