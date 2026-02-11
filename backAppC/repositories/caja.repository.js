const sql = require("mssql");

exports.obtenerCajasRepo = async (pool, idEmpresa) => {
  const request = pool.request().input("idEmpresa", sql.UniqueIdentifier, idEmpresa);

  const queryConApertura = `
    SELECT
      c.idCaja,
      c.nombre,
      c.descripcion,
      ISNULL(s.nombre, '') AS sucursal,
      c.estado,
      CASE WHEN ac.idApertura IS NOT NULL THEN 1 ELSE 0 END AS cajaAbierta,
      ac.idApertura,
      CONVERT(VARCHAR(19), ac.fechaApertura, 120) AS fechaApertura,
      ac.montoInicial,
      ISNULL(uw.nombres, '') + ' ' + ISNULL(uw.apellidos, '') AS usuarioApertura
    FROM Cajas c
    LEFT JOIN Sucursal s ON c.idSucursal = s.idSucursal
    LEFT JOIN AperturasCaja ac ON c.idCaja = ac.idCaja AND ac.estado = 1
    LEFT JOIN UsuarioWeb uw ON ac.idUsuario = uw.idUsuario
    WHERE c.idEmpresa = @idEmpresa AND ISNULL(c.estado, 1) = 1
    ORDER BY c.nombre
  `;

  const querySoloCajas = `
    SELECT
      c.idCaja,
      c.nombre,
      c.descripcion,
      ISNULL(s.nombre, '') AS sucursal,
      c.estado,
      0 AS cajaAbierta,
      CAST(NULL AS UNIQUEIDENTIFIER) AS idApertura,
      CAST(NULL AS VARCHAR(19)) AS fechaApertura,
      CAST(NULL AS DECIMAL(18,2)) AS montoInicial,
      '' AS usuarioApertura
    FROM Cajas c
    LEFT JOIN Sucursal s ON c.idSucursal = s.idSucursal
    WHERE c.idEmpresa = @idEmpresa AND ISNULL(c.estado, 1) = 1
    ORDER BY c.nombre
  `;

  try {
    const result = await request.query(queryConApertura);
    return result.recordset;
  } catch (err) {
    const code = err.number ?? err.originalError?.number;
    const msg = (err.message || err.originalError?.message || '');
    if (code === 208 && (msg.includes('AperturasCaja') || msg.includes('Invalid object name'))) {
      const result = await pool.request().input("idEmpresa", sql.UniqueIdentifier, idEmpresa).query(querySoloCajas);
      return result.recordset;
    }
    throw err;
  }
};

