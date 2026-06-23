// repositories/cotizaciones.repository.js
const sql = require('mssql');

/** Valida y retorna idSucursal para BD: si es UUID válido se usa; si no, null (el servicio debe proveer uno). */
function toIdSucursalUniqueIdentifier(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return uuidRegex.test(s) ? s : null;
}

async function sucursalPerteneceAEmpresa(transaction, idEmpresa, idSucursal) {
  if (!idEmpresa || !idSucursal) return false;
  const rs = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .query('SELECT 1 AS ok FROM Sucursal WHERE idEmpresa = @idEmpresa AND idSucursal = @idSucursal');
  return !!rs.recordset?.[0]?.ok;
}

/**
 * ctx: Transaction o ConnectionPool.
 * Válido si el cliente pertenece a idEmpresa o a una empresa que esa idEmpresa gestiona (gestora → hija).
 * idCliente es PK global en Clientes; no exigir cl.idEmpresa = cabecera.idEmpresa (fallaba en cotizaciones de gestora).
 */
exports.clientePerteneceAEmpresa = async (ctx, idEmpresa, idCliente) => {
  const id = Number(idCliente);
  if (!Number.isFinite(id) || id < 1) return false;
  if (!idEmpresa) return false;
  const rCl = await ctx
    .request()
    .input('idCliente', sql.Int, id)
    .query('SELECT idEmpresa FROM Clientes WHERE idCliente = @idCliente');
  const row = rCl.recordset && rCl.recordset[0];
  if (!row || !row.idEmpresa) return false;
  const empCli = row.idEmpresa;
  if (String(empCli).toLowerCase() === String(idEmpresa).toLowerCase()) return true;
  const rGe = await ctx
    .request()
    .input('idOrigen', sql.UniqueIdentifier, idEmpresa)
    .input('idDestino', sql.UniqueIdentifier, empCli)
    .query(`
      SELECT 1 AS ok
      FROM Gestores_Empresas
      WHERE idEmpresaOrigen = @idOrigen AND idEmpresaDestino = @idDestino AND estado = 1
    `);
  return !!(rGe.recordset && rGe.recordset[0] && rGe.recordset[0].ok);
};

