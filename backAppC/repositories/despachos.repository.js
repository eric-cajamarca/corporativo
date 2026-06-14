const sql = require("mssql");
const { resolveFechaHoraClienteSql } = require("../utils/fechaHoraLocal.util");

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
    const idEmpresaOperativa = datos.idEmpresaOperativa || user.empresa;
    let idSucursal = datos.idSucursalOperativa || user.sucursal || null;
    if (!idSucursal) {
      const reqSuc = transaction.request();
      const rsSuc = await reqSuc
        .input("idEmpresa", sql.UniqueIdentifier, idEmpresaOperativa)
        .query("SELECT TOP 1 idSucursal FROM Sucursal WHERE idEmpresa = @idEmpresa");
      idSucursal = rsSuc.recordset?.[0]?.idSucursal || null;
    }
    if (!idSucursal) {
      throw new Error("No se pudo determinar la sucursal. Configure al menos una sucursal para la empresa.");
    }

    const mercaderiaPendienteDeCarga = datos.mercaderiaPendienteDeCarga === true;
    const estadoCabecera = mercaderiaPendienteDeCarga ? "PENDIENTE" : "COMPLETADO";
    const fechaDespachoSql = resolveFechaHoraClienteSql(datos.fechaDespacho);

    const reqDespacho = transaction.request();
    const despachoResult = await reqDespacho
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresaOperativa)
      .input("idSucursal", sql.UniqueIdentifier, idSucursal)
      .input("idVenta", sql.Int, datos.idVenta)
      .input("idTipoDespacho", sql.Int, datos.idTipoDespacho)
      .input("idUsuarioDespacho", sql.UniqueIdentifier, user.sub)
      .input("observaciones", sql.VarChar, datos.observaciones || null)
      .input("estadoCabecera", sql.VarChar(20), estadoCabecera)
      .input("fechaDespacho", sql.VarChar(23), fechaDespachoSql)
      .query(`
        INSERT INTO Despachos (
          idEmpresa, idSucursal, idVenta, idTipoDespacho,
          idUsuarioDespacho, observaciones, fechaDespacho, estado
        )
        OUTPUT INSERTED.idDespacho
        VALUES (
          @idEmpresa, @idSucursal, @idVenta, @idTipoDespacho,
          @idUsuarioDespacho, @observaciones, TRY_CONVERT(DATETIME, @fechaDespacho, 120), @estadoCabecera
        )
      `);

    const idDespacho = despachoResult.recordset[0].idDespacho;

    // Crear detalles: si vienen detalles con cant. por línea, usarlos; si no, crear con todo el pendiente
    await crearDetallesDespacho(
      transaction,
      idDespacho,
      idEmpresaOperativa,
      datos.idVenta,
      datos.idTipoDespacho,
      datos.detalles,
      mercaderiaPendienteDeCarga
    );

    // Sincronizar DetalleVenta (cantEntregada, idEstadoPedido) y Ventas.idEstadoPedido
    await sincronizarDetalleVentaYVentaTrasDespacho(transaction, idDespacho, datos.idVenta);

    await transaction.commit();
    return { idDespacho, mensaje: "Despacho creado exitosamente con todos sus detalles" };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Función auxiliar para crear detalles del despacho.
