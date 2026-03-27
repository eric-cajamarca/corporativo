-- Intentos fallidos de login por empresa + email (normalizado). Ejecutar una vez en SQL Server.
-- Tras 5 fallos: bloqueo temporal (30 min), gestionado en backAppC/services/auth.service.js

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SeguridadLoginIntento' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.SeguridadLoginIntento (
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        emailNormalizado VARCHAR(320) NOT NULL,
        intentosFallidos INT NOT NULL CONSTRAINT DF_SeguridadLogin_intentos DEFAULT (0),
        bloqueadoHasta DATETIME NULL,
        ultimoIntento DATETIME NULL,
        ipUltimoIntento VARCHAR(45) NULL,
        CONSTRAINT PK_SeguridadLoginIntento PRIMARY KEY (idEmpresa, emailNormalizado),
        CONSTRAINT FK_SeguridadLoginIntento_Empresas FOREIGN KEY (idEmpresa) REFERENCES dbo.Empresas(idEmpresa) ON DELETE CASCADE
    );
    CREATE INDEX IX_SeguridadLoginIntento_bloqueo ON dbo.SeguridadLoginIntento (idEmpresa, emailNormalizado)
        INCLUDE (bloqueadoHasta, intentosFallidos);
END
GO
