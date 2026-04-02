// repositories/inventario.repository.js
const sql = require('mssql');

/**
 * Inserta una fila en MovimientosInventario (esquema con idProducto y cantidad NOT NULL).
 * Usado cuando la tabla exige idProducto/cantidad por fila (una fila por ítem).
 * Devuelve idMovimiento insertado.
 */
exports.insertarFilaMovimiento = async (transaction, datos) => {
  const {
    idEmpresa,
    idSucursal,
    idProducto,
    tipoMovimiento,
    cantidad,
    docRelacionado,
    idComprobante,
    idUsuario,
    observaciones,
    costoUnitario,
    idLote,
    idGrupoMovimiento,
    codigoTipoMovimiento,
    fMovimiento
  } = datos;
  const result = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('tipoMovimiento', sql.VarChar(2), tipoMovimiento)
    .input('cantidad', sql.Decimal(18, 3), cantidad)
    .input('docRelacionado', sql.VarChar(50), docRelacionado || null)
    .input('idComprobante', sql.Int, idComprobante != null ? idComprobante : null)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('observaciones', sql.VarChar(255), observaciones || null)
    .input('costoUnitario', sql.Decimal(18, 6), costoUnitario != null ? parseFloat(costoUnitario) : null)
    .input('idLote', sql.UniqueIdentifier, idLote || null)
    .input('idGrupoMovimiento', sql.UniqueIdentifier, idGrupoMovimiento || null)
    .input('codigoTipoMovimiento', sql.VarChar(32), codigoTipoMovimiento || null)
    .input('fMovimiento', sql.DateTime, fMovimiento || null)
    .query(`
      INSERT INTO MovimientosInventario (
        idEmpresa, idSucursal, idProducto, tipoMovimiento, cantidad, docRelacionado, idComprobante, idUsuario,
        observaciones, costoUnitario, idLote, idGrupoMovimiento, codigoTipoMovimiento, fMovimiento
      )
      OUTPUT INSERTED.idMovimiento
      VALUES (
        @idEmpresa, @idSucursal, @idProducto, @tipoMovimiento, @cantidad, @docRelacionado, @idComprobante, @idUsuario,
        @observaciones, @costoUnitario, @idLote, @idGrupoMovimiento, @codigoTipoMovimiento, ISNULL(@fMovimiento, GETDATE())
      )
    `);
  return result.recordset && result.recordset[0] ? result.recordset[0].idMovimiento : null;
};

/**
 * Siguiente número de lote para la empresa (inventario inicial / entrada).
 */
