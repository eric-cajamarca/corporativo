-- Módulos de menú por plan SaaS + servicios Factiliza por plan (extensible por filas).
-- Ejecutar tras saas_planes_catalogo.sql y existir FactilizaConfig.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SaasPlanModulo')
BEGIN
    CREATE TABLE dbo.SaasPlanModulo (
        planCode VARCHAR(30) NOT NULL,
        moduloCodigo VARCHAR(64) NOT NULL,
        CONSTRAINT PK_SaasPlanModulo PRIMARY KEY (planCode, moduloCodigo),
        CONSTRAINT FK_SaasPlanModulo_SaasPlan FOREIGN KEY (planCode) REFERENCES dbo.SaasPlan(planCode)
    );
    CREATE INDEX IX_SaasPlanModulo_plan ON dbo.SaasPlanModulo(planCode);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SaasPlanFactilizaServicio')
BEGIN
    CREATE TABLE dbo.SaasPlanFactilizaServicio (
        planCode VARCHAR(30) NOT NULL,
        idFactilizaConfig INT NOT NULL,
        CONSTRAINT PK_SaasPlanFactilizaServicio PRIMARY KEY (planCode, idFactilizaConfig),
        CONSTRAINT FK_SPF_SaasPlan FOREIGN KEY (planCode) REFERENCES dbo.SaasPlan(planCode),
        CONSTRAINT FK_SPF_FactilizaConfig FOREIGN KEY (idFactilizaConfig) REFERENCES dbo.FactilizaConfig(idFactilizaConfig)
    );
    CREATE INDEX IX_SaasPlanFactiliza_plan ON dbo.SaasPlanFactilizaServicio(planCode);
END
GO

-- Servicios Factiliza adicionales (URLs orientativas; el backend puede seguir usando env/token)
IF NOT EXISTS (SELECT 1 FROM dbo.FactilizaConfig WHERE nombre = 'Factiliza PLACA')
    INSERT INTO dbo.FactilizaConfig (nombre, urlApi, tokenDefault, parametroRuta, estado)
    VALUES (N'Factiliza PLACA', N'https://api.factiliza.com/v1/placa/info', NULL, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.FactilizaConfig WHERE nombre = 'Factiliza SOAT')
    INSERT INTO dbo.FactilizaConfig (nombre, urlApi, tokenDefault, parametroRuta, estado)
    VALUES (N'Factiliza SOAT', N'https://api.factiliza.com/v1/placa/soat', NULL, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.FactilizaConfig WHERE nombre = 'Factiliza LICENCIA')
    INSERT INTO dbo.FactilizaConfig (nombre, urlApi, tokenDefault, parametroRuta, estado)
    VALUES (N'Factiliza LICENCIA', N'https://api.factiliza.com/v1/licencia/info', NULL, NULL, 1);
GO

/* ---------- Módulos de menú (códigos = campo modulo en permisos.service) ---------- */
DECLARE @m TABLE (planCode VARCHAR(30), modulo VARCHAR(64));
INSERT INTO @m VALUES
-- demo: sin Catálogos; Caja reducida en código (gestión + arqueo); sin despachos ni análisis
('demo','DASHBOARD'),('demo','EMPRESA'),('demo','VENTAS'),('demo','COMPRAS'),('demo','INVENTARIO'),('demo','PRODUCTOS'),('demo','CLIENTES'),('demo','FACTURACION'),('demo','CONFIGURACION'),('demo','CAJA'),
-- basico: operación esencial sin caja ni catálogos
('basico','DASHBOARD'),('basico','EMPRESA'),('basico','VENTAS'),('basico','COMPRAS'),('basico','INVENTARIO'),('basico','PRODUCTOS'),('basico','CLIENTES'),('basico','FACTURACION'),('basico','CONFIGURACION'),
-- emprendedor: + caja y catálogos; sin despachos/análisis/reportes/utilidades
('emprendedor','DASHBOARD'),('emprendedor','EMPRESA'),('emprendedor','VENTAS'),('emprendedor','COMPRAS'),('emprendedor','INVENTARIO'),('emprendedor','PRODUCTOS'),('emprendedor','CLIENTES'),('emprendedor','FACTURACION'),('emprendedor','CONFIGURACION'),('emprendedor','CATALOGOS'),('emprendedor','CAJA'),
-- profesional: + despachos, análisis, reportes, utilidades
('profesional','DASHBOARD'),('profesional','EMPRESA'),('profesional','VENTAS'),('profesional','COMPRAS'),('profesional','INVENTARIO'),('profesional','PRODUCTOS'),('profesional','CLIENTES'),('profesional','FACTURACION'),('profesional','CONFIGURACION'),('profesional','CATALOGOS'),('profesional','CAJA'),('profesional','DESPACHOS'),('profesional','ANALISIS'),('profesional','REPORTES'),('profesional','UTILIDADES'),
-- empresarial (legado): mismo conjunto que profesional
('empresarial','DASHBOARD'),('empresarial','EMPRESA'),('empresarial','VENTAS'),('empresarial','COMPRAS'),('empresarial','INVENTARIO'),('empresarial','PRODUCTOS'),('empresarial','CLIENTES'),('empresarial','FACTURACION'),('empresarial','CONFIGURACION'),('empresarial','CATALOGOS'),('empresarial','CAJA'),('empresarial','DESPACHOS'),('empresarial','ANALISIS'),('empresarial','REPORTES'),('empresarial','UTILIDADES'),
-- enterprise: on-prem; gestores multi-empresa en código
('enterprise','DASHBOARD'),('enterprise','EMPRESA'),('enterprise','VENTAS'),('enterprise','COMPRAS'),('enterprise','INVENTARIO'),('enterprise','PRODUCTOS'),('enterprise','CLIENTES'),('enterprise','FACTURACION'),('enterprise','CONFIGURACION'),('enterprise','CATALOGOS'),('enterprise','CAJA'),('enterprise','DESPACHOS'),('enterprise','ANALISIS'),('enterprise','REPORTES'),('enterprise','UTILIDADES');

