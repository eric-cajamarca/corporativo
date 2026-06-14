const sql = require("mssql");
const { getNowLocal, resolveFechaHoraClienteSql, getFechaSoloSQLString } = require("../utils/fechaHoraLocal.util");

/** Añade filtros opcionales (estado, fechas, RUC, cliente) al WHERE de envíos programados. */
function appendFiltrosEnviosProgramadosWhere(request, filtros, whereClauses) {
  if (filtros.idEstadoEnvio != null && String(filtros.idEstadoEnvio).trim() !== "") {
    whereClauses.push("e.idEstadoEnvio = @idEstadoEnvio");
    request.input("idEstadoEnvio", sql.Int, parseInt(filtros.idEstadoEnvio, 10));
  }
  const fechaDesde =
    filtros.fechaDesde != null && String(filtros.fechaDesde).trim() !== ""
      ? String(filtros.fechaDesde).trim().substring(0, 10)
      : null;
  const fechaHasta =
    filtros.fechaHasta != null && String(filtros.fechaHasta).trim() !== ""
      ? String(filtros.fechaHasta).trim().substring(0, 10)
      : null;
  if (fechaDesde) {
    whereClauses.push("CONVERT(VARCHAR(10), ISNULL(e.fechaProgramada, e.fechaSolicitud), 120) >= @fechaDesde");
    request.input("fechaDesde", sql.VarChar(10), fechaDesde);
  }
  if (fechaHasta) {
    whereClauses.push("CONVERT(VARCHAR(10), ISNULL(e.fechaProgramada, e.fechaSolicitud), 120) <= @fechaHasta");
    request.input("fechaHasta", sql.VarChar(10), fechaHasta);
  }
  const ruc = filtros.ruc != null && String(filtros.ruc).trim() !== "" ? String(filtros.ruc).trim() : null;
  const cliente = filtros.cliente != null && String(filtros.cliente).trim() !== "" ? String(filtros.cliente).trim() : null;
  if (ruc) {
    whereClauses.push("(ISNULL(c.rSocial, '') LIKE @termRuc OR ISNULL(c.ruc, '') LIKE @termRuc)");
    request.input("termRuc", sql.VarChar(100), "%" + ruc + "%");
  }
  if (cliente) {
    whereClauses.push(
      "(ISNULL(c.rSocial, '') LIKE @termCliente OR ISNULL(e.contactoDestinatario, '') LIKE @termCliente)"
    );
    request.input("termCliente", sql.VarChar(100), "%" + cliente + "%");
  }
}

exports.obtenerEnviosProgramadosRepo = async (pool, idEmpresa, filtros = {}) => {
  const request = pool.request();
  request.input("idEmpresa", sql.UniqueIdentifier, idEmpresa);

  const whereClauses = ["e.idEmpresa = @idEmpresa"];
  appendFiltrosEnviosProgramadosWhere(request, filtros, whereClauses);

  const whereSql = whereClauses.join(" AND ");
  const query = `
    SELECT
      e.idEnvio,
      e.idEmpresa,
      e.idEstadoEnvio,
      e.idChofer,
      e.idTransportista,
      e.fechaSolicitud,
      e.fechaProgramada,
      e.fechaEntrega,
      e.costoEnvio,
      e.direccionEntrega,
      e.referencia,
      COALESCE(NULLIF(LTRIM(RTRIM(e.contactoDestinatario)), ''), NULLIF(LTRIM(RTRIM(c.rSocial)), '')) AS contactoDestinatario,
      COALESCE(NULLIF(LTRIM(RTRIM(e.telefonoDestinatario)), ''), NULLIF(LTRIM(RTRIM(c.celular)), '')) AS telefonoDestinatario,
      e.observaciones,
      CONVERT(VARCHAR(10), ISNULL(e.fechaProgramada, e.fechaSolicitud), 120) AS FEnvio,
      te.nombre AS tipoEnvio,
      ee.nombre AS estadoActual,
      ee.color AS colorEstado,
      v.serie + '-' + v.numero AS comprobante,
      LTRIM(RTRIM(ISNULL(c.rSocial, ISNULL(e.contactoDestinatario, '(Sin cliente en maestro)')))) AS cliente,
      t.nombres + ' ' + t.apellidos AS transportista,
      CASE
        WHEN NULLIF(LTRIM(RTRIM(ISNULL(uChof.nombres, '') + ' ' + ISNULL(uChof.apellidos, ''))), '') IS NOT NULL
        THEN LTRIM(RTRIM(ISNULL(uChof.nombres, '') + ' ' + ISNULL(uChof.apellidos, '')))
        ELSE LTRIM(RTRIM(ISNULL(uw.nombres, '') + ' ' + ISNULL(uw.apellidos, '')))
      END AS chofer
    FROM Envios e
    INNER JOIN Ventas v ON e.idVenta = v.idVenta AND v.idEmpresa = e.idEmpresa
    LEFT JOIN Clientes c ON v.idCliente = c.idCliente AND c.idEmpresa = v.idEmpresa
    INNER JOIN TiposEnvio te ON e.idTipoEnvio = te.idTipoEnvio
    INNER JOIN EstadosEnvio ee ON e.idEstadoEnvio = ee.idEstadoEnvio
    LEFT JOIN UsuarioWeb uw ON e.idUsuarioEnvio = uw.idUsuario
    LEFT JOIN Choferes ch ON e.idChofer = ch.idChofer AND ch.estado = 1
    LEFT JOIN UsuarioWeb uChof ON ch.idUsuarioChofer = uChof.idUsuario AND uChof.idEmpresa = ch.idEmpresa
    LEFT JOIN Transportistas t ON e.idTransportista = t.idTransportista AND t.estado = 1
    WHERE ${whereSql}
    ORDER BY ISNULL(e.fechaProgramada, e.fechaSolicitud) DESC
  `;
  const result = await request.query(query);
  return result.recordset;
};

