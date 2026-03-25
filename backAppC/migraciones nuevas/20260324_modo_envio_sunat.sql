-- Modos de envío SUNAT (1=inmediato al cobrar, 2=diferido N min, 3=hora fija diaria)
-- Reintentos y marcas de pago en ComprobantesElectronicos

IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = 'ConfiguracionFacturacionElectronica' AND c.name = 'modoEnvioSunat'
)
BEGIN
  ALTER TABLE ConfiguracionFacturacionElectronica ADD modoEnvioSunat TINYINT NOT NULL CONSTRAINT DF_CFE_modoEnvioSunat DEFAULT 2;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = 'ConfiguracionFacturacionElectronica' AND c.name = 'horaEnvioSunat'
)
BEGIN
  ALTER TABLE ConfiguracionFacturacionElectronica ADD horaEnvioSunat TIME NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = 'ConfiguracionFacturacionElectronica' AND c.name = 'fechaUltimaOlaEnvioProgramado'
)
BEGIN
  ALTER TABLE ConfiguracionFacturacionElectronica ADD fechaUltimaOlaEnvioProgramado DATE NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = 'ComprobantesElectronicos' AND c.name = 'fechaConfirmacionPago'
)
BEGIN
  ALTER TABLE ComprobantesElectronicos ADD fechaConfirmacionPago DATETIME2 NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = 'ComprobantesElectronicos' AND c.name = 'fechaElegibleEnvio'
)
BEGIN
  ALTER TABLE ComprobantesElectronicos ADD fechaElegibleEnvio DATETIME2 NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = 'ComprobantesElectronicos' AND c.name = 'intentosEnvio'
)
BEGIN
  ALTER TABLE ComprobantesElectronicos ADD intentosEnvio INT NOT NULL CONSTRAINT DF_CE_intentosEnvio DEFAULT 0;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = 'ComprobantesElectronicos' AND c.name = 'fechaUltimoIntentoEnvio'
)
BEGIN
  ALTER TABLE ComprobantesElectronicos ADD fechaUltimoIntentoEnvio DATETIME2 NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = 'ComprobantesElectronicos' AND c.name = 'fechaProximoReintento'
)
BEGIN
  ALTER TABLE ComprobantesElectronicos ADD fechaProximoReintento DATETIME2 NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = 'ComprobantesElectronicos' AND c.name = 'maxIntentosEnvio'
)
BEGIN
  ALTER TABLE ComprobantesElectronicos ADD maxIntentosEnvio INT NULL;
END
GO
