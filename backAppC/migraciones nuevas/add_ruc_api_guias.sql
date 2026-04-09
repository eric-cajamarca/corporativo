-- RUC que se usó para registrar la app en el portal SUNAT api-seguridad.
-- Puede ser distinto al RUC de la empresa en el sistema.
-- Si está vacío, se usa el ruc de la tabla Empresas.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('ConfiguracionFacturacionElectronica') AND name = 'rucApiGuias'
)
BEGIN
  ALTER TABLE ConfiguracionFacturacionElectronica
  ADD rucApiGuias VARCHAR(11) NULL;
END
GO