/** Sucursal de la empresa con más stock en Lotes para el producto; si no hay, null. */
async function obtenerSucursalPreferenteLotes(transaction, idEmpresa, idProducto) {
  if (!idEmpresa || !idProducto) return null;
  const rs = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      SELECT TOP 1 idSucursal
      FROM (
        SELECT idSucursal, SUM(cantidadDisponible) AS qty
        FROM Lotes
        WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto AND cantidadDisponible > 0
        GROUP BY idSucursal
      ) x
      ORDER BY x.qty DESC
    `);
  return rs.recordset?.[0]?.idSucursal || null;
}

/**
 * Obtiene el primer idSucursal de la empresa (para BD con idSucursal UNIQUEIDENTIFIER).
 * Debe ejecutarse dentro de una transacción.
 */
exports.obtenerPrimeraSucursalPorEmpresa = async (transaction, idEmpresa) => {
  const result = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT TOP 1 idSucursal FROM Sucursal WHERE idEmpresa = @idEmpresa');
  const row = result.recordset && result.recordset[0];
  return row && row.idSucursal != null ? row.idSucursal : null;
};

/**
 * Obtiene y reserva el siguiente número para el comprobante (incrementa en BD).
 * Debe ejecutarse dentro de una transacción.
 */
exports.obtenerSiguienteNumero = async (transaction, idEmpresa, idComprobante) => {
  const result = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idComprobante', sql.Int, idComprobante)
    .query(`
      UPDATE Comprobantes
      SET numero = ISNULL(numero, 0) + 1
      OUTPUT INSERTED.numero
      WHERE idEmpresa = @idEmpresa AND idComprobante = @idComprobante
    `);
  const row = result.recordset && result.recordset[0];
  const num = row && row.numero != null ? Number(row.numero) : 1;
  return String(num).padStart(8, '0');
};

exports.insertar = async (transaction, datosCabecera, idEmpresa, idUsuario) => {
  const {
    idComprobante,
    serie,
    numero,
    serieNumero,
    fEmision,
    fVencimiento,
    idDocumento,
    idCliente,
    moneda,
    idCondicionPago,
    total,
    esCotizacionAgrupada
  } = datosCabecera;

  const esAgrupada = esCotizacionAgrupada === true || esCotizacionAgrupada === 1;

  const result = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('serieNumero', sql.VarChar(13), serieNumero || (serie + '-' + numero))
    .input('idComprobante', sql.Int, idComprobante)
    .input('serie', sql.VarChar(4), (serie != null ? String(serie) : '').substring(0, 4))
    .input('numero', sql.VarChar(8), (numero != null ? String(numero) : '').substring(0, 8))
    .input('fEmision', sql.VarChar(10), fEmision ? String(fEmision).substring(0, 10) : null)
    .input('fVencimiento', sql.VarChar(10), fVencimiento ? String(fVencimiento).substring(0, 10) : null)
    .input('idDocumento', sql.VarChar(1), idDocumento != null ? String(idDocumento).substring(0, 1) : '1')
    .input('idCliente', sql.Int, idCliente)
    .input('moneda', sql.VarChar(20), moneda || null)
    .input('idCondicionPago', sql.Int, idCondicionPago || null)
    .input('total', sql.Decimal(18, 2), total != null ? total : 0)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('esCotizacionAgrupada', sql.Bit, esAgrupada ? 1 : 0)
    .query(`
      INSERT INTO Cotizaciones (idEmpresa, serieNumero, idComprobante, serie, numero, fEmision, fVencimiento, idDocumento, idCliente, moneda, idCondicionPago, total, idUsuario, esCotizacionAgrupada)
      OUTPUT INSERTED.idCotizacion
      VALUES (@idEmpresa, @serieNumero, @idComprobante, @serie, @numero, @fEmision, @fVencimiento, @idDocumento, @idCliente, @moneda, @idCondicionPago, @total, @idUsuario, @esCotizacionAgrupada)
    `);
  return result;
};

exports.insertarDetalle = async (transaction, idCotizacion, idEmpresa, items, idSucursalDefault = null) => {
  const defaultSucursal = toIdSucursalUniqueIdentifier(idSucursalDefault);
  for (const it of items) {
    const cantidad = it.cantidad != null ? Number(it.cantidad) : 0;
    const pVenta = it.pVenta != null ? Number(it.pVenta) : 0;
    const subtotal = it.subtotal != null ? Number(it.subtotal) : cantidad * pVenta;
    const total = it.total != null ? Number(it.total) : subtotal;
    const descuento = it.descuento != null ? Number(it.descuento) : 0;
    const igv = it.igv != null ? Number(it.igv) : 0;
    const isc = it.isc != null ? Number(it.isc) : 0;
    const idProductoLinea = toIdSucursalUniqueIdentifier(it.idProducto);
    const idEmpresaProductoLinea = toIdSucursalUniqueIdentifier(it.idEmpresaProducto);
    const aliasEmpresaLinea = it.aliasEmpresa != null ? String(it.aliasEmpresa).substring(0, 10) : null;
    let idSucursalLinea = toIdSucursalUniqueIdentifier(it.idSucursal);
    const empCab = String(idEmpresa).toLowerCase();
    const empProd = idEmpresaProductoLinea ? String(idEmpresaProductoLinea).toLowerCase() : '';
    if (idEmpresaProductoLinea && idProductoLinea && empProd !== empCab) {
      const okSuc = idSucursalLinea && (await sucursalPerteneceAEmpresa(transaction, idEmpresaProductoLinea, idSucursalLinea));
      if (!okSuc) {
        idSucursalLinea =
          (await obtenerSucursalPreferenteLotes(transaction, idEmpresaProductoLinea, idProductoLinea)) ||
          (await exports.obtenerPrimeraSucursalPorEmpresa(transaction, idEmpresaProductoLinea));
      }
    } else if (!idSucursalLinea) {
      idSucursalLinea = defaultSucursal;
    }
    if (!idSucursalLinea) {
      idSucursalLinea = defaultSucursal;
    }
    await transaction.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idCotizacion', sql.Int, idCotizacion)
      .input('cantidad', sql.Decimal(18, 3), cantidad)
      .input('codigo', sql.VarChar(50), (it.codigo != null ? String(it.codigo) : '').substring(0, 50))
      .input('descripcion', sql.VarChar(200), (it.descripcion != null ? String(it.descripcion) : '').substring(0, 200))
      .input('idPresentacion', sql.Int, it.idPresentacion != null ? it.idPresentacion : 1)
      .input('pVenta', sql.Decimal(18, 5), pVenta)
      .input('descuentos', sql.Decimal(18, 2), descuento)
      .input('igv', sql.Decimal(18, 2), igv)
      .input('ISC', sql.Decimal(18, 2), isc)
      .input('total', sql.Decimal(18, 2), total)
      .input('idSucursal', sql.UniqueIdentifier, idSucursalLinea)
      .input('hVenta', sql.VarChar(10), null)
      .input('idProducto', sql.UniqueIdentifier, idProductoLinea)
      .input('idEmpresaProducto', sql.UniqueIdentifier, idEmpresaProductoLinea)
      .input('aliasEmpresa', sql.VarChar(10), aliasEmpresaLinea)
      .query(`
        INSERT INTO DetalleCotizacion (idEmpresa, idCotizacion, cantidad, codigo, descripcion, idPresentacion, pVenta, descuentos, igv, ISC, total, idSucursal, hVenta, idProducto, idEmpresaProducto, aliasEmpresa)
        VALUES (@idEmpresa, @idCotizacion, @cantidad, @codigo, @descripcion, @idPresentacion, @pVenta, @descuentos, @igv, @ISC, @total, @idSucursal, @hVenta, @idProducto, @idEmpresaProducto, @aliasEmpresa)
      `);
  }
};

exports.actualizarNumeroComprobante = async (transaction, idEmpresa, idComprobante, numeroUsado) => {
  const num = parseInt(String(numeroUsado || '0').replace(/^0+/, '') || '0', 10);
  if (isNaN(num) || num < 0) return;
  await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idComprobante', sql.Int, idComprobante)
    .input('numero', sql.Int, num)
    .query('UPDATE Comprobantes SET numero = @numero WHERE idEmpresa = @idEmpresa AND idComprobante = @idComprobante');
};

exports.listarConFiltros = async (pool, idEmpresa, filtros = {}) => {
  const { fechaDesde, fechaHasta, idCliente, serie, numero } = filtros;
  let where = ' WHERE c.idEmpresa = @idEmpresa';
  const request = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);

  if (fechaDesde) {
    where += ' AND CONVERT(date, c.fEmision) >= @fechaDesde';
    request.input('fechaDesde', sql.Date, fechaDesde);
  }
  if (fechaHasta) {
    where += ' AND CONVERT(date, c.fEmision) <= @fechaHasta';
    request.input('fechaHasta', sql.Date, fechaHasta);
  }
  if (idCliente != null && idCliente !== '') {
    where += ' AND c.idCliente = @idCliente';
    request.input('idCliente', sql.Int, idCliente);
  }
  if (serie) {
    where += ' AND c.serie = @serie';
    request.input('serie', sql.VarChar(4), String(serie).substring(0, 4));
  }
  if (numero) {
    where += ' AND c.numero = @numero';
    request.input('numero', sql.VarChar(8), String(numero).substring(0, 8));
  }

  const result = await request.query(`
    SELECT
      c.idCotizacion,
      c.serieNumero,
      c.serie,
      c.numero,
      c.fEmision,
      c.fVencimiento,
      c.total,
      c.idCliente,
      cl.rSocial AS clienteRazonSocial,
      cl.ruc AS clienteRuc,
      comp.nombre AS nombreComprobante,
      comp.codigo AS codigoComprobante,
      ISNULL(c.esCotizacionAgrupada, 0) AS esCotizacionAgrupada
    FROM Cotizaciones c
    LEFT JOIN Clientes cl ON cl.idCliente = c.idCliente
    LEFT JOIN Comprobantes comp ON comp.idComprobante = c.idComprobante AND comp.idEmpresa = c.idEmpresa
    ${where}
    ORDER BY c.idCotizacion DESC
  `);
  return result.recordset || [];
};

exports.obtenerPorId = async (pool, idCotizacion, idEmpresa) => {
  const cab = await pool.request()
    .input('idCotizacion', sql.Int, idCotizacion)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        c.idCotizacion, c.serieNumero, c.idComprobante, c.serie, c.numero,
        c.fEmision, c.fVencimiento, c.idDocumento, c.idCliente, c.moneda, c.idCondicionPago, c.total,
        ISNULL(c.esCotizacionAgrupada, 0) AS esCotizacionAgrupada,
        cl.rSocial AS clienteRazonSocial, cl.ruc AS clienteRuc,
        comp.nombre AS nombreComprobante, comp.codigo AS codigoComprobante
      FROM Cotizaciones c
      LEFT JOIN Clientes cl ON cl.idCliente = c.idCliente
      LEFT JOIN Comprobantes comp ON comp.idComprobante = c.idComprobante AND comp.idEmpresa = c.idEmpresa
      WHERE c.idCotizacion = @idCotizacion AND c.idEmpresa = @idEmpresa
    `);
  const det = await pool.request()
    .input('idCotizacion', sql.Int, idCotizacion)
    .query(`
      SELECT idDetalleCotizacion, cantidad, codigo, descripcion, idPresentacion, pVenta, descuentos, igv, ISC, total, idSucursal,
             idProducto, idEmpresaProducto, aliasEmpresa
      FROM DetalleCotizacion
      WHERE idCotizacion = @idCotizacion
      ORDER BY idDetalleCotizacion
    `);
  return {
    cabecera: cab.recordset && cab.recordset[0] ? cab.recordset[0] : null,
    detalles: det.recordset || []
  };
};

