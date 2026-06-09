-- Migración: columna activo en Lotes para deshabilitar lotes sin eliminarlos.
IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Lotes' AND COLUMN_NAME = 'activo'
)
BEGIN
    ALTER TABLE Lotes ADD activo BIT NOT NULL CONSTRAINT DF_Lotes_activo DEFAULT 1;
END;
GO
