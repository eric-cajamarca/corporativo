-- Eliminación lógica en MovimientosCaja (recibos tachados en historial).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('MovimientosCaja') AND name = 'eliminado')
BEGIN
  ALTER TABLE MovimientosCaja ADD eliminado BIT NOT NULL DEFAULT 0;
END
