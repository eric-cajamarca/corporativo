-- Guías electrónicas emitidas (remitente / transportista). Listado en Facturación > Emisión de guías.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'GuiasElectronicasEmitidas')
BEGIN
  CREATE TABLE dbo.GuiasElectronicasEmitidas (
    idGuiaElectronica UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_GuiasElectronicasEmitidas PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    tipoDocumento VARCHAR(2) NOT NULL, -- 09 GRE remitente, 31 transportista (catálogo SUNAT)
    tipoRol VARCHAR(20) NOT NULL,      -- REMITENTE | TRANSPORTISTA
    serie VARCHAR(10) NOT NULL,
    numero VARCHAR(12) NOT NULL,
    fechaEmision DATETIME2 NOT NULL,
    idEstadoSunat INT NULL,
    descripcionEstado VARCHAR(200) NULL,
    ticketSunat VARCHAR(100) NULL,
    comprobanteOrigenSerie VARCHAR(10) NULL,
    comprobanteOrigenNumero VARCHAR(12) NULL,
    motivoTraslado VARCHAR(10) NULL,
    fechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_GuiasEmitidas_fechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_GuiasEmitidas_Empresa FOREIGN KEY (idEmpresa) REFERENCES dbo.Empresas(idEmpresa)
  );
  CREATE INDEX IX_GuiasEmitidas_Empresa_Fecha ON dbo.GuiasElectronicasEmitidas(idEmpresa, fechaEmision DESC);
END
GO
