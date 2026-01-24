const sql = require("mssql");

exports.obtenerCreditosClienteRepo = async (pool, idEmpresa, idCliente) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idCliente", sql.Int, idCliente)
    .query(`
      SELECT
        cc.idCredito,
        cc.fechaCredito,
        cc.montoTotal,
        cc.plazoDias,
        cc.tasaInteres,
        cc.estado,
        cc.observaciones,
        v.idVenta,
        v.serie + '-' + v.numero AS comprobante,
        uw.nombres + ' ' + uw.apellidos AS usuarioCredito,
        -- Información de cuotas
        COUNT(cu.idCuota) AS totalCuotas,
        COUNT(CASE WHEN cu.estado = 'PAGADO' THEN 1 END) AS cuotasPagadas,
        COUNT(CASE WHEN cu.estado = 'VENCIDO' THEN 1 END) AS cuotasVencidas,
        SUM(cu.montoCuota) AS totalCuotasGeneradas,
        SUM(CASE WHEN cu.estado = 'PAGADO' THEN cu.montoCuota ELSE 0 END) AS totalPagado,
        MIN(CASE WHEN cu.estado IN ('PENDIENTE', 'VENCIDO') THEN cu.fechaVencimiento END) AS proximaCuota
      FROM CreditosClientes cc
      LEFT JOIN Ventas v ON cc.idVenta = v.idVenta
      LEFT JOIN CuotasCredito cu ON cc.idCredito = cu.idCredito
      LEFT JOIN UsuarioWeb uw ON cc.idUsuarioCredito = uw.idUsuario
      WHERE cc.idEmpresa = @idEmpresa
        AND cc.idCliente = @idCliente
      GROUP BY cc.idCredito, cc.fechaCredito, cc.montoTotal, cc.plazoDias,
               cc.tasaInteres, cc.estado, cc.observaciones, v.idVenta,
               v.serie, v.numero, uw.nombres, uw.apellidos
      ORDER BY cc.fechaCredito DESC
    `);

  return result.recordset;
};

