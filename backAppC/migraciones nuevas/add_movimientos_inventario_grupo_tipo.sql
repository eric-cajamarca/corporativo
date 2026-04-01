-- Agrupa líneas del mismo registro desde Ingresos y salidas y conserva el tipo lógico (5 variantes).
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.MovimientosInventario') AND name = N'idGrupoMovimiento'
)
BEGIN
  ALTER TABLE dbo.MovimientosInventario ADD idGrupoMovimiento UNIQUEIDENTIFIER NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.MovimientosInventario') AND name = N'codigoTipoMovimiento'
)
BEGIN
  ALTER TABLE dbo.MovimientosInventario ADD codigoTipoMovimiento VARCHAR(32) NULL;
END
GO
