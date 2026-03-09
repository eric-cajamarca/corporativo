-- ============================================================
-- Fase 1: Resumen diario de boletas
-- - useResumenDiarioBoletas en ConfiguracionFacturacionElectronica
-- - Tabla ResumenesDiariosSunat
-- ============================================================

-- Columna para que la empresa elija: boletas por resumen diario (1) o envío individual (0)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('ConfiguracionFacturacionElectronica') AND name = 'useResumenDiarioBoletas'
)
BEGIN
  ALTER TABLE ConfiguracionFacturacionElectronica
  ADD useResumenDiarioBoletas BIT NOT NULL DEFAULT 0;
END
GO

-- Tabla de resúmenes diarios enviados (RC)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ResumenesDiariosSunat')
BEGIN
  CREATE TABLE ResumenesDiariosSunat (
    idResumenDiarioSunat UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    fechaResumen DATE NOT NULL,
    numeroCorrelativo VARCHAR(5) NOT NULL,
    ticketSunat VARCHAR(50) NULL,
    idEstadoSunat INT NULL,
    fechaEnvio VARCHAR(23) NULL,
    fechaRespuesta VARCHAR(23) NULL,
    codigoRespuesta VARCHAR(10) NULL,
    descripcionRespuesta VARCHAR(500) NULL,
    cdr NVARCHAR(MAX) NULL,
    fechaCreacion DATETIME2 NOT NULL DEFAULT GETDATE(),
    fechaModificacion DATETIME2 NULL,
    CONSTRAINT FK_ResumenesDiariosSunat_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT FK_ResumenesDiariosSunat_Estado FOREIGN KEY (idEstadoSunat) REFERENCES EstadosSunat(idEstadoSunat)
  );

  CREATE INDEX IX_ResumenesDiariosSunat_EmpresaFecha ON ResumenesDiariosSunat(idEmpresa, fechaResumen);
  CREATE UNIQUE INDEX UQ_ResumenesDiariosSunat_EmpresaFechaCorrel ON ResumenesDiariosSunat(idEmpresa, fechaResumen, numeroCorrelativo);
END
GO

-- Tabla de relación: qué comprobantes electrónicos están en cada resumen (para actualizar estado cuando el CDR sea aceptado)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ResumenDiarioSunatDetalle')
BEGIN
  CREATE TABLE ResumenDiarioSunatDetalle (
    idResumenDiarioSunatDetalle UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idResumenDiarioSunat UNIQUEIDENTIFIER NOT NULL,
    idComprobanteElectronico UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT FK_ResumenDetalle_Resumen FOREIGN KEY (idResumenDiarioSunat) REFERENCES ResumenesDiariosSunat(idResumenDiarioSunat) ON DELETE CASCADE,
    CONSTRAINT FK_ResumenDetalle_Comprobante FOREIGN KEY (idComprobanteElectronico) REFERENCES ComprobantesElectronicos(idComprobanteElectronico)
  );

  CREATE INDEX IX_ResumenDiarioSunatDetalle_Resumen ON ResumenDiarioSunatDetalle(idResumenDiarioSunat);
END
GO
