-- Servicio plataforma: habilitar Bot WhatsApp por empresa (matriz empresaFaciliza / tab Servicios API).

IF NOT EXISTS (SELECT 1 FROM dbo.FactilizaConfig WHERE nombre = N'Factiliza WHATSAPP BOT')
BEGIN
    INSERT INTO dbo.FactilizaConfig (nombre, urlApi, tokenDefault, parametroRuta, estado)
    VALUES (N'Factiliza WHATSAPP BOT', N'', NULL, NULL, 1);
END
GO

-- SaaS: mismo alcance que Factiliza WHATSAPP en planes que ya lo incluyen
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SaasPlanFactilizaServicio')
   AND EXISTS (SELECT 1 FROM dbo.FactilizaConfig WHERE nombre = N'Factiliza WHATSAPP BOT' AND estado = 1)
BEGIN
    INSERT INTO dbo.SaasPlanFactilizaServicio (planCode, idFactilizaConfig)
    SELECT p.planCode, bot.idFactilizaConfig
    FROM dbo.SaasPlanFactilizaServicio p
    INNER JOIN dbo.FactilizaConfig wa ON wa.idFactilizaConfig = p.idFactilizaConfig AND wa.nombre = N'Factiliza WHATSAPP' AND wa.estado = 1
    CROSS JOIN dbo.FactilizaConfig bot
    WHERE bot.nombre = N'Factiliza WHATSAPP BOT' AND bot.estado = 1
      AND NOT EXISTS (
        SELECT 1 FROM dbo.SaasPlanFactilizaServicio x
        WHERE x.planCode = p.planCode AND x.idFactilizaConfig = bot.idFactilizaConfig
      );
END
GO
