-- =============================================
-- Crear tabla empresaFaciliza (servicios API por empresa)
-- Ejecutar si la tabla se llama empresaFaciliza en tu base de datos
-- =============================================

USE SistemaInventario;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'empresaFaciliza')
BEGIN
    CREATE TABLE empresaFaciliza (
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        nombreServicio VARCHAR(100) NOT NULL,
        puedeUsar BIT NOT NULL DEFAULT 1,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        fModificacion DATETIME NULL,

        CONSTRAINT PK_empresaFaciliza PRIMARY KEY (idEmpresa, nombreServicio),
        CONSTRAINT FK_empresaFaciliza_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE
    );

    CREATE INDEX IX_empresaFaciliza_idEmpresa ON empresaFaciliza(idEmpresa);
    CREATE INDEX IX_empresaFaciliza_nombreServicio ON empresaFaciliza(nombreServicio);
END
GO
