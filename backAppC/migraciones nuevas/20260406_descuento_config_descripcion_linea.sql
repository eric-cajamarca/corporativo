-- Descripción por línea en ventas (no modifica Productos) + flag en catálogo
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.DetalleVenta') AND name = N'descripcionLinea'
)
  ALTER TABLE dbo.DetalleVenta ADD descripcionLinea NVARCHAR(500) NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.Productos') AND name = N'permiteDescripcionEnVenta'
)
BEGIN
  ALTER TABLE dbo.Productos ADD permiteDescripcionEnVenta BIT NOT NULL
    CONSTRAINT DF_Productos_permiteDescripcionEnVenta DEFAULT 0;
END