exports.validarClienteEmpresaRepo = async (pool, idCliente, idEmpresa) => {
  const result = await pool
    .request()
    .input("idCliente", sql.Int, idCliente)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as existe
      FROM Clientes
      WHERE idCliente = @idCliente AND idEmpresa = @idEmpresa AND estado = 1
    `);

  return result.recordset[0].existe > 0;
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

exports.crearCreditoRepo = async (pool, user, datos) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const request = transaction.request();
    const fechaInicio = datos.fechaInicio || new Date();

    // Crear el crédito
    const creditoResult = await request
      .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
      .input("idCliente", sql.Int, datos.idCliente)
      .input("idVenta", sql.Int, datos.idVenta || null)
      .input("idUsuarioCredito", sql.UniqueIdentifier, user.sub)
      .input("montoTotal", sql.Decimal(18, 2), datos.montoTotal)
      .input("plazoDias", sql.Int, datos.plazoDias)
      .input("tasaInteres", sql.Decimal(5, 2), datos.tasaInteres || 0)
      .input("observaciones", sql.VarChar, datos.observaciones || null)
      .query(`
        INSERT INTO CreditosClientes (
          idEmpresa, idCliente, idVenta, idUsuarioCredito, fechaCredito,
          montoTotal, plazoDias, tasaInteres, estado, observaciones
        )
        OUTPUT INSERTED.idCredito
        VALUES (
          @idEmpresa, @idCliente, @idVenta, @idUsuarioCredito, GETDATE(),
          @montoTotal, @plazoDias, @tasaInteres, 'ACTIVO', @observaciones
        )
      `);

    const idCredito = creditoResult.recordset[0].idCredito;

    // Generar cuotas automáticamente
    await generarCuotasCredito(request, idCredito, user.empresa, datos.montoTotal, datos.plazoDias, datos.tasaInteres, fechaInicio);

    await transaction.commit();
    return { idCredito, mensaje: "Crédito y cuotas generadas exitosamente" };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Función auxiliar para generar cuotas
async function generarCuotasCredito(request, idCredito, idEmpresa, montoTotal, plazoDias, tasaInteres, fechaInicio) {
  const numeroCuotas = Math.ceil(plazoDias / 30); // Una cuota por mes
  const montoCuota = montoTotal / numeroCuotas;
  const tasaMensual = (tasaInteres || 0) / 100 / 12;

  for (let i = 1; i <= numeroCuotas; i++) {
    const fechaVencimiento = new Date(fechaInicio);
    fechaVencimiento.setMonth(fechaVencimiento.getMonth() + i);

    // Calcular interés si aplica
    const interes = tasaMensual > 0 ? (montoTotal - (i-1) * montoCuota) * tasaMensual : 0;
    const capital = montoCuota;
    const totalCuota = capital + interes;

    await request
      .input(`idCredito_${i}`, sql.UniqueIdentifier, idCredito)
      .input(`idEmpresa_${i}`, sql.UniqueIdentifier, idEmpresa)
      .input(`numeroCuota_${i}`, sql.Int, i)
      .input(`fechaVencimiento_${i}`, sql.Date, fechaVencimiento)
      .input(`montoCuota_${i}`, sql.Decimal(18, 2), totalCuota)
      .input(`interes_${i}`, sql.Decimal(18, 2), interes)
      .input(`capital_${i}`, sql.Decimal(18, 2), capital)
      .input(`saldoPendiente_${i}`, sql.Decimal(18, 2), totalCuota)
      .query(`
        INSERT INTO CuotasCredito (
          idCredito, idEmpresa, numeroCuota, fechaVencimiento,
          montoCuota, interes, capital, saldoPendiente, estado
        ) VALUES (
          @idCredito_${i}, @idEmpresa_${i}, @numeroCuota_${i}, @fechaVencimiento_${i},
          @montoCuota_${i}, @interes_${i}, @capital_${i}, @saldoPendiente_${i}, 'PENDIENTE'
        )
      `);
  }
}

exports.obtenerCuotasCreditoRepo = async (pool, idEmpresa, idCredito) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idCredito", sql.UniqueIdentifier, idCredito)
    .query(`
      SELECT
        cu.idCuota,
        cu.numeroCuota,
        cu.fechaVencimiento,
        cu.montoCuota,
        cu.interes,
        cu.capital,
        cu.saldoPendiente,
        cu.estado,
        cu.fechaPago,
        -- Información de pagos
        COUNT(pc.idPagoCuota) AS numeroPagos,
        SUM(pc.montoPagado) AS totalPagado
      FROM CuotasCredito cu
      LEFT JOIN PagosCuotas pc ON cu.idCuota = pc.idCuota
      WHERE cu.idEmpresa = @idEmpresa AND cu.idCredito = @idCredito
      GROUP BY cu.idCuota, cu.numeroCuota, cu.fechaVencimiento, cu.montoCuota,
               cu.interes, cu.capital, cu.saldoPendiente, cu.estado, cu.fechaPago
      ORDER BY cu.numeroCuota
    `);

  return result.recordset;
};

exports.validarCuotaPendienteRepo = async (pool, idCuota, idEmpresa) => {
  const result = await pool
    .request()
    .input("idCuota", sql.UniqueIdentifier, idCuota)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as existe
      FROM CuotasCredito
      WHERE idCuota = @idCuota AND idEmpresa = @idEmpresa
        AND estado IN ('PENDIENTE', 'VENCIDO')
    `);

  return result.recordset[0].existe > 0;
};

