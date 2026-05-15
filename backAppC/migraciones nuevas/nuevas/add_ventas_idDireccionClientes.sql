-- Dirección usada al emitir el comprobante (evita ambigüedad si el cliente tiene varias en DireccionClientes).
-- El PDF prioriza esta fila; si es NULL se mantiene la lógica anterior (DireccionClientes + RUC / XML).

IF COL_LENGTH('dbo.Ventas', 'idDireccionClientes') IS NULL
BEGIN
  ALTER TABLE dbo.Ventas ADD idDireccionClientes INT NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Ventas_DireccionClientes'
)
BEGIN
  -- NO ACTION: evita Msg 1785 (múltiples rutas CASCADE) porque Empresas ya enlaza en cascada
  -- con Ventas y con DireccionClientes; SET NULL/CASCADE aquí duplicaría el camino hacia DireccionClientes.
  ALTER TABLE dbo.Ventas ADD CONSTRAINT FK_Ventas_DireccionClientes
    FOREIGN KEY (idDireccionClientes) REFERENCES dbo.DireccionClientes (idDireccionClientes)
    ON DELETE NO ACTION;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'IX_Ventas_idDireccionClientes' AND object_id = OBJECT_ID('dbo.Ventas')
)
BEGIN
  CREATE INDEX IX_Ventas_idDireccionClientes ON dbo.Ventas (idDireccionClientes)
    WHERE idDireccionClientes IS NOT NULL;
END
GO