/**
 * Listado para empresa gestora: envíos de la gestora y de todas las empresas gestionadas.
 * @param {string[]} idsEmpresa
 */
exports.obtenerEnviosProgramadosMultiEmpresaRepo = async (pool, idsEmpresa, filtros = {}) => {
  const list = [...new Set((idsEmpresa || []).filter(Boolean))];
  if (list.length === 0) return [];
  const request = pool.request();
  list.forEach((id, i) => {
    request.input(`em${i}`, sql.UniqueIdentifier, id);
  });
  const inClause = list.map((_, i) => `@em${i}`).join(", ");
  const whereClauses = [`e.idEmpresa IN (${inClause})`];
  appendFiltrosEnviosProgramadosWhere(request, filtros, whereClauses);

  const whereSql = whereClauses.join(" AND ");
  const query = `
    SELECT
      e.idEnvio,
      e.idEmpresa,
      e.idEstadoEnvio,
      e.idChofer,
      e.idTransportista,
      e.fechaSolicitud,
      e.fechaProgramada,
      e.fechaEntrega,
      e.costoEnvio,
      e.direccionEntrega,
      e.referencia,
      COALESCE(NULLIF(LTRIM(RTRIM(e.contactoDestinatario)), ''), NULLIF(LTRIM(RTRIM(c.rSocial)), '')) AS contactoDestinatario,
      COALESCE(NULLIF(LTRIM(RTRIM(e.telefonoDestinatario)), ''), NULLIF(LTRIM(RTRIM(c.celular)), '')) AS telefonoDestinatario,
      e.observaciones,
      CONVERT(VARCHAR(10), ISNULL(e.fechaProgramada, e.fechaSolicitud), 120) AS FEnvio,
      te.nombre AS tipoEnvio,
      ee.nombre AS estadoActual,
      ee.color AS colorEstado,
      v.serie + '-' + v.numero AS comprobante,
      LTRIM(RTRIM(ISNULL(c.rSocial, ISNULL(e.contactoDestinatario, '(Sin cliente en maestro)')))) AS cliente,
      t.nombres + ' ' + t.apellidos AS transportista,
      CASE
        WHEN NULLIF(LTRIM(RTRIM(ISNULL(uChof.nombres, '') + ' ' + ISNULL(uChof.apellidos, ''))), '') IS NOT NULL
        THEN LTRIM(RTRIM(ISNULL(uChof.nombres, '') + ' ' + ISNULL(uChof.apellidos, '')))
        ELSE LTRIM(RTRIM(ISNULL(uw.nombres, '') + ' ' + ISNULL(uw.apellidos, '')))
      END AS chofer
    FROM Envios e
    INNER JOIN Ventas v ON e.idVenta = v.idVenta AND v.idEmpresa = e.idEmpresa
    LEFT JOIN Clientes c ON v.idCliente = c.idCliente AND c.idEmpresa = v.idEmpresa
    INNER JOIN TiposEnvio te ON e.idTipoEnvio = te.idTipoEnvio
    INNER JOIN EstadosEnvio ee ON e.idEstadoEnvio = ee.idEstadoEnvio
    LEFT JOIN UsuarioWeb uw ON e.idUsuarioEnvio = uw.idUsuario
    LEFT JOIN Choferes ch ON e.idChofer = ch.idChofer AND ch.estado = 1
    LEFT JOIN UsuarioWeb uChof ON ch.idUsuarioChofer = uChof.idUsuario AND uChof.idEmpresa = ch.idEmpresa
    LEFT JOIN Transportistas t ON e.idTransportista = t.idTransportista AND t.estado = 1
    WHERE ${whereSql}
    ORDER BY ISNULL(e.fechaProgramada, e.fechaSolicitud) DESC
  `;
  const result = await request.query(query);
  return result.recordset;
};

exports.obtenerDetalleEnvioRepo = async (pool, idEnvio, idEmpresa) => {
  const envioReq = await pool
    .request()
    .input("idEnvio", sql.UniqueIdentifier, idEnvio)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT e.idDespacho, e.idVenta
      FROM Envios e
      WHERE e.idEnvio = @idEnvio AND e.idEmpresa = @idEmpresa
    `);

  const envio = envioReq.recordset?.[0];
  if (!envio) return null;

  if (envio.idDespacho) {
    const DespachosRepo = require("./despachos.repository");
    return await DespachosRepo.obtenerDetalleDespachoRepo(pool, envio.idDespacho, idEmpresa);
  }

  const detalleReq = await pool
    .request()
    .input("idVenta", sql.Int, envio.idVenta)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        dv.idDetalle AS idDetalleVenta,
        dv.idProducto,
        p.codigo AS productoCodigo,
        p.descripcion AS productoDescripcion,
        dv.cantidad AS cantidadSolicitada,
        ISNULL(dv.cantEntregada, 0) AS cantidadDespachada,
        NULL AS ubicacionOrigen,
        NULL AS ubicacionDestino,
        CASE WHEN (dv.cantidad - ISNULL(dv.cantEntregada, 0)) <= 0 THEN 'DESPACHADO' ELSE 'PENDIENTE' END AS estado,
        NULL AS fechaDespacho
      FROM DetalleVenta dv
      INNER JOIN Ventas v ON v.idVenta = dv.idVenta AND v.idEmpresa = @idEmpresa
      INNER JOIN Productos p ON p.idProducto = dv.idProducto
      WHERE dv.idVenta = @idVenta
      ORDER BY p.descripcion
    `);

  return detalleReq.recordset || [];
};

