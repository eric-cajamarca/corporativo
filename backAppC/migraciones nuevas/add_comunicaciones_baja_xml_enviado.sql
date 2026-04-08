-- XML firmado enviado en sendSummary (RA) y descripción larga de SUNAT
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.ComunicacionesBaja') AND name = 'xmlEnviado')
BEGIN
  ALTER TABLE dbo.ComunicacionesBaja ADD xmlEnviado NVARCHAR(MAX) NULL;
END
GO
-- Motivos de rechazo SUNAT suelen superar 500 caracteres
ALTER TABLE dbo.ComunicacionesBaja ALTER COLUMN descripcionRespuesta NVARCHAR(MAX) NULL;
GO
