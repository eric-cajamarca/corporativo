-- ============================================================
-- Migración OPCIONAL: Tablas para credenciales API SUNAT
-- (Facturación y Guías con URLs distintas; multiempresa)
-- ============================================================
-- Si se usa, el flujo actual puede seguir leyendo ConfiguracionFacturacionElectronica
-- para facturación y usar estas tablas para guías o para unificar después.
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ServiciosSunat')
BEGIN
    CREATE TABLE ServiciosSunat (
        idServicioSunat INT PRIMARY KEY IDENTITY(1,1),
        codigo VARCHAR(20) NOT NULL UNIQUE,
        nombre VARCHAR(100) NOT NULL,
        urlBeta VARCHAR(500) NULL,
        urlProduccion VARCHAR(500) NULL,
        activo BIT NOT NULL DEFAULT 1
    );

    INSERT INTO ServiciosSunat (codigo, nombre, urlBeta, urlProduccion) VALUES
    ('FACTURACION', 'Facturación electrónica (Facturas, Boletas, Notas, RC, RA)',
     'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
     'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService'),
    ('GUIAS', 'Guías de remisión electrónicas',
     'https://e-beta.sunat.gob.pe/ol-ti-itemision-guia-gem-beta/billService',
     'https://e-factura.sunat.gob.pe/ol-ti-itemision-guia-gem/billService');
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CredencialesApiSunat')
BEGIN
    CREATE TABLE CredencialesApiSunat (
        idCredencialApiSunat UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idServicioSunat INT NOT NULL,
        usuarioSol VARCHAR(100) NULL,
        claveSol VARCHAR(256) NULL,
        urlEnvio VARCHAR(500) NULL,
        usarBeta BIT NOT NULL DEFAULT 1,
        activo BIT NOT NULL DEFAULT 1,
        fechaCreacion DATETIME2 NOT NULL DEFAULT GETDATE(),
        fechaModificacion DATETIME2 NULL,
        CONSTRAINT UQ_CredencialesApiSunat_EmpresaServicio UNIQUE (idEmpresa, idServicioSunat),
        CONSTRAINT FK_CredencialesApiSunat_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_CredencialesApiSunat_Servicio FOREIGN KEY (idServicioSunat) REFERENCES ServiciosSunat(idServicioSunat)
    );

    CREATE INDEX IX_CredencialesApiSunat_Empresa ON CredencialesApiSunat(idEmpresa);
END
GO