/** Empresa dueña del envío (para permisos gestora / operaciones multi-empresa). */
exports.obtenerIdEmpresaPorEnvioRepo = async (pool, idEnvio) => {
  const r = await pool
    .request()
    .input("idEnvio", sql.UniqueIdentifier, idEnvio)
    .query(`SELECT idEmpresa FROM Envios WHERE idEnvio = @idEnvio`);
  return r.recordset?.[0]?.idEmpresa || null;
};

exports.obtenerEnviosVentaRepo = async (pool, idEmpresa, idVenta) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idVenta", sql.Int, idVenta)
    .query(`
      SELECT
        e.idEnvio,
        e.fechaSolicitud,
        e.fechaProgramada,
        e.fechaEntrega,
        e.costoEnvio,
        e.direccionEntrega,
        e.referencia,
        e.coordenadas,
        e.contactoDestinatario,
        e.telefonoDestinatario,
        e.observaciones,
        e.evidenciaFoto,
        te.nombre AS tipoEnvio,
        te.descripcion AS tipoEnvioDesc,
        ee.nombre AS estadoActual,
        ee.descripcion AS estadoDesc,
        ee.color AS colorEstado,
        t.nombres + ' ' + t.apellidos AS transportista,
        t.celular AS celularTransportista,
        uw.nombres + ' ' + uw.apellidos AS usuarioEnvio
      FROM Envios e
      INNER JOIN TiposEnvio te ON e.idTipoEnvio = te.idTipoEnvio
      INNER JOIN EstadosEnvio ee ON e.idEstadoEnvio = ee.idEstadoEnvio
      LEFT JOIN Transportistas t ON e.idTransportista = t.idTransportista
      INNER JOIN UsuarioWeb uw ON e.idUsuarioEnvio = uw.idUsuario
      WHERE e.idEmpresa = @idEmpresa AND e.idVenta = @idVenta
      ORDER BY e.fechaSolicitud DESC
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

exports.validarTipoEnvioRepo = async (pool, idTipoEnvio) => {
  const result = await pool
    .request()
    .input("idTipoEnvio", sql.Int, idTipoEnvio)
    .query(`
      SELECT COUNT(*) as existe
      FROM TiposEnvio
      WHERE idTipoEnvio = @idTipoEnvio
    `);

  return result.recordset[0].existe > 0;
};

exports.obtenerSucursalVentaRepo = async (pool, idVenta, idEmpresa) => {
  const result = await pool
    .request()
    .input("idVenta", sql.Int, idVenta)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT TOP 1 idSucursal
      FROM Ventas
      WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
    `);

  return result.recordset?.[0]?.idSucursal || null;
};

exports.obtenerSucursalDefaultEmpresaRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT TOP 1 idSucursal
      FROM Sucursal
      WHERE idEmpresa = @idEmpresa
      ORDER BY codigo
    `);

  return result.recordset?.[0]?.idSucursal || null;
};

exports.validarTransportistaEmpresaRepo = async (pool, idTransportista, idEmpresa) => {
  const result = await pool
    .request()
    .input("idTransportista", sql.UniqueIdentifier, idTransportista)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as existe
      FROM Transportistas
      WHERE idTransportista = @idTransportista AND idEmpresa = @idEmpresa AND estado = 1
    `);

  return result.recordset[0].existe > 0;
};

exports.validarChoferEmpresaRepo = async (pool, idChofer, idEmpresa) => {
  const result = await pool
    .request()
    .input("idChofer", sql.UniqueIdentifier, idChofer)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as existe
      FROM Choferes
      WHERE idChofer = @idChofer AND idEmpresa = @idEmpresa AND estado = 1
    `);

  return result.recordset[0].existe > 0;
};

/** Empresa donde está registrado el chofer (catálogo propio; puede diferir de Envios.idEmpresa en gestora). */
exports.obtenerIdEmpresaChoferActivaRepo = async (pool, idChofer) => {
  const result = await pool
    .request()
    .input("idChofer", sql.UniqueIdentifier, idChofer)
    .query(`
      SELECT TOP 1 idEmpresa
      FROM Choferes
      WHERE idChofer = @idChofer AND estado = 1
    `);
  return result.recordset?.[0]?.idEmpresa || null;
};

/** Empresa del transportista externo activo. */
exports.obtenerIdEmpresaTransportistaActivaRepo = async (pool, idTransportista) => {
  const result = await pool
    .request()
    .input("idTransportista", sql.UniqueIdentifier, idTransportista)
    .query(`
      SELECT TOP 1 idEmpresa
      FROM Transportistas
      WHERE idTransportista = @idTransportista AND estado = 1
    `);
  return result.recordset?.[0]?.idEmpresa || null;
};

exports.obtenerVehiculoChoferRepo = async (pool, idChofer, idEmpresa) => {
  const result = await pool
    .request()
    .input("idChofer", sql.UniqueIdentifier, idChofer)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT TOP 1 idVehiculo
      FROM Choferes
      WHERE idChofer = @idChofer AND idEmpresa = @idEmpresa AND estado = 1
    `);

  return result.recordset?.[0]?.idVehiculo || null;
};

