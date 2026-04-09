-- Agrega columna datosGuia (JSON completo del GRE) a GuiasElectronicasEmitidas
-- Permite reconstruir el PDF y ver el detalle de la guía sin re-consultar SUNAT.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('GuiasElectronicasEmitidas') AND name = 'datosGuia'
)
BEGIN
  ALTER TABLE GuiasElectronicasEmitidas
  ADD datosGuia NVARCHAR(MAX) NULL;
END
GO