/**
 * Cotización con detalles listos para venta: idProducto persistido o resuelto por código (empresa cabecera).
 */
exports.obtenerParaVenta = async (pool, idCotizacion, idEmpresa) => {
  const cab = await pool.request()
    .input('idCotizacion', sql.Int, idCotizacion)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        c.idCotizacion, c.serieNumero, c.idComprobante, c.serie, c.numero,
        c.fEmision, c.fVencimiento, c.idDocumento, c.idCliente, c.moneda, c.idCondicionPago, c.total,
        ISNULL(c.esCotizacionAgrupada, 0) AS esCotizacionAgrupada,
        cl.rSocial AS clienteRazonSocial, cl.ruc AS clienteRuc,
        comp.nombre AS nombreComprobante, comp.codigo AS codigoComprobante
      FROM Cotizaciones c
      LEFT JOIN Clientes cl ON cl.idCliente = c.idCliente
      LEFT JOIN Comprobantes comp ON comp.idComprobante = c.idComprobante AND comp.idEmpresa = c.idEmpresa
      WHERE c.idCotizacion = @idCotizacion AND c.idEmpresa = @idEmpresa
    `);
  const cabecera = cab.recordset && cab.recordset[0] ? cab.recordset[0] : null;
  if (!cabecera) return null;
  const det = await pool.request()
    .input('idCotizacion', sql.Int, idCotizacion)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT d.idDetalleCotizacion, d.cantidad, d.codigo, d.descripcion, d.idPresentacion, d.pVenta, d.descuentos, d.igv, d.ISC, d.total, d.idSucursal,
             d.idEmpresaProducto,
             ISNULL(d.aliasEmpresa, '') AS aliasEmpresa,
             ISNULL(s.nombre, '') AS nombreSucursal,
             COALESCE(pPorId.idProducto, pPorCodigoEmp.idProducto, pPorCodigo.idProducto, codigoEnRed.idProductoMatch, d.idProducto) AS idProducto,
             ISNULL(pr.codigo, '') AS codigoPresentacion,
             ISNULL(mRes.nombre, '') AS marca
      FROM DetalleCotizacion d
      LEFT JOIN Sucursal s ON s.idSucursal = d.idSucursal
      LEFT JOIN Productos pPorId ON pPorId.idProducto = d.idProducto
      LEFT JOIN Productos pPorCodigoEmp ON d.idProducto IS NULL
        AND d.idEmpresaProducto IS NOT NULL
        AND pPorCodigoEmp.idEmpresa = d.idEmpresaProducto
        AND RTRIM(LTRIM(ISNULL(pPorCodigoEmp.codigo, ''))) = RTRIM(LTRIM(ISNULL(d.codigo, '')))
      LEFT JOIN Productos pPorCodigo ON d.idProducto IS NULL AND d.idEmpresaProducto IS NULL
        AND pPorCodigo.idEmpresa = @idEmpresa
        AND RTRIM(LTRIM(ISNULL(pPorCodigo.codigo, ''))) = RTRIM(LTRIM(ISNULL(d.codigo, '')))
      OUTER APPLY (
        SELECT TOP 1 p.idProducto AS idProductoMatch
        FROM Productos p
        INNER JOIN Gestores_Empresas ge ON ge.idEmpresaDestino = p.idEmpresa
          AND ge.idEmpresaOrigen = @idEmpresa AND ge.estado = 1
        WHERE d.idProducto IS NULL
          AND d.idEmpresaProducto IS NULL
          AND RTRIM(LTRIM(ISNULL(p.codigo, ''))) = RTRIM(LTRIM(ISNULL(d.codigo, '')))
        ORDER BY p.idProducto
      ) codigoEnRed
      LEFT JOIN Presentacion pr ON pr.idPresentacion = d.idPresentacion
      LEFT JOIN Productos prodRes ON prodRes.idProducto = COALESCE(
        pPorId.idProducto, pPorCodigoEmp.idProducto, pPorCodigo.idProducto, codigoEnRed.idProductoMatch, d.idProducto
      )
      LEFT JOIN Marcas mRes ON mRes.idMarca = prodRes.idMarca
      WHERE d.idCotizacion = @idCotizacion
      ORDER BY d.idDetalleCotizacion
    `);
  const detalles = (det.recordset || []).map(row => ({
    idDetalleCotizacion: row.idDetalleCotizacion,
    idProducto: row.idProducto != null ? String(row.idProducto) : null,
    idEmpresaProducto: row.idEmpresaProducto,
    aliasEmpresa: row.aliasEmpresa != null ? String(row.aliasEmpresa).trim() : '',
    codigo: row.codigo,
    descripcion: row.descripcion,
    codigoPresentacion: row.codigoPresentacion || '',
    idPresentacion: row.idPresentacion,
    cantidad: row.cantidad,
    pVenta: row.pVenta,
    descuentos: row.descuentos,
    igv: row.igv,
    ISC: row.ISC,
    total: row.total,
    idSucursal: row.idSucursal,
    nombreSucursal: row.nombreSucursal != null ? String(row.nombreSucursal).trim() : '',
    marca: row.marca != null ? String(row.marca).trim() : ''
  }));
  return { cabecera, detalles };
};