exports.crearEnvioRepo = async (pool, user, datos) => {
  const estadoInicial = datos.idEstadoEnvioInicial != null ? datos.idEstadoEnvioInicial : 1;
  const idEmpresaInsert = datos.idEmpresaOperativa || user.empresa;

  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresaInsert)
    .input("idSucursal", sql.UniqueIdentifier, datos.idSucursal || user.sucursal || null)
    .input("idVenta", sql.Int, datos.idVenta)
    .input("idDespacho", sql.UniqueIdentifier, datos.idDespacho || null)
    .input("idTipoEnvio", sql.Int, datos.idTipoEnvio)
    .input("idEstadoEnvio", sql.Int, estadoInicial)
    .input("idTransportista", sql.UniqueIdentifier, datos.idTransportista || null)
    .input("idChofer", sql.UniqueIdentifier, datos.idChofer || null)
    .input("idVehiculoEntrega", sql.UniqueIdentifier, datos.idVehiculoEntrega || null)
    .input("idUsuarioEnvio", sql.UniqueIdentifier, user.sub)
    .input("costoEnvio", sql.Decimal(18, 2), datos.costoEnvio)
    .input("direccionEntrega", sql.VarChar, datos.direccionEntrega)
    .input("referencia", sql.VarChar, datos.referencia || null)
    .input("coordenadas", sql.VarChar, datos.coordenadas || null)
    .input("contactoDestinatario", sql.VarChar, datos.contactoDestinatario || null)
    .input("telefonoDestinatario", sql.VarChar, datos.telefonoDestinatario || null)
    .input("fechaProgramada", sql.VarChar(23), datos.fechaProgramada ? getFechaSoloSQLString(datos.fechaProgramada) || String(datos.fechaProgramada).trim().slice(0, 19).replace('T', ' ') + '.000' : null)
    .input("observaciones", sql.VarChar, datos.observaciones || null)
    .query(`
    INSERT INTO Envios (
      idEmpresa, idSucursal, idVenta, idDespacho, idTipoEnvio, idEstadoEnvio,
      idTransportista, idChofer, idVehiculoEntrega, idUsuarioEnvio, costoEnvio, direccionEntrega,
      referencia, coordenadas, contactoDestinatario, telefonoDestinatario,
      fechaProgramada, observaciones
    )
    OUTPUT INSERTED.idEnvio
    VALUES (
      @idEmpresa, @idSucursal, @idVenta, @idDespacho, @idTipoEnvio, @idEstadoEnvio,
      @idTransportista, @idChofer, @idVehiculoEntrega, @idUsuarioEnvio, @costoEnvio, @direccionEntrega,
      @referencia, @coordenadas, @contactoDestinatario, @telefonoDestinatario,
      @fechaProgramada, @observaciones
    )
  `);

  return { idEnvio: result.recordset[0].idEnvio, mensaje: "Envío creado exitosamente" };
};

exports.obtenerEnvioParaValidarRolRepo = async (pool, idEnvio, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEnvio", sql.UniqueIdentifier, idEnvio)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        COUNT(*) AS existe,
        MAX(ch.idUsuarioChofer) AS idChoferUsuario
      FROM Envios e
      LEFT JOIN Choferes ch ON ch.idChofer = e.idChofer AND ch.estado = 1
      WHERE e.idEnvio = @idEnvio AND e.idEmpresa = @idEmpresa
    `);

  return result.recordset?.[0] || { existe: false, idChoferUsuario: null };
};

exports.actualizarEnvioRepo = async (pool, user, datos) => {
  const valido = await pool
    .request()
    .input("idEnvio", sql.UniqueIdentifier, datos.idEnvio)
    .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
    .query(`
      SELECT COUNT(*) as existe FROM Envios WHERE idEnvio = @idEnvio AND idEmpresa = @idEmpresa
    `);
  if (valido.recordset[0].existe === 0) return null;

  const updates = [];
  const req = pool.request()
    .input("idEnvio", sql.UniqueIdentifier, datos.idEnvio)
    .input("idEmpresa", sql.UniqueIdentifier, user.empresa);

  if (datos.fechaProgramada !== undefined) {
    updates.push("fechaProgramada = @fechaProgramada");
    req.input("fechaProgramada", sql.VarChar(23), datos.fechaProgramada ? getFechaSoloSQLString(datos.fechaProgramada) || String(datos.fechaProgramada).trim().slice(0, 19).replace('T', ' ') + '.000' : null);
  }
  if (datos.direccionEntrega !== undefined) {
    updates.push("direccionEntrega = @direccionEntrega");
    req.input("direccionEntrega", sql.VarChar(255), datos.direccionEntrega);
  }
  if (datos.idChofer !== undefined) {
    updates.push("idChofer = @idChofer");
    req.input("idChofer", sql.UniqueIdentifier, datos.idChofer || null);
  }
  if (datos.idTransportista !== undefined) {
    updates.push("idTransportista = @idTransportista");
    req.input("idTransportista", sql.UniqueIdentifier, datos.idTransportista || null);
  }
  if (datos.contactoDestinatario !== undefined) {
    updates.push("contactoDestinatario = @contactoDestinatario");
    req.input("contactoDestinatario", sql.VarChar(100), datos.contactoDestinatario || null);
  }
  if (datos.telefonoDestinatario !== undefined) {
    updates.push("telefonoDestinatario = @telefonoDestinatario");
    req.input("telefonoDestinatario", sql.VarChar(15), datos.telefonoDestinatario || null);
  }
  if (datos.observaciones !== undefined) {
    updates.push("observaciones = @observaciones");
    req.input("observaciones", sql.VarChar(300), datos.observaciones || null);
  }

  if (updates.length === 0) return { idEnvio: datos.idEnvio, mensaje: "Sin cambios" };

  await req.query(`
    UPDATE Envios SET ${updates.join(", ")}
    WHERE idEnvio = @idEnvio AND idEmpresa = @idEmpresa
  `);
  return { idEnvio: datos.idEnvio, mensaje: "Envío actualizado" };
};

exports.eliminarEnvioRepo = async (pool, idEnvio, idEmpresa) => {
  const valido = await pool
    .request()
    .input("idEnvio", sql.UniqueIdentifier, idEnvio)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as existe FROM Envios WHERE idEnvio = @idEnvio AND idEmpresa = @idEmpresa
    `);
  if (valido.recordset[0].existe === 0) return false;

  await pool.request()
    .input("idEnvio", sql.UniqueIdentifier, idEnvio)
    .query(`DELETE FROM HistorialEstadosEnvio WHERE idEnvio = @idEnvio`);

  await pool.request()
    .input("idEnvio", sql.UniqueIdentifier, idEnvio)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`DELETE FROM Envios WHERE idEnvio = @idEnvio AND idEmpresa = @idEmpresa`);

  return true;
};

