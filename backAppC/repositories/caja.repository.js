const sql = require("mssql");

exports.obtenerCajasRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        c.idCaja,
        c.nombre,
        c.descripcion,
        s.nombre AS sucursal,
        c.estado,
        CASE WHEN ac.idApertura IS NOT NULL THEN 1 ELSE 0 END AS cajaAbierta,
        ac.fechaApertura,
        ac.montoInicial,
        uw.nombres + ' ' + uw.apellidos AS usuarioApertura
      FROM Cajas c
      INNER JOIN Sucursal s ON c.idSucursal = s.idSucursal
      LEFT JOIN AperturasCaja ac ON c.idCaja = ac.idCaja AND ac.estado = 1
      LEFT JOIN UsuarioWeb uw ON ac.idUsuario = uw.idUsuario
      WHERE c.idEmpresa = @idEmpresa
      ORDER BY c.nombre
    `);

  return result.recordset;
};

exports.validarCajaEmpresaRepo = async (pool, idCaja, idEmpresa) => {
  const result = await pool
    .request()
    .input("idCaja", sql.UniqueIdentifier, idCaja)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as existe
      FROM Cajas
      WHERE idCaja = @idCaja AND idEmpresa = @idEmpresa AND estado = 1
    `);

  return result.recordset[0].existe > 0;
};

exports.verificarCajaAbiertaRepo = async (pool, idCaja) => {
  const result = await pool
    .request()
    .input("idCaja", sql.UniqueIdentifier, idCaja)
    .query(`
      SELECT COUNT(*) as abierta
      FROM AperturasCaja
      WHERE idCaja = @idCaja AND estado = 1
    `);

  return result.recordset[0].abierta > 0;
};

exports.abrirCajaRepo = async (pool, user, datos) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const request = transaction.request();

    // Insertar apertura de caja
    const result = await request
      .input("idCaja", sql.UniqueIdentifier, datos.idCaja)
      .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
      .input("idSucursal", sql.UniqueIdentifier, user.sucursal || null)
      .input("idUsuario", sql.UniqueIdentifier, user.sub)
      .input("montoInicial", sql.Decimal(18, 2), datos.montoInicial)
      .input("observaciones", sql.VarChar, datos.observaciones || null)
      .query(`
        INSERT INTO AperturasCaja (
          idCaja, idEmpresa, idSucursal, idUsuario,
          fechaApertura, montoInicial, observaciones, estado
        )
        OUTPUT INSERTED.idApertura
        VALUES (
          @idCaja, @idEmpresa, @idSucursal, @idUsuario,
          GETDATE(), @montoInicial, @observaciones, 1
        )
      `);

    await transaction.commit();
    return result.recordset[0];
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

