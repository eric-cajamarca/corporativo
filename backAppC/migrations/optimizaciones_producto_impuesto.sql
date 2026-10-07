IF COL_LENGTH('dbo.Productos', 'idImpuesto') IS NULL
BEGIN
    ALTER TABLE dbo.Productos ADD idImpuesto INT NULL;
END