exports.validarEnvioEmpresaRepo = async (pool, idEnvio, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEnvio", sql.UniqueIdentifier, idEnvio)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as existe
      FROM Envios
      WHERE idEnvio = @idEnvio AND idEmpresa = @idEmpresa
    `);

  return result.recordset[0].existe > 0;
};

exports.validarEstadoEnvioRepo = async (pool, idEstadoEnvio) => {
  const result = await pool
    .request()
    .input("idEstadoEnvio", sql.Int, idEstadoEnvio)
    .query(`
      SELECT COUNT(*) as existe
      FROM EstadosEnvio
      WHERE idEstadoEnvio = @idEstadoEnvio
    `);

  return result.recordset[0].existe > 0;
};

exports.obtenerNombreEstadoEnvioPorIdRepo = async (pool, idEstadoEnvio) => {
  const r = await pool
    .request()
    .input("id", sql.Int, idEstadoEnvio)
    .query(`SELECT TOP 1 nombre FROM EstadosEnvio WHERE idEstadoEnvio = @id`);
  return r.recordset?.[0]?.nombre || null;
};

exports.obtenerEstadoNombreEnvioPorIdEnvioRepo = async (pool, idEnvio, idEmpresa) => {
  const r = await pool
    .request()
    .input("idEnvio", sql.UniqueIdentifier, idEnvio)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT ee.nombre AS nombreEstado, e.idEstadoEnvio
      FROM Envios e
      INNER JOIN EstadosEnvio ee ON ee.idEstadoEnvio = e.idEstadoEnvio
      WHERE e.idEnvio = @idEnvio AND e.idEmpresa = @idEmpresa
    `);
  return r.recordset?.[0] || null;
};

/**
 * Envíos vinculados al despacho (Envios.idDespacho): actualiza estado e historial.
 */
