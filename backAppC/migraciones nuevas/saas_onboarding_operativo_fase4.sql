-- Fase 4: bitácora de automatizaciones de onboarding/operación SaaS.
-- Permite enviar correos automáticos sin duplicados y auditar ejecuciones.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'OnboardingAutomationLog')
BEGIN
    CREATE TABLE dbo.OnboardingAutomationLog (
        idLog UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        tipoEvento VARCHAR(40) NOT NULL, -- BIENVENIDA / FALTA_SUNAT / ACTIVA_PLAN / METRICA_PRIMER_COMPROBANTE
        canal VARCHAR(20) NOT NULL DEFAULT 'EMAIL',
        destinatario VARCHAR(200) NULL,
        asunto NVARCHAR(250) NULL,
        detalle NVARCHAR(1000) NULL,
        fechaEnvio DATETIME NOT NULL DEFAULT GETDATE(),
        metadataJson NVARCHAR(MAX) NULL,
        CONSTRAINT FK_OnboardingAutomationLog_Empresa FOREIGN KEY (idEmpresa)
            REFERENCES dbo.Empresas(idEmpresa) ON DELETE CASCADE
    );

    CREATE INDEX IX_OnboardingAutomationLog_EmpresaFecha
        ON dbo.OnboardingAutomationLog(idEmpresa, fechaEnvio DESC);

    CREATE INDEX IX_OnboardingAutomationLog_TipoFecha
        ON dbo.OnboardingAutomationLog(tipoEvento, fechaEnvio DESC);
END
GO

