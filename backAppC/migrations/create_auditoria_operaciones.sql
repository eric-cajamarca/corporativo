-- Log selectivo de operaciones de negocio (ventas, compras, inventario, caja, despachos).
-- Retención configurable vía AUDITORIA_OPERACIONES_RETENTION_MONTHS (job de purga en backend).

IF NOT EXISTS (
  SELECT 1 FROM sys.tables WHERE name = 'AuditoriaOperaciones' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE dbo.AuditoriaOperaciones (
    idAuditoria UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_AuditoriaOperaciones PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idUsuario UNIQUEIDENTIFIER NULL,
    modulo VARCHAR(40) NOT NULL,
    accion VARCHAR(60) NOT NULL,
    idRegistro NVARCHAR(100) NULL,
    referencia NVARCHAR(200) NULL,
    detalle NVARCHAR(500) NULL,
    ipCliente VARCHAR(45) NULL,
    userAgent NVARCHAR(500) NULL,
    fecha DATETIME NOT NULL CONSTRAINT DF_AuditoriaOperaciones_fecha DEFAULT GETDATE()
  );

  CREATE INDEX IX_AuditoriaOperaciones_EmpresaFecha
    ON dbo.AuditoriaOperaciones (idEmpresa, fecha DESC);

  CREATE INDEX IX_AuditoriaOperaciones_Fecha
    ON dbo.AuditoriaOperaciones (fecha);
END
GO