exports.actualizar = async (transaction, idCotizacion, datosCabecera, idEmpresa) => {
  const {
    serie,
    numero,
    serieNumero,
    fEmision,
    fVencimiento,
    idDocumento,
    idCliente,
    moneda,
    idCondicionPago,
    total,
    esCotizacionAgrupada
  } = datosCabecera;

  const esAgrupada =
    esCotizacionAgrupada === true ||
    esCotizacionAgrupada === 1 ||
    esCotizacionAgrupada === '1' ||
    String(esCotizacionAgrupada || '').toLowerCase() === 'true';

  await transaction.request()
    .input('idCotizacion', sql.Int, idCotizacion)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('serieNumero', sql.VarChar(13), serieNumero || (serie + '-' + numero))
    .input('serie', sql.VarChar(4), (serie != null ? String(serie) : '').substring(0, 4))
    .input('numero', sql.VarChar(8), (numero != null ? String(numero) : '').substring(0, 8))
    .input('fEmision', sql.VarChar(10), fEmision ? String(fEmision).substring(0, 10) : null)
    .input('fVencimiento', sql.VarChar(10), fVencimiento ? String(fVencimiento).substring(0, 10) : null)
    .input('idDocumento', sql.VarChar(1), idDocumento != null ? String(idDocumento).substring(0, 1) : '1')
    .input('idCliente', sql.Int, idCliente)
    .input('moneda', sql.VarChar(20), moneda || null)
    .input('idCondicionPago', sql.Int, idCondicionPago || null)
    .input('total', sql.Decimal(18, 2), total != null ? total : 0)
    .input('esCotizacionAgrupada', sql.Bit, esAgrupada ? 1 : 0)
    .query(`
      UPDATE Cotizaciones
      SET serieNumero = @serieNumero, serie = @serie, numero = @numero, fEmision = @fEmision, fVencimiento = @fVencimiento,
          idDocumento = @idDocumento, idCliente = @idCliente, moneda = @moneda, idCondicionPago = @idCondicionPago, total = @total,
          esCotizacionAgrupada = @esCotizacionAgrupada
      WHERE idCotizacion = @idCotizacion AND idEmpresa = @idEmpresa
    `);
};

