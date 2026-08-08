const sql = require("mssql");

function bindUuidInList(request, ids, prefix) {
  const list = [...new Set((ids || []).filter(Boolean))];
  list.forEach((id, i) => {
    request.input(`${prefix}${i}`, sql.UniqueIdentifier, id);
  });
  return { list, inClause: list.map((_, i) => `@${prefix}${i}`).join(", ") };
}

/**
 * Guarda o actualiza vehículo por placa + idEmpresa e inserta registro de SOAT.
 * vehiculo: { placa, marca, modelo, color, serie, motor, vin }
 * soat: { placa, nombre_compania, fecha_inicio, fecha_fin, estado, numero_poliza, codigo_sbs_aseguradora, codigo_unico_poliza }
 */
exports.guardarVehiculoYSoatRepo = async (pool, idEmpresa, { vehiculo, soat }) => {
  const placa = (vehiculo?.placa || soat?.placa || "").toString().trim().toUpperCase();
  if (!placa) throw new Error("Placa es obligatoria");

  const request = pool.request();
  request.input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
  request.input("placa", sql.VarChar(20), placa);
  request.input("marca", sql.VarChar(100), (vehiculo?.marca || "").toString().trim().slice(0, 100) || null);
  request.input("modelo", sql.VarChar(100), (vehiculo?.modelo || "").toString().trim().slice(0, 100) || null);
  request.input("color", sql.VarChar(80), (vehiculo?.color || "").toString().trim().slice(0, 80) || null);
  request.input("serie", sql.VarChar(50), (vehiculo?.serie || vehiculo?.vin || "").toString().trim().slice(0, 50) || null);
  request.input("motor", sql.VarChar(50), (vehiculo?.motor || "").toString().trim().slice(0, 50) || null);
  request.input("vin", sql.VarChar(50), (vehiculo?.vin || vehiculo?.serie || "").toString().trim().slice(0, 50) || null);

  const upsert = await request.query(`
    MERGE Vehiculos AS t
    USING (SELECT @idEmpresa AS idEmpresa, @placa AS placa, @marca AS marca, @modelo AS modelo, @color AS color, @serie AS serie, @motor AS motor, @vin AS vin) AS s
    ON t.idEmpresa = s.idEmpresa AND t.placa = s.placa
    WHEN MATCHED THEN
      UPDATE SET marca = s.marca, modelo = s.modelo, color = s.color, serie = s.serie, motor = s.motor, vin = s.vin
    WHEN NOT MATCHED THEN
      INSERT (idEmpresa, placa, marca, modelo, color, serie, motor, vin)
      VALUES (s.idEmpresa, s.placa, s.marca, s.modelo, s.color, s.serie, s.motor, s.vin)
    OUTPUT INSERTED.idVehiculo;
  `);

  let idVehiculo = upsert.recordset?.[0]?.idVehiculo;
  if (!idVehiculo) {
    const sel = await pool.request()
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .input("placa", sql.VarChar(20), placa)
      .query("SELECT idVehiculo FROM Vehiculos WHERE idEmpresa = @idEmpresa AND placa = @placa");
    idVehiculo = sel.recordset?.[0]?.idVehiculo;
  }
  if (!idVehiculo) throw new Error("No se pudo obtener idVehiculo");

  if (soat && (soat.estado || soat.nombre_compania || soat.numero_poliza)) {
    await pool.request()
      .input("idVehiculo", sql.UniqueIdentifier, idVehiculo)
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .input("placa", sql.VarChar(20), placa)
      .input("nombreCompania", sql.VarChar(150), (soat.nombre_compania || "").toString().trim().slice(0, 150) || null)
      .input("fechaInicio", sql.VarChar(30), (soat.fecha_inicio || "").toString().trim().slice(0, 30) || null)
      .input("fechaFin", sql.VarChar(30), (soat.fecha_fin || "").toString().trim().slice(0, 30) || null)
      .input("estado", sql.VarChar(30), (soat.estado || "").toString().trim().slice(0, 30) || null)
      .input("numeroPoliza", sql.VarChar(80), (soat.numero_poliza || "").toString().trim().slice(0, 80) || null)
      .input("codigoSbsAseguradora", sql.VarChar(20), (soat.codigo_sbs_aseguradora || "").toString().trim().slice(0, 20) || null)
      .input("codigoUnicoPoliza", sql.VarChar(80), (soat.codigo_unico_poliza || "").toString().trim().slice(0, 80) || null)
      .query(`
        INSERT INTO VehiculoSoat (idVehiculo, idEmpresa, placa, nombreCompania, fechaInicio, fechaFin, estado, numeroPoliza, codigoSbsAseguradora, codigoUnicoPoliza)
        VALUES (@idVehiculo, @idEmpresa, @placa, @nombreCompania, @fechaInicio, @fechaFin, @estado, @numeroPoliza, @codigoSbsAseguradora, @codigoUnicoPoliza)
      `);
  }

  return { idVehiculo, placa };
};

