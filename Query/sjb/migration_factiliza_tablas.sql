-- =============================================
-- MIGRACIÓN: Tablas Factiliza (API SUNAT y acceso por empresa)
-- Fecha: 2026-01-30
-- Uso: Ejecutar sobre base de datos SistemaInventario
-- =============================================

USE SistemaInventario;
GO

-- Configuración global de la API Factiliza (URL y token por defecto)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FactilizaConfig')
BEGIN
    CREATE TABLE FactilizaConfig (
        idFactilizaConfig INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
        nombre VARCHAR(100) NOT NULL DEFAULT 'Factiliza SUNAT',
        urlApi VARCHAR(500) NOT NULL DEFAULT 'https://api.factiliza.com/v1/sunat/xml',
        tokenDefault NVARCHAR(MAX) NULL,
        estado BIT NOT NULL DEFAULT 1,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        fModificacion DATETIME NULL
    );

    INSERT INTO FactilizaConfig (nombre, urlApi, tokenDefault, estado)
    VALUES ('Factiliza SUNAT', 'https://api.factiliza.com/v1/sunat/xml', NULL, 1);
END
GO

-- Acceso por empresa: qué empresas pueden usar Factiliza y con qué credenciales
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EmpresaFactiliza')
BEGIN
    CREATE TABLE EmpresaFactiliza (
        idEmpresaFactiliza UNIQUEIDENTIFIER PRIMARY KEY NOT NULL DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        puedeUsar BIT NOT NULL DEFAULT 0,
        tokenFactiliza NVARCHAR(MAX) NULL,
        usuarioSol VARCHAR(100) NULL,
        passwordSol NVARCHAR(MAX) NULL,
        rucEmpresa VARCHAR(11) NULL,
        activo BIT NOT NULL DEFAULT 1,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        fModificacion DATETIME NULL,

        CONSTRAINT FK_EmpresaFactiliza_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT UQ_EmpresaFactiliza_Empresa UNIQUE (idEmpresa)
    );

    CREATE INDEX IX_EmpresaFactiliza_idEmpresa ON EmpresaFactiliza(idEmpresa);
    CREATE INDEX IX_EmpresaFactiliza_puedeUsar ON EmpresaFactiliza(puedeUsar) WHERE activo = 1;
END
GO
