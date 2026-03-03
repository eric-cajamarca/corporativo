-- Añade columna esPrincipal a Empresas para identificar la empresa dueña del SaaS (recibe pagos de suscripción).
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Empresas' AND COLUMN_NAME = 'esPrincipal')
BEGIN
    ALTER TABLE Empresas ADD esPrincipal BIT NOT NULL DEFAULT 0;
END
GO
