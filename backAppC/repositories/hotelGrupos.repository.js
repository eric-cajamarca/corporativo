const sql = require('mssql');

let esquemaGrupoOk = false;

async function asegurarEsquema(pool) {
  if (esquemaGrupoOk) return;
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HotelGrupos')
    BEGIN
      CREATE TABLE HotelGrupos (
        idGrupo UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idCliente INT NULL,
        codigo VARCHAR(30) NOT NULL,
        nombre VARCHAR(200) NOT NULL,
        fechaEntrada DATE NOT NULL,
        fechaSalida DATE NOT NULL,
        hospedajeFacturado BIT NOT NULL CONSTRAINT DF_HotelGrupos_hospedajeFacturado DEFAULT 0,
        idVentaHospedaje INT NULL,
        estado VARCHAR(20) NOT NULL CONSTRAINT DF_HotelGrupos_estado DEFAULT 'activo',
        observaciones VARCHAR(500) NULL,
        idUsuario UNIQUEIDENTIFIER NULL,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_HotelGrupos_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT CK_HotelGrupos_estado CHECK (estado IN ('activo','cerrado','cancelado')),
        CONSTRAINT UQ_HotelGrupos_EmpresaCodigo UNIQUE (idEmpresa, codigo)
      );
      CREATE INDEX IX_HotelGrupos_EmpresaEstado ON HotelGrupos(idEmpresa, estado);
    END

    IF COL_LENGTH('dbo.Reservas', 'idGrupo') IS NULL
      ALTER TABLE Reservas ADD idGrupo UNIQUEIDENTIFIER NULL;
    IF COL_LENGTH('dbo.Reservas', 'habitacionFacturada') IS NULL
      ALTER TABLE Reservas ADD habitacionFacturada BIT NOT NULL CONSTRAINT DF_Reservas_habitacionFacturada DEFAULT 0;
    IF COL_LENGTH('dbo.Reservas', 'idVentaHabitacion') IS NULL
      ALTER TABLE Reservas ADD idVentaHabitacion INT NULL;

    IF COL_LENGTH('dbo.Estancias', 'idGrupo') IS NULL
      ALTER TABLE Estancias ADD idGrupo UNIQUEIDENTIFIER NULL;
  `);
  esquemaGrupoOk = true;
}

function selectGrupoBase() {
  return `
    SELECT g.idGrupo, g.idEmpresa, g.idCliente, g.codigo, g.nombre,
           CONVERT(VARCHAR(10), g.fechaEntrada, 120) AS fechaEntrada,
           CONVERT(VARCHAR(10), g.fechaSalida, 120) AS fechaSalida,
           CAST(ISNULL(g.hospedajeFacturado, 0) AS BIT) AS hospedajeFacturado,
           g.idVentaHospedaje, g.estado, g.observaciones,
           CONVERT(VARCHAR(19), g.fRegistro, 120) AS fRegistro,
           c.rSocial AS clienteNombre,
           (SELECT COUNT(*) FROM Reservas r WHERE r.idGrupo = g.idGrupo AND r.idEmpresa = g.idEmpresa) AS totalHabitaciones,
           (SELECT COUNT(*) FROM Reservas r WHERE r.idGrupo = g.idGrupo AND r.idEmpresa = g.idEmpresa AND r.estado = 'confirmada') AS reservasPendientes,
           (SELECT COUNT(*) FROM Estancias e WHERE e.idGrupo = g.idGrupo AND e.idEmpresa = g.idEmpresa AND e.estadoEstancia = 'activa') AS inHouse
    FROM HotelGrupos g
    LEFT JOIN Clientes c ON g.idCliente = c.idCliente
  `;
}

async function siguienteCodigo(pool, idEmpresa) {
  await asegurarEsquema(pool);
  const año = new Date().getFullYear();
  const prefijo = `GRP-${año}-%`;
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('prefijo', sql.VarChar(20), prefijo)
    .query(`
      SELECT ISNULL(MAX(CAST(SUBSTRING(codigo, 10, 10) AS INT)), 0) + 1 AS siguiente
      FROM HotelGrupos
      WHERE idEmpresa = @idEmpresa AND codigo LIKE @prefijo
    `);
  const num = result.recordset[0]?.siguiente || 1;
  return `GRP-${año}-${String(num).padStart(3, '0')}`;
}

async function crear(pool, idEmpresa, payload, idUsuario) {
  await asegurarEsquema(pool);
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCliente', sql.Int, payload.idCliente || null)
    .input('codigo', sql.VarChar(30), payload.codigo)
    .input('nombre', sql.VarChar(200), payload.nombre)
    .input('fechaEntrada', sql.Date, payload.fechaEntrada)
    .input('fechaSalida', sql.Date, payload.fechaSalida)
    .input('observaciones', sql.VarChar(500), payload.observaciones || null)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario || null)
    .query(`
      INSERT INTO HotelGrupos
        (idEmpresa, idCliente, codigo, nombre, fechaEntrada, fechaSalida, observaciones, idUsuario)
      OUTPUT INSERTED.idGrupo, INSERTED.codigo
      VALUES
        (@idEmpresa, @idCliente, @codigo, @nombre, @fechaEntrada, @fechaSalida, @observaciones, @idUsuario)
    `);
  return result.recordset[0];
}

async function obtenerPorId(pool, idGrupo, idEmpresa) {
  await asegurarEsquema(pool);
  const result = await pool.request()
    .input('idGrupo', sql.UniqueIdentifier, idGrupo)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`${selectGrupoBase()} WHERE g.idGrupo = @idGrupo AND g.idEmpresa = @idEmpresa`);
  return result.recordset[0] || null;
}

async function listarVigentes(pool, idEmpresa) {
  await asegurarEsquema(pool);
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      ${selectGrupoBase()}
      WHERE g.idEmpresa = @idEmpresa
        AND g.estado = 'activo'
        AND (
          ISNULL(g.hospedajeFacturado, 0) = 0
          OR g.fechaSalida >= CAST(GETDATE() AS DATE)
          OR EXISTS (
            SELECT 1 FROM Estancias e
            WHERE e.idGrupo = g.idGrupo AND e.idEmpresa = g.idEmpresa AND e.estadoEstancia = 'activa'
          )
        )
      ORDER BY g.fechaEntrada, g.codigo
    `);
  return result.recordset;
}