exports.pagarCuotaRepo = async (pool, user, datos) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const request = transaction.request();

    // Obtener información de la cuota
    const cuotaResult = await request
      .input("idCuota", sql.UniqueIdentifier, datos.idCuota)
      .query(`
        SELECT idCredito, numeroCuota, montoCuota, saldoPendiente, fechaVencimiento
        FROM CuotasCredito
        WHERE idCuota = @idCuota
      `);

    const cuota = cuotaResult.recordset[0];

    // Determinar si es pago parcial o total
    const esPagoParcial = datos.montoPagado < cuota.saldoPendiente;

    if (esPagoParcial) {
      // Pago parcial: registrar pago y generar nueva cuota
      await procesarPagoParcial(request, cuota, datos, user);
    } else {
      // Pago total: marcar cuota como pagada
      await request
        .input("idCuota", sql.UniqueIdentifier, datos.idCuota)
        .input("fechaPago", sql.DateTime, new Date())
        .query(`
          UPDATE CuotasCredito
          SET estado = 'PAGADO', fechaPago = @fechaPago, saldoPendiente = 0
          WHERE idCuota = @idCuota
        `);
    }

    // Registrar el pago
    await request
      .input("idCuota", sql.UniqueIdentifier, datos.idCuota)
      .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
      .input("idUsuarioPago", sql.UniqueIdentifier, user.sub)
      .input("montoPagado", sql.Decimal(18, 2), datos.montoPagado)
      .input("idMediosPago", sql.Int, datos.idMediosPago)
      .input("idMoneda", sql.Int, datos.idMoneda || 1)
      .input("numeroRecibo", sql.VarChar, datos.numeroRecibo || null)
      .input("observaciones", sql.VarChar, datos.observaciones || null)
      .query(`
        INSERT INTO PagosCuotas (
          idCuota, idEmpresa, idUsuarioPago, fechaPago, montoPagado,
          idMediosPago, idMoneda, numeroRecibo, observaciones
        ) VALUES (
          @idCuota, @idEmpresa, @idUsuarioPago, GETDATE(), @montoPagado,
          @idMediosPago, @idMoneda, @numeroRecibo, @observaciones
        )
      `);

    await transaction.commit();
    return {
      idCuota: datos.idCuota,
      montoPagado: datos.montoPagado,
      esPagoParcial,
      mensaje: esPagoParcial ? "Pago parcial registrado, nueva cuota generada" : "Cuota pagada completamente"
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Función auxiliar para procesar pagos parciales
async function procesarPagoParcial(request, cuota, datos, user) {
  // Actualizar cuota actual
  await request
    .input("idCuota", sql.UniqueIdentifier, datos.idCuota)
    .input("nuevoSaldo", sql.Decimal(18, 2), cuota.saldoPendiente - datos.montoPagado)
    .query(`
      UPDATE CuotasCredito
      SET saldoPendiente = @nuevoSaldo
      WHERE idCuota = @idCuota
    `);

  // Generar nueva cuota con el saldo restante
  const nuevaFechaVencimiento = new Date(cuota.fechaVencimiento);
  nuevaFechaVencimiento.setMonth(nuevaFechaVencimiento.getMonth() + 1); // Próximo mes

  await request
    .input("idCredito", sql.UniqueIdentifier, cuota.idCredito)
    .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
    .input("numeroCuota", sql.Int, cuota.numeroCuota + 1)
    .input("fechaVencimiento", sql.Date, nuevaFechaVencimiento)
    .input("montoCuota", sql.Decimal(18, 2), cuota.saldoPendiente - datos.montoPagado)
    .input("saldoPendiente", sql.Decimal(18, 2), cuota.saldoPendiente - datos.montoPagado)
    .query(`
      INSERT INTO CuotasCredito (
        idCredito, idEmpresa, numeroCuota, fechaVencimiento,
        montoCuota, interes, capital, saldoPendiente, estado
      ) VALUES (
        @idCredito, @idEmpresa, @numeroCuota, @fechaVencimiento,
        @montoCuota, 0, @montoCuota, @saldoPendiente, 'PENDIENTE'
      )
    `);
}

exports.obtenerResumenCreditosRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        COUNT(DISTINCT cc.idCredito) AS totalCreditos,
        SUM(cc.montoTotal) AS montoTotalCreditos,
        COUNT(DISTINCT CASE WHEN cc.estado = 'ACTIVO' THEN cc.idCredito END) AS creditosActivos,
        SUM(CASE WHEN cc.estado = 'ACTIVO' THEN cc.montoTotal ELSE 0 END) AS montoCreditosActivos,
        COUNT(cu.idCuota) AS totalCuotas,
        COUNT(CASE WHEN cu.estado = 'PAGADO' THEN cu.idCuota END) AS cuotasPagadas,
        COUNT(CASE WHEN cu.estado = 'VENCIDO' THEN cu.idCuota END) AS cuotasVencidas,
        COUNT(CASE WHEN cu.estado = 'PENDIENTE' THEN cu.idCuota END) AS cuotasPendientes,
        SUM(CASE WHEN cu.estado = 'PAGADO' THEN cu.montoCuota ELSE 0 END) AS totalCobrado,
        SUM(cu.saldoPendiente) AS saldoPendienteTotal,
        AVG(cc.tasaInteres) AS tasaInteresPromedio
      FROM CreditosClientes cc
      LEFT JOIN CuotasCredito cu ON cc.idCredito = cu.idCredito
      WHERE cc.idEmpresa = @idEmpresa
    `);

  return result.recordset[0];
};

exports.obtenerCuotasPendientesRepo = async (pool, idEmpresa, dias = 7) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("dias", sql.Int, dias)
    .query(`
      SELECT
        cu.idCuota,
        cu.numeroCuota,
        cu.fechaVencimiento,
        cu.montoCuota,
        cu.saldoPendiente,
        cu.estado,
        DATEDIFF(DAY, GETDATE(), cu.fechaVencimiento) AS diasParaVencimiento,
        CASE
          WHEN DATEDIFF(DAY, GETDATE(), cu.fechaVencimiento) < 0 THEN 'VENCIDA'
          WHEN DATEDIFF(DAY, GETDATE(), cu.fechaVencimiento) <= @dias THEN 'POR_VENCER'
          ELSE 'AL_DIA'
        END AS situacion,
        c.rSocial AS cliente,
        cc.idCredito,
        uw.nombres + ' ' + uw.apellidos AS usuarioCredito
      FROM CuotasCredito cu
      INNER JOIN CreditosClientes cc ON cu.idCredito = cc.idCredito
      INNER JOIN Clientes c ON cc.idCliente = c.idCliente
      INNER JOIN UsuarioWeb uw ON cc.idUsuarioCredito = uw.idUsuario
      WHERE cu.idEmpresa = @idEmpresa
        AND cu.estado IN ('PENDIENTE', 'VENCIDO')
        AND (
          DATEDIFF(DAY, GETDATE(), cu.fechaVencimiento) <= @dias
          OR cu.fechaVencimiento < GETDATE()
        )
      ORDER BY cu.fechaVencimiento
    `);

  return result.recordset;
};

exports.obtenerEficienciaCobrosRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        uw.nombres + ' ' + uw.apellidos AS usuario,
        COUNT(DISTINCT cc.idCredito) AS creditosOtorgados,
        COUNT(cu.idCuota) AS totalCuotas,
        COUNT(CASE WHEN cu.estado = 'PAGADO' THEN cu.idCuota END) AS cuotasPagadas,
        COUNT(CASE WHEN cu.estado = 'VENCIDO' THEN cu.idCuota END) AS cuotasVencidas,
        SUM(CASE WHEN cu.estado = 'PAGADO' THEN cu.montoCuota ELSE 0 END) AS montoCobrado,
        SUM(cu.montoCuota) AS montoTotal,
        CASE
          WHEN COUNT(cu.idCuota) > 0 THEN
            CAST(COUNT(CASE WHEN cu.estado = 'PAGADO' THEN cu.idCuota END) AS DECIMAL(10,2)) /
            COUNT(cu.idCuota) * 100
          ELSE 0
        END AS porcentajeCobranza,
        AVG(DATEDIFF(DAY, cu.fechaVencimiento,
          CASE WHEN cu.estado = 'PAGADO' THEN cu.fechaPago ELSE GETDATE() END)
        ) AS diasPromedioCobro
      FROM UsuarioWeb uw
      LEFT JOIN CreditosClientes cc ON uw.idUsuario = cc.idUsuarioCredito AND cc.idEmpresa = @idEmpresa
      LEFT JOIN CuotasCredito cu ON cc.idCredito = cu.idCredito
      WHERE uw.idEmpresa = @idEmpresa
      GROUP BY uw.idUsuario, uw.nombres, uw.apellidos
      ORDER BY porcentajeCobranza DESC
    `);

  return result.recordset;
};