-- Agrega columna eliminado a Ventas para eliminación lógica (registro tachado en historial).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Ventas') AND name = 'eliminado')
BEGIN
  ALTER TABLE Ventas ADD eliminado BIT NOT NULL DEFAULT 0;
END
