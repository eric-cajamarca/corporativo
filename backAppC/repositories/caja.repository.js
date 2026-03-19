const sql = require("mssql");
const { getFechaHoyLocal } = require("../utils/fechaHoraLocal.util");

exports.obtenerCajasRepo = async (pool, idEmpresa) => {
  const request = pool.request().input("idEmpresa", sql.UniqueIdentifier, idEmpresa);

  const queryConApertura = `
    SELECT
      c.idCaja,
      c.idSucursal,
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
      c.idSucursal,
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

/** Obtiene el tipo ('I' o 'E') del tipo de movimiento de caja. */
exports.obtenerTipoOperacionPorIdRepo = async (pool, idTipoMovimientoCaja) => {
  const result = await pool
    .request()
    .input("idTipoMovimientoCaja", sql.Int, idTipoMovimientoCaja)
    .query(`SELECT tipo FROM TiposMovimientoCaja WHERE idTipoMovimientoCaja = @idTipoMovimientoCaja`);
  return result.recordset[0] ? result.recordset[0].tipo : null;
};

/**
 * Obtiene y reserva el siguiente número para Recibo Ingreso (RI) o Recibo Egreso (RE).
 * Debe ejecutarse dentro de una transacción.
 * @param {object} transaction - Transacción de mssql
 * @param {string} idEmpresa - UUID empresa
 * @param {string} codigo - 'RI' o 'RE'
 * @returns {{ serie: string, numeroFormateado: string, documentoRelacionado: string }}
 */
exports.obtenerSiguienteNumeroReciboRepo = async (transaction, idEmpresa, codigo) => {
  const cod = (codigo === "RI" || codigo === "RE") ? codigo : null;
  if (!cod) {
    throw new Error("CODIGO_RECIBO_INVALIDO");
  }
  const result = await transaction.request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("codigo", sql.VarChar(2), cod)
    .query(`
      UPDATE Comprobantes
      SET numero = ISNULL(numero, 0) + 1
      OUTPUT INSERTED.serie, INSERTED.numero
      WHERE idEmpresa = @idEmpresa AND codigo = @codigo
    `);
  const row = result.recordset && result.recordset[0];
  if (!row) {
    throw new Error("COMPROBANTE_RI_RE_NO_CONFIGURADO");
  }
  const serie = String(row.serie || "0001").trim().substring(0, 4);
  const num = row.numero != null ? Number(row.numero) : 1;
  const numeroFormateado = String(num).padStart(8, "0");
  const documentoRelacionado = cod + " " + serie + "-" + numeroFormateado;
  return { serie, numeroFormateado, documentoRelacionado };
};

exports.registrarMovimientoRepo = async (poolOrTransaction, user, datos) => {
  let idSucursal = user.sucursal || null;
  if (!idSucursal && datos.idApertura) {
    const resApertura = await poolOrTransaction
      .request()
      .input("idApertura", sql.UniqueIdentifier, datos.idApertura)
      .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
      .query("SELECT idSucursal FROM AperturasCaja WHERE idApertura = @idApertura AND idEmpresa = @idEmpresa");
    if (resApertura.recordset && resApertura.recordset[0]) {
      idSucursal = resApertura.recordset[0].idSucursal;
    }
  }
  if (!idSucursal) {
    throw new Error("No se pudo determinar la sucursal para el movimiento. Verifique la apertura de caja o el usuario.");
  }
  console.log('datos en el repositorio de movimientoscaja', datos);
  const result = await poolOrTransaction
    .request()
    .input("idApertura", sql.UniqueIdentifier, datos.idApertura)
    .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
    .input("idSucursal", sql.UniqueIdentifier, idSucursal)
    .input("idUsuario", sql.UniqueIdentifier, user.sub)
    .input("idTipoMovimientoCaja", sql.Int, datos.idTipoMovimientoCaja)
    .input("fechaMovimiento", sql.DateTime, datos.fechaMovimiento || null)
    .input("concepto", sql.VarChar, datos.concepto)
    .input("idConcepto", sql.UniqueIdentifier, datos.idConcepto || null)
    .input("monto", sql.Decimal(18, 2), datos.monto)
    .input("idMediosPago", sql.Int, datos.idMediosPago || null)
    .input("idMoneda", sql.Int, datos.idMoneda || 1)
    .input("documentoRelacionado", sql.VarChar, datos.documentoRelacionado || null)
    .input("observaciones", sql.VarChar, datos.observaciones || null)
    .query(`
      INSERT INTO MovimientosCaja (
        idApertura, idEmpresa, idSucursal, idUsuario, idTipoMovimientoCaja,
        fechaMovimiento, concepto, idConcepto, monto, idMediosPago, idMoneda,
        documentoRelacionado, observaciones
      )
      OUTPUT INSERTED.idMovimientoCaja
      VALUES (
        @idApertura, @idEmpresa, @idSucursal, @idUsuario, @idTipoMovimientoCaja,
        ISNULL(TRY_CONVERT(DATETIME, @fechaMovimiento, 23), GETDATE()), @concepto, @idConcepto, @monto, @idMediosPago, @idMoneda,
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
  if (filtros.soloRecibos && filtros.tipoMovimiento === "I") {
    whereClause += " AND mc.documentoRelacionado LIKE 'RI %'";
  }
  if (filtros.soloRecibos && filtros.tipoMovimiento === "E") {
    whereClause += " AND mc.documentoRelacionado LIKE 'RE %'";
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
        mc.idTipoMovimientoCaja,
        mc.fechaMovimiento,
        mc.concepto,
        mc.idConcepto,
        ISNULL(
          conc.descripcion,
          ISNULL(
            mc.concepto,
            CASE WHEN tmc.nombre = 'APERTURA_CAJA' THEN 'Apertura de caja' ELSE REPLACE(tmc.nombre, '_', ' ') END
          )
        ) AS conceptoCatalogoDescripcion,
        mc.monto,
        mc.idMediosPago,
        tmc.nombre AS tipoMovimiento,
        tmc.tipo AS tipoOperacion,
        COALESCE(fp.descripcion, mp.descripcion) AS medioPago,
        mon.simbolo + ' ' + mon.descripcion AS moneda,
        mc.documentoRelacionado,
        mc.observaciones,
        uw.nombres + ' ' + uw.apellidos AS usuario
      FROM MovimientosCaja mc
      INNER JOIN TiposMovimientoCaja tmc ON mc.idTipoMovimientoCaja = tmc.idTipoMovimientoCaja
      LEFT JOIN Concepto conc ON mc.idConcepto = conc.idConcepto
      LEFT JOIN FormasPago fp ON fp.idFormaPago = mc.idMediosPago
      LEFT JOIN MediosPago mp ON mp.idMediosPago = mc.idMediosPago
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
    .input("idConcepto", sql.UniqueIdentifier, datos.idConcepto || null)
    .input("monto", sql.Decimal(18, 2), datos.monto)
    .input("idMediosPago", sql.Int, datos.idMediosPago || null)
    .input("documentoRelacionado", sql.VarChar, datos.documentoRelacionado || null)
    .input("observaciones", sql.VarChar, datos.observaciones || null)
    .query(`
      UPDATE MovimientosCaja
      SET concepto = @concepto, idConcepto = @idConcepto, monto = @monto, idMediosPago = @idMediosPago,
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

exports.crearTipoMovimientoCajaRepo = async (pool, datos) => {
  const result = await pool
    .request()
    .input("nombre", sql.VarChar(30), datos.nombre)
    .input("descripcion", sql.VarChar(100), datos.descripcion || null)
    .input("tipo", sql.Char(1), datos.tipo)
    .query(`
      INSERT INTO TiposMovimientoCaja (nombre, descripcion, tipo)
      OUTPUT INSERTED.idTipoMovimientoCaja
      VALUES (@nombre, @descripcion, @tipo)
    `);
  return result.recordset[0];
};

exports.actualizarTipoMovimientoCajaRepo = async (pool, id, datos) => {
  await pool
    .request()
    .input("idTipoMovimientoCaja", sql.Int, id)
    .input("nombre", sql.VarChar(30), datos.nombre)
    .input("descripcion", sql.VarChar(100), datos.descripcion || null)
    .input("tipo", sql.Char(1), datos.tipo)
    .query(`
      UPDATE TiposMovimientoCaja
      SET nombre = @nombre, descripcion = @descripcion, tipo = @tipo
      WHERE idTipoMovimientoCaja = @idTipoMovimientoCaja
    `);
};

exports.eliminarTipoMovimientoCajaRepo = async (pool, id) => {
  const result = await pool
    .request()
    .input("idTipoMovimientoCaja", sql.Int, id)
    .query(`
      DELETE FROM TiposMovimientoCaja
      WHERE idTipoMovimientoCaja = @idTipoMovimientoCaja
    `);
  return result.rowsAffected[0];
};

exports.obtenerResumenCajaDiarioRepo = async (pool, idEmpresa, fecha) => {
  const fechaFiltro = fecha || getFechaHoyLocal();

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
      SELECT TOP 1 ac.idApertura, ac.idCaja, ac.idSucursal
      FROM AperturasCaja ac
      INNER JOIN Cajas c ON ac.idCaja = c.idCaja
      WHERE ac.idEmpresa = @idEmpresa AND ac.idSucursal = @idSucursal AND ac.estado = 1
      ORDER BY ac.fechaApertura DESC
    `);
  return result.recordset[0] || null;
};

/** Obtiene cualquier apertura abierta (estado=1) de la empresa, para registrar egresos cuando no hay sucursal (ej. compra al contado). */
exports.obtenerCualquierAperturaAbiertaRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT TOP 1 ac.idApertura, ac.idCaja, ac.idSucursal
      FROM AperturasCaja ac
      INNER JOIN Cajas c ON ac.idCaja = c.idCaja
      WHERE ac.idEmpresa = @idEmpresa AND ac.estado = 1
      ORDER BY ac.fechaApertura DESC
    `);
  return result.recordset[0] || null;
};

/** Obtiene idTipoMovimientoCaja por nombre (ej. COMPRA_CONTADO) o el primer tipo de operación E (egreso). */
exports.obtenerIdTipoMovimientoEgresoRepo = async (pool, nombrePreferido) => {
  if (nombrePreferido) {
    const r = await pool.request()
      .input("nombre", sql.VarChar(50), nombrePreferido)
      .query("SELECT idTipoMovimientoCaja FROM TiposMovimientoCaja WHERE tipo = 'E' AND nombre = @nombre");
    if (r.recordset && r.recordset[0]) return r.recordset[0].idTipoMovimientoCaja;
  }
  const r = await pool.request().query(
    "SELECT TOP 1 idTipoMovimientoCaja FROM TiposMovimientoCaja WHERE tipo = 'E' ORDER BY idTipoMovimientoCaja"
  );
  return r.recordset && r.recordset[0] ? r.recordset[0].idTipoMovimientoCaja : null;
};

/** Registra en caja los movimientos de venta al contado por cada forma de pago. Si ya existían movimientos para idVenta, los elimina y reemplaza (para reflejar cambios de desglose).
 *  FK MovimientosCaja.idMediosPago -> MediosPago.idMediosPago. Si el front envía idFormaPago, se valida y se usa un idMediosPago válido como fallback. */
exports.registrarMovimientosVentaContadoRepo = async (transaction, payload) => {
  const { idApertura, idEmpresa, idSucursal, idUsuario, idVenta, compVenta, detallePago } = payload;
  if (!idApertura || !idVenta || !compVenta || !detallePago || detallePago.length === 0) return;

  const req = transaction.request();
  const tipoVenta = await req.query("SELECT idTipoMovimientoCaja FROM TiposMovimientoCaja WHERE nombre = 'VENTA_CONTADO'");
  const idTipoVentaContado = tipoVenta.recordset[0]?.idTipoMovimientoCaja;
  if (!idTipoVentaContado) return;

  const validIdsResult = await req.query("SELECT idMediosPago FROM MediosPago");
  const validIds = new Set((validIdsResult.recordset || []).map((r) => Number(r.idMediosPago)).filter((n) => !Number.isNaN(n)));
  const idMediosPagoDefault = validIds.size > 0 ? Math.min(...validIds) : null;
  if (idMediosPagoDefault == null) return;

  await req
    .input("idVenta", sql.Int, idVenta)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query("DELETE FROM MovimientosCaja WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa");

  const concepto = "Venta al contado " + (compVenta || "");
  for (const pago of detallePago) {
    let idMediosPago = pago.idMediosPago != null ? Number(pago.idMediosPago) : null;
    if (idMediosPago == null || !validIds.has(idMediosPago)) idMediosPago = idMediosPagoDefault;
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

/** Arqueo dinámico: resumen por concepto y forma de pago. Filtro por fecha única o por rango (fechaInicial, fechaFinal).
 *  Para ventas (idVenta no nulo) usa DetallePagoVenta + FormasPago; para el resto usa MovimientosCaja + MediosPago.
 *  Incluye ventasCredito: total de ventas con condición Crédito en el período (informativo, no efectivo en caja). */
exports.obtenerArqueoDinamicoRepo = async (pool, idEmpresa, filtros) => {
  const { fecha, fechaInicial, fechaFinal, idCaja } = filtros || {};
  const usaRango = fechaInicial && fechaFinal;
  const fechaFiltro = fecha || getFechaHoyLocal();
  const filtrarPorCaja = idCaja && idCaja !== 'TODAS';

  const request = pool.request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
  if (usaRango) {
    request.input("fechaInicial", sql.Date, fechaInicial).input("fechaFinal", sql.Date, fechaFinal);
  } else {
    request.input("fecha", sql.Date, fechaFiltro);
  }
  if (filtrarPorCaja) request.input("idCaja", sql.UniqueIdentifier, idCaja);

  const condicionFecha = usaRango
    ? "AND CONVERT(DATE, mc.fechaMovimiento) >= @fechaInicial AND CONVERT(DATE, mc.fechaMovimiento) <= @fechaFinal"
    : "AND CONVERT(DATE, mc.fechaMovimiento) = @fecha";

  /* Excluir cotizaciones: solo ventas con comprobante distinto de CT (Cotización). */
  const sqlVentas = `
    SELECT
      tmc.nombre AS concepto,
      tmc.tipo AS tipoOperacion,
      ISNULL(fp.descripcion, 'Sin especificar') AS formaPago,
      SUM(dpv.monto) AS importe
    FROM MovimientosCaja mc
    INNER JOIN TiposMovimientoCaja tmc ON mc.idTipoMovimientoCaja = tmc.idTipoMovimientoCaja
    INNER JOIN AperturasCaja ac ON mc.idApertura = ac.idApertura
    INNER JOIN Ventas v ON v.idVenta = mc.idVenta AND v.idEmpresa = mc.idEmpresa
    INNER JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa AND ISNULL(c.codigo, '') <> 'CT'
    INNER JOIN DetallePagoVenta dpv ON dpv.idVenta = mc.idVenta
    LEFT JOIN FormasPago fp ON fp.idFormaPago = dpv.idMediosPago
    WHERE mc.idEmpresa = @idEmpresa
      ${condicionFecha}
      AND mc.idVenta IS NOT NULL
      ${filtrarPorCaja ? 'AND ac.idCaja = @idCaja' : ''}
    GROUP BY tmc.nombre, tmc.tipo, fp.descripcion
  `;
  const sqlOtros = `
    SELECT
      tmc.nombre AS concepto,
      tmc.tipo AS tipoOperacion,
      ISNULL(fp.descripcion, ISNULL(mp.descripcion, 'Sin especificar')) AS formaPago,
      SUM(mc.monto) AS importe
    FROM MovimientosCaja mc
    INNER JOIN TiposMovimientoCaja tmc ON mc.idTipoMovimientoCaja = tmc.idTipoMovimientoCaja
    INNER JOIN AperturasCaja ac ON mc.idApertura = ac.idApertura
    LEFT JOIN FormasPago fp ON fp.idFormaPago = mc.idMediosPago
    LEFT JOIN MediosPago mp ON mp.idMediosPago = mc.idMediosPago
    WHERE mc.idEmpresa = @idEmpresa
      ${condicionFecha}
      AND (mc.idVenta IS NULL OR mc.idVenta = 0)
      ${filtrarPorCaja ? 'AND ac.idCaja = @idCaja' : ''}
    GROUP BY tmc.nombre, tmc.tipo, fp.descripcion, mp.descripcion
  `;

  const result = await request.query(`
    (${sqlVentas})
    UNION ALL
    (${sqlOtros})
    ORDER BY tipoOperacion DESC, concepto, formaPago
  `);
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/4cdb12f7-f0e0-45f1-8edf-c7587f720407',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'X-Debug-Session-Id':'3c0e71'
    },
    body:JSON.stringify({
      sessionId:'3c0e71',
      runId:'post-fix',
      hypothesisId:'H2-H3',
      location:'caja.repository.js:obtenerArqueoDinamicoRepo',
      message:'Filas arqueo dinámico por concepto/formaPago',
      data:(result.recordset || []).map(r => ({
        concepto:r.concepto,
        tipoOperacion:r.tipoOperacion,
        formaPago:r.formaPago,
        importe:r.importe
      })),
      timestamp:Date.now()
    })
  }).catch(()=>{});
  // #endregion

  const sqlDetalleVentas = `
    SELECT
      tmc.nombre AS concepto,
      tmc.tipo AS tipoOperacion,
      ISNULL(fp.descripcion, ISNULL(mp.descripcion, 'Sin especificar')) AS formaPago,
      mc.monto AS importe,
      v.serie + '-' + v.numero AS comprobante,
      ISNULL(cl.rSocial, '') AS clienteOrProveedor
    FROM MovimientosCaja mc
    INNER JOIN TiposMovimientoCaja tmc ON mc.idTipoMovimientoCaja = tmc.idTipoMovimientoCaja
    INNER JOIN AperturasCaja ac ON mc.idApertura = ac.idApertura
    INNER JOIN Ventas v ON v.idVenta = mc.idVenta AND v.idEmpresa = mc.idEmpresa
    INNER JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa AND ISNULL(c.codigo, '') <> 'CT'
    LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
    LEFT JOIN FormasPago fp ON fp.idFormaPago = mc.idMediosPago
    LEFT JOIN MediosPago mp ON mp.idMediosPago = mc.idMediosPago
    WHERE mc.idEmpresa = @idEmpresa
      ${condicionFecha}
      AND mc.idVenta IS NOT NULL
      ${filtrarPorCaja ? 'AND ac.idCaja = @idCaja' : ''}
  `;
  const sqlDetalleOtros = `
    SELECT
      tmc.nombre AS concepto,
      tmc.tipo AS tipoOperacion,
      ISNULL(fp.descripcion, ISNULL(mp.descripcion, 'Sin especificar')) AS formaPago,
      mc.monto AS importe,
      ISNULL(mc.documentoRelacionado, '') AS comprobante,
      ISNULL(mc.concepto, '') AS clienteOrProveedor
    FROM MovimientosCaja mc
    INNER JOIN TiposMovimientoCaja tmc ON mc.idTipoMovimientoCaja = tmc.idTipoMovimientoCaja
    INNER JOIN AperturasCaja ac ON mc.idApertura = ac.idApertura
    LEFT JOIN FormasPago fp ON fp.idFormaPago = mc.idMediosPago
    LEFT JOIN MediosPago mp ON mp.idMediosPago = mc.idMediosPago
    WHERE mc.idEmpresa = @idEmpresa
      ${condicionFecha}
      AND (mc.idVenta IS NULL OR mc.idVenta = 0)
      ${filtrarPorCaja ? 'AND ac.idCaja = @idCaja' : ''}
  `;
  let detalleRecordset = [];
  try {
    const reqDetalle = pool.request()
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
    if (usaRango) {
      reqDetalle.input("fechaInicial", sql.Date, fechaInicial).input("fechaFinal", sql.Date, fechaFinal);
    } else {
      reqDetalle.input("fecha", sql.Date, fechaFiltro);
    }
    if (filtrarPorCaja) reqDetalle.input("idCaja", sql.UniqueIdentifier, idCaja);
    const resDetalle = await reqDetalle.query(`(${sqlDetalleVentas}) UNION ALL (${sqlDetalleOtros}) ORDER BY tipoOperacion DESC, concepto, formaPago`);
    detalleRecordset = resDetalle.recordset || [];
  } catch (err) {
    console.error("Error obtener detalle arqueo (comprobante/cliente/proveedor):", err);
  }

  let ventasCredito = { concepto: 'VENTA_CREDITO', importe: 0 };
  try {
    const reqCredito = pool.request()
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
    if (usaRango) {
      reqCredito.input("fechaInicial", sql.Date, fechaInicial).input("fechaFinal", sql.Date, fechaFinal);
    } else {
      reqCredito.input("fecha", sql.Date, fechaFiltro);
    }
    const condicionFechaVentas = usaRango
      ? "AND CONVERT(DATE, v.fEmision) >= @fechaInicial AND CONVERT(DATE, v.fEmision) <= @fechaFinal"
      : "AND CONVERT(DATE, v.fEmision) = @fecha";
    /* Excluir cotizaciones: solo ventas con comprobante distinto de CT. */
    const rCredito = await reqCredito.query(`
      SELECT ISNULL(SUM(v.total), 0) AS total
      FROM Ventas v
      INNER JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa AND ISNULL(c.codigo, '') <> 'CT'
      INNER JOIN MediosPago mp ON (mp.idMediosPago = TRY_CAST(v.idMediosPago AS INT) OR CAST(mp.idMediosPago AS VARCHAR(20)) = RTRIM(LTRIM(ISNULL(v.idMediosPago, ''))))
        AND (mp.descripcion LIKE '%credito%' OR mp.descripcion LIKE '%crédito%' OR LOWER(REPLACE(mp.descripcion, 'í', 'i')) LIKE '%credito%')
      WHERE v.idEmpresa = @idEmpresa ${condicionFechaVentas}
    `);
    const total = rCredito.recordset?.[0]?.total;
    ventasCredito.importe = Number(total) || 0;
  } catch (err) {
    console.error("Error obtener ventas al crédito para arqueo:", err);
  }

  let cobroCreditos = { concepto: 'COBRO CREDITOS', importe: 0 };
  try {
    const reqCobro = pool.request()
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
    if (usaRango) {
      reqCobro.input("fechaInicial", sql.Date, fechaInicial).input("fechaFinal", sql.Date, fechaFinal);
    } else {
      reqCobro.input("fecha", sql.Date, fechaFiltro);
    }
    const condicionFechaPago = usaRango
      ? "AND CONVERT(DATE, pc.fechaPago) >= @fechaInicial AND CONVERT(DATE, pc.fechaPago) <= @fechaFinal"
      : "AND CONVERT(DATE, pc.fechaPago) = @fecha";
    const rCobro = await reqCobro.query(`
      SELECT ISNULL(SUM(pc.montoPagado), 0) AS total
      FROM PagosCuotas pc
      WHERE pc.idEmpresa = @idEmpresa ${condicionFechaPago}
    `);
    const totalCobro = rCobro.recordset?.[0]?.total;
    cobroCreditos.importe = Number(totalCobro) || 0;
  } catch (err) {
    console.error("Error obtener total cobro de créditos para arqueo:", err);
  }

  return { movimientos: result.recordset, detalle: detalleRecordset, ventasCredito, cobroCreditos };
};