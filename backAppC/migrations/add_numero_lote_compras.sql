-- Migración: numero de lote por compra (un número por compra, no por ítem)
-- Ejecutar una sola vez en la base de datos.

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Compras' AND COLUMN_NAME = 'numeroLote'
)
BEGIN
    ALTER TABLE Compras ADD numeroLote INT NULL;
END
GO
