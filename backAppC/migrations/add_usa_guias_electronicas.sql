-- Habilitar emisión de guías electrónicas por empresa (remitente / transportista)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('ConfiguracionFacturacionElectronica') AND name = 'usaGuiasElectronicas'
)
BEGIN
  ALTER TABLE ConfiguracionFacturacionElectronica
  ADD usaGuiasElectronicas BIT NOT NULL DEFAULT 0;
END
GO
