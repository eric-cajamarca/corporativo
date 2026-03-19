-- Choferes internos y vínculo con Envios (delivery).
-- Crea tabla Choferes y agrega columnas a Envios.

-- 1) Rol: Chofer
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Rol') AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Empresas')
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM Rol r
    WHERE r.descripcion = 'Chofer'
  )
  BEGIN
    INSERT INTO Rol (idEmpresa, descripcion, estado)
    SELECT e.idEmpresa, 'Chofer', 1
    FROM Empresas e
    WHERE NOT EXISTS (
      SELECT 1 FROM Rol r2 WHERE r2.idEmpresa = e.idEmpresa AND r2.descripcion = 'Chofer'
    );
  END
END
GO

-- 2) Tabla Choferes
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Choferes')
BEGIN
  CREATE TABLE Choferes (
    idChofer UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idUsuarioChofer UNIQUEIDENTIFIER NOT NULL,
    idVehiculo UNIQUEIDENTIFIER NULL,
    estado BIT NOT NULL DEFAULT 1,
    fRegistro DATETIME NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_Choferes_idEmpresa
      FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,

    CONSTRAINT FK_Choferes_idUsuarioChofer
      FOREIGN KEY (idUsuarioChofer) REFERENCES UsuarioWeb(idUsuario),

    CONSTRAINT FK_Choferes_idVehiculo
      FOREIGN KEY (idVehiculo) REFERENCES Vehiculos(idVehiculo)
  );

  CREATE UNIQUE INDEX UQ_Choferes_EmpresaUsuario ON Choferes(idEmpresa, idUsuarioChofer);
  CREATE INDEX IX_Choferes_Empresa ON Choferes(idEmpresa, estado);
END
GO

-- 3) Agregar columnas a Envios
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Envios')
BEGIN
  IF COL_LENGTH('Envios', 'idChofer') IS NULL
  BEGIN
    ALTER TABLE Envios ADD idChofer UNIQUEIDENTIFIER NULL;
  END

  IF COL_LENGTH('Envios', 'idVehiculoEntrega') IS NULL
  BEGIN
    ALTER TABLE Envios ADD idVehiculoEntrega UNIQUEIDENTIFIER NULL;
  END

  -- Índice para listar envíos por chofer
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_Envios_EmpresaChofer' AND object_id = OBJECT_ID('Envios')
  )
  BEGIN
    CREATE INDEX IX_Envios_EmpresaChofer ON Envios(idEmpresa, idChofer);
  END

  -- FK: Envios.idChofer -> Choferes.idChofer
  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Envios_idChofer'
  )
  BEGIN
    ALTER TABLE Envios
      ADD CONSTRAINT FK_Envios_idChofer
      FOREIGN KEY (idChofer) REFERENCES Choferes(idChofer);
  END

  -- FK: Envios.idVehiculoEntrega -> Vehiculos.idVehiculo
  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Envios_idVehiculoEntrega'
  )
  BEGIN
    ALTER TABLE Envios
      ADD CONSTRAINT FK_Envios_idVehiculoEntrega
      FOREIGN KEY (idVehiculoEntrega) REFERENCES Vehiculos(idVehiculo);
  END
END
GO