// Si detallesUsuario está definido (array de { idDetalle, idProducto, cantidadADespachar }), se usan esas cantidades (solo líneas con cantidadADespachar > 0).
// Si no, se crean líneas con todo el pendiente de la venta.
// Se usa transaction.request() nuevo en cada consulta para no reutilizar parámetros (evitar EDUPEPARAM).
async function crearDetallesDespacho(
  transaction,
  idDespacho,
  idEmpresa,
  idVenta,
  idTipoDespacho,
  detallesUsuario,
  mercaderiaPendienteDeCarga = false
) {
  const tipoReq = transaction.request();
  const tipoResult = await tipoReq
    .input("idTipoDespacho", sql.Int, idTipoDespacho)
    .query(`SELECT requiereCantidad FROM TiposDespacho WHERE idTipoDespacho = @idTipoDespacho`);
  const requiereCantidad = tipoResult.recordset[0].requiereCantidad;

  if (Array.isArray(detallesUsuario) && detallesUsuario.length > 0) {
    for (const d of detallesUsuario) {
      const cantidadADespachar = Number(d.cantidadADespachar) || 0;
      if (cantidadADespachar <= 0) continue;
      const cantidadDespachadaInicial = mercaderiaPendienteDeCarga ? 0 : requiereCantidad ? 0 : cantidadADespachar;
      const estado = cantidadDespachadaInicial >= cantidadADespachar ? "DESPACHADO" : "PENDIENTE";
      const req = transaction.request();
      await req
        .input("idDespacho", sql.UniqueIdentifier, idDespacho)
        .input("idDetalleVenta", sql.Int, d.idDetalle)
        .input("idProducto", sql.UniqueIdentifier, d.idProducto)
        .input("cantidadSolicitada", sql.Decimal(18, 3), cantidadADespachar)
        .input("cantidadDespachada", sql.Decimal(18, 3), cantidadDespachadaInicial)
        .input("estado", sql.VarChar(20), estado)
        .query(`
          INSERT INTO DetalleDespachos (idDespacho, idDetalleVenta, idProducto, cantidadSolicitada, cantidadDespachada, estado)
          VALUES (@idDespacho, @idDetalleVenta, @idProducto, @cantidadSolicitada, @cantidadDespachada, @estado)
        `);
    }
    return;
  }

  const detalleReq = transaction.request();
  const detalleResult = await detalleReq
    .input("idVenta", sql.Int, idVenta)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT dv.idDetalle, dv.idProducto, dv.cantidad, ISNULL(dv.cantEntregada, 0) AS cantEntregada,
             (dv.cantidad - ISNULL(dv.cantEntregada, 0)) AS cantPendiente
      FROM DetalleVenta dv
      INNER JOIN Ventas v ON v.idVenta = dv.idVenta AND v.idEmpresa = @idEmpresa
      WHERE dv.idVenta = @idVenta AND (dv.cantidad - ISNULL(dv.cantEntregada, 0)) > 0
    `);

  for (const row of detalleResult.recordset) {
    const cantPendiente = Number(row.cantPendiente) || 0;
    const cantidadDespachadaInicial = mercaderiaPendienteDeCarga ? 0 : requiereCantidad ? 0 : cantPendiente;
    const estado = cantidadDespachadaInicial >= cantPendiente ? "DESPACHADO" : "PENDIENTE";
    const req = transaction.request();
    await req
      .input("idDespacho", sql.UniqueIdentifier, idDespacho)
      .input("idDetalleVenta", sql.Int, row.idDetalle)
      .input("idProducto", sql.UniqueIdentifier, row.idProducto)
      .input("cantidadSolicitada", sql.Decimal(18, 3), cantPendiente)
      .input("cantidadDespachada", sql.Decimal(18, 3), cantidadDespachadaInicial)
      .input("estado", sql.VarChar(20), estado)
      .query(`
        INSERT INTO DetalleDespachos (idDespacho, idDetalleVenta, idProducto, cantidadSolicitada, cantidadDespachada, estado)
        VALUES (@idDespacho, @idDetalleVenta, @idProducto, @cantidadSolicitada, @cantidadDespachada, @estado)
      `);
  }
}

/** Dentro de la transacción: actualiza cantEntregada en DetalleVenta por cada línea del despacho,
 *  luego idEstadoPedido en DetalleVenta (2=Entregado si cantPendiente=0, 1=Pendiente) y en Ventas si todo el detalle está entregado. */
async function sincronizarDetalleVentaYVentaTrasDespacho(transaction, idDespacho, idVenta) {
  const reqIds = transaction.request();
  const rsIds = await reqIds
    .input("idDespacho", sql.UniqueIdentifier, idDespacho)
    .query("SELECT idDetalleVenta FROM DetalleDespachos WHERE idDespacho = @idDespacho");
  for (const r of (rsIds.recordset || [])) {
    const reqSync = transaction.request();
    await reqSync
      .input("idDetalleVenta", sql.Int, r.idDetalleVenta)
      .query(`
        UPDATE DetalleVenta SET cantEntregada = (
          SELECT ISNULL(SUM(dd.cantidadDespachada), 0)
          FROM DetalleDespachos dd
          WHERE dd.idDetalleVenta = @idDetalleVenta
        )
        WHERE idDetalle = @idDetalleVenta
      `);
  }
  const reqEstadoDetalle = transaction.request();
  await reqEstadoDetalle
    .input("idVenta", sql.Int, idVenta)
    .query(`
      UPDATE DetalleVenta SET idEstadoPedido = CASE WHEN (cantidad - cantEntregada) <= 0 THEN 2 ELSE 1 END
      WHERE idVenta = @idVenta
    `);
  const reqEstadoVenta = transaction.request();
  await reqEstadoVenta
    .input("idVenta", sql.Int, idVenta)
    .query(`
      UPDATE Ventas SET idEstadoPedido = 2
      WHERE idVenta = @idVenta
        AND NOT EXISTS (SELECT 1 FROM DetalleVenta WHERE idVenta = @idVenta AND (cantidad - cantEntregada) > 0)
    `);
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
  const req = pool.request();
  const detalleRow = await req
    .input("idDetalleDespacho", sql.UniqueIdentifier, datos.idDetalleDespacho)
    .query(`
      SELECT dd.cantidadSolicitada, dd.idDetalleVenta, dd.idDespacho
      FROM DetalleDespachos dd
      WHERE dd.idDetalleDespacho = @idDetalleDespacho
    `);
  const row = detalleRow.recordset[0];
  if (!row) throw new Error("DETALLE_NO_ENCONTRADO");
  const estado = datos.cantidadDespachada >= row.cantidadSolicitada ? "DESPACHADO" : "PENDIENTE";
  const fechaDespachoSql = estado === "DESPACHADO"
    ? resolveFechaHoraClienteSql(datos.fechaDespacho)
    : null;

  await req
    .input("idDetalleDespacho", sql.UniqueIdentifier, datos.idDetalleDespacho)
    .input("cantidadDespachada", sql.Decimal(18, 3), datos.cantidadDespachada)
    .input("ubicacionOrigen", sql.VarChar, datos.ubicacionOrigen || null)
    .input("ubicacionDestino", sql.VarChar, datos.ubicacionDestino || null)
    .input("estado", sql.VarChar, estado)
    .input("fechaDespacho", sql.VarChar(23), fechaDespachoSql)
    .query(`
      UPDATE DetalleDespachos
      SET cantidadDespachada = @cantidadDespachada,
          ubicacionOrigen = @ubicacionOrigen,
          ubicacionDestino = @ubicacionDestino,
          estado = @estado,
          fechaDespacho = CASE WHEN @estado = 'DESPACHADO' THEN TRY_CONVERT(DATETIME, @fechaDespacho, 120) ELSE fechaDespacho END
      WHERE idDetalleDespacho = @idDetalleDespacho
    `);

  await sincronizarCantEntregadaDetalleVenta(pool, row.idDetalleVenta);

  const idDespacho = row.idDespacho;
  if (idDespacho) {
    const reqEst = pool.request().input("idDespacho", sql.UniqueIdentifier, idDespacho);
    await reqEst.query(`
      UPDATE Despachos
      SET estado = CASE
        WHEN NOT EXISTS (
          SELECT 1 FROM DetalleDespachos x
          WHERE x.idDespacho = @idDespacho AND x.estado <> N'DESPACHADO'
        ) THEN N'COMPLETADO'
        WHEN EXISTS (
          SELECT 1 FROM DetalleDespachos x
          WHERE x.idDespacho = @idDespacho AND x.estado = N'DESPACHADO'
        ) THEN N'EN_PROCESO'
        ELSE N'PENDIENTE'
      END
      WHERE idDespacho = @idDespacho
    `);
  }

  let todosDetallesDespachados = false;
  if (idDespacho) {
    const chk = await pool
      .request()
      .input("idDespacho", sql.UniqueIdentifier, idDespacho)
      .query(`
        SELECT COUNT(*) AS n
        FROM DetalleDespachos
        WHERE idDespacho = @idDespacho AND estado <> N'DESPACHADO'
      `);
    todosDetallesDespachados = Number(chk.recordset[0]?.n) === 0;
  }

  return {
    idDetalleDespacho: datos.idDetalleDespacho,
    estado,
    cantidadDespachada: datos.cantidadDespachada,
    idDespacho,
    todosDetallesDespachados
  };
};

/**
 * Registra cantidades retiradas para varias líneas del mismo despacho (una transacción).
 * items: [{ idDetalleDespacho, cantidadDespachada, ubicacionOrigen?, ubicacionDestino? }]
 */
exports.actualizarCantidadesDespachoBatchRepo = async (pool, _user, idDespacho, items, fechaDespachoCliente) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("ITEMS_VACIOS");
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const rqEmp = transaction.request().input("idDespacho", sql.UniqueIdentifier, idDespacho);
    const empRes = await rqEmp.query(`SELECT idEmpresa FROM Despachos WHERE idDespacho = @idDespacho`);
    const idEmpresaDesp = empRes.recordset[0]?.idEmpresa;
    if (!idEmpresaDesp) {
      throw new Error("DESPACHO_NO_ENCONTRADO");
    }

    const idDetallesVentaSync = new Set();

    for (const it of items) {
      const idDd = it.idDetalleDespacho;
      if (!idDd) {
        throw new Error("DETALLE_NO_ENCONTRADO");
      }
      const detalleRow = await transaction
        .request()
        .input("idDetalleDespacho", sql.UniqueIdentifier, idDd)
        .input("idDespacho", sql.UniqueIdentifier, idDespacho)
        .query(`
          SELECT dd.cantidadSolicitada, dd.idDetalleVenta, dd.idDespacho
          FROM DetalleDespachos dd
          WHERE dd.idDetalleDespacho = @idDetalleDespacho AND dd.idDespacho = @idDespacho
        `);
      const row = detalleRow.recordset[0];
      if (!row) {
        throw new Error("DETALLE_NO_ENCONTRADO");
      }
      const cant = Number(it.cantidadDespachada) || 0;
      if (cant < 0 || cant > Number(row.cantidadSolicitada)) {
        throw new Error("CANTIDAD_INVALIDA");
      }
      const estado = cant >= Number(row.cantidadSolicitada) ? "DESPACHADO" : "PENDIENTE";
      idDetallesVentaSync.add(row.idDetalleVenta);
      const fechaDespachoSql = estado === "DESPACHADO"
        ? resolveFechaHoraClienteSql(fechaDespachoCliente)
        : null;

      await transaction
        .request()
        .input("idDetalleDespacho", sql.UniqueIdentifier, idDd)
        .input("cantidadDespachada", sql.Decimal(18, 3), cant)
        .input("ubicacionOrigen", sql.VarChar, it.ubicacionOrigen || null)
        .input("ubicacionDestino", sql.VarChar, it.ubicacionDestino || null)
        .input("estado", sql.VarChar, estado)
        .input("fechaDespacho", sql.VarChar(23), fechaDespachoSql)
        .query(`
          UPDATE DetalleDespachos
          SET cantidadDespachada = @cantidadDespachada,
              ubicacionOrigen = @ubicacionOrigen,
              ubicacionDestino = @ubicacionDestino,
              estado = @estado,
              fechaDespacho = CASE WHEN @estado = 'DESPACHADO' THEN TRY_CONVERT(DATETIME, @fechaDespacho, 120) ELSE fechaDespacho END
          WHERE idDetalleDespacho = @idDetalleDespacho
        `);
    }

    for (const idDv of idDetallesVentaSync) {
      await transaction
        .request()
        .input("idDetalleVenta", sql.Int, idDv)
        .query(`
          UPDATE DetalleVenta SET cantEntregada = (
            SELECT ISNULL(SUM(dd.cantidadDespachada), 0)
            FROM DetalleDespachos dd
            WHERE dd.idDetalleVenta = @idDetalleVenta
          )
          WHERE idDetalle = @idDetalleVenta
        `);
    }

    await transaction
      .request()
      .input("idDespacho", sql.UniqueIdentifier, idDespacho)
      .query(`
        UPDATE Despachos
        SET estado = CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM DetalleDespachos x
            WHERE x.idDespacho = @idDespacho AND x.estado <> N'DESPACHADO'
          ) THEN N'COMPLETADO'
          WHEN EXISTS (
            SELECT 1 FROM DetalleDespachos x
            WHERE x.idDespacho = @idDespacho AND x.estado = N'DESPACHADO'
          ) THEN N'EN_PROCESO'
          ELSE N'PENDIENTE'
        END
        WHERE idDespacho = @idDespacho
      `);

    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    throw e;
  }

  const chk = await pool
    .request()
    .input("idDespacho", sql.UniqueIdentifier, idDespacho)
    .query(`
      SELECT COUNT(*) AS n
      FROM DetalleDespachos
      WHERE idDespacho = @idDespacho AND estado <> N'DESPACHADO'
    `);
  const todosDetallesDespachados = Number(chk.recordset[0]?.n) === 0;

  return { idDespacho, todosDetallesDespachados };
};

function sincronizarCantEntregadaDetalleVenta(pool, idDetalleVenta) {
  return pool.request()
    .input("idDetalleVenta", sql.Int, idDetalleVenta)
    .query(`
      UPDATE DetalleVenta SET cantEntregada = (
        SELECT ISNULL(SUM(dd.cantidadDespachada), 0)
        FROM DetalleDespachos dd
        WHERE dd.idDetalleVenta = @idDetalleVenta
      )
      WHERE idDetalle = @idDetalleVenta
    `);
}

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
  const idsDetalle = await pool.request()
    .input("idDespacho", sql.UniqueIdentifier, idDespacho)
    .query(`SELECT idDetalleVenta FROM DetalleDespachos WHERE idDespacho = @idDespacho`);
  for (const r of (idsDetalle.recordset || [])) {
    await sincronizarCantEntregadaDetalleVenta(pool, r.idDetalleVenta);
  }
  await pool.request()
    .input("idDespacho", sql.UniqueIdentifier, idDespacho)
    .query(`
      UPDATE Despachos SET estado = 'COMPLETADO' WHERE idDespacho = @idDespacho
    `);
  return { idDespacho, estado: "COMPLETADO", mensaje: "Despacho finalizado exitosamente" };
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

/** Detalle de venta por idVenta para despacho: cantidad, cantEntregada, cantPendiente y ubicaciones con cantidad disponible por almacén. */
exports.obtenerDetalleVentaParaDespachoRepo = async (pool, idEmpresa, idVenta) => {
  const req = pool.request();
  req.input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
  req.input("idVenta", sql.Int, idVenta);
  const result = await req.query(`
    SELECT
      dv.idDetalle,
      dv.idProducto,
      p.codigo AS productoCodigo,
      p.descripcion AS productoDescripcion,
      LTRIM(RTRIM(ISNULL(m.nombre, ''))) AS productoMarca,
      dv.cantidad,
      ISNULL(dv.cantEntregada, 0) AS cantEntregada,
      (dv.cantidad - ISNULL(dv.cantEntregada, 0)) AS cantPendiente,
      v.idSucursal
    FROM DetalleVenta dv
    INNER JOIN Ventas v ON v.idVenta = dv.idVenta AND v.idEmpresa = @idEmpresa
    INNER JOIN Productos p ON p.idProducto = dv.idProducto AND p.idEmpresa = v.idEmpresa
    LEFT JOIN Marcas m ON m.idMarca = p.idMarca
    WHERE dv.idVenta = @idVenta
    ORDER BY p.descripcion
  `);
  const filas = result.recordset || [];
  if (filas.length === 0) return filas;
  const idsProducto = [...new Set(filas.map((f) => f.idProducto))];
  const idSucursal = filas[0] && filas[0].idSucursal ? filas[0].idSucursal : null;
  let ubicacionesPorProducto = {};
  if (idSucursal && idsProducto.length > 0) {
    try {
      const placeholders = idsProducto.map((_, i) => `@p${i}`).join(",");
      const uReq = pool.request();
      uReq.input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
      uReq.input("idSucursal", sql.UniqueIdentifier, idSucursal);
      idsProducto.forEach((id, i) => uReq.input(`p${i}`, sql.UniqueIdentifier, id));
      const uRes = await uReq.query(`
        SELECT
          l.idProducto,
          up.codigoUbicacion,
          SUM(CAST(lu.cantidad AS DECIMAL(18,2))) AS cantidad
        FROM Lotes l
        INNER JOIN LotesUbicacion lu ON lu.idLote = l.idLote AND lu.cantidad > 0
        INNER JOIN UbicacionesPrioridad up ON up.idUbicacion = lu.idUbicacion
        WHERE l.idEmpresa = @idEmpresa
          AND l.idSucursal = @idSucursal
          AND l.idProducto IN (${placeholders})
          AND l.cantidadDisponible > 0
        GROUP BY l.idProducto, up.codigoUbicacion, up.prioridad
        ORDER BY l.idProducto, up.prioridad
      `);
      const uRows = uRes.recordset || [];
      for (const r of uRows) {
        const k = r.idProducto;
        if (!ubicacionesPorProducto[k]) ubicacionesPorProducto[k] = [];
        const cant = r.cantidad != null ? Number(r.cantidad) : 0;
        const cod = (r.codigoUbicacion || "").trim();
        if (cod) ubicacionesPorProducto[k].push(`${cod}: ${cant}`);
      }
      for (const k of Object.keys(ubicacionesPorProducto)) {
        ubicacionesPorProducto[k] = ubicacionesPorProducto[k].join(", ");
      }
    } catch (e) {
      ubicacionesPorProducto = {};
    }
  } else {
    try {
      const placeholders = idsProducto.map((_, i) => `@p${i}`).join(",");
      const uReq = pool.request();
      uReq.input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
      idsProducto.forEach((id, i) => uReq.input(`p${i}`, sql.UniqueIdentifier, id));
      const uRes = await uReq.query(`
        SELECT
          l.idProducto,
          up.codigoUbicacion,
          SUM(CAST(lu.cantidad AS DECIMAL(18,2))) AS cantidad
        FROM Lotes l
        INNER JOIN LotesUbicacion lu ON lu.idLote = l.idLote AND lu.cantidad > 0
        INNER JOIN UbicacionesPrioridad up ON up.idUbicacion = lu.idUbicacion
        WHERE l.idEmpresa = @idEmpresa
          AND l.idProducto IN (${placeholders})
          AND l.cantidadDisponible > 0
        GROUP BY l.idProducto, up.codigoUbicacion, up.prioridad
        ORDER BY l.idProducto, up.prioridad
      `);
      const uRows = uRes.recordset || [];
      for (const r of uRows) {
        const k = r.idProducto;
        if (!ubicacionesPorProducto[k]) ubicacionesPorProducto[k] = [];
        const cant = r.cantidad != null ? Number(r.cantidad) : 0;
        const cod = (r.codigoUbicacion || "").trim();
        if (cod) ubicacionesPorProducto[k].push(`${cod}: ${cant}`);
      }
      for (const k of Object.keys(ubicacionesPorProducto)) {
        ubicacionesPorProducto[k] = ubicacionesPorProducto[k].join(", ");
      }
    } catch (e) {
      ubicacionesPorProducto = {};
    }
  }
  const filasSinSucursal = filas.map((f) => {
    const { idSucursal: _s, ...rest } = f;
    return rest;
  });
  return filasSinSucursal.map((f) => ({
    ...f,
    ubicaciones: ubicacionesPorProducto[f.idProducto] || ""
  }));
};

/** Buscar venta por compVenta (número comprobante) o idVenta. Devuelve venta + lista de despachos + indicador entregado mismo día.
 *  Sin la columna Ventas.idEstadoPedido (migración add_idEstadoPedido_ventas.sql) entregadoMismoDia será siempre false.
 */
/** Escapa % _ [ ] para usar el literal dentro de un patrón LIKE (SQL Server). */
function escapeSqlLikeLiteral(s) {
  return String(s)
    .replace(/\[/g, "[[]")
    .replace(/]/g, "[]]")
    .replace(/%/g, "[%]")
    .replace(/_/g, "[_]");
}

exports.buscarVentaDespachosRepo = async (pool, idEmpresa, filtros) => {
  const compVentaRaw = filtros.compVenta ? String(filtros.compVenta).trim() : "";
  const idVentaRaw =
    filtros.idVenta != null && filtros.idVenta !== "" ? String(filtros.idVenta).trim() : "";

  if (!compVentaRaw && !idVentaRaw) return null;

  const req = pool.request();
  req.input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
  let whereVenta = "v.idEmpresa = @idEmpresa";
  const orParts = [];

  if (compVentaRaw) {
    const soloDigitos = /^\d+$/.test(compVentaRaw);
    const esc = escapeSqlLikeLiteral(compVentaRaw);
    const patronLike = soloDigitos ? `%${esc}` : `%${esc}%`;
    req.input("compLike", sql.NVarChar(32), patronLike);
    orParts.push("v.compVenta LIKE @compLike");
  }

  if (idVentaRaw) {
    const idNum = parseInt(idVentaRaw, 10);
    if (!Number.isNaN(idNum)) {
      req.input("idVenta", sql.Int, idNum);
      orParts.push("v.idVenta = @idVenta");
    }
  }

  if (!orParts.length) return null;
  whereVenta += ` AND (${orParts.join(" OR ")})`;

  const ventaResult = await req.query(`
    SELECT TOP 1
      v.idEmpresa,
      v.idVenta,
      v.compVenta,
      v.serie,
      v.numero,
      CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
      v.total,
      ISNULL(v.eliminado, 0) AS eliminado,
      v.idEstadoPago,
      ISNULL(ep.descripcion, '') AS estadoPagoNombre,
      cl.rSocial AS clienteRazonSocial,
      cl.ruc AS clienteRuc,
      ISNULL(c.codigo, '') AS codigoComprobante
    FROM Ventas v
    LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
    LEFT JOIN EstadoPago ep ON ep.idEstadoPago = v.idEstadoPago
    LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
    WHERE ${whereVenta}
    ORDER BY v.fEmision DESC, v.idVenta DESC
  `);
  let venta = ventaResult.recordset && ventaResult.recordset[0];
  if (!venta) return null;
  venta = { ...venta, idEstadoPedidoVenta: null, estadoPedidoVentaNombre: null };

  const despachosResult = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idVenta", sql.Int, venta.idVenta)
    .query(`
      SELECT
        d.idDespacho,
        d.idVenta,
        CONVERT(VARCHAR(19), d.fechaDespacho, 120) AS fechaDespacho,
        d.estado,
        d.observaciones,
        td.nombre AS tipoDespacho,
        uw.nombres + ' ' + ISNULL(uw.apellidos, '') AS usuarioDespacho,
        COUNT(dd.idDetalleDespacho) AS totalLineas,
        SUM(CASE WHEN dd.estado = 'DESPACHADO' THEN 1 ELSE 0 END) AS lineasDespachadas
      FROM Despachos d
      INNER JOIN TiposDespacho td ON d.idTipoDespacho = td.idTipoDespacho
      INNER JOIN UsuarioWeb uw ON d.idUsuarioDespacho = uw.idUsuario
      LEFT JOIN DetalleDespachos dd ON d.idDespacho = dd.idDespacho
      WHERE d.idEmpresa = @idEmpresa AND d.idVenta = @idVenta
      GROUP BY d.idDespacho, d.idVenta, d.fechaDespacho, d.estado, d.observaciones, td.nombre, uw.nombres, uw.apellidos
      ORDER BY d.fechaDespacho DESC
    `);

  const entregadoMismoDia = false;
  const detalleVenta = await exports.obtenerDetalleVentaParaDespachoRepo(pool, idEmpresa, venta.idVenta);
  return {
    venta,
    despachos: despachosResult.recordset || [],
    entregadoMismoDia: !!entregadoMismoDia,
    detalleVenta
  };
};

/** Detalle de un despacho (DetalleDespachos): líneas de entrega por producto. */
exports.obtenerDetalleDespachoRepo = async (pool, idDespacho, idEmpresa) => {
  const result = await pool
    .request()
    .input("idDespacho", sql.UniqueIdentifier, idDespacho)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        dd.idDetalleDespacho,
        dd.idDespacho,
        dd.idDetalleVenta,
        dd.idProducto,
        p.codigo AS productoCodigo,
        p.descripcion AS productoDescripcion,
        LTRIM(RTRIM(ISNULL(m.nombre, ''))) AS productoMarca,
        dd.cantidadSolicitada,
        dd.cantidadDespachada,
        dd.ubicacionOrigen,
        dd.ubicacionDestino,
        dd.estado,
        CONVERT(VARCHAR(19), dd.fechaDespacho, 120) AS fechaDespacho
      FROM DetalleDespachos dd
      INNER JOIN Despachos d ON d.idDespacho = dd.idDespacho AND d.idEmpresa = @idEmpresa
      INNER JOIN Productos p ON p.idProducto = dd.idProducto
      LEFT JOIN Marcas m ON m.idMarca = p.idMarca
      WHERE dd.idDespacho = @idDespacho
      ORDER BY p.descripcion
    `);
  return result.recordset || [];
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

