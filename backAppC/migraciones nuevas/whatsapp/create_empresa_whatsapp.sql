-- Configuracion WhatsApp por empresa (proveedor baileys | factiliza)

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EmpresaWhatsApp')
BEGIN
    CREATE TABLE EmpresaWhatsApp (
        idEmpresa UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        proveedor VARCHAR(20) NOT NULL DEFAULT 'factiliza',
        estadoSesion VARCHAR(30) NOT NULL DEFAULT 'desconectado',
        telefonoVinculado VARCHAR(20) NULL,
        activo BIT NOT NULL DEFAULT 1,
        fActualizacion DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_EmpresaWhatsApp_Empresas FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT CK_EmpresaWhatsApp_proveedor CHECK (proveedor IN ('baileys', 'factiliza'))
    );
    CREATE INDEX IX_EmpresaWhatsApp_proveedor ON EmpresaWhatsApp(proveedor) WHERE activo = 1;
END
GO
