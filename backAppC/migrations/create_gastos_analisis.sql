-- Tabla Gastos para análisis financiero (gastos operativos por período).
-- idEstadoPago: 1=Pendiente, 2=Pagado en EstadoPago.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Gastos')
BEGIN
    CREATE TABLE Gastos (
        idGasto UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        fecha DATE NOT NULL,
        tipo VARCHAR(30) NOT NULL DEFAULT 'ADMINISTRACION', -- ADMINISTRACION | VENTAS | FINANCIERO
        monto DECIMAL(18,2) NOT NULL,
        descripcion VARCHAR(500) NULL,
        idUsuario UNIQUEIDENTIFIER NULL,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Gastos_idEmpresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_Gastos_idUsuario FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario)
    );
    CREATE INDEX IX_Gastos_idEmpresa ON Gastos(idEmpresa);
    CREATE INDEX IX_Gastos_fecha ON Gastos(fecha);
    CREATE INDEX IX_Gastos_idEmpresa_fecha ON Gastos(idEmpresa, fecha);
END
GO
