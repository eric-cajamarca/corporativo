-- =============================================================================
-- Fase 3 chatbot WhatsApp: configurabilidad por empresa + escalamiento a humano
-- =============================================================================
-- Idempotente: cada bloque comprueba sys.columns antes de agregar.
-- Aplica solo en la BD del proyecto (multitenant via idEmpresa).
-- =============================================================================

USE [BSACorp_DB];
GO

-- 1) Toggle global de "humanizacion" (typing/delay/burbujas/reacciones).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.WhatsAppBotConfig') AND name = 'humanizar')
BEGIN
    ALTER TABLE WhatsAppBotConfig ADD humanizar BIT NOT NULL DEFAULT 1;
END
GO

-- 2) Tono formal: 0 = tuteo (default fase 1/2), 1 = "usted".
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.WhatsAppBotConfig') AND name = 'tonoFormal')
BEGIN
    ALTER TABLE WhatsAppBotConfig ADD tonoFormal BIT NOT NULL DEFAULT 0;
END
GO

-- 3) Permitir o no emojis/reacciones en respuestas.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.WhatsAppBotConfig') AND name = 'usarEmojis')
BEGIN
    ALTER TABLE WhatsAppBotConfig ADD usarEmojis BIT NOT NULL DEFAULT 1;
END
GO

-- 4) Cap superior del delay simulado entre presence y sendText (ms).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.WhatsAppBotConfig') AND name = 'delayMaxMs')
BEGIN
    ALTER TABLE WhatsAppBotConfig ADD delayMaxMs INT NOT NULL DEFAULT 3000;
END
GO

-- 5) Mensaje de despedida configurable.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.WhatsAppBotConfig') AND name = 'mensajeDespedida')
BEGIN
    ALTER TABLE WhatsAppBotConfig ADD mensajeDespedida NVARCHAR(500) NULL;
END
GO

-- 6) Numero del vendedor que recibe alertas de escalamiento (sin '+' ni espacios,
--    formato 51XXXXXXXXX). Si NULL se notifica al telefonoVinculado del bot.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.WhatsAppBotConfig') AND name = 'numeroEscalamiento')
BEGIN
    ALTER TABLE WhatsAppBotConfig ADD numeroEscalamiento VARCHAR(20) NULL;
END
GO

-- 7) Habilita/inhabilita el comando "agente" / handoff a humano.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.WhatsAppBotConfig') AND name = 'escalamientoActivo')
BEGIN
    ALTER TABLE WhatsAppBotConfig ADD escalamientoActivo BIT NOT NULL DEFAULT 1;
END
GO

-- 8) Minutos que el bot queda silencioso luego de escalar (default 60).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.WhatsAppBotConfig') AND name = 'escalamientoTimeoutMin')
BEGIN
    ALTER TABLE WhatsAppBotConfig ADD escalamientoTimeoutMin INT NOT NULL DEFAULT 60;
END
GO

-- 9) Cuantos "no entiendo" consecutivos antes de ofrecer agente humano (0 = nunca).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.WhatsAppBotConfig') AND name = 'umbralNoEntiendoEscalar')
BEGIN
    ALTER TABLE WhatsAppBotConfig ADD umbralNoEntiendoEscalar INT NOT NULL DEFAULT 3;
END
GO

PRINT 'Fase 3 chatbot: WhatsAppBotConfig actualizado (idempotente).';
GO