async function listarHabitaciones(pool, idGrupo, idEmpresa) {
  await asegurarEsquema(pool);
  const result = await pool.request()
    .input('idGrupo', sql.UniqueIdentifier, idGrupo)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT r.idReserva, r.idProductoHabitacion, r.idCliente, r.codigo, r.nombreHuesped,
             CONVERT(VARCHAR(10), r.fechaEntrada, 120) AS fechaEntrada,
             CONVERT(VARCHAR(10), r.fechaSalida, 120) AS fechaSalida,
             r.estado, r.total,
             CAST(ISNULL(r.habitacionFacturada, 0) AS BIT) AS habitacionFacturada,
             r.idVentaHabitacion,
             p.codigo AS habitacionCodigo, p.descripcion AS habitacionDescripcion,
             e.idEstancia, e.estadoEstancia,
             CONVERT(VARCHAR(19), e.checkIn, 120) AS checkIn,
             CONVERT(VARCHAR(19), e.checkOutPrevisto, 120) AS checkOutPrevisto,
             e.totalHabitacion AS totalEstancia,
             CAST(ISNULL(e.habitacionFacturada, 0) AS BIT) AS estanciaHabitacionFacturada
      FROM Reservas r
      INNER JOIN Productos p ON r.idProductoHabitacion = p.idProducto
      LEFT JOIN Estancias e ON r.idEstancia = e.idEstancia AND e.idEmpresa = r.idEmpresa
      WHERE r.idGrupo = @idGrupo AND r.idEmpresa = @idEmpresa
      ORDER BY p.codigo
    `);
  return result.recordset;
}

async function marcarHospedajeFacturado(pool, idGrupo, idEmpresa, idVenta) {
  await asegurarEsquema(pool);
  await pool.request()
    .input('idGrupo', sql.UniqueIdentifier, idGrupo)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idVenta', sql.Int, idVenta)
    .query(`
      UPDATE HotelGrupos SET
        hospedajeFacturado = 1,
        idVentaHospedaje = COALESCE(idVentaHospedaje, @idVenta)
      WHERE idGrupo = @idGrupo AND idEmpresa = @idEmpresa AND estado = 'activo'
    `);

  await pool.request()
    .input('idGrupo', sql.UniqueIdentifier, idGrupo)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idVenta', sql.Int, idVenta)
    .query(`
      UPDATE Reservas SET
        habitacionFacturada = 1,
        idVentaHabitacion = COALESCE(idVentaHabitacion, @idVenta)
      WHERE idGrupo = @idGrupo AND idEmpresa = @idEmpresa
        AND estado IN ('confirmada', 'convertida')
    `);

  await pool.request()
    .input('idGrupo', sql.UniqueIdentifier, idGrupo)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idVenta', sql.Int, idVenta)
    .query(`
      UPDATE Estancias SET
        habitacionFacturada = 1,
        idVentaHabitacion = COALESCE(idVentaHabitacion, @idVenta)
      WHERE idGrupo = @idGrupo AND idEmpresa = @idEmpresa
        AND estadoEstancia IN ('activa', 'checkout')
    `);
}

module.exports = {
  asegurarEsquema,
  siguienteCodigo,
  crear,
  obtenerPorId,
  listarVigentes,
  listarHabitaciones,
  marcarHospedajeFacturado
};
