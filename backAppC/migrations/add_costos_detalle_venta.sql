-- Migración: agregar columnas de costo a DetalleVenta para cálculo de utilidad por línea.
IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'DetalleVenta' AND COLUMN_NAME = 'costoUnitario'
)
BEGIN
    ALTER TABLE DetalleVenta ADD costoUnitario DECIMAL(18,6) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'DetalleVenta' AND COLUMN_NAME = 'costoTotal'
)
BEGIN
    ALTER TABLE DetalleVenta ADD costoTotal DECIMAL(18,6) NULL;
END;
GO

