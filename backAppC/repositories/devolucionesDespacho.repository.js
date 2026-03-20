const sql = require('mssql');
const stockRepository = require('./stock.repository');
const inventarioRepository = require('./inventario.repository');

async function obtenerDespachoBase(transaction, idEmpresa, idDespacho) {
  const rs = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idDespacho', sql.UniqueIdentifier, idDespacho)
    .query(`
      SELECT d.idDespacho, d.idVenta, d.idSucursal, v.compVenta
      FROM Despachos d
      INNER JOIN Ventas v ON v.idVenta = d.idVenta AND v.idEmpresa = d.idEmpresa
      WHERE d.idEmpresa = @idEmpresa AND d.idDespacho = @idDespacho
    `);
  return rs.recordset && rs.recordset[0] ? rs.recordset[0] : null;
}

async function obtenerDetalleDespacho(transaction, idEmpresa, idDetalleDespacho) {
  const rs = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idDetalleDespacho', sql.UniqueIdentifier, idDetalleDespacho)
    .query(`
      SELECT dd.idDetalleDespacho, dd.idDetalleVenta, dd.idProducto,
             dd.cantidadSolicitada, dd.cantidadDespachada,
             dv.costoUnitario
      FROM DetalleDespachos dd
      INNER JOIN Despachos d ON d.idDespacho = dd.idDespacho AND d.idEmpresa = @idEmpresa
      INNER JOIN DetalleVenta dv ON dv.idDetalle = dd.idDetalleVenta
      WHERE dd.idDetalleDespacho = @idDetalleDespacho
    `);
  return rs.recordset && rs.recordset[0] ? rs.recordset[0] : null;
}

async function resyncEntregaVenta(transaction, idVenta) {
  await transaction.request()
    .input('idVenta', sql.Int, idVenta)
    .query(`
      UPDATE DetalleVenta
      SET cantEntregada = ISNULL((
        SELECT SUM(dd.cantidadDespachada)
        FROM DetalleDespachos dd
        WHERE dd.idDetalleVenta = DetalleVenta.idDetalle
      ), 0)
      WHERE idVenta = @idVenta
    `);
  await transaction.request()
    .input('idVenta', sql.Int, idVenta)
    .query(`
      UPDATE DetalleVenta
      SET idEstadoPedido = CASE WHEN (cantidad - cantEntregada) <= 0 THEN 2 ELSE 1 END
      WHERE idVenta = @idVenta
    `);
  await transaction.request()
    .input('idVenta', sql.Int, idVenta)
    .query(`
      UPDATE Ventas
      SET idEstadoPedido = CASE
        WHEN EXISTS (SELECT 1 FROM DetalleVenta WHERE idVenta = @idVenta AND (cantidad - cantEntregada) > 0) THEN 1
        ELSE 2
      END
      WHERE idVenta = @idVenta
    `);
}

exports.crearDevolucionDespachoRepo = async (pool, idEmpresa, idUsuario, payload) => {
  const { idDespacho, observaciones, items } = payload;
  const transaction = pool.transaction();
  try {
    await transaction.begin();

    const despacho = await obtenerDespachoBase(transaction, idEmpresa, idDespacho);
    if (!despacho) {
      await transaction.rollback();
      return { ok: false, error: 'DESPACHO_NO_ENCONTRADO' };
    }

    const insertCab = await transaction.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idDespacho', sql.UniqueIdentifier, idDespacho)
      .input('idVenta', sql.Int, despacho.idVenta)
      .input('idUsuario', sql.UniqueIdentifier, idUsuario)
      .input('observaciones', sql.VarChar(500), observaciones || null)
      .query(`
        INSERT INTO DevolucionesDespacho (idEmpresa, idDespacho, idVenta, idUsuario, observaciones)
        OUTPUT INSERTED.idDevolucionDespacho
        VALUES (@idEmpresa, @idDespacho, @idVenta, @idUsuario, @observaciones)
      `);
    const idDevolucionDespacho = insertCab.recordset?.[0]?.idDevolucionDespacho;
    if (!idDevolucionDespacho) {
      await transaction.rollback();
      return { ok: false, error: 'NO_SE_PUDO_CREAR' };
    }

    for (const it of items) {
      const cantidadDevuelta = Number(it.cantidadDevuelta) || 0;
      if (cantidadDevuelta <= 0) continue;

      const detalle = await obtenerDetalleDespacho(transaction, idEmpresa, it.idDetalleDespacho);
      if (!detalle) {
        await transaction.rollback();
        return { ok: false, error: 'DETALLE_NO_ENCONTRADO' };
      }
      if (cantidadDevuelta > Number(detalle.cantidadDespachada || 0)) {
        await transaction.rollback();
        return { ok: false, error: 'CANTIDAD_SUPERA_DESPACHO' };
      }

      await transaction.request()
        .input('idDevolucionDespacho', sql.UniqueIdentifier, idDevolucionDespacho)
        .input('idDetalleDespacho', sql.UniqueIdentifier, detalle.idDetalleDespacho)
        .input('idDetalleVenta', sql.Int, detalle.idDetalleVenta)
        .input('idProducto', sql.UniqueIdentifier, detalle.idProducto)
        .input('cantidadDevuelta', sql.Decimal(18, 3), cantidadDevuelta)
        .input('notas', sql.VarChar(200), it.notas || null)
        .query(`
          INSERT INTO DevolucionesDespachoDetalle
            (idDevolucionDespacho, idDetalleDespacho, idDetalleVenta, idProducto, cantidadDevuelta, notas)
          VALUES
            (@idDevolucionDespacho, @idDetalleDespacho, @idDetalleVenta, @idProducto, @cantidadDevuelta, @notas)
        `);

      await transaction.request()
        .input('idDetalleDespacho', sql.UniqueIdentifier, detalle.idDetalleDespacho)
        .input('cantidadDevuelta', sql.Decimal(18, 3), cantidadDevuelta)
        .query(`
          UPDATE DetalleDespachos
          SET cantidadDespachada = cantidadDespachada - @cantidadDevuelta,
              estado = CASE
                WHEN (cantidadDespachada - @cantidadDevuelta) >= cantidadSolicitada THEN 'DESPACHADO'
                ELSE 'PENDIENTE'
              END
          WHERE idDetalleDespacho = @idDetalleDespacho
        `);

      await stockRepository.restaurarStockEnLotes(transaction, {
        idEmpresa,
        idSucursal: despacho.idSucursal,
        idProducto: detalle.idProducto,
        cantidad: cantidadDevuelta
      });

      await inventarioRepository.insertarFilaMovimiento(transaction, {
        idEmpresa,
        idSucursal: despacho.idSucursal,
        idProducto: detalle.idProducto,
        tipoMovimiento: 'EN',
        cantidad: cantidadDevuelta,
        docRelacionado: despacho.compVenta || String(despacho.idVenta),
        idUsuario,
        observaciones: 'Devolución de despacho',
        costoUnitario: detalle.costoUnitario || 0,
        idLote: null
      });
    }

    await resyncEntregaVenta(transaction, despacho.idVenta);

    await transaction.commit();
    return { ok: true, idDevolucionDespacho };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

exports.listarDevolucionesPorDespachoRepo = async (pool, idEmpresa, idDespacho) => {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idDespacho', sql.UniqueIdentifier, idDespacho)
    .query(`
      SELECT
        d.idDevolucionDespacho,
        d.idDespacho,
        d.idVenta,
        CONVERT(VARCHAR(19), d.fechaDevolucion, 120) AS fechaDevolucion,
        d.observaciones,
        uw.nombres + ' ' + ISNULL(uw.apellidos, '') AS usuarioNombre,
        COUNT(dd.idDevolucionDetalle) AS totalLineas,
        SUM(dd.cantidadDevuelta) AS cantidadTotalDevuelta
      FROM DevolucionesDespacho d
      INNER JOIN UsuarioWeb uw ON uw.idUsuario = d.idUsuario
      LEFT JOIN DevolucionesDespachoDetalle dd ON dd.idDevolucionDespacho = d.idDevolucionDespacho
      WHERE d.idEmpresa = @idEmpresa AND d.idDespacho = @idDespacho
      GROUP BY d.idDevolucionDespacho, d.idDespacho, d.idVenta, d.fechaDevolucion, d.observaciones, uw.nombres, uw.apellidos
      ORDER BY d.fechaDevolucion DESC
    `);
  return result.recordset || [];
};

exports.obtenerDetalleDevolucionRepo = async (pool, idEmpresa, idDevolucionDespacho) => {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idDevolucionDespacho', sql.UniqueIdentifier, idDevolucionDespacho)
    .query(`
      SELECT
        dd.idDevolucionDetalle,
        dd.idDevolucionDespacho,
        dd.idDetalleDespacho,
        dd.idDetalleVenta,
        dd.idProducto,
        p.codigo AS productoCodigo,
        p.descripcion AS productoDescripcion,
        dd.cantidadDevuelta,
        dd.notas
      FROM DevolucionesDespachoDetalle dd
      INNER JOIN DevolucionesDespacho d ON d.idDevolucionDespacho = dd.idDevolucionDespacho
      INNER JOIN Productos p ON p.idProducto = dd.idProducto
      WHERE d.idEmpresa = @idEmpresa AND d.idDevolucionDespacho = @idDevolucionDespacho
      ORDER BY p.descripcion
    `);
  return result.recordset || [];
};