exports.eliminarDetalle = async (transaction, idCotizacion) => {
  await transaction.request()
    .input('idCotizacion', sql.Int, idCotizacion)
    .query('DELETE FROM DetalleCotizacion WHERE idCotizacion = @idCotizacion');
};

exports.eliminar = async (transaction, idCotizacion, idEmpresa) => {
  await exports.eliminarDetalle(transaction, idCotizacion);
  await transaction.request()
    .input('idCotizacion', sql.Int, idCotizacion)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('DELETE FROM Cotizaciones WHERE idCotizacion = @idCotizacion AND idEmpresa = @idEmpresa');
};

/**
 * Datos para PDF: misma estructura que ventas.repository obtenerComprobanteParaPdf
 * (empresa, venta/cabecera, cliente, items).
 */
exports.obtenerParaPdf = async (pool, idCotizacion, idEmpresa, baseUrl = 'http://localhost:3000') => {
  const cabecera = await pool.request()
    .input('idCotizacion', sql.Int, idCotizacion)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        c.idCotizacion AS idVenta,
        c.serieNumero AS compVenta,
        c.serie, c.numero,
        c.fEmision,
        c.total,
        c.idCliente,
        cl.idEmpresa AS clienteIdEmpresa,
        cl.rSocial AS clienteRazonSocial, cl.ruc AS clienteRuc, cl.idDocumento AS clienteTipoDoc,
        ISNULL(cl.celular, '') AS clienteCelular,
        (SELECT TOP 1 ISNULL(direccion, '') FROM DireccionClientes WHERE idCliente = cl.idCliente AND idEmpresa = cl.idEmpresa ORDER BY idDireccionClientes) AS clienteDireccion,
        comp.nombre AS nombreComprobante, comp.codigo AS codigoComprobante
      FROM Cotizaciones c
      LEFT JOIN Comprobantes comp ON comp.idComprobante = c.idComprobante AND comp.idEmpresa = c.idEmpresa
      LEFT JOIN Clientes cl ON cl.idCliente = c.idCliente
      WHERE c.idCotizacion = @idCotizacion AND c.idEmpresa = @idEmpresa
    `);

  const cab = cabecera.recordset && cabecera.recordset[0] ? cabecera.recordset[0] : null;
  if (!cab) return null;

  const empresaResult = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT e.razon_Social AS nombre, e.ruc, e.Logo AS logoArchivo,
        ISNULL(e.rubro, '') AS rubro, ISNULL(e.celular, '') AS celular, ISNULL(e.correo, '') AS correo,
        ISNULL(de.direccion, '') AS direccion
      FROM Empresas e
      LEFT JOIN DireccionEmpresa de ON e.idEmpresa = de.idEmpresa AND de.principal = 1
      WHERE e.idEmpresa = @idEmpresa
    `);

  const items = await pool.request()
    .input('idCotizacion', sql.Int, idCotizacion)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        d.cantidad,
        d.pVenta,
        d.total,
        d.codigo,
        CASE
          WHEN NULLIF(LTRIM(RTRIM(ISNULL(d.descripcion, ''))), '') IS NOT NULL
          THEN LTRIM(RTRIM(d.descripcion))
          ELSE LTRIM(RTRIM(ISNULL(COALESCE(pPorId.descripcion, pPorCodigo.descripcion), '')))
        END AS descripcion,
        LTRIM(RTRIM(ISNULL(COALESCE(pPorId.descripcion, pPorCodigo.descripcion), ''))) AS descripcionProducto,
        LTRIM(RTRIM(ISNULL(m.nombre, ''))) AS marca,
        LTRIM(RTRIM(ISNULL(pr.descripcion, ''))) AS presentacion,
        LTRIM(RTRIM(ISNULL(pr.codigo, ''))) AS presentacionCodigo
      FROM DetalleCotizacion d
      LEFT JOIN Productos pPorId ON pPorId.idProducto = d.idProducto
      LEFT JOIN Productos pPorCodigo ON d.idProducto IS NULL
        AND pPorCodigo.idEmpresa = COALESCE(d.idEmpresaProducto, d.idEmpresa)
        AND RTRIM(LTRIM(ISNULL(pPorCodigo.codigo, ''))) = RTRIM(LTRIM(ISNULL(d.codigo, '')))
      LEFT JOIN Marcas m ON m.idMarca = COALESCE(pPorId.idMarca, pPorCodigo.idMarca)
      LEFT JOIN Presentacion pr ON pr.idPresentacion = COALESCE(
        CASE WHEN ISNULL(d.idPresentacion, 0) > 1 THEN d.idPresentacion END,
        pPorId.idPresentacion,
        pPorCodigo.idPresentacion,
        NULLIF(d.idPresentacion, 0),
        1
      )
      WHERE d.idCotizacion = @idCotizacion
      ORDER BY d.idDetalleCotizacion
    `);

  const emp = empresaResult.recordset && empresaResult.recordset[0] ? empresaResult.recordset[0] : null;
  let clienteDireccion = (cab.clienteDireccion != null && String(cab.clienteDireccion).trim() !== '') ? String(cab.clienteDireccion).trim() : '';
  const idEmpresaDirCliente =
    cab.clienteIdEmpresa != null ? cab.clienteIdEmpresa : idEmpresa;
  if (!clienteDireccion && cab.idCliente != null && idEmpresaDirCliente != null) {
    try {
      const dirResult = await pool.request()
        .input('idCliente', sql.Int, cab.idCliente)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresaDirCliente)
        .query('SELECT TOP 1 ISNULL(direccion, \'\') AS direccion FROM DireccionClientes WHERE idCliente = @idCliente AND idEmpresa = @idEmpresa ORDER BY idDireccionClientes');
      const dirRow = dirResult.recordset && dirResult.recordset[0];
      if (dirRow && dirRow.direccion) clienteDireccion = String(dirRow.direccion).trim();
    } catch (_) {}
  }

  const base = (baseUrl || '').replace(/\/$/, '');
  const logoFileName = emp && (emp.logoArchivo ?? emp.logoarchivo ?? '');
  const logoUrl = (typeof logoFileName === 'string' && String(logoFileName).trim() !== '')
    ? `${base}/logos/${String(logoFileName).trim()}`
    : `${base}/assets/img/01.jpg`;

  const tipoDocCliente = cab.clienteTipoDoc != null ? String(cab.clienteTipoDoc).trim() : '';
  const tipoDocSunat = (tipoDocCliente === '6' || (cab.clienteRuc && String(cab.clienteRuc).length === 11)) ? '6' : '1';

  const empresaPayload = emp ? {
    nombre: emp.nombre,
    ruc: emp.ruc,
    direccion: (emp.direccion != null && String(emp.direccion).trim()) ? String(emp.direccion).trim() : '',
    telefono: (emp.celular != null && String(emp.celular).trim()) ? String(emp.celular).trim() : '',
    rubro: (emp.rubro != null && String(emp.rubro).trim()) ? String(emp.rubro).trim() : '',
    correo: (emp.correo != null && String(emp.correo).trim()) ? String(emp.correo).trim() : '',
    logo: logoUrl
  } : { nombre: '', ruc: '', direccion: '', telefono: '', rubro: '', correo: '', logo: `${base}/assets/img/01.jpg` };

  const detalle = (items.recordset || []).map((d) => ({
    descripcion: d.descripcion != null ? String(d.descripcion).trim() : '',
    descripcionProducto: d.descripcionProducto != null ? String(d.descripcionProducto).trim() : '',
    codigo: d.codigo != null ? String(d.codigo).trim() : '',
    marca: d.marca != null ? String(d.marca).trim() : '',
    presentacion: d.presentacion != null ? String(d.presentacion).trim() : '',
    presentacionCodigo: d.presentacionCodigo != null ? String(d.presentacionCodigo).trim() : '',
    cantidad: d.cantidad,
    pVenta: d.pVenta,
    subtotal: d.total,
    total: d.total
  }));

  return {
    venta: {
      compVenta: cab.compVenta,
      nombreComprobante: cab.nombreComprobante || 'Cotización',
      codigoComprobante: (cab.codigoComprobante != null ? String(cab.codigoComprobante).trim() : '') || 'CT',
      fEmision: cab.fEmision,
      subtotal: cab.total,
      igv: 0,
      exonerado: 0,
      gratuito: 0,
      otrosCargos: 0,
      descuentos: 0,
      total: cab.total,
      resumenHash: ''
    },
    empresa: empresaPayload,
    cliente: {
      rSocial: cab.clienteRazonSocial,
      razonSocial: cab.clienteRazonSocial,
      ruc: cab.clienteRuc,
      celular: (cab.clienteCelular != null && String(cab.clienteCelular).trim() !== '') ? String(cab.clienteCelular).trim() : '',
      direccion: clienteDireccion,
      tipoDocSunat: tipoDocSunat
    },
    items: detalle
  };
};
