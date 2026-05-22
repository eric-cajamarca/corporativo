const sql = require('mssql');

async function getByEmpresa(pool, idEmpresa) {
  try {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT idEmpresa, proveedor, estadoSesion, telefonoVinculado, activo,
               CONVERT(VARCHAR(19), fActualizacion, 120) AS fActualizacion
        FROM EmpresaWhatsApp
        WHERE idEmpresa = @idEmpresa
      `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  } catch (e) {
    if (e && e.number === 208) return null;
    throw e;
  }
}

async function upsert(pool, idEmpresa, data) {
  const proveedor = data.proveedor != null ? String(data.proveedor).trim().toLowerCase() : 'factiliza';
  const estadoSesion = data.estadoSesion != null ? String(data.estadoSesion).trim() : 'desconectado';
  const telefonoVinculado = data.telefonoVinculado != null ? String(data.telefonoVinculado).trim() : null;
  const activo = data.activo === false || data.activo === 0 ? 0 : 1;

  await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('proveedor', sql.VarChar(20), proveedor)
    .input('estadoSesion', sql.VarChar(30), estadoSesion)
    .input('telefonoVinculado', sql.VarChar(20), telefonoVinculado)
    .input('activo', sql.Bit, activo)
    .query(`
      MERGE EmpresaWhatsApp AS t
      USING (SELECT @idEmpresa AS idEmpresa) AS s ON t.idEmpresa = s.idEmpresa
      WHEN MATCHED THEN
        UPDATE SET proveedor = @proveedor, estadoSesion = @estadoSesion,
          telefonoVinculado = @telefonoVinculado, activo = @activo, fActualizacion = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (idEmpresa, proveedor, estadoSesion, telefonoVinculado, activo)
        VALUES (@idEmpresa, @proveedor, @estadoSesion, @telefonoVinculado, @activo);
    `);
}

async function setProveedor(pool, idEmpresa, proveedor) {
  await upsert(pool, idEmpresa, { proveedor, estadoSesion: 'desconectado', activo: 1 });
}

async function syncEstadoSesion(pool, idEmpresa, estadoSesion, telefonoVinculado) {
  const row = await getByEmpresa(pool, idEmpresa);
  if (!row) {
    await upsert(pool, idEmpresa, {
      proveedor: 'baileys',
      estadoSesion,
      telefonoVinculado,
      activo: 1
    });
    return;
  }
  await upsert(pool, idEmpresa, {
    proveedor: row.proveedor,
    estadoSesion,
    telefonoVinculado: telefonoVinculado != null ? telefonoVinculado : row.telefonoVinculado,
    activo: row.activo
  });
}

module.exports = {
  getByEmpresa,
  upsert,
  setProveedor,
  syncEstadoSesion
};