exports.obtenerIdEmpresaDesdeDespachoRepo = async (pool, idDespacho) => {
  const r = await pool
    .request()
    .input("idDespacho", sql.UniqueIdentifier, idDespacho)
    .query(`SELECT idEmpresa FROM Despachos WHERE idDespacho = @idDespacho`);
  return r.recordset[0]?.idEmpresa || null;
};

exports.obtenerIdEmpresaDesdeDetalleDespachoRepo = async (pool, idDetalleDespacho) => {
  const r = await pool
    .request()
    .input("id", sql.UniqueIdentifier, idDetalleDespacho)
    .query(`
      SELECT d.idEmpresa
      FROM DetalleDespachos dd
      INNER JOIN Despachos d ON d.idDespacho = dd.idDespacho
      WHERE dd.idDetalleDespacho = @id
    `);
  return r.recordset[0]?.idEmpresa || null;
};

/**
 * Coincidencias de VentaAgrupada para empresa cobradora (gestora). Al menos un filtro distinto de vacío.
 */
exports.listarVentaAgrupadaCoincidenciasDespachoRepo = async (pool, idEmpresaCobradora, filtros) => {
  const { idVentaAgrupada, compVenta, ruc, nombreCliente } = filtros;
  const req = pool.request().input("idGestora", sql.UniqueIdentifier, idEmpresaCobradora);
  let where = "va.idEmpresaCobradora = @idGestora";
  if (idVentaAgrupada) {
    req.input("idVA", sql.UniqueIdentifier, idVentaAgrupada);
    where += " AND va.idVentaAgrupada = @idVA";
  }
  if (compVenta && String(compVenta).trim()) {
    const c = String(compVenta).trim();
    req.input("compLike", sql.VarChar(80), `%${c}%`);
    where +=
      " AND (ISNULL(va.compVenta,'') LIKE @compLike OR CAST(va.idVentaAgrupada AS VARCHAR(36)) LIKE @compLike)";
  }
  if (ruc && String(ruc).trim()) {
    req.input("rucLike", sql.VarChar(20), `%${String(ruc).trim()}%`);
    where += " AND ISNULL(cl.ruc,'') LIKE @rucLike";
  }
  if (nombreCliente && String(nombreCliente).trim()) {
    req.input("nomLike", sql.VarChar(200), `%${String(nombreCliente).trim()}%`);
    where += " AND ISNULL(cl.rSocial,'') LIKE @nomLike";
  }
  const r = await req.query(`
    SELECT TOP 25
      va.idVentaAgrupada,
      va.compVenta,
      va.total,
      CONVERT(VARCHAR(19), va.fEmision, 120) AS fEmision,
      ISNULL(cl.ruc,'') AS clienteRuc,
      ISNULL(cl.rSocial,'') AS clienteRazonSocial
    FROM VentaAgrupada va
    LEFT JOIN Clientes cl ON cl.idCliente = va.idCliente AND cl.idEmpresa = va.idEmpresaCobradora
    WHERE ${where}
    ORDER BY va.fEmision DESC
  `);
  return r.recordset || [];
};