exports.validarAperturaEmpresaRepo = async (pool, idApertura, idEmpresa) => {
  const result = await pool
    .request()
    .input("idApertura", sql.UniqueIdentifier, idApertura)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as existe
      FROM AperturasCaja
      WHERE idApertura = @idApertura AND idEmpresa = @idEmpresa AND estado = 1
    `);

  return result.recordset[0].existe > 0;
};

exports.cerrarCajaRepo = async (pool, user, datos) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const request = transaction.request();

    // Calcular diferencias y totales
    const resumenResult = await request
      .input("idApertura", sql.UniqueIdentifier, datos.idApertura)
      .query(`
        SELECT
          ac.montoInicial,
          ISNULL(SUM(CASE WHEN tmc.tipo = 'I' THEN mc.monto ELSE 0 END), 0) AS ingresos,
          ISNULL(SUM(CASE WHEN tmc.tipo = 'E' THEN mc.monto ELSE 0 END), 0) AS egresos
        FROM AperturasCaja ac
        LEFT JOIN MovimientosCaja mc ON ac.idApertura = mc.idApertura
        LEFT JOIN TiposMovimientoCaja tmc ON mc.idTipoMovimientoCaja = tmc.idTipoMovimientoCaja
        WHERE ac.idApertura = @idApertura
        GROUP BY ac.montoInicial
      `);

    const resumen = resumenResult.recordset[0];
    const saldoEsperado = resumen.montoInicial + resumen.ingresos - resumen.egresos;
    const diferencia = datos.montoFinal - saldoEsperado;

    // Obtener datos de la apertura
    const aperturaResult = await request
      .input("idApertura", sql.UniqueIdentifier, datos.idApertura)
      .query(`
        SELECT idEmpresa, idSucursal
        FROM AperturasCaja
        WHERE idApertura = @idApertura
      `);

    const apertura = aperturaResult.recordset[0];

    // Insertar cierre
    const cierreResult = await request
      .input("idApertura", sql.UniqueIdentifier, datos.idApertura)
      .input("idEmpresa", sql.UniqueIdentifier, apertura.idEmpresa)
      .input("idSucursal", sql.UniqueIdentifier, apertura.idSucursal)
      .input("idUsuarioCierre", sql.UniqueIdentifier, user.sub)
      .input("montoFinal", sql.Decimal(18, 2), datos.montoFinal)
      .input("diferencia", sql.Decimal(18, 2), diferencia)
      .input("observaciones", sql.VarChar, datos.observaciones || null)
      .query(`
        INSERT INTO CierresCaja (
          idApertura, idEmpresa, idSucursal, idUsuarioCierre,
          fechaCierre, montoFinal, diferencia, observaciones
        )
        OUTPUT INSERTED.idCierre
        VALUES (
          @idApertura, @idEmpresa, @idSucursal, @idUsuarioCierre,
          GETDATE(), @montoFinal, @diferencia, @observaciones
        )
      `);

    // Cerrar la apertura
    await request
      .input("idApertura", sql.UniqueIdentifier, datos.idApertura)
      .query(`
        UPDATE AperturasCaja
        SET estado = 0
        WHERE idApertura = @idApertura
      `);

    await transaction.commit();
    return cierreResult.recordset[0];
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

exports.verificarAperturaAbiertaRepo = async (pool, idApertura, idEmpresa) => {
  const result = await pool
    .request()
    .input("idApertura", sql.UniqueIdentifier, idApertura)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as abierta
      FROM AperturasCaja
      WHERE idApertura = @idApertura AND idEmpresa = @idEmpresa AND estado = 1
    `);

  return result.recordset[0].abierta > 0;
};

exports.validarTipoMovimientoRepo = async (pool, idTipoMovimientoCaja) => {
  const result = await pool
    .request()
    .input("idTipoMovimientoCaja", sql.Int, idTipoMovimientoCaja)
    .query(`
      SELECT COUNT(*) as existe
      FROM TiposMovimientoCaja
      WHERE idTipoMovimientoCaja = @idTipoMovimientoCaja
    `);

  return result.recordset[0].existe > 0;
};

exports.registrarMovimientoRepo = async (pool, user, datos) => {
  const result = await pool
    .request()
    .input("idApertura", sql.UniqueIdentifier, datos.idApertura)
    .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
    .input("idSucursal", sql.UniqueIdentifier, user.sucursal || null)
    .input("idUsuario", sql.UniqueIdentifier, user.sub)
    .input("idTipoMovimientoCaja", sql.Int, datos.idTipoMovimientoCaja)
    .input("concepto", sql.VarChar, datos.concepto)
    .input("monto", sql.Decimal(18, 2), datos.monto)
    .input("idMediosPago", sql.Int, datos.idMediosPago || null)
    .input("idMoneda", sql.Int, datos.idMoneda || 1)
    .input("documentoRelacionado", sql.VarChar, datos.documentoRelacionado || null)
    .input("observaciones", sql.VarChar, datos.observaciones || null)
    .query(`
      INSERT INTO MovimientosCaja (
        idApertura, idEmpresa, idSucursal, idUsuario, idTipoMovimientoCaja,
        fechaMovimiento, concepto, monto, idMediosPago, idMoneda,
        documentoRelacionado, observaciones
      )
      OUTPUT INSERTED.idMovimientoCaja
      VALUES (
        @idApertura, @idEmpresa, @idSucursal, @idUsuario, @idTipoMovimientoCaja,
        GETDATE(), @concepto, @monto, @idMediosPago, @idMoneda,
        @documentoRelacionado, @observaciones
      )
    `);

  return result.recordset[0];
};

