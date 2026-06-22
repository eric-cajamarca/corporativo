const sql = require('mssql');

async function obtenerPorEmpresa(pool, idEmpresa) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        idEmpresa,
        CONVERT(VARCHAR(8), horaCheckIn, 108) AS horaCheckIn,
        CONVERT(VARCHAR(8), horaCheckOut, 108) AS horaCheckOut,
        CONVERT(VARCHAR(8), horaCorteDia, 108) AS horaCorteDia,
        minutosLimpieza,
        nochesMinimasWalkIn,
        permitirWalkInSinReserva,
        recargoEarlyCheckIn,
        recargoLateCheckOut,
        CONVERT(VARCHAR(19), fActualizacion, 120) AS fActualizacion
      FROM ConfiguracionHotel
      WHERE idEmpresa = @idEmpresa
    `);
  return result.recordset[0] || null;
}

async function upsert(pool, idEmpresa, payload) {
  const existente = await obtenerPorEmpresa(pool, idEmpresa);
  if (!existente) {
    await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('horaCheckIn', sql.VarChar(8), payload.horaCheckIn || '14:00:00')
      .input('horaCheckOut', sql.VarChar(8), payload.horaCheckOut || '11:00:00')
      .input('horaCorteDia', sql.VarChar(8), payload.horaCorteDia || '11:00:00')
      .input('minutosLimpieza', sql.Int, payload.minutosLimpieza ?? 30)
      .input('nochesMinimasWalkIn', sql.Int, payload.nochesMinimasWalkIn ?? 1)
      .input('permitirWalkInSinReserva', sql.Bit, payload.permitirWalkInSinReserva !== false ? 1 : 0)
      .input('recargoEarlyCheckIn', sql.Decimal(18, 6), payload.recargoEarlyCheckIn ?? 0)
      .input('recargoLateCheckOut', sql.Decimal(18, 6), payload.recargoLateCheckOut ?? 0)
      .query(`
        INSERT INTO ConfiguracionHotel
          (idEmpresa, horaCheckIn, horaCheckOut, horaCorteDia, minutosLimpieza, nochesMinimasWalkIn, permitirWalkInSinReserva, recargoEarlyCheckIn, recargoLateCheckOut)
        VALUES
          (@idEmpresa, @horaCheckIn, @horaCheckOut, @horaCorteDia, @minutosLimpieza, @nochesMinimasWalkIn, @permitirWalkInSinReserva, @recargoEarlyCheckIn, @recargoLateCheckOut)
      `);
  } else {
    await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('horaCheckIn', sql.VarChar(8), payload.horaCheckIn || existente.horaCheckIn)
      .input('horaCheckOut', sql.VarChar(8), payload.horaCheckOut || existente.horaCheckOut)
      .input('horaCorteDia', sql.VarChar(8), payload.horaCorteDia || existente.horaCorteDia)
      .input('minutosLimpieza', sql.Int, payload.minutosLimpieza ?? existente.minutosLimpieza)
      .input('nochesMinimasWalkIn', sql.Int, payload.nochesMinimasWalkIn ?? existente.nochesMinimasWalkIn)
      .input('permitirWalkInSinReserva', sql.Bit, payload.permitirWalkInSinReserva !== false ? 1 : 0)
      .input('recargoEarlyCheckIn', sql.Decimal(18, 6), payload.recargoEarlyCheckIn ?? existente.recargoEarlyCheckIn ?? 0)
      .input('recargoLateCheckOut', sql.Decimal(18, 6), payload.recargoLateCheckOut ?? existente.recargoLateCheckOut ?? 0)
      .query(`
        UPDATE ConfiguracionHotel SET
          horaCheckIn = @horaCheckIn,
          horaCheckOut = @horaCheckOut,
          horaCorteDia = @horaCorteDia,
          minutosLimpieza = @minutosLimpieza,
          nochesMinimasWalkIn = @nochesMinimasWalkIn,
          permitirWalkInSinReserva = @permitirWalkInSinReserva,
          recargoEarlyCheckIn = @recargoEarlyCheckIn,
          recargoLateCheckOut = @recargoLateCheckOut,
          fActualizacion = GETDATE()
        WHERE idEmpresa = @idEmpresa
      `);
  }
  return obtenerPorEmpresa(pool, idEmpresa);
}

module.exports = { obtenerPorEmpresa, upsert };
