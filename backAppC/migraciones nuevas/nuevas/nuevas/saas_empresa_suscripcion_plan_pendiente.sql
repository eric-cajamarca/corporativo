-- Downgrade programado: plan menor aplica en próxima renovación (sin cobro ahora).
IF COL_LENGTH('dbo.EmpresaSuscripcion', 'planCodePendiente') IS NULL
BEGIN
    ALTER TABLE dbo.EmpresaSuscripcion
        ADD planCodePendiente VARCHAR(30) NULL;
END
GO

IF COL_LENGTH('dbo.EmpresaSuscripcion', 'billingCyclePendiente') IS NULL
BEGIN
    ALTER TABLE dbo.EmpresaSuscripcion
        ADD billingCyclePendiente VARCHAR(10) NULL;
END
GO
