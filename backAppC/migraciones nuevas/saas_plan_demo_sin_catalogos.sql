-- Plan demo: quitar módulo de menú Catálogos (oculto en SaaS demo).
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SaasPlanModulo')
BEGIN
    DELETE FROM dbo.SaasPlanModulo
    WHERE LOWER(LTRIM(RTRIM(planCode))) = N'demo' AND LOWER(LTRIM(RTRIM(moduloCodigo))) = N'catalogos';
END
GO
