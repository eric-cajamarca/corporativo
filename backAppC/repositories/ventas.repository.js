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

/** Lista comprobantes de venta de la empresa con nombre de comprobante, cliente e idComprobanteElectronico para envío SUNAT. */
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
        c.codigo AS codigoComprobante,
        cl.rSocial AS clienteRazonSocial,
        cl.ruc AS clienteRuc,
        ce.idComprobanteElectronico,
        ce.tipoComprobante,
        e.ruc AS rucEmpresa
      FROM Ventas v
      LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
      LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
      LEFT JOIN ComprobantesElectronicos ce ON ce.idVenta = v.idVenta AND ce.idEmpresa = v.idEmpresa
      LEFT JOIN Empresas e ON e.idEmpresa = v.idEmpresa
      WHERE v.idEmpresa = @idEmpresa
      ORDER BY v.fEmision DESC
    `);
  const rows = result.recordset || [];
  return rows.map((r) => ({
    ...r,
    idComprobanteElectronico: r.idComprobanteElectronico != null ? String(r.idComprobanteElectronico) : null,
    tipoComprobante: r.tipoComprobante != null ? String(r.tipoComprobante).trim() : null,
    rucEmpresa: r.rucEmpresa != null ? String(r.rucEmpresa).trim() : null
  }));
};

/** Datos completos de una venta para generar comprobante PDF (cabecera, empresa, cliente, items). baseUrl para armar URL del logo (ej: http://localhost:3000). */
exports.obtenerComprobanteParaPdf = async (pool, idVenta, idEmpresa, baseUrl = 'http://localhost:3000') => {
  let cabecera;
  try {
    cabecera = await pool
      .request()
      .input('idVenta', sql.Int, idVenta)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT
          v.idVenta, v.compVenta, v.serie, v.numero,
          CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
          v.subtotal, v.igv,
          ISNULL(v.exonerado, 0) AS exonerado,
          ISNULL(v.gratuito, 0) AS gratuito,
          ISNULL(v.otrosCargos, 0) AS otrosCargos,
          ISNULL(v.descuentos, 0) AS descuentos, v.total,
          c.nombre AS nombreComprobante, c.codigo AS codigoComprobante,
          cl.idCliente AS idCliente,
          cl.rSocial AS clienteRazonSocial, cl.ruc AS clienteRuc, cl.idDocumento AS clienteTipoDoc,
          (SELECT TOP 1 ISNULL(direccion, '') FROM DireccionClientes WHERE idCliente = cl.idCliente AND idEmpresa = cl.idEmpresa ORDER BY idDireccionClientes) AS clienteDireccion
        FROM Ventas v
        LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
        WHERE v.idVenta = @idVenta AND v.idEmpresa = @idEmpresa
      `);
  } catch (err) {
    cabecera = await pool
      .request()
      .input('idVenta', sql.Int, idVenta)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT
          v.idVenta, v.compVenta, v.serie, v.numero,
          CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
          v.subtotal, v.igv, ISNULL(v.descuentos, 0) AS descuentos, v.total,
          c.nombre AS nombreComprobante, c.codigo AS codigoComprobante,
          cl.idCliente AS idCliente,
          cl.rSocial AS clienteRazonSocial, cl.ruc AS clienteRuc, cl.idDocumento AS clienteTipoDoc,
          (SELECT TOP 1 ISNULL(direccion, '') FROM DireccionClientes WHERE idCliente = cl.idCliente AND idEmpresa = cl.idEmpresa ORDER BY idDireccionClientes) AS clienteDireccion
        FROM Ventas v
        LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
        WHERE v.idVenta = @idVenta AND v.idEmpresa = @idEmpresa
      `);
  }

  let empresaResult;
  try {
    empresaResult = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT e.razon_Social AS nombre, e.ruc, e.Logo AS logoArchivo,
          ISNULL(e.rubro, '') AS rubro,
          ISNULL(e.celular, '') AS celular,
          ISNULL(e.correo, '') AS correo,
          ISNULL(de.direccion, '') AS direccion
        FROM Empresas e
        LEFT JOIN DireccionEmpresa de ON e.idEmpresa = de.idEmpresa AND de.principal = 1
        WHERE e.idEmpresa = @idEmpresa
      `);
  } catch (err) {
    empresaResult = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT razon_Social AS nombre, ruc, Logo AS logoArchivo
        FROM Empresas WHERE idEmpresa = @idEmpresa
      `);
  }
  const empresa = empresaResult;

  const items = await pool
    .request()
    .input('idVenta', sql.Int, idVenta)
    .query(`
      SELECT dv.cantidad, dv.pVenta, dv.subtotal, dv.total, p.descripcion
      FROM DetalleVenta dv
      INNER JOIN Productos p ON p.idProducto = dv.idProducto
      WHERE dv.idVenta = @idVenta
    `);

  const hashResult = await pool
    .request()
    .input('idVenta', sql.Int, idVenta)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT TOP 1 hash AS resumenHash FROM ComprobantesElectronicos
      WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
    `);

  const cab = cabecera.recordset && cabecera.recordset[0] ? cabecera.recordset[0] : null;
  const emp = empresaResult.recordset && empresaResult.recordset[0] ? empresaResult.recordset[0] : null;
  const detalle = items.recordset || [];
  const hashRow = hashResult.recordset && hashResult.recordset[0] ? hashResult.recordset[0] : null;
  const resumenHash = hashRow && (hashRow.resumenHash || hashRow.resumenhash) ? String(hashRow.resumenHash || hashRow.resumenhash).trim() : '';

  if (!cab) return null;

  let clienteDireccion = (cab.clienteDireccion != null && String(cab.clienteDireccion).trim() !== '') ? String(cab.clienteDireccion).trim() : '';
  if (!clienteDireccion && cab.idCliente != null) {
    try {
      const dirClienteResult = await pool
        .request()
        .input('idCliente', sql.Int, cab.idCliente)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`SELECT TOP 1 ISNULL(direccion, '') AS direccion FROM DireccionClientes WHERE idCliente = @idCliente AND idEmpresa = @idEmpresa ORDER BY idDireccionClientes`);
      const dirRow = dirClienteResult.recordset && dirClienteResult.recordset[0];
      if (dirRow && dirRow.direccion) clienteDireccion = String(dirRow.direccion).trim();
    } catch (_) {}
  }

  const base = (baseUrl || '').replace(/\/$/, '');
  const logoFileName = emp && (
    emp.logoArchivo ?? emp.logoarchivo ?? emp.logo ?? emp.Logo ?? ''
  );
  const logoFile = typeof logoFileName === 'string' && String(logoFileName).trim() !== '';
  const logoUrl = logoFile ? `${base}/logos/${String(logoFileName).trim()}` : `${base}/assets/img/01.jpg`;

  const tipoDocCliente = cab.clienteTipoDoc != null ? String(cab.clienteTipoDoc).trim() : '';
  const tipoDocSunat = (tipoDocCliente === '6' || (cab.clienteRuc && String(cab.clienteRuc).length === 11)) ? '6' : '1';

  const exonerado = cab.exonerado != null ? Number(cab.exonerado) : 0;
  const gratuito = cab.gratuito != null ? Number(cab.gratuito) : 0;
  const otrosCargos = cab.otrosCargos != null ? Number(cab.otrosCargos) : 0;

  const empresaPayload = emp
    ? {
        nombre: emp.nombre,
        ruc: emp.ruc,
        direccion: (emp.direccion != null && String(emp.direccion).trim()) ? String(emp.direccion).trim() : '',
        telefono: (emp.celular != null && String(emp.celular).trim()) ? String(emp.celular).trim() : '',
        rubro: (emp.rubro != null && String(emp.rubro).trim()) ? String(emp.rubro).trim() : '',
        correo: (emp.correo != null && String(emp.correo).trim()) ? String(emp.correo).trim() : '',
        logo: logoUrl
      }
    : { nombre: '', ruc: '', direccion: '', telefono: '', rubro: '', correo: '', logo: `${base}/assets/img/01.jpg` };

  // #region agent log
  try {
    const fs = require('fs');
    const logLine = JSON.stringify({
      hypothesisId: 'H1',
      location: 'ventas.repository.js:obtenerComprobanteParaPdf',
      message: 'Backend empresa logo',
      data: { logoUrl, logoFileName: String(logoFileName), base, hasEmp: !!emp },
      timestamp: Date.now()
    }) + '\n';
    fs.appendFileSync('c:\\project172026\\.cursor\\debug.log', logLine);
  } catch (_) {}
  // #endregion

  return {
    venta: {
      compVenta: cab.compVenta,
      nombreComprobante: cab.nombreComprobante,
      codigoComprobante: cab.codigoComprobante != null ? String(cab.codigoComprobante).trim() : '01',
      fEmision: cab.fEmision,
      subtotal: cab.subtotal,
      igv: cab.igv,
      exonerado,
      gratuito,
      otrosCargos,
      descuentos: cab.descuentos,
      total: cab.total,
      resumenHash
    },
    empresa: empresaPayload,
    cliente: {
      rSocial: cab.clienteRazonSocial,
      razonSocial: cab.clienteRazonSocial,
      ruc: cab.clienteRuc,
      direccion: clienteDireccion,
      tipoDocSunat: tipoDocSunat
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