exports.marcarEnviosPorDespachoAEstadoNombreRepo = async (
  pool,
  idDespacho,
  idEmpresa,
  nombreEstadoObjetivo,
  idUsuarioUuid,
  observacionesHistorial,
  fechaCambioCliente
) => {
  const fechaCambioSql = resolveFechaHoraClienteSql(fechaCambioCliente);
  const idNuevoRes = await pool
    .request()
    .input("nombre", sql.VarChar(40), nombreEstadoObjetivo)
    .query(`SELECT TOP 1 idEstadoEnvio AS id FROM EstadosEnvio WHERE nombre = @nombre`);
  const idNuevo = idNuevoRes.recordset?.[0]?.id;
  if (idNuevo == null) {
    console.error("marcarEnviosPorDespachoAEstadoNombreRepo: estado no en catálogo:", nombreEstadoObjetivo);
    return { ok: false };
  }

  const lista = await pool
    .request()
    .input("idDespacho", sql.UniqueIdentifier, idDespacho)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT idEnvio, idEstadoEnvio
      FROM Envios
      WHERE idEmpresa = @idEmpresa AND idDespacho = @idDespacho
    `);

  const rows = lista.recordset || [];
  if (!rows.length) return { ok: true, actualizados: 0 };

  const transaction = pool.transaction();
  await transaction.begin();
  try {
    for (const row of rows) {
      if (row.idEstadoEnvio === idNuevo) continue;
      const rq = transaction.request();
      rq.input("idEnvio", sql.UniqueIdentifier, row.idEnvio);
      rq.input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
      rq.input("idEstadoNuevo", sql.Int, idNuevo);
      rq.input("idEstadoAnterior", sql.Int, row.idEstadoEnvio);
      rq.input("idUsuarioCambio", sql.UniqueIdentifier, idUsuarioUuid);
      rq.input("obs", sql.NVarChar(500), observacionesHistorial || null);
      rq.input("fechaCambio", sql.VarChar(23), fechaCambioSql);
      await rq.query(`
        UPDATE Envios SET idEstadoEnvio = @idEstadoNuevo WHERE idEnvio = @idEnvio AND idEmpresa = @idEmpresa
      `);
      await rq.query(`
        INSERT INTO HistorialEstadosEnvio (
          idEnvio, idEstadoAnterior, idEstadoNuevo, idUsuarioCambio, fechaCambio, observaciones
        ) VALUES (
          @idEnvio, @idEstadoAnterior, @idEstadoNuevo, @idUsuarioCambio, TRY_CONVERT(DATETIME, @fechaCambio, 120), @obs
        )
      `);
    }
    await transaction.commit();
    return { ok: true, actualizados: rows.length };
  } catch (err) {
    await transaction.rollback();
    console.error("marcarEnviosPorDespachoAEstadoNombreRepo:", err);
    throw err;
  }
};

exports.actualizarEstadoEnvioRepo = async (pool, user, datos) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const request = transaction.request();
    request.input("idEmpresa", sql.UniqueIdentifier, user.empresa);

    // Obtener estado anterior
    const estadoAnteriorResult = await request
      .input("idEnvio", sql.UniqueIdentifier, datos.idEnvio)
      .query(`
        SELECT idEstadoEnvio, idVenta
        FROM Envios
        WHERE idEnvio = @idEnvio AND idEmpresa = @idEmpresa
      `);

    const estadoAnterior = estadoAnteriorResult.recordset[0].idEstadoEnvio;
    const idVenta = estadoAnteriorResult.recordset[0].idVenta;

    const fechaCambioSql = resolveFechaHoraClienteSql(datos.fechaCambio || datos.fechaEntrega);
    const fechaEntrega = datos.idEstadoEnvio === 4
      ? resolveFechaHoraClienteSql(datos.fechaEntrega || datos.fechaCambio)
      : null;

    await request
      .input("idEstadoEnvio", sql.Int, datos.idEstadoEnvio)
      .input("fechaEntrega", sql.VarChar(23), fechaEntrega)
      .input("evidenciaFoto", sql.VarChar, datos.evidenciaFoto || null)
      .query(`
        UPDATE Envios
        SET idEstadoEnvio = @idEstadoEnvio,
            fechaEntrega = CASE WHEN @idEstadoEnvio = 4 THEN TRY_CONVERT(DATETIME, @fechaEntrega, 120) ELSE fechaEntrega END,
            evidenciaFoto = @evidenciaFoto
        WHERE idEnvio = @idEnvio AND idEmpresa = @idEmpresa
      `);

    // Registrar cambio de estado en historial
    await request
      .input("idEstadoAnterior", sql.Int, estadoAnterior)
      .input("idEstadoNuevo", sql.Int, datos.idEstadoEnvio)
      .input("idUsuarioCambio", sql.UniqueIdentifier, user.sub)
      .input("observaciones", sql.VarChar, datos.observaciones || null)
      .input("fechaCambio", sql.VarChar(23), fechaCambioSql)
      .query(`
        INSERT INTO HistorialEstadosEnvio (
          idEnvio, idEstadoAnterior, idEstadoNuevo, idUsuarioCambio,
          fechaCambio, observaciones
        ) VALUES (
          @idEnvio, @idEstadoAnterior, @idEstadoNuevo, @idUsuarioCambio,
          TRY_CONVERT(DATETIME, @fechaCambio, 120), @observaciones
        )
      `);

    // Sincronizar estado del pedido/venta cuando el envío se marca como final.
    // ENTREGADO / DEVUELTO / NO_ENCONTRADO actualiza Ventas + DetalleVenta.
    const estadoPedido = await request.query(`
      SELECT nombre
      FROM EstadosEnvio
      WHERE idEstadoEnvio = @idEstadoNuevo
    `).catch(() => null);

    // Nota: por simplicidad se usa nombre (más robusto que id numérico).
    const nombreEstadoNuevo = estadoPedido?.recordset?.[0]?.nombre;

    if (['ENTREGADO', 'DEVUELTO', 'NO_ENCONTRADO'].includes(nombreEstadoNuevo)) {
      // EstadosPedidos es catálogo global (sin idEmpresa en la mayoría de instalaciones).
      const idsRes = await request.query(`
        SELECT
          (SELECT TOP 1 idEstadoPedido FROM EstadosPedidos WHERE descripcion = 'Entregado') AS idEstadoPedidoEntregado,
          (SELECT TOP 1 idEstadoPedido FROM EstadosPedidos WHERE descripcion = 'Devuelto') AS idEstadoPedidoDevuelto,
          (SELECT TOP 1 idEstadoPedido FROM EstadosPedidos WHERE descripcion = 'No encontrado') AS idEstadoPedidoNoEncontrado
      `);

      const ids = idsRes?.recordset?.[0] || {};

      let idEstadoPedidoNuevo = null;
      if (nombreEstadoNuevo === 'ENTREGADO') idEstadoPedidoNuevo = ids.idEstadoPedidoEntregado;
      if (nombreEstadoNuevo === 'DEVUELTO') idEstadoPedidoNuevo = ids.idEstadoPedidoDevuelto;
      if (nombreEstadoNuevo === 'NO_ENCONTRADO') idEstadoPedidoNuevo = ids.idEstadoPedidoNoEncontrado;

      if (!idEstadoPedidoNuevo) {
        throw new Error('ESTADO_PEDIDO_NO_CONFIGURADO_PARA_' + nombreEstadoNuevo);
      }

      const cantEntregadaNuevoSql = nombreEstadoNuevo === 'ENTREGADO' ? 'dv.cantidad' : 'CAST(0 AS DECIMAL(18,3))';
      const fUltEntregaCase = nombreEstadoNuevo === 'ENTREGADO'
        ? 'TRY_CONVERT(DATETIME, @fUltEntrega, 120)'
        : 'NULL';
      if (nombreEstadoNuevo === 'ENTREGADO') {
        request.input('fUltEntrega', sql.VarChar(23), fechaCambioSql);
      }

      request.input('idVenta', sql.Int, idVenta);
      request.input('idEstadoPedidoNuevo', sql.Int, idEstadoPedidoNuevo);

      await request.query(`
        UPDATE dv
        SET
          dv.cantEntregada = ${cantEntregadaNuevoSql},
          dv.fUltEntrega = ${fUltEntregaCase},
          dv.idEstadoPedido = @idEstadoPedidoNuevo
        FROM DetalleVenta dv
        WHERE dv.idVenta = @idVenta
      `);

      await request.query(`
        UPDATE Ventas
        SET idEstadoPedido = @idEstadoPedidoNuevo
        WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
      `);

      // Sincronizar ProgramacionPedidos solo si la tabla existe (BD sin módulo legacy).
      const legacyProg = await request.query(`
        SELECT CASE WHEN OBJECT_ID(N'dbo.ProgramacionPedidos', N'U') IS NOT NULL THEN 1 ELSE 0 END AS existe
      `);
      if (legacyProg.recordset?.[0]?.existe === 1) {
        await request.query(`
          UPDATE pp
          SET pp.idEstado = @idEstadoPedidoNuevo
          FROM ProgramacionPedidos pp
          INNER JOIN Ventas v ON v.compVenta = pp.CompVentas AND v.idEmpresa = @idEmpresa
          WHERE v.idVenta = @idVenta
        `);
      }
    }

    await transaction.commit();
    return {
      idEnvio: datos.idEnvio,
      estadoAnterior,
      estadoNuevo: datos.idEstadoEnvio,
      fechaCambio: new Date(),
      mensaje: "Estado del envío actualizado exitosamente"
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

exports.obtenerEnviosPorChoferRepo = async (pool, _idEmpresaLegacy, idChoferUsuario) => {
  const result = await pool
    .request()
    .input("idChoferUsuario", sql.UniqueIdentifier, idChoferUsuario)
    .query(`
      SELECT
        e.idEnvio,
        e.fechaSolicitud AS fechaEnvio,
        e.fechaProgramada AS fechaEntregaEstimada,
        e.fechaEntrega AS fechaEntregaReal,
        e.costoEnvio,
        e.direccionEntrega,
        te.nombre AS tipoEnvio,
        ee.nombre AS estado,
        ee.color AS colorEstado,
        v.serie + '-' + v.numero AS comprobante,
        c.rSocial AS cliente,
        u.nombres + ' ' + u.apellidos AS chofer,
        vh.placa AS placaVehiculo
      FROM Envios e
      INNER JOIN Ventas v ON e.idVenta = v.idVenta AND v.idEmpresa = e.idEmpresa
      INNER JOIN Clientes c ON v.idCliente = c.idCliente AND c.idEmpresa = v.idEmpresa
      INNER JOIN TiposEnvio te ON e.idTipoEnvio = te.idTipoEnvio
      INNER JOIN EstadosEnvio ee ON e.idEstadoEnvio = ee.idEstadoEnvio
      INNER JOIN Choferes ch ON e.idChofer = ch.idChofer AND ch.estado = 1
      INNER JOIN UsuarioWeb u ON ch.idUsuarioChofer = u.idUsuario AND u.idEmpresa = ch.idEmpresa
      LEFT JOIN Vehiculos vh ON e.idVehiculoEntrega = vh.idVehiculo AND vh.idEmpresa = ch.idEmpresa
      WHERE u.idUsuario = @idChoferUsuario
      ORDER BY e.fechaSolicitud DESC
    `);

  return result.recordset;
};

exports.asignarTransportistaRepo = async (pool, user, datos) => {
  const result = await pool
    .request()
    .input("idEnvio", sql.UniqueIdentifier, datos.idEnvio)
    .input("idTransportista", sql.UniqueIdentifier, datos.idTransportista)
    .query(`
      UPDATE Envios
      SET idTransportista = @idTransportista
      WHERE idEnvio = @idEnvio
    `);

  return { idEnvio: datos.idEnvio, idTransportista: datos.idTransportista, mensaje: "Transportista asignado exitosamente" };
};

exports.obtenerTransportistasRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        idTransportista,
        nombres,
        apellidos,
        documento,
        licencia,
        celular,
        email,
        vehiculo,
        placa,
        estado,
        fRegistro,
        idEmpresa
      FROM Transportistas
      WHERE idEmpresa = @idEmpresa AND estado = 1
      ORDER BY nombres, apellidos
    `);

  return result.recordset;
};

/** Transportistas activos de varias empresas (gestora + gestionadas). */
exports.obtenerTransportistasMultiEmpresaRepo = async (pool, idsEmpresa) => {
  const list = [...new Set((idsEmpresa || []).filter(Boolean))];
  if (list.length === 0) return [];
  const request = pool.request();
  list.forEach((id, i) => {
    request.input(`tm${i}`, sql.UniqueIdentifier, id);
  });
  const inClause = list.map((_, i) => `@tm${i}`).join(", ");
  const result = await request.query(`
      SELECT
        t.idTransportista,
        t.nombres,
        t.apellidos,
        t.documento,
        t.licencia,
        t.celular,
        t.email,
        t.vehiculo,
        t.placa,
        t.estado,
        t.fRegistro,
        t.idEmpresa,
        em.razon_Social AS razonSocialEmpresa
      FROM Transportistas t
      INNER JOIN Empresas em ON em.idEmpresa = t.idEmpresa
      WHERE t.idEmpresa IN (${inClause}) AND t.estado = 1
      ORDER BY em.razon_Social, t.nombres, t.apellidos
    `);
  return result.recordset || [];
};

exports.crearTransportistaRepo = async (pool, idEmpresa, datos) => {
  const nombres = (datos?.nombres || '').toString().trim().slice(0, 50);
  const apellidos = (datos?.apellidos || '').toString().trim().slice(0, 50);
  const documento = (datos?.documento || '').toString().trim().slice(0, 20);
  const licencia = datos?.licencia != null ? (datos.licencia || '').toString().trim().slice(0, 20) : null;
  const celular = (datos?.celular || '').toString().trim().slice(0, 15);
  const email = datos?.email != null ? (datos.email || '').toString().trim().slice(0, 100) : null;
  const vehiculo = datos?.vehiculo != null ? (datos.vehiculo || '').toString().trim().slice(0, 50) : null;
  const placa = datos?.placa != null ? (datos.placa || '').toString().trim().toUpperCase().slice(0, 10) : null;

  const existeRes = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("documento", sql.VarChar(20), documento)
    .query(`
      SELECT COUNT(*) as existe
      FROM Transportistas
      WHERE idEmpresa = @idEmpresa AND documento = @documento
    `);

  if (existeRes.recordset?.[0]?.existe > 0) {
    throw new Error("TRANSPORTISTA_YA_EXISTE");
  }

  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("nombres", sql.VarChar(50), nombres)
    .input("apellidos", sql.VarChar(50), apellidos)
    .input("documento", sql.VarChar(20), documento)
    .input("licencia", sql.VarChar(20), licencia)
    .input("celular", sql.VarChar(15), celular)
    .input("email", sql.VarChar(100), email)
    .input("vehiculo", sql.VarChar(50), vehiculo)
    .input("placa", sql.VarChar(10), placa)
    .query(`
      INSERT INTO Transportistas (
        idEmpresa, nombres, apellidos, documento, licencia, celular,
        email, vehiculo, placa, estado
      )
      OUTPUT INSERTED.idTransportista
      VALUES (
        @idEmpresa, @nombres, @apellidos, @documento, @licencia, @celular,
        @email, @vehiculo, @placa, 1
      )
    `);

  return { idTransportista: result.recordset?.[0]?.idTransportista, documento, placa };
};

exports.obtenerTiposEnvioRepo = async (pool) => {
  const result = await pool
    .request()
    .query(`
      SELECT
        idTipoEnvio,
        nombre,
        descripcion,
        costoBase,
        requiereTransportista
      FROM TiposEnvio
      ORDER BY nombre
    `);

  return result.recordset;
};

exports.obtenerEstadosEnvioRepo = async (pool) => {
  const result = await pool
    .request()
    .query(`
      SELECT
        idEstadoEnvio,
        nombre,
        descripcion,
        color,
        orden
      FROM EstadosEnvio
      ORDER BY orden
    `);

  return result.recordset;
};

exports.obtenerEnviosPorEstadoRepo = async (pool, idEmpresa, estado) => {
  let whereClause = "WHERE e.idEmpresa = @idEmpresa";

  if (estado) {
    whereClause += " AND ee.nombre = @estado";
  }

  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("estado", sql.VarChar, estado || null)
    .query(`
      SELECT
        e.idEnvio,
        e.fechaSolicitud,
        e.fechaProgramada,
        e.fechaEntrega,
        e.costoEnvio,
        e.direccionEntrega,
        e.contactoDestinatario,
        e.telefonoDestinatario,
        v.serie + '-' + v.numero AS comprobante,
        c.rSocial AS cliente,
        te.nombre AS tipoEnvio,
        ee.nombre AS estado,
        ee.color AS colorEstado,
        t.nombres + ' ' + t.apellidos AS transportista
      FROM Envios e
      INNER JOIN Ventas v ON e.idVenta = v.idVenta
      INNER JOIN Clientes c ON v.idCliente = c.idCliente
      INNER JOIN TiposEnvio te ON e.idTipoEnvio = te.idTipoEnvio
      INNER JOIN EstadosEnvio ee ON e.idEstadoEnvio = ee.idEstadoEnvio
      LEFT JOIN Transportistas t ON e.idTransportista = t.idTransportista
      ${whereClause}
      ORDER BY e.fechaSolicitud DESC
    `);

  return result.recordset;
};

exports.obtenerEnviosPorTransportistaRepo = async (pool, idEmpresa, idTransportista) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idTransportista", sql.UniqueIdentifier, idTransportista)
    .query(`
      SELECT
        e.idEnvio,
        e.fechaSolicitud,
        e.fechaProgramada,
        e.fechaEntrega,
        e.costoEnvio,
        e.direccionEntrega,
        e.contactoDestinatario,
        e.telefonoDestinatario,
        v.serie + '-' + v.numero AS comprobante,
        c.rSocial AS cliente,
        te.nombre AS tipoEnvio,
        ee.nombre AS estado,
        ee.color AS colorEstado
      FROM Envios e
      INNER JOIN Ventas v ON e.idVenta = v.idVenta
      INNER JOIN Clientes c ON v.idCliente = c.idCliente
      INNER JOIN TiposEnvio te ON e.idTipoEnvio = te.idTipoEnvio
      INNER JOIN EstadosEnvio ee ON e.idEstadoEnvio = ee.idEstadoEnvio
      WHERE e.idEmpresa = @idEmpresa
        AND e.idTransportista = @idTransportista
        AND e.fechaProgramada >= CAST(GETDATE() AS DATE)
      ORDER BY e.fechaProgramada ASC
    `);

  return result.recordset;
};