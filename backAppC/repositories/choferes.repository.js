const sql = require('mssql');

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
      INNER JOIN Rol r ON r.idRol = u.idRol
      WHERE u.idEmpresa = @idEmpresa
        AND r.descripcion = 'Chofer'
        AND u.estado = 1
        AND r.estado = 1
      ORDER BY u.nombres, u.apellidos
    `);

  return result.recordset;
};

exports.validarUsuarioChoferEmpresaRepo = async (pool, idEmpresa, idUsuarioChofer) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idUsuarioChofer', sql.UniqueIdentifier, idUsuarioChofer)
    .query(`
      SELECT COUNT(*) AS existe
      FROM UsuarioWeb u
      INNER JOIN Rol r ON r.idRol = u.idRol
      WHERE u.idEmpresa = @idEmpresa
        AND u.idUsuario = @idUsuarioChofer
        AND r.descripcion = 'Chofer'
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

