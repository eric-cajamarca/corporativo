-- XML UBL firmado último enviado a SUNAT (GRE GEM), para auditoría y descarga.
IF COL_LENGTH('dbo.GuiasElectronicasEmitidas', 'xmlFirmado') IS NULL
BEGIN
  ALTER TABLE dbo.GuiasElectronicasEmitidas ADD xmlFirmado NVARCHAR(MAX) NULL;
END
GO
