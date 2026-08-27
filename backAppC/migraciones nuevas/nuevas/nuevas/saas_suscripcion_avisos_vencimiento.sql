-- Avisos de suscripción (pre-aviso de vencimiento, vencida y pago confirmado).
-- Reutiliza OnboardingAutomationLog como bitácora e idempotencia por canal.
-- Requiere haber ejecutado antes: saas_onboarding_operativo_fase4.sql

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'OnboardingAutomationLog')
BEGIN
    -- El cooldown se consulta por (empresa, tipoEvento, canal, fechaEnvio):
    -- sin este índice el conteo hace scan al crecer la bitácora.
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_OnboardingAutomationLog_EmpresaTipoCanalFecha'
          AND object_id = OBJECT_ID('dbo.OnboardingAutomationLog')
    )
    BEGIN
        CREATE INDEX IX_OnboardingAutomationLog_EmpresaTipoCanalFecha
            ON dbo.OnboardingAutomationLog(idEmpresa, tipoEvento, canal, fechaEnvio DESC);
    END
END
GO

-- EmpresaSuscripcion se recorre por fechaFin para detectar por vencer / vencidas.
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmpresaSuscripcion')
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_EmpresaSuscripcion_EstadoFechaFin'
          AND object_id = OBJECT_ID('dbo.EmpresaSuscripcion')
    )
    BEGIN
        CREATE INDEX IX_EmpresaSuscripcion_EstadoFechaFin
            ON dbo.EmpresaSuscripcion(estado, fechaFin);
    END
END
GO