exports.crearCajaRepo = async (pool, idEmpresa, datos) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idSucursal", sql.UniqueIdentifier, datos.idSucursal)
    .input("nombre", sql.VarChar(50), datos.nombre)
    .input("descripcion", sql.VarChar(100), datos.descripcion || null)
    .query(`
      INSERT INTO Cajas (idEmpresa, idSucursal, nombre, descripcion, estado)
      OUTPUT INSERTED.idCaja
      VALUES (@idEmpresa, @idSucursal, @nombre, @descripcion, 1)
    `);
  return result.recordset[0];
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
    // Obtener idSucursal de la caja (la caja pertenece a una sucursal)
    const req1 = transaction.request();
    const cajaRow = await req1
      .input("idCaja", sql.UniqueIdentifier, datos.idCaja)
      .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
      .query("SELECT idSucursal FROM Cajas WHERE idCaja = @idCaja AND idEmpresa = @idEmpresa");
    const idSucursal = cajaRow.recordset[0]?.idSucursal || user.sucursal;
    if (!idSucursal) {
      throw new Error("CAJA_SIN_SUCURSAL");
    }

    // Insertar apertura de caja (nuevo request para no duplicar parámetros)
    const req2 = transaction.request();
    const result = await req2
      .input("idCaja", sql.UniqueIdentifier, datos.idCaja)
      .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
      .input("idSucursal", sql.UniqueIdentifier, idSucursal)
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

    const idApertura = result.recordset[0].idApertura;

    // Registrar movimiento de ingreso "Apertura de caja" para que aparezca en ingresos con detalle
    if (datos.montoInicial > 0) {
      const reqApertura = transaction.request();
      const tipoApertura = await reqApertura.query(`
        SELECT idTipoMovimientoCaja FROM TiposMovimientoCaja WHERE nombre = 'APERTURA_CAJA'
      `);
      const idTipoApertura = tipoApertura.recordset[0]?.idTipoMovimientoCaja;
      if (idTipoApertura) {
        const reqMov = transaction.request();
        await reqMov
          .input("idApertura", sql.UniqueIdentifier, idApertura)
          .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
          .input("idSucursal", sql.UniqueIdentifier, idSucursal)
          .input("idUsuario", sql.UniqueIdentifier, user.sub)
          .input("idTipoMovimientoCaja", sql.Int, idTipoApertura)
          .input("concepto", sql.VarChar(100), "Apertura de caja")
          .input("monto", sql.Decimal(18, 2), datos.montoInicial)
          .input("idMoneda", sql.Int, 1)
          .query(`
            INSERT INTO MovimientosCaja (
              idApertura, idEmpresa, idSucursal, idUsuario, idTipoMovimientoCaja,
              fechaMovimiento, concepto, monto, idMediosPago, idMoneda
            )
            VALUES (
              @idApertura, @idEmpresa, @idSucursal, @idUsuario, @idTipoMovimientoCaja,
              GETDATE(), @concepto, @monto, NULL, @idMoneda
            )
          `);
      }
    }

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
    // Calcular diferencias y totales
    const req1 = transaction.request();
    const resumenResult = await req1
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
    const req2 = transaction.request();
    const aperturaResult = await req2
      .input("idApertura", sql.UniqueIdentifier, datos.idApertura)
      .query(`
        SELECT idEmpresa, idSucursal
        FROM AperturasCaja
        WHERE idApertura = @idApertura
      `);

    const apertura = aperturaResult.recordset[0];

    // Insertar cierre
    const req3 = transaction.request();
    const cierreResult = await req3
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
    const req4 = transaction.request();
    await req4
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

  if (filtros.tipoMovimiento) {
    whereClause += " AND tmc.tipo = @tipoMovimiento";
  }

  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idApertura", sql.UniqueIdentifier, filtros.idApertura || null)
    .input("fechaDesde", sql.DateTime, filtros.fechaDesde || null)
    .input("fechaHasta", sql.DateTime, filtros.fechaHasta || null)
    .input("tipoMovimiento", sql.Char(1), filtros.tipoMovimiento || null)
    .query(`
      SELECT
        mc.idMovimientoCaja,
        mc.idApertura,
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

exports.eliminarMovimientoCajaRepo = async (pool, idMovimientoCaja, idEmpresa) => {
  const result = await pool
    .request()
    .input("idMovimientoCaja", sql.UniqueIdentifier, idMovimientoCaja)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      DELETE FROM MovimientosCaja
      WHERE idMovimientoCaja = @idMovimientoCaja AND idEmpresa = @idEmpresa
    `);
  return result.rowsAffected[0];
};

exports.actualizarMovimientoCajaRepo = async (pool, idEmpresa, datos) => {
  const result = await pool
    .request()
    .input("idMovimientoCaja", sql.UniqueIdentifier, datos.idMovimientoCaja)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("concepto", sql.VarChar, datos.concepto)
    .input("monto", sql.Decimal(18, 2), datos.monto)
    .input("idMediosPago", sql.Int, datos.idMediosPago || null)
    .input("documentoRelacionado", sql.VarChar, datos.documentoRelacionado || null)
    .input("observaciones", sql.VarChar, datos.observaciones || null)
    .query(`
      UPDATE MovimientosCaja
      SET concepto = @concepto, monto = @monto, idMediosPago = @idMediosPago,
          documentoRelacionado = @documentoRelacionado, observaciones = @observaciones
      WHERE idMovimientoCaja = @idMovimientoCaja AND idEmpresa = @idEmpresa
    `);
  return result.rowsAffected[0];
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

/** Obtiene la apertura abierta (estado=1) de una sucursal para la empresa (cualquier caja de esa sucursal). */
exports.obtenerAperturaAbiertaPorSucursalRepo = async (pool, idEmpresa, idSucursal) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idSucursal", sql.UniqueIdentifier, idSucursal)
    .query(`
      SELECT TOP 1 ac.idApertura, ac.idCaja
      FROM AperturasCaja ac
      INNER JOIN Cajas c ON ac.idCaja = c.idCaja
      WHERE ac.idEmpresa = @idEmpresa AND ac.idSucursal = @idSucursal AND ac.estado = 1
      ORDER BY ac.fechaApertura DESC
    `);
  return result.recordset[0] || null;
};

