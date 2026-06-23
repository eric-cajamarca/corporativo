-- Reparación parcial: si la sección 4 del script principal falló en el UPDATE de estadoConsumo,
-- ejecute SOLO este bloque (es idempotente).

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ConsumoHabitacion')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ConsumoHabitacion' AND COLUMN_NAME = 'idEstancia')
        ALTER TABLE ConsumoHabitacion ADD idEstancia UNIQUEIDENTIFIER NULL;
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ConsumoHabitacion')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ConsumoHabitacion' AND COLUMN_NAME = 'estadoConsumo')
        ALTER TABLE ConsumoHabitacion ADD estadoConsumo VARCHAR(20) NOT NULL
            CONSTRAINT DF_ConsumoHabitacion_estadoConsumo DEFAULT 'pendiente';
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ConsumoHabitacion')
   AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Estancias')
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ConsumoHabitacion_Estancia')
BEGIN
    ALTER TABLE ConsumoHabitacion ADD CONSTRAINT FK_ConsumoHabitacion_Estancia
        FOREIGN KEY (idEstancia) REFERENCES Estancias(idEstancia);
END
GO