exports.obtenerMovimientosCajaRepo = async (pool, idEmpresa, filtros) => {
  let whereClause = "WHERE mc.idEmpresa = @idEmpresa";

  if (filtros.idApertura) {
    whereClause += " AND mc.idApertura = @idApertura";
  }

  if (filtros.fechaDesde) {
    whereClause += " AND mc.fechaMovimiento >= @fechaDesde";
  }

  if (filtros.fechaHasta) {
    whereClause += " AND mc.fechaMovimiento <= @fechaHasta";
  }

  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idApertura", sql.UniqueIdentifier, filtros.idApertura || null)
    .input("fechaDesde", sql.DateTime, filtros.fechaDesde || null)
    .input("fechaHasta", sql.DateTime, filtros.fechaHasta || null)
    .query(`
      SELECT
        mc.idMovimientoCaja,
        mc.fechaMovimiento,
        mc.concepto,
        mc.monto,
        tmc.nombre AS tipoMovimiento,
        tmc.tipo AS tipoOperacion,
        mp.descripcion AS medioPago,
        mon.simbolo + ' ' + mon.descripcion AS moneda,
        mc.documentoRelacionado,
        mc.observaciones,
        uw.nombres + ' ' + uw.apellidos AS usuario
      FROM MovimientosCaja mc
      INNER JOIN TiposMovimientoCaja tmc ON mc.idTipoMovimientoCaja = tmc.idTipoMovimientoCaja
      LEFT JOIN MediosPago mp ON mc.idMediosPago = mp.idMediosPago
      INNER JOIN Moneda mon ON mc.idMoneda = mon.idMoneda
      INNER JOIN UsuarioWeb uw ON mc.idUsuario = uw.idUsuario
      ${whereClause}
      ORDER BY mc.fechaMovimiento DESC
    `);

  return result.recordset;
};

exports.obtenerTiposMovimientoCajaRepo = async (pool) => {
  const result = await pool
    .request()
    .query(`
      SELECT
        idTipoMovimientoCaja,
        nombre,
        descripcion,
        tipo
      FROM TiposMovimientoCaja
      ORDER BY nombre
    `);

  return result.recordset;
};

exports.obtenerResumenCajaDiarioRepo = async (pool, idEmpresa, fecha) => {
  const fechaFiltro = fecha || new Date().toISOString().split('T')[0];

  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fecha", sql.Date, fechaFiltro)
    .query(`
      SELECT
        ac.idApertura,
        c.nombre AS caja,
        s.nombre AS sucursal,
        ac.fechaApertura,
        ac.montoInicial,
        ISNULL(SUM(CASE WHEN tmc.tipo = 'I' THEN mc.monto ELSE 0 END), 0) AS totalIngresos,
        ISNULL(SUM(CASE WHEN tmc.tipo = 'E' THEN mc.monto ELSE 0 END), 0) AS totalEgresos,
        ac.montoInicial +
        ISNULL(SUM(CASE WHEN tmc.tipo = 'I' THEN mc.monto ELSE 0 END), 0) -
        ISNULL(SUM(CASE WHEN tmc.tipo = 'E' THEN mc.monto ELSE 0 END), 0) AS saldoEsperado,
        CASE WHEN cc.idCierre IS NOT NULL THEN 'CERRADA' ELSE 'ABIERTA' END AS estado,
        uw.nombres + ' ' + uw.apellidos AS usuarioApertura
      FROM AperturasCaja ac
      INNER JOIN Cajas c ON ac.idCaja = c.idCaja
      INNER JOIN Sucursal s ON ac.idSucursal = s.idSucursal
      LEFT JOIN MovimientosCaja mc ON ac.idApertura = mc.idApertura
      LEFT JOIN TiposMovimientoCaja tmc ON mc.idTipoMovimientoCaja = tmc.idTipoMovimientoCaja
      LEFT JOIN CierresCaja cc ON ac.idApertura = cc.idApertura
      LEFT JOIN UsuarioWeb uw ON ac.idUsuario = uw.idUsuario
      WHERE ac.idEmpresa = @idEmpresa
        AND CONVERT(DATE, ac.fechaApertura) = @fecha
      GROUP BY ac.idApertura, c.nombre, s.nombre, ac.fechaApertura,
               ac.montoInicial, cc.idCierre, uw.nombres, uw.apellidos
      ORDER BY ac.fechaApertura DESC
    `);

  return result.recordset;
};