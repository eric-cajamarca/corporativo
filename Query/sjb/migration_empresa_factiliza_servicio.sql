-- =============================================
-- MIGRACIÓN: EmpresaFactilizaServicio (asignar qué servicio API puede usar cada empresa)
-- Fecha: 2026-02-19
-- Uso: Ejecutar sobre base de datos SistemaInventario
-- =============================================

USE SistemaInventario;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EmpresaFactilizaServicio')
BEGIN
    CREATE TABLE EmpresaFactilizaServicio (
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        nombreServicio VARCHAR(100) NOT NULL,
        puedeUsar BIT NOT NULL DEFAULT 1,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        fModificacion DATETIME NULL,

        CONSTRAINT PK_EmpresaFactilizaServicio PRIMARY KEY (idEmpresa, nombreServicio),
        CONSTRAINT FK_EmpresaFactilizaServicio_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE
    );

    CREATE INDEX IX_EmpresaFactilizaServicio_idEmpresa ON EmpresaFactilizaServicio(idEmpresa);
    CREATE INDEX IX_EmpresaFactilizaServicio_nombreServicio ON EmpresaFactilizaServicio(nombreServicio);
END
GO