exports.obtenerSiguienteNumeroLote = async (transaction, idEmpresa) => {
  const r = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT ISNULL(MAX(TRY_CAST(numeroLote AS INT)), 0) + 1 AS siguiente
      FROM Lotes WHERE idEmpresa = @idEmpresa
    `);
  const v = r.recordset && r.recordset[0] ? r.recordset[0].siguiente : 1;
  return typeof v === 'number' ? v : (parseInt(v, 10) || 1);
};

/**
 * Crea lote sin compra (inventario inicial / entrada varia / reajuste positivo).
 * Opcional: fechaVencimiento, numeroLote, idUbicacionDefault para LotesUbicacion.
 */
exports.crearLoteSinCompra = async (transaction, datos) => {
  const {
    idEmpresa,
    idProducto,
    idSucursal,
    costoUnitario,
    cantidad,
    fechaVencimiento,
    numeroLote,
    idUbicacionDefault
  } = datos;

  const costo = parseFloat(costoUnitario) || 0;
  const cant = parseFloat(cantidad) || 0;
  const numLote = numeroLote != null && numeroLote !== '' ? String(numeroLote) : null;
  const fechaVenc = fechaVencimiento != null && fechaVencimiento !== '' ? fechaVencimiento : null;

  const req = transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('costoUnitario', sql.Decimal(18, 6), costo)
    .input('cantidadIngresada', sql.Decimal(18, 2), cant)
    .input('cantidadDisponible', sql.Decimal(18, 2), cant)
    .input('fechaVencimiento', sql.DateTime, fechaVenc)
    .input('numeroLote', sql.VarChar(50), numLote);

  const result = await req.query(`
    INSERT INTO Lotes (idEmpresa, idProducto, idSucursal, costoUnitario, cantidadIngresada, cantidadDisponible, fechaVencimiento, numeroLote)
    OUTPUT INSERTED.idLote
    VALUES (@idEmpresa, @idProducto, @idSucursal, @costoUnitario, @cantidadIngresada, @cantidadDisponible, @fechaVencimiento, @numeroLote)
  `);
  const idLote = result.recordset && result.recordset[0] ? result.recordset[0].idLote : null;

  if (idLote && idUbicacionDefault && cant > 0) {
    await transaction.request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .input('idUbicacion', sql.Int, idUbicacionDefault)
      .input('cantidad', sql.Decimal(18, 2), Math.round(cant))
      .query('INSERT INTO LotesUbicacion (idLote, idUbicacion, cantidad) VALUES (@idLote, @idUbicacion, @cantidad)');
  }
  return idLote;
};

/**
 * Lista movimientos con filtros (idEmpresa obligatorio).
 * Compatible con esquema donde MovimientosInventario tiene idProducto/cantidad por fila (una fila por ítem).
 */
exports.listarMovimientos = async (pool, filtros) => {
  const { idEmpresa, fechaInicio, fechaFin, idSucursal, tipoMovimiento } = filtros;
  const request = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);

  let tipos = ['EN', 'SA', 'AJ'];
  if (tipoMovimiento && tipoMovimiento !== '') {
    tipos = [String(tipoMovimiento).toUpperCase().substring(0, 2)];
  }
  tipos.forEach((t, i) => request.input(`tipo${i}`, sql.VarChar(2), t));
  const placeholders = tipos.map((_, i) => `@tipo${i}`).join(', ');
  let where = ` AND m.tipoMovimiento IN (${placeholders})`;
  if (fechaInicio) {
    request.input('fechaInicio', sql.DateTime, fechaInicio);
    where += ' AND m.fMovimiento >= @fechaInicio';
  }
  if (fechaFin) {
    request.input('fechaFin', sql.DateTime, fechaFin);
    where += ' AND m.fMovimiento <= @fechaFin';
  }
  if (idSucursal) {
    request.input('idSucursal', sql.UniqueIdentifier, idSucursal);
    where += ' AND m.idSucursal = @idSucursal';
  }

  const result = await request.query(`
    SELECT m.idMovimiento, m.idSucursal, s.nombre AS sucursal, m.tipoMovimiento, m.docRelacionado,
           CONVERT(VARCHAR(19), m.fMovimiento, 120) AS fMovimiento, m.observaciones,
           LTRIM(RTRIM(ISNULL(u.nombres, '') + ' ' + ISNULL(u.apellidos, ''))) AS usuario,
           1 AS totalProductos, m.cantidad AS totalCantidad
    FROM MovimientosInventario m
    INNER JOIN Sucursal s ON m.idSucursal = s.idSucursal
    INNER JOIN UsuarioWeb u ON m.idUsuario = u.idUsuario
    WHERE m.idEmpresa = @idEmpresa ${where}
    ORDER BY m.fMovimiento DESC
  `);
  return result.recordset || [];
};

/** FROM/WHERE/JOIN compartido para resumen de movimientos agrupados. */
function buildMovimientosResumenBaseSql(whereExtra) {
  return `
    FROM MovimientosInventario m
    LEFT JOIN Sucursal s ON s.idSucursal = m.idSucursal AND s.idEmpresa = m.idEmpresa
    LEFT JOIN UsuarioWeb u ON u.idUsuario = m.idUsuario AND u.idEmpresa = m.idEmpresa
    LEFT JOIN Comprobantes comp ON comp.idComprobante = m.idComprobante AND comp.idEmpresa = m.idEmpresa
    WHERE m.idEmpresa = @idEmpresa
      AND UPPER(LTRIM(RTRIM(ISNULL(m.observaciones, '')))) <> N'VENTA'
      ${whereExtra}
  `;
}

/**
 * Cabeceras agrupadas con paginación (OFFSET/FETCH).
 * @returns {Promise<{ items: object[], total: number }>}
 */
exports.listarMovimientosResumen = async (pool, filtros) => {
  const {
    idEmpresa,
    fechaInicio,
    fechaFin,
    idSucursal,
    codigoTipoMovimiento,
    buscar,
    page = 1,
    pageSize = 10
  } = filtros;

  const pagina = Math.max(1, parseInt(String(page), 10) || 1);
  const tamPag = Math.min(100, Math.max(1, parseInt(String(pageSize), 10) || 10));
  const offset = (pagina - 1) * tamPag;

  const request = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);

  let where = '';
  if (fechaInicio) {
    const fd = String(fechaInicio).trim().substring(0, 10);
    request.input('fechaInicio', sql.VarChar(10), fd);
    where += ' AND CAST(m.fMovimiento AS DATE) >= CAST(@fechaInicio AS DATE)';
  }
  if (fechaFin) {
    const fh = String(fechaFin).trim().substring(0, 10);
    request.input('fechaFin', sql.VarChar(10), fh);
    where += ' AND CAST(m.fMovimiento AS DATE) <= CAST(@fechaFin AS DATE)';
  }
  if (idSucursal) {
    request.input('idSucursal', sql.UniqueIdentifier, idSucursal);
    where += ' AND m.idSucursal = @idSucursal';
  }
  if (codigoTipoMovimiento && String(codigoTipoMovimiento).trim()) {
    request.input('codigoTipo', sql.VarChar(32), String(codigoTipoMovimiento).trim());
    where += ' AND m.codigoTipoMovimiento = @codigoTipo';
  }
  const buscarLike = buscar && String(buscar).trim() ? `%${String(buscar).trim()}%` : null;
  if (buscarLike) {
    request.input('buscarLike', sql.NVarChar(400), buscarLike);
    where += ` AND (
      m.docRelacionado LIKE @buscarLike
      OR m.observaciones LIKE @buscarLike
      OR ISNULL(s.nombre, '') LIKE @buscarLike
      OR LTRIM(RTRIM(ISNULL(u.nombres, '') + ' ' + ISNULL(u.apellidos, ''))) LIKE @buscarLike
      OR ISNULL(comp.codigo, '') LIKE @buscarLike
      OR ISNULL(comp.nombre, '') LIKE @buscarLike
    )`;
  }

  const baseFrom = buildMovimientosResumenBaseSql(where);
  const groupExpr = `ISNULL(CONVERT(VARCHAR(36), m.idGrupoMovimiento), CONCAT('ROW', CAST(m.idMovimiento AS VARCHAR(20))))`;

  const countReq = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  if (fechaInicio) {
    const fd = String(fechaInicio).trim().substring(0, 10);
    countReq.input('fechaInicio', sql.VarChar(10), fd);
  }
  if (fechaFin) {
    const fh = String(fechaFin).trim().substring(0, 10);
    countReq.input('fechaFin', sql.VarChar(10), fh);
  }
  if (idSucursal) countReq.input('idSucursal', sql.UniqueIdentifier, idSucursal);
  if (codigoTipoMovimiento && String(codigoTipoMovimiento).trim()) {
    countReq.input('codigoTipo', sql.VarChar(32), String(codigoTipoMovimiento).trim());
  }
  if (buscarLike) countReq.input('buscarLike', sql.NVarChar(400), buscarLike);

  const countSql = `
    SELECT COUNT(*) AS total
    FROM (
      SELECT 1 AS x
      ${baseFrom}
      GROUP BY ${groupExpr}
    ) t
  `;
  const countRes = await countReq.query(countSql);
  const total = countRes.recordset && countRes.recordset[0] ? Number(countRes.recordset[0].total) || 0 : 0;

  request.input('offset', sql.Int, offset);
  request.input('pageSize', sql.Int, tamPag);

  const dataSql = `
    ;WITH Grupos AS (
      SELECT
        MIN(m.idMovimiento) AS idMovimiento,
        MAX(m.idGrupoMovimiento) AS idGrupoMovimiento,
        CONVERT(VARCHAR(10), MAX(m.fMovimiento), 103) AS fecha,
        MAX(CONVERT(VARCHAR(19), m.fMovimiento, 120)) AS fMovimiento,
        MAX(m.fMovimiento) AS fMovimientoOrd,
        MAX(m.tipoMovimiento) AS tipoMovimiento,
        MAX(m.codigoTipoMovimiento) AS codigoTipoMovimiento,
        MAX(m.docRelacionado) AS docRelacionado,
        MAX(m.observaciones) AS observaciones,
        MAX(m.idSucursal) AS idSucursal,
        MAX(ISNULL(s.nombre, '')) AS sucursal,
        MAX(LTRIM(RTRIM(ISNULL(u.nombres, '') + ' ' + ISNULL(u.apellidos, '')))) AS usuario,
        COUNT(*) AS totalLineas,
        CAST(SUM(m.cantidad * ISNULL(m.costoUnitario, 0)) AS DECIMAL(18, 2)) AS totalImporte,
        MAX(ISNULL(RTRIM(comp.codigo), '')) AS compCodigo,
        MAX(ISNULL(comp.nombre, '')) AS compNombre
      ${baseFrom}
      GROUP BY ${groupExpr}
    )
    SELECT
      idMovimiento,
      idGrupoMovimiento,
      fecha,
      fMovimiento,
      tipoMovimiento,
      codigoTipoMovimiento,
      docRelacionado,
      observaciones,
      idSucursal,
      sucursal,
      usuario,
      totalLineas,
      totalImporte,
      compCodigo,
      compNombre
    FROM Grupos
    ORDER BY fMovimientoOrd DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `;

  const result = await request.query(dataSql);
  const items = result.recordset || [];
  return { items, total };
};

/**
 * Todas las líneas de una cabecera (por idMovimiento representativo de la agrupación).
 */
exports.listarLineasMovimientoPorCabecera = async (pool, idEmpresa, idMovimiento) => {
  const req0 = pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idMovimiento', sql.Int, idMovimiento);
  const r0 = await req0.query(`
    SELECT TOP 1 idGrupoMovimiento FROM MovimientosInventario
    WHERE idEmpresa = @idEmpresa AND idMovimiento = @idMovimiento
  `);
  const row0 = r0.recordset && r0.recordset[0] ? r0.recordset[0] : null;
  if (!row0) return [];

  const grupo = row0.idGrupoMovimiento;
  if (grupo) {
    const r = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idGrupo', sql.UniqueIdentifier, grupo)
      .query(`
        SELECT m.idMovimiento, m.idSucursal, s.nombre AS sucursal,
               m.idProducto, m.tipoMovimiento, m.cantidad, m.costoUnitario,
               CONVERT(VARCHAR(19), m.fMovimiento, 120) AS fMovimiento,
               m.docRelacionado, m.observaciones,
               p.codigo AS productoCodigo, p.descripcion AS productoDescripcion
        FROM MovimientosInventario m
        INNER JOIN Sucursal s ON s.idSucursal = m.idSucursal AND s.idEmpresa = m.idEmpresa
        LEFT JOIN Productos p ON m.idProducto = p.idProducto AND p.idEmpresa = m.idEmpresa
        WHERE m.idEmpresa = @idEmpresa AND m.idGrupoMovimiento = @idGrupo
        ORDER BY CASE m.tipoMovimiento WHEN 'SA' THEN 1 WHEN 'EN' THEN 2 WHEN 'AJ' THEN 3 ELSE 4 END,
                 m.idSucursal, m.idMovimiento
      `);
    return r.recordset || [];
  }

  const r2 = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idMovimiento', sql.Int, idMovimiento)
    .query(`
      SELECT m.idMovimiento, m.idSucursal, s.nombre AS sucursal,
             m.idProducto, m.tipoMovimiento, m.cantidad, m.costoUnitario,
             CONVERT(VARCHAR(19), m.fMovimiento, 120) AS fMovimiento,
             m.docRelacionado, m.observaciones,
             p.codigo AS productoCodigo, p.descripcion AS productoDescripcion
      FROM MovimientosInventario m
      INNER JOIN Sucursal s ON s.idSucursal = m.idSucursal AND s.idEmpresa = m.idEmpresa
      LEFT JOIN Productos p ON m.idProducto = p.idProducto AND p.idEmpresa = m.idEmpresa
      WHERE m.idEmpresa = @idEmpresa AND m.idMovimiento = @idMovimiento
      ORDER BY m.idMovimiento
    `);
  return r2.recordset || [];
};

/**
 * Obtiene un movimiento por id (para detalle en modal). Incluye producto si existe.
 */
exports.obtenerMovimientoPorId = async (pool, idEmpresa, idMovimiento) => {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idMovimiento', sql.Int, idMovimiento)
    .query(`
      SELECT m.idMovimiento, m.idSucursal, s.nombre AS sucursal, m.tipoMovimiento, m.docRelacionado,
             CONVERT(VARCHAR(19), m.fMovimiento, 120) AS fMovimiento, m.observaciones,
             LTRIM(RTRIM(ISNULL(u.nombres, '') + ' ' + ISNULL(u.apellidos, ''))) AS usuario,
             m.idProducto, m.cantidad, m.costoUnitario, p.codigo AS productoCodigo, p.descripcion AS productoDescripcion
      FROM MovimientosInventario m
      INNER JOIN Sucursal s ON m.idSucursal = s.idSucursal
      INNER JOIN UsuarioWeb u ON m.idUsuario = u.idUsuario
      LEFT JOIN Productos p ON m.idProducto = p.idProducto
      WHERE m.idEmpresa = @idEmpresa AND m.idMovimiento = @idMovimiento
    `);
  return result.recordset && result.recordset[0] ? result.recordset[0] : null;
};

function construirInClauseUuid(request, ids, prefijo) {
  const params = [];
  (ids || []).forEach((id, index) => {
    const key = `${prefijo}${index}`;
    request.input(key, sql.UniqueIdentifier, id);
    params.push(`@${key}`);
  });
  return params.length > 0 ? params.join(', ') : null;
}

/**
 * Stock actual agregado por producto (suma de Lotes.cantidadDisponible).
 * @param {object} opts
 * @param {string[]} opts.idsEmpresa
 * @param {string|null} opts.idSucursal
 * @param {string|null} opts.categoriaLike - fragmento LIKE
 * @param {string|null} opts.marcaLike
 * @param {string} opts.filtroStock - 'todos' | 'cero' | 'minimo'
 * @param {string|null} opts.buscar - código o descripción
 */
exports.listarStockActual = async (pool, opts) => {
  const ids = (opts.idsEmpresa || []).filter(Boolean);
  if (ids.length === 0) return [];

  const filtroStock = String(opts.filtroStock || 'todos').toLowerCase();
  let stockClause = '1=1';
  if (filtroStock === 'cero') {
    stockClause = 'COALESCE(stk.stock, 0) = 0';
  } else if (filtroStock === 'minimo') {
    stockClause = '(p.alertaMinimo IS NOT NULL AND COALESCE(stk.stock, 0) <= p.alertaMinimo)';
  }

  const request = pool.request();
  const inClause = construirInClauseUuid(request, ids, 'idEmpresaStock');
  if (!inClause) return [];

  const idSucursal = opts.idSucursal && String(opts.idSucursal).trim() ? String(opts.idSucursal).trim() : null;
  if (idSucursal) {
    request.input('idSucursal', sql.UniqueIdentifier, idSucursal);
  }

  const cat = opts.categoriaLike && String(opts.categoriaLike).trim() ? `%${String(opts.categoriaLike).trim()}%` : null;
  const mar = opts.marcaLike && String(opts.marcaLike).trim() ? `%${String(opts.marcaLike).trim()}%` : null;
  const bus = opts.buscar && String(opts.buscar).trim() ? `%${String(opts.buscar).trim()}%` : null;

  if (cat) request.input('catLike', sql.NVarChar(200), cat);
  if (mar) request.input('marLike', sql.NVarChar(200), mar);
  if (bus) request.input('busLike', sql.NVarChar(500), bus);

  const whereSucursal = idSucursal ? 'AND l.idSucursal = @idSucursal' : '';
  const whereCat = cat ? 'AND c.nombre LIKE @catLike' : '';
  const whereBus = bus ? 'AND (p.codigo LIKE @busLike OR p.descripcion LIKE @busLike)' : '';
  const whereMarFixed = mar ? 'AND ISNULL(m.nombre, \'\') LIKE @marLike' : '';

  const result = await request.query(`
    SELECT
      p.idProducto,
      p.idEmpresa,
      p.codigo,
      p.descripcion,
      c.nombre AS categoria,
      ISNULL(m.nombre, '') AS marca,
      ISNULL(NULLIF(LTRIM(RTRIM(pr.descripcion)), ''), pr.codigo) AS unidad,
      CAST(COALESCE(stk.stock, 0) AS DECIMAL(18, 3)) AS stock,
      CAST(p.cUnitario AS DECIMAL(18, 6)) AS cUnitario,
      CAST(p.alertaMinimo AS DECIMAL(18, 2)) AS alertaMinimo,
      ISNULL(e.alias, ISNULL(e.nombreComercial, e.razon_Social)) AS aliasEmpresa,
      CAST(COALESCE(stk.stock, 0) * p.cUnitario AS DECIMAL(18, 6)) AS valorizado
    FROM Productos p
    INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
    LEFT JOIN Marcas m ON p.idMarca = m.idMarca
    INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
    INNER JOIN Empresas e ON p.idEmpresa = e.idEmpresa
    LEFT JOIN (
      SELECT l.idEmpresa, l.idProducto, SUM(l.cantidadDisponible) AS stock
      FROM Lotes l
      WHERE l.idEmpresa IN (${inClause})
      ${whereSucursal}
      GROUP BY l.idEmpresa, l.idProducto
    ) stk ON stk.idProducto = p.idProducto AND stk.idEmpresa = p.idEmpresa
    WHERE p.idEmpresa IN (${inClause})
      AND p.estado = 1
      ${whereCat}
      ${whereMarFixed}
      ${whereBus}
      AND (${stockClause})
    ORDER BY p.idEmpresa, p.descripcion
  `);

  return result.recordset || [];
};
