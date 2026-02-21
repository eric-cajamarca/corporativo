-- Agregar a Clientes: sujeto a crédito y línea de crédito.
-- Por defecto: no sujeto a crédito (0), línea de crédito 0.

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Clientes') AND name = 'sujetoCredito'
)
BEGIN
  ALTER TABLE Clientes ADD sujetoCredito BIT NOT NULL DEFAULT 0;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Clientes') AND name = 'lineaCredito'
)
BEGIN
  ALTER TABLE Clientes ADD lineaCredito DECIMAL(18,2) NOT NULL DEFAULT 0;
END
GO