MERGE dbo.SaasPlanModulo AS t
USING @m AS s ON t.planCode = s.planCode AND t.moduloCodigo = s.modulo
WHEN NOT MATCHED THEN INSERT (planCode, moduloCodigo) VALUES (s.planCode, s.modulo);
GO

/* ---------- Factiliza por plan (por idFactilizaConfig) ---------- */
DECLARE @f TABLE (planCode VARCHAR(30), nombreServicio NVARCHAR(100));
-- Todos los planes: SUNAT
INSERT INTO @f SELECT 'demo', nombre FROM dbo.FactilizaConfig WHERE nombre = N'Factiliza SUNAT' AND estado = 1;
INSERT INTO @f SELECT 'basico', nombre FROM dbo.FactilizaConfig WHERE nombre = N'Factiliza SUNAT' AND estado = 1;
INSERT INTO @f SELECT 'emprendedor', nombre FROM dbo.FactilizaConfig WHERE nombre = N'Factiliza SUNAT' AND estado = 1;
INSERT INTO @f SELECT 'profesional', nombre FROM dbo.FactilizaConfig WHERE nombre = N'Factiliza SUNAT' AND estado = 1;
INSERT INTO @f SELECT 'empresarial', nombre FROM dbo.FactilizaConfig WHERE nombre = N'Factiliza SUNAT' AND estado = 1;
INSERT INTO @f SELECT 'enterprise', nombre FROM dbo.FactilizaConfig WHERE nombre = N'Factiliza SUNAT' AND estado = 1;
-- Desde emprendedor: WHATSAPP, TIPO CAMBIO
INSERT INTO @f SELECT 'emprendedor', nombre FROM dbo.FactilizaConfig WHERE nombre IN (N'Factiliza WHATSAPP', N'Factiliza TIPO CAMBIO') AND estado = 1;
INSERT INTO @f SELECT 'profesional', nombre FROM dbo.FactilizaConfig WHERE nombre IN (N'Factiliza WHATSAPP', N'Factiliza TIPO CAMBIO') AND estado = 1;
INSERT INTO @f SELECT 'empresarial', nombre FROM dbo.FactilizaConfig WHERE nombre IN (N'Factiliza WHATSAPP', N'Factiliza TIPO CAMBIO') AND estado = 1;
INSERT INTO @f SELECT 'enterprise', nombre FROM dbo.FactilizaConfig WHERE nombre IN (N'Factiliza WHATSAPP', N'Factiliza TIPO CAMBIO') AND estado = 1;
-- Desde profesional: PDF, PLACA, SOAT, LICENCIA
INSERT INTO @f SELECT 'profesional', nombre FROM dbo.FactilizaConfig WHERE nombre IN (N'Factiliza SUNAT PDF', N'Factiliza PLACA', N'Factiliza SOAT', N'Factiliza LICENCIA') AND estado = 1;
INSERT INTO @f SELECT 'empresarial', nombre FROM dbo.FactilizaConfig WHERE nombre IN (N'Factiliza SUNAT PDF', N'Factiliza PLACA', N'Factiliza SOAT', N'Factiliza LICENCIA') AND estado = 1;
INSERT INTO @f SELECT 'enterprise', nombre FROM dbo.FactilizaConfig WHERE nombre IN (N'Factiliza SUNAT PDF', N'Factiliza PLACA', N'Factiliza SOAT', N'Factiliza LICENCIA') AND estado = 1;

MERGE dbo.SaasPlanFactilizaServicio AS t
USING (
    SELECT DISTINCT f.planCode, c.idFactilizaConfig
    FROM @f f
    INNER JOIN dbo.FactilizaConfig c ON c.nombre = f.nombreServicio AND c.estado = 1
) AS s ON t.planCode = s.planCode AND t.idFactilizaConfig = s.idFactilizaConfig
WHEN NOT MATCHED THEN INSERT (planCode, idFactilizaConfig) VALUES (s.planCode, s.idFactilizaConfig);
GO

-- Bases que ya ejecutaron esta migración antes de incluir CAJA en demo (arqueo en menú)
IF NOT EXISTS (SELECT 1 FROM dbo.SaasPlanModulo WHERE planCode = 'demo' AND moduloCodigo = 'CAJA')
    INSERT INTO dbo.SaasPlanModulo (planCode, moduloCodigo) VALUES ('demo', 'CAJA');
GO
