-- Migración: vincular reserva con venta generada desde hotel (MVP)
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Reservas')
   AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Reservas' AND COLUMN_NAME = 'idVenta')
BEGIN
    ALTER TABLE Reservas ADD idVenta INT NULL;
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Reservas')
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Reservas_IdVenta' AND object_id = OBJECT_ID('Reservas'))
BEGIN
    CREATE INDEX IX_Reservas_IdVenta ON Reservas(idVenta) WHERE idVenta IS NOT NULL;
END
GO
