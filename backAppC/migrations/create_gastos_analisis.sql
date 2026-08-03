-- Tabla Gastos para análisis financiero (gastos operativos por período).
-- Soporta gastos puntuales y costos fijos recurrentes mensuales.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Gastos')
BEGIN
    CREATE TABLE Gastos (
        idGasto UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        fecha DATE NOT NULL,
        fechaFin DATE NULL,
        tipo VARCHAR(30) NOT NULL DEFAULT 'ADMINISTRACION', -- ADMINISTRACION | VENTAS | FINANCIERO
        monto DECIMAL(18,2) NOT NULL,
        descripcion VARCHAR(500) NULL,
        esRecurrente BIT NOT NULL CONSTRAINT DF_Gastos_esRecurrente DEFAULT 0,
        activo BIT NOT NULL CONSTRAINT DF_Gastos_activo DEFAULT 1,
        idUsuario UNIQUEIDENTIFIER NULL,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Gastos_idEmpresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_Gastos_idUsuario FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario)
    );
    CREATE INDEX IX_Gastos_idEmpresa ON Gastos(idEmpresa);
    CREATE INDEX IX_Gastos_fecha ON Gastos(fecha);
    CREATE INDEX IX_Gastos_idEmpresa_fecha ON Gastos(idEmpresa, fecha);
    CREATE INDEX IX_Gastos_Empresa_Recurrente ON Gastos(idEmpresa, esRecurrente, activo);
END
GO