/** Cabecera VA + comprobantes hijos con despachos y detalle de venta (empresa gestora). */
exports.construirDetalleVentaAgrupadaDespachoRepo = async (pool, idEmpresaCobradora, idVentaAgrupada) => {
  const ventaAgrupadaRs = await pool
    .request()
    .input("idVA", sql.UniqueIdentifier, idVentaAgrupada)
    .input("idGestora", sql.UniqueIdentifier, idEmpresaCobradora)
    .query(`
      SELECT
        va.idVentaAgrupada,
        va.compVenta,
        va.serie,
        va.numero,
        va.total,
        CONVERT(VARCHAR(19), va.fEmision, 120) AS fEmision,
        ISNULL(cl.ruc,'') AS clienteRuc,
        ISNULL(cl.rSocial,'') AS clienteRazonSocial
      FROM VentaAgrupada va
      LEFT JOIN Clientes cl ON cl.idCliente = va.idCliente AND cl.idEmpresa = va.idEmpresaCobradora
      WHERE va.idVentaAgrupada = @idVA AND va.idEmpresaCobradora = @idGestora
    `);
  const vaRow = ventaAgrupadaRs.recordset[0];
  if (!vaRow) return null;

  const comprobantesRaw = await pool
    .request()
    .input("idEmpresaCobradora", sql.UniqueIdentifier, idEmpresaCobradora)
    .input("idVentaAgrupada", sql.UniqueIdentifier, idVentaAgrupada)
    .query(`
      SELECT
        ve.idVenta,
        ve.idEmpresa,
        ve.compVenta,
        ve.serie,
        ve.numero,
        ve.idComprobante,
        c.nombre AS nombreComprobante,
        c.codigo AS codigoComprobante,
        e.razon_Social AS empresaRazonSocial,
        e.ruc AS empresaRuc,
        CONVERT(VARCHAR(19), ve.fEmision, 120) AS fEmision,
        ve.total
      FROM VentaEmpresa ve
      INNER JOIN VentaAgrupada va ON va.idVentaAgrupada = ve.idVentaAgrupada
      INNER JOIN Empresas e ON e.idEmpresa = ve.idEmpresa
      LEFT JOIN Comprobantes c ON c.idComprobante = ve.idComprobante AND c.idEmpresa = ve.idEmpresa
      WHERE ve.idVentaAgrupada = @idVentaAgrupada
        AND va.idEmpresaCobradora = @idEmpresaCobradora
      ORDER BY ve.fEmision ASC
    `);

  const comprobantes = [];
  for (const row of comprobantesRaw.recordset || []) {
    const despachosResult = await pool
      .request()
      .input("idEmpresa", sql.UniqueIdentifier, row.idEmpresa)
      .input("idVenta", sql.Int, row.idVenta)
      .query(`
        SELECT
          d.idDespacho,
          d.idVenta,
          CONVERT(VARCHAR(19), d.fechaDespacho, 120) AS fechaDespacho,
          d.estado,
          d.observaciones,
          td.nombre AS tipoDespacho,
          uw.nombres + ' ' + ISNULL(uw.apellidos, '') AS usuarioDespacho,
          COUNT(dd.idDetalleDespacho) AS totalLineas,
          SUM(CASE WHEN dd.estado = 'DESPACHADO' THEN 1 ELSE 0 END) AS lineasDespachadas
        FROM Despachos d
        INNER JOIN TiposDespacho td ON d.idTipoDespacho = td.idTipoDespacho
        INNER JOIN UsuarioWeb uw ON d.idUsuarioDespacho = uw.idUsuario
        LEFT JOIN DetalleDespachos dd ON d.idDespacho = dd.idDespacho
        WHERE d.idEmpresa = @idEmpresa AND d.idVenta = @idVenta
        GROUP BY d.idDespacho, d.idVenta, d.fechaDespacho, d.estado, d.observaciones, td.nombre, uw.nombres, uw.apellidos
        ORDER BY d.fechaDespacho DESC
      `);
    const detalleVenta = await exports.obtenerDetalleVentaParaDespachoRepo(pool, row.idEmpresa, row.idVenta);
    comprobantes.push({
      ...row,
      despachos: despachosResult.recordset || [],
      detalleVenta
    });
  }

  return { ventaAgrupada: vaRow, comprobantes };
};