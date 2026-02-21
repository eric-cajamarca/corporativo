-- Migración: flags usarEnVenta y usarEnCompra en Comprobantes
-- Ejecutar una sola vez en la base de datos.

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Comprobantes' AND COLUMN_NAME = 'usarEnVenta'
)
BEGIN
    ALTER TABLE Comprobantes ADD usarEnVenta BIT NOT NULL DEFAULT 1;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Comprobantes' AND COLUMN_NAME = 'usarEnCompra'
)
BEGIN
    ALTER TABLE Comprobantes ADD usarEnCompra BIT NOT NULL DEFAULT 1;
END
GO
