-- Vehículos por empresa (datos de consulta placa Factiliza)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Vehiculos')
BEGIN
    CREATE TABLE Vehiculos (
        idVehiculo UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        placa VARCHAR(20) NOT NULL,
        marca VARCHAR(100) NULL,
        modelo VARCHAR(100) NULL,
        color VARCHAR(80) NULL,
        serie VARCHAR(50) NULL,
        motor VARCHAR(50) NULL,
        vin VARCHAR(50) NULL,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Vehiculos_idEmpresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IX_Vehiculos_idEmpresa_placa ON Vehiculos(idEmpresa, placa);
    CREATE INDEX IX_Vehiculos_idEmpresa ON Vehiculos(idEmpresa);
END
GO

-- SOAT por vehículo (historial; cada consulta puede insertar un registro)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VehiculoSoat')
BEGIN
    CREATE TABLE VehiculoSoat (
        idVehiculoSoat UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idVehiculo UNIQUEIDENTIFIER NOT NULL,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        placa VARCHAR(20) NOT NULL,
        nombreCompania VARCHAR(150) NULL,
        fechaInicio VARCHAR(30) NULL,
        fechaFin VARCHAR(30) NULL,
        estado VARCHAR(30) NULL,
        numeroPoliza VARCHAR(80) NULL,
        codigoSbsAseguradora VARCHAR(20) NULL,
        codigoUnicoPoliza VARCHAR(80) NULL,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_VehiculoSoat_idVehiculo FOREIGN KEY (idVehiculo) REFERENCES Vehiculos(idVehiculo) ON DELETE CASCADE,
        CONSTRAINT FK_VehiculoSoat_idEmpresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE
    );
    CREATE INDEX IX_VehiculoSoat_idVehiculo ON VehiculoSoat(idVehiculo);
    CREATE INDEX IX_VehiculoSoat_idEmpresa ON VehiculoSoat(idEmpresa);
    CREATE INDEX IX_VehiculoSoat_placa ON VehiculoSoat(placa);
END
GO