/** Cantidad de vehículos registrados de la empresa (idEmpresa del token). */
exports.contarVehiculosEmpresaRepo = async (pool, idEmpresa) => {
  const result = await pool.request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) AS total
      FROM Vehiculos
      WHERE idEmpresa = @idEmpresa
    `);
  return Number(result.recordset?.[0]?.total || 0);
};

/**
 * Lista vehículos de la empresa con el estado del último SOAT.
 */
exports.listarVehiculosRepo = async (pool, idEmpresa) => {
  const result = await pool.request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        v.idVehiculo,
        v.placa,
        v.marca,
        v.modelo,
        v.color,
        v.serie,
        v.motor,
        v.vin,
        CONVERT(VARCHAR(19), v.fRegistro, 120) AS fRegistro,
        s.estado AS soatEstado,
        s.fechaFin AS soatFechaFin,
        s.nombreCompania AS soatCompania
      FROM Vehiculos v
      OUTER APPLY (
        SELECT TOP 1 estado, fechaFin, nombreCompania
        FROM VehiculoSoat
        WHERE idVehiculo = v.idVehiculo
        ORDER BY fRegistro DESC
      ) s
      WHERE v.idEmpresa = @idEmpresa
      ORDER BY v.placa
    `);
  return result.recordset || [];
};

/**
 * Vehículos de varias empresas (gestora + gestionadas).
 * @param {string[]} idsEmpresa
 */
exports.listarVehiculosConsolidadoGestoraRepo = async (pool, idsEmpresa) => {
  const request = pool.request();
  const { list, inClause } = bindUuidInList(request, idsEmpresa, "ve");
  if (list.length === 0) return [];
  const result = await request.query(`
      SELECT
        v.idVehiculo,
        v.placa,
        v.marca,
        v.modelo,
        v.color,
        v.serie,
        v.motor,
        v.vin,
        v.idEmpresa,
        em.razon_Social AS razonSocialEmpresa,
        CONVERT(VARCHAR(19), v.fRegistro, 120) AS fRegistro,
        s.estado AS soatEstado,
        s.fechaFin AS soatFechaFin,
        s.nombreCompania AS soatCompania
      FROM Vehiculos v
      INNER JOIN Empresas em ON em.idEmpresa = v.idEmpresa
      OUTER APPLY (
        SELECT TOP 1 estado, fechaFin, nombreCompania
        FROM VehiculoSoat
        WHERE idVehiculo = v.idVehiculo
        ORDER BY fRegistro DESC
      ) s
      WHERE v.idEmpresa IN (${inClause})
      ORDER BY em.razon_Social, v.placa
    `);
  return result.recordset || [];
};

/**
 * Lista vehículos con SOAT vencido (estado = 'VENCIDO' o sin SOAT reciente vigente).
 */
exports.listarVehiculosSoatVencidoRepo = async (pool, idEmpresa) => {
  const result = await pool.request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        v.idVehiculo,
        v.placa,
        v.marca,
        v.modelo,
        s.estado AS soatEstado,
        s.fechaFin AS soatFechaFin,
        s.nombreCompania AS soatCompania
      FROM Vehiculos v
      OUTER APPLY (
        SELECT TOP 1 estado, fechaFin, nombreCompania
        FROM VehiculoSoat
        WHERE idVehiculo = v.idVehiculo
        ORDER BY fRegistro DESC
      ) s
      WHERE v.idEmpresa = @idEmpresa
        AND (s.estado = 'VENCIDO' OR s.estado IS NULL)
      ORDER BY v.placa
    `);
  return result.recordset || [];
};

exports.eliminarVehiculoRepo = async (pool, idEmpresa, idVehiculo) => {
  const result = await pool.request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idVehiculo", sql.UniqueIdentifier, idVehiculo)
    .query("DELETE FROM Vehiculos WHERE idEmpresa = @idEmpresa AND idVehiculo = @idVehiculo");
  return result.rowsAffected && result.rowsAffected[0] > 0;
};

