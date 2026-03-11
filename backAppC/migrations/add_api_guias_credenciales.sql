-- Credenciales API guías de remisión (no SOAP). Endpoint: POST {urlBaseApiGuias}/v1/contribuyente/gem
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('ConfiguracionFacturacionElectronica') AND name = 'urlBaseApiGuias'
)
BEGIN
  ALTER TABLE ConfiguracionFacturacionElectronica
  ADD urlBaseApiGuias VARCHAR(500) NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('ConfiguracionFacturacionElectronica') AND name = 'idApiGuias'
)
BEGIN
  ALTER TABLE ConfiguracionFacturacionElectronica
  ADD idApiGuias VARCHAR(100) NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('ConfiguracionFacturacionElectronica') AND name = 'claveApiGuias'
)
BEGIN
  ALTER TABLE ConfiguracionFacturacionElectronica
  ADD claveApiGuias VARCHAR(256) NULL;
END
GO