/** Registra en caja los movimientos de venta al contado por cada forma de pago. Si ya existían movimientos para idVenta, los elimina y reemplaza (para reflejar cambios de desglose). */
exports.registrarMovimientosVentaContadoRepo = async (transaction, payload) => {
  const { idApertura, idEmpresa, idSucursal, idUsuario, idVenta, compVenta, detallePago } = payload;
  if (!idApertura || !idVenta || !compVenta || !detallePago || detallePago.length === 0) return;

  const req = transaction.request();
  const tipoVenta = await req.query("SELECT idTipoMovimientoCaja FROM TiposMovimientoCaja WHERE nombre = 'VENTA_CONTADO'");
  const idTipoVentaContado = tipoVenta.recordset[0]?.idTipoMovimientoCaja;
  if (!idTipoVentaContado) return;

  await req
    .input("idVenta", sql.Int, idVenta)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query("DELETE FROM MovimientosCaja WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa");

  const concepto = "Venta al contado " + (compVenta || "");
  for (const pago of detallePago) {
    const idMediosPago = pago.idMediosPago != null ? Number(pago.idMediosPago) : null;
    const monto = Number(pago.monto);
    if (monto <= 0) continue;
    const reqIns = transaction.request();
    await reqIns
      .input("idApertura", sql.UniqueIdentifier, idApertura)
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .input("idSucursal", sql.UniqueIdentifier, idSucursal)
      .input("idUsuario", sql.UniqueIdentifier, idUsuario)
      .input("idTipoMovimientoCaja", sql.Int, idTipoVentaContado)
      .input("concepto", sql.VarChar(100), concepto)
      .input("monto", sql.Decimal(18, 2), monto)
      .input("idMediosPago", sql.Int, idMediosPago)
      .input("idMoneda", sql.Int, 1)
      .input("documentoRelacionado", sql.VarChar(20), compVenta || null)
      .input("idVenta", sql.Int, idVenta)
      .query(`
        INSERT INTO MovimientosCaja (idApertura, idEmpresa, idSucursal, idUsuario, idTipoMovimientoCaja, fechaMovimiento, concepto, monto, idMediosPago, idMoneda, documentoRelacionado, idVenta)
        VALUES (@idApertura, @idEmpresa, @idSucursal, @idUsuario, @idTipoMovimientoCaja, GETDATE(), @concepto, @monto, @idMediosPago, @idMoneda, @documentoRelacionado, @idVenta)
      `);
  }
};

/** Arqueo dinámico: resumen por concepto (tipo movimiento) y por forma de pago para una fecha. */
exports.obtenerArqueoDinamicoRepo = async (pool, idEmpresa, fecha, idCaja) => {
  const fechaFiltro = fecha || new Date().toISOString().split('T')[0];
  const filtrarPorCaja = idCaja && idCaja !== 'TODAS';

  const request = pool.request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fecha", sql.Date, fechaFiltro);
  if (filtrarPorCaja) request.input("idCaja", sql.UniqueIdentifier, idCaja);

  const result = await request.query(`
    SELECT
      tmc.nombre AS concepto,
      tmc.tipo AS tipoOperacion,
      ISNULL(mp.descripcion, 'Sin especificar') AS formaPago,
      SUM(mc.monto) AS importe
    FROM MovimientosCaja mc
    INNER JOIN TiposMovimientoCaja tmc ON mc.idTipoMovimientoCaja = tmc.idTipoMovimientoCaja
    INNER JOIN AperturasCaja ac ON mc.idApertura = ac.idApertura
    LEFT JOIN MediosPago mp ON mc.idMediosPago = mp.idMediosPago
    WHERE mc.idEmpresa = @idEmpresa
      AND CONVERT(DATE, mc.fechaMovimiento) = @fecha
      ${filtrarPorCaja ? 'AND ac.idCaja = @idCaja' : ''}
    GROUP BY tmc.nombre, tmc.tipo, mp.descripcion
    ORDER BY tmc.tipo DESC, tmc.nombre, formaPago
  `);

  return result.recordset;
};