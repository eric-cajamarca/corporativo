const sql = require("mssql");
const { getNowLocal, getNowLocalSQLString, getFechaSoloSQLString } = require("../utils/fechaHoraLocal.util");

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

exports.crearEnvioRepo = async (pool, user, datos) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
    .input("idSucursal", sql.UniqueIdentifier, user.sucursal || null)
    .input("idVenta", sql.Int, datos.idVenta)
    .input("idTipoEnvio", sql.Int, datos.idTipoEnvio)
    .input("idEstadoEnvio", sql.Int, 1) // Estado inicial: AGENDADO
    .input("idTransportista", sql.UniqueIdentifier, datos.idTransportista || null)
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
        idEmpresa, idSucursal, idVenta, idTipoEnvio, idEstadoEnvio,
        idTransportista, idUsuarioEnvio, costoEnvio, direccionEntrega,
        referencia, coordenadas, contactoDestinatario, telefonoDestinatario,
        fechaProgramada, observaciones
      )
      OUTPUT INSERTED.idEnvio
      VALUES (
        @idEmpresa, @idSucursal, @idVenta, @idTipoEnvio, @idEstadoEnvio,
        @idTransportista, @idUsuarioEnvio, @costoEnvio, @direccionEntrega,
        @referencia, @coordenadas, @contactoDestinatario, @telefonoDestinatario,
        @fechaProgramada, @observaciones
      )
    `);

  return { idEnvio: result.recordset[0].idEnvio, mensaje: "Envío creado exitosamente" };
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

exports.actualizarEstadoEnvioRepo = async (pool, user, datos) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const request = transaction.request();

    // Obtener estado anterior
    const estadoAnteriorResult = await request
      .input("idEnvio", sql.UniqueIdentifier, datos.idEnvio)
      .query(`
        SELECT idEstadoEnvio FROM Envios WHERE idEnvio = @idEnvio
      `);

    const estadoAnterior = estadoAnteriorResult.recordset[0].idEstadoEnvio;

    // Actualizar estado del envío
    const fechaEntrega = datos.idEstadoEnvio === 4 ? getNowLocalSQLString() : null; // 4 = ENTREGADO (hora local servidor)

    await request
      .input("idEstadoEnvio", sql.Int, datos.idEstadoEnvio)
      .input("fechaEntrega", sql.VarChar(23), fechaEntrega)
      .input("evidenciaFoto", sql.VarChar, datos.evidenciaFoto || null)
      .query(`
        UPDATE Envios
        SET idEstadoEnvio = @idEstadoEnvio,
            fechaEntrega = CASE WHEN @idEstadoEnvio = 4 THEN GETDATE() ELSE fechaEntrega END,
            evidenciaFoto = @evidenciaFoto
        WHERE idEnvio = @idEnvio
      `);

    // Registrar cambio de estado en historial
    await request
      .input("idEstadoAnterior", sql.Int, estadoAnterior)
      .input("idEstadoNuevo", sql.Int, datos.idEstadoEnvio)
      .input("idUsuarioCambio", sql.UniqueIdentifier, user.sub)
      .input("observaciones", sql.VarChar, datos.observaciones || null)
      .query(`
        INSERT INTO HistorialEstadosEnvio (
          idEnvio, idEstadoAnterior, idEstadoNuevo, idUsuarioCambio,
          fechaCambio, observaciones
        ) VALUES (
          @idEnvio, @idEstadoAnterior, @idEstadoNuevo, @idUsuarioCambio,
          GETDATE(), @observaciones
        )
      `);

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
        fRegistro
      FROM Transportistas
      WHERE idEmpresa = @idEmpresa AND estado = 1
      ORDER BY nombres, apellidos
    `);

  return result.recordset;
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