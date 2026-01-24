const sql = require("mssql");

exports.obtenerDespachosVentaRepo = async (pool, idEmpresa, idVenta) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idVenta", sql.Int, idVenta)
    .query(`
      SELECT
        d.idDespacho,
        d.fechaDespacho,
        d.estado,
        d.observaciones,
        td.nombre AS tipoDespacho,
        td.requiereCantidad,
        uw.nombres + ' ' + uw.apellidos AS usuarioDespacho,
        -- Estadísticas del despacho
        COUNT(dd.idDetalleDespacho) AS totalProductos,
        COUNT(CASE WHEN dd.estado = 'DESPACHADO' THEN 1 END) AS productosDespachados,
        COUNT(CASE WHEN dd.estado = 'PENDIENTE' THEN 1 END) AS productosPendientes,
        SUM(dd.cantidadSolicitada) AS cantidadTotalSolicitada,
        SUM(dd.cantidadDespachada) AS cantidadTotalDespachada
      FROM Despachos d
      INNER JOIN TiposDespacho td ON d.idTipoDespacho = td.idTipoDespacho
      INNER JOIN UsuarioWeb uw ON d.idUsuarioDespacho = uw.idUsuario
      LEFT JOIN DetalleDespachos dd ON d.idDespacho = dd.idDespacho
      WHERE d.idEmpresa = @idEmpresa AND d.idVenta = @idVenta
      GROUP BY d.idDespacho, d.fechaDespacho, d.estado, d.observaciones,
               td.nombre, td.requiereCantidad, uw.nombres, uw.apellidos
      ORDER BY d.fechaDespacho DESC
    `);

  return result.recordset;
};

exports.validarVentaEmpresaRepo = async (pool, idVenta, idEmpresa) => {
  const result = await pool
    .request()
    .input("idVenta", sql.Int, idVenta)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as existe
      FROM Ventas
      WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
    `);

  return result.recordset[0].existe > 0;
};

exports.validarTipoDespachoRepo = async (pool, idTipoDespacho) => {
  const result = await pool
    .request()
    .input("idTipoDespacho", sql.Int, idTipoDespacho)
    .query(`
      SELECT COUNT(*) as existe
      FROM TiposDespacho
      WHERE idTipoDespacho = @idTipoDespacho
    `);

  return result.recordset[0].existe > 0;
};

exports.crearDespachoRepo = async (pool, user, datos) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const request = transaction.request();

    // Crear el despacho
    const despachoResult = await request
      .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
      .input("idSucursal", sql.UniqueIdentifier, user.sucursal || null)
      .input("idVenta", sql.Int, datos.idVenta)
      .input("idTipoDespacho", sql.Int, datos.idTipoDespacho)
      .input("idUsuarioDespacho", sql.UniqueIdentifier, user.sub)
      .input("observaciones", sql.VarChar, datos.observaciones || null)
      .query(`
        INSERT INTO Despachos (
          idEmpresa, idSucursal, idVenta, idTipoDespacho,
          idUsuarioDespacho, observaciones
        )
        OUTPUT INSERTED.idDespacho
        VALUES (
          @idEmpresa, @idSucursal, @idVenta, @idTipoDespacho,
          @idUsuarioDespacho, @observaciones
        )
      `);

    const idDespacho = despachoResult.recordset[0].idDespacho;

    // Crear detalles del despacho basados en los productos de la venta
    await crearDetallesDespacho(request, idDespacho, user.empresa, datos.idVenta, datos.idTipoDespacho);

    await transaction.commit();
    return { idDespacho, mensaje: "Despacho creado exitosamente con todos sus detalles" };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Función auxiliar para crear detalles del despacho
async function crearDetallesDespacho(request, idDespacho, idEmpresa, idVenta, idTipoDespacho) {
  // Obtener el tipo de despacho para saber si requiere cantidad
  const tipoResult = await request
    .input("idTipoDespacho", sql.Int, idTipoDespacho)
    .query(`
      SELECT requiereCantidad FROM TiposDespacho WHERE idTipoDespacho = @idTipoDespacho
    `);

  const requiereCantidad = tipoResult.recordset[0].requiereCantidad;

  // Obtener productos de la venta
  const productosResult = await request
    .input("idVenta", sql.Int, idVenta)
    .query(`
      SELECT
        dv.idProducto,
        p.descripcion,
        dv.cantidad,
        dv.pVenta,
        dv.total
      FROM DetalleVenta dv
      INNER JOIN Productos p ON dv.idProducto = p.idProducto
      WHERE dv.idVenta = @idVenta
    `);

  // Crear detalle para cada producto
  for (const producto of productosResult.recordset) {
    await request
      .input(`idDespacho_${producto.idProducto}`, sql.UniqueIdentifier, idDespacho)
      .input(`idProducto_${producto.idProducto}`, sql.UniqueIdentifier, producto.idProducto)
      .input(`cantidadSolicitada_${producto.idProducto}`, sql.Decimal(18, 3), producto.cantidad)
      .input(`cantidadDespachada_${producto.idProducto}`, sql.Decimal(18, 3), requiereCantidad ? 0 : producto.cantidad)
      .query(`
        INSERT INTO DetalleDespachos (
          idDespacho, idDetalleVenta, idProducto, cantidadSolicitada, cantidadDespachada, estado
        ) VALUES (
          @idDespacho_${producto.idProducto},
          (SELECT TOP 1 idDetalle FROM DetalleVenta WHERE idVenta = @idVenta AND idProducto = @idProducto_${producto.idProducto}),
          @idProducto_${producto.idProducto},
          @cantidadSolicitada_${producto.idProducto},
          @cantidadDespachada_${producto.idProducto},
          CASE WHEN @cantidadDespachada_${producto.idProducto} >= @cantidadSolicitada_${producto.idProducto} THEN 'DESPACHADO' ELSE 'PENDIENTE' END
        )
      `);
  }
}

exports.validarDetalleDespachoRepo = async (pool, idDetalleDespacho, idEmpresa) => {
  const result = await pool
    .request()
    .input("idDetalleDespacho", sql.UniqueIdentifier, idDetalleDespacho)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as existe
      FROM DetalleDespachos dd
      INNER JOIN Despachos d ON dd.idDespacho = d.idDespacho
      WHERE dd.idDetalleDespacho = @idDetalleDespacho AND d.idEmpresa = @idEmpresa
    `);

  return result.recordset[0].existe > 0;
};

exports.actualizarCantidadDespachadaRepo = async (pool, user, datos) => {
  // Determinar el nuevo estado basado en la cantidad
  const estado = datos.cantidadDespachada >= (
    await pool.request()
      .input("idDetalleDespacho", sql.UniqueIdentifier, datos.idDetalleDespacho)
      .query(`SELECT cantidadSolicitada FROM DetalleDespachos WHERE idDetalleDespacho = @idDetalleDespacho`)
  ).recordset[0].cantidadSolicitada ? 'DESPACHADO' : 'PENDIENTE';

  const result = await pool
    .request()
    .input("idDetalleDespacho", sql.UniqueIdentifier, datos.idDetalleDespacho)
    .input("cantidadDespachada", sql.Decimal(18, 3), datos.cantidadDespachada)
    .input("ubicacionOrigen", sql.VarChar, datos.ubicacionOrigen || null)
    .input("ubicacionDestino", sql.VarChar, datos.ubicacionDestino || null)
    .input("estado", sql.VarChar, estado)
    .query(`
      UPDATE DetalleDespachos
      SET cantidadDespachada = @cantidadDespachada,
          ubicacionOrigen = @ubicacionOrigen,
          ubicacionDestino = @ubicacionDestino,
          estado = @estado,
          fechaDespacho = CASE WHEN @estado = 'DESPACHADO' THEN GETDATE() ELSE fechaDespacho END
      WHERE idDetalleDespacho = @idDetalleDespacho
    `);

  return { idDetalleDespacho: datos.idDetalleDespacho, estado, cantidadDespachada: datos.cantidadDespachada };
};

exports.validarDespachoEmpresaRepo = async (pool, idDespacho, idEmpresa) => {
  const result = await pool
    .request()
    .input("idDespacho", sql.UniqueIdentifier, idDespacho)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as existe
      FROM Despachos
      WHERE idDespacho = @idDespacho AND idEmpresa = @idEmpresa
    `);

  return result.recordset[0].existe > 0;
};

exports.finalizarDespachoRepo = async (pool, user, idDespacho) => {
  const result = await pool
    .request()
    .input("idDespacho", sql.UniqueIdentifier, idDespacho)
    .query(`
      UPDATE Despachos
      SET estado = 'COMPLETADO'
      WHERE idDespacho = @idDespacho
    `);

  return { idDespacho, estado: 'COMPLETADO', mensaje: "Despacho finalizado exitosamente" };
};

exports.obtenerTiposDespachoRepo = async (pool) => {
  const result = await pool
    .request()
    .query(`
      SELECT
        idTipoDespacho,
        nombre,
        descripcion,
        requiereCantidad
      FROM TiposDespacho
      ORDER BY nombre
    `);

  return result.recordset;
};

exports.obtenerEstadoDespachosRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        d.estado,
        COUNT(*) as cantidad,
        COUNT(DISTINCT d.idVenta) as ventasAfectadas,
        SUM(dd.cantidadSolicitada) as cantidadTotalSolicitada,
        SUM(dd.cantidadDespachada) as cantidadTotalDespachada
      FROM Despachos d
      LEFT JOIN DetalleDespachos dd ON d.idDespacho = dd.idDespacho
      WHERE d.idEmpresa = @idEmpresa
        AND d.fechaDespacho >= DATEADD(DAY, -30, GETDATE()) -- Últimos 30 días
      GROUP BY d.estado
      ORDER BY
        CASE d.estado
          WHEN 'PENDIENTE' THEN 1
          WHEN 'EN_PROCESO' THEN 2
          WHEN 'COMPLETADO' THEN 3
          WHEN 'CANCELADO' THEN 4
        END
    `);

  return result.recordset;
};