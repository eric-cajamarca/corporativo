-- Facturación parcial de estancia: habitación y consumo se pueden facturar por separado.
-- La estancia sigue activa hasta que no quede saldo pendiente.

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Estancias')
BEGIN
    IF COL_LENGTH('dbo.Estancias', 'habitacionFacturada') IS NULL
        ALTER TABLE Estancias ADD habitacionFacturada BIT NOT NULL
            CONSTRAINT DF_Estancias_habitacionFacturada DEFAULT 0;

    IF COL_LENGTH('dbo.Estancias', 'idVentaHabitacion') IS NULL
        ALTER TABLE Estancias ADD idVentaHabitacion INT NULL;
END
GO
