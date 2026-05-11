const sql = require('mssql');

/** Rol por empresa: mismo criterio que migraciones (Chofer / Conductor). */
const SQL_JOIN_ROL_CHOFER_USUARIO = `
  INNER JOIN Rol r ON r.idRol = u.idRol AND r.idEmpresa = u.idEmpresa
`;
const SQL_FILTRO_ROL_CHOFER = `
  AND UPPER(LTRIM(RTRIM(r.descripcion))) IN ('CHOFER', 'CONDUCTOR')
`;

function bindUuidInList(request, ids, prefix) {
  const list = (ids || []).filter(Boolean);
  list.forEach((id, i) => {
    request.input(`${prefix}${i}`, sql.UniqueIdentifier, id);
  });
  return list.map((_, i) => `@${prefix}${i}`).join(', ');
}

exports.listarChoferesRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        c.idChofer,
        u.idUsuario AS idUsuarioChofer,
        u.nombres,
        u.apellidos,
        u.email,
        c.estado,
        c.idEmpresa,
        v.idVehiculo,
        v.placa,
        v.marca,
        v.modelo
      FROM Choferes c
      INNER JOIN UsuarioWeb u ON u.idUsuario = c.idUsuarioChofer AND u.idEmpresa = @idEmpresa
      LEFT JOIN Vehiculos v ON v.idVehiculo = c.idVehiculo AND v.idEmpresa = @idEmpresa
      WHERE c.idEmpresa = @idEmpresa
        AND c.estado = 1
      ORDER BY u.nombres, u.apellidos
    `);

  return result.recordset;
};

/**
 * Choferes internos de varias empresas (gestora + gestionadas). Incluye razon social para UI.
 * @param {string[]} idsEmpresa
 */
exports.listarChoferesConsolidadoGestoraRepo = async (pool, idsEmpresa) => {
  const list = [...new Set((idsEmpresa || []).filter(Boolean))];
  if (list.length === 0) return [];
  const request = pool.request();
  const inClause = bindUuidInList(request, list, 'ce');
  const result = await request.query(`
      SELECT
        c.idChofer,
        u.idUsuario AS idUsuarioChofer,
        u.nombres,
        u.apellidos,
        u.email,
        c.estado,
        v.idVehiculo,
        v.placa,
        v.marca,
        v.modelo,
        c.idEmpresa,
        em.razon_Social AS razonSocialEmpresa
      FROM Choferes c
      INNER JOIN UsuarioWeb u ON u.idUsuario = c.idUsuarioChofer AND u.idEmpresa = c.idEmpresa
      INNER JOIN Empresas em ON em.idEmpresa = c.idEmpresa
      LEFT JOIN Vehiculos v ON v.idVehiculo = c.idVehiculo AND v.idEmpresa = c.idEmpresa
      WHERE c.idEmpresa IN (${inClause})
        AND c.estado = 1
      ORDER BY em.razon_Social, u.nombres, u.apellidos
    `);
  return result.recordset || [];
};

exports.listarUsuariosChoferRolRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        u.idUsuario,
        u.nombres,
        u.apellidos,
        u.email,
        u.estado
      FROM UsuarioWeb u
      ${SQL_JOIN_ROL_CHOFER_USUARIO}
      WHERE u.idEmpresa = @idEmpresa
        ${SQL_FILTRO_ROL_CHOFER}
        AND u.estado = 1
        AND r.estado = 1
      ORDER BY u.nombres, u.apellidos
    `);

  return result.recordset;
};

/**
 * Usuarios con rol Chofer en varias empresas (gestora + gestionadas).
 * @param {string[]} idsEmpresa
 */
exports.listarUsuariosChoferRolConsolidadoGestoraRepo = async (pool, idsEmpresa) => {
  const list = [...new Set((idsEmpresa || []).filter(Boolean))];
  if (list.length === 0) return [];
  const request = pool.request();
  const inClause = bindUuidInList(request, list, 'ue');
  const result = await request.query(`
      SELECT
        u.idUsuario,
        u.nombres,
        u.apellidos,
        u.email,
        u.estado,
        u.idEmpresa,
        em.razon_Social AS razonSocialEmpresa
      FROM UsuarioWeb u
      ${SQL_JOIN_ROL_CHOFER_USUARIO}
      INNER JOIN Empresas em ON em.idEmpresa = u.idEmpresa
      WHERE u.idEmpresa IN (${inClause})
        ${SQL_FILTRO_ROL_CHOFER}
        AND u.estado = 1
        AND r.estado = 1
      ORDER BY em.razon_Social, u.nombres, u.apellidos
    `);
  return result.recordset || [];
};

exports.validarUsuarioChoferEmpresaRepo = async (pool, idEmpresa, idUsuarioChofer) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idUsuarioChofer', sql.UniqueIdentifier, idUsuarioChofer)
    .query(`
      SELECT COUNT(*) AS existe
      FROM UsuarioWeb u
      ${SQL_JOIN_ROL_CHOFER_USUARIO}
      WHERE u.idEmpresa = @idEmpresa
        AND u.idUsuario = @idUsuarioChofer
        ${SQL_FILTRO_ROL_CHOFER}
        AND u.estado = 1
        AND r.estado = 1
    `);
  return result.recordset[0].existe > 0;
};

exports.validarVehiculoEmpresaRepo = async (pool, idEmpresa, idVehiculo) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idVehiculo', sql.UniqueIdentifier, idVehiculo)
    .query(`
      SELECT COUNT(*) AS existe
      FROM Vehiculos
      WHERE idEmpresa = @idEmpresa
        AND idVehiculo = @idVehiculo
    `);
  return result.recordset[0].existe > 0;
};

exports.crearOActualizarChoferRepo = async (pool, idEmpresa, idUsuarioChofer, idVehiculo) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idUsuarioChofer', sql.UniqueIdentifier, idUsuarioChofer)
    .input('idVehiculo', sql.UniqueIdentifier, idVehiculo)
    .query(`
      IF EXISTS (SELECT 1 FROM Choferes WHERE idEmpresa = @idEmpresa AND idUsuarioChofer = @idUsuarioChofer)
      BEGIN
        UPDATE Choferes
        SET idVehiculo = @idVehiculo,
            estado = 1
        WHERE idEmpresa = @idEmpresa AND idUsuarioChofer = @idUsuarioChofer;
      END
      ELSE
      BEGIN
        INSERT INTO Choferes (idEmpresa, idUsuarioChofer, idVehiculo, estado)
        VALUES (@idEmpresa, @idUsuarioChofer, @idVehiculo, 1);
      END

      SELECT TOP 1
        c.idChofer,
        c.idVehiculo
      FROM Choferes c
      WHERE c.idEmpresa = @idEmpresa AND c.idUsuarioChofer = @idUsuarioChofer;
    `);

  return {
    data: result.recordset?.[0] || null,
    mensaje: 'Chofer guardado exitosamente'
  };
};

