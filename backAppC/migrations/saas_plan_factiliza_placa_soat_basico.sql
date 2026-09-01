-- Consultas Factiliza placa y SOAT desde el plan Básico (y Emprendedor).
-- PDF y licencia de conducir siguen en Profesional.

IF OBJECT_ID('dbo.SaasPlanFactilizaServicio', 'U') IS NOT NULL
   AND OBJECT_ID('dbo.FactilizaConfig', 'U') IS NOT NULL
   AND OBJECT_ID('dbo.SaasPlan', 'U') IS NOT NULL
BEGIN
    DECLARE @f TABLE (planCode VARCHAR(30), nombreServicio NVARCHAR(100));
    INSERT INTO @f SELECT 'basico', nombre FROM dbo.FactilizaConfig WHERE nombre IN (N'Factiliza PLACA', N'Factiliza SOAT') AND estado = 1;
    INSERT INTO @f SELECT 'emprendedor', nombre FROM dbo.FactilizaConfig WHERE nombre IN (N'Factiliza PLACA', N'Factiliza SOAT') AND estado = 1;

    MERGE dbo.SaasPlanFactilizaServicio AS t
    USING (
        SELECT DISTINCT f.planCode, c.idFactilizaConfig
        FROM @f f
        INNER JOIN dbo.FactilizaConfig c ON c.nombre = f.nombreServicio AND c.estado = 1
        INNER JOIN dbo.SaasPlan p ON p.planCode = f.planCode
    ) AS s ON t.planCode = s.planCode AND t.idFactilizaConfig = s.idFactilizaConfig
    WHEN NOT MATCHED THEN INSERT (planCode, idFactilizaConfig) VALUES (s.planCode, s.idFactilizaConfig);
END
GO
