-- Gastos recurrentes (costos fijos mensuales): se registran una vez y aplican mes a mes.
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Gastos')
BEGIN
    IF COL_LENGTH('Gastos', 'esRecurrente') IS NULL
    BEGIN
        ALTER TABLE Gastos ADD esRecurrente BIT NOT NULL
            CONSTRAINT DF_Gastos_esRecurrente DEFAULT 0;
    END

    IF COL_LENGTH('Gastos', 'activo') IS NULL
    BEGIN
        ALTER TABLE Gastos ADD activo BIT NOT NULL
            CONSTRAINT DF_Gastos_activo DEFAULT 1;
    END

    IF COL_LENGTH('Gastos', 'fechaFin') IS NULL
    BEGIN
        ALTER TABLE Gastos ADD fechaFin DATE NULL;
    END
END
GO
