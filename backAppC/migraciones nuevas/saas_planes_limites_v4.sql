-- Planes SaaS v4: mismo sistema en todos los planes, límites por escala.
-- SUNAT 200/800/3000 · usuarios 2/6/20 · sucursales 1/3/8 · productos 2000/4000/8000
-- WhatsApp manual (Factiliza WHATSAPP) desde Básico; bot (Factiliza WHATSAPP BOT) desde Emprendedor.
-- Conversaciones bot simultáneas: Emprendedor 5, Profesional 20.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SaasPlan')
BEGIN
    RAISERROR('Ejecute primero saas_planes_catalogo.sql', 16, 1);
    RETURN;
END
GO

IF COL_LENGTH('dbo.SaasPlan', 'maxProductosActivos') IS NULL
BEGIN
    ALTER TABLE dbo.SaasPlan ADD maxProductosActivos INT NOT NULL
        CONSTRAINT DF_SaasPlan_maxProductos DEFAULT (0);
END
GO

IF COL_LENGTH('dbo.SaasPlan', 'maxBotConversacionesSimultaneas') IS NULL
BEGIN
    ALTER TABLE dbo.SaasPlan ADD maxBotConversacionesSimultaneas INT NOT NULL
        CONSTRAINT DF_SaasPlan_maxBotConv DEFAULT (0);
END
GO

UPDATE dbo.SaasPlan SET
    descripcionCorta = N'Todo el sistema para 1 local: facturación SUNAT, inventario y WhatsApp ilimitado.',
    beneficiosJson = N'["Todo el sistema: ventas, compras, inventario, caja, créditos y despachos","Hasta 200 comprobantes SUNAT aceptados al mes","Hasta 2 usuarios, 1 sucursal y 2 000 productos","WhatsApp vinculado ilimitado (envío de comprobantes)","Cotizaciones, compras y clientes sin límite","Sin bot de pedidos WhatsApp"]',
    precioMensualPen = 49.00,
    precioAnualPen = 490.00,
    maxUsuarios = 2,
    maxSucursales = 1,
    maxComprobantesSunatAceptados = 200,
    maxProductosActivos = 2000,
    maxBotConversacionesSimultaneas = 0,
    visibleEnCatalogoPublico = 1,
    orden = 15
WHERE planCode = N'basico';
GO

UPDATE dbo.SaasPlan SET
    descripcionCorta = N'Escala tu PYME: más volumen SUNAT, equipo y bot de pedidos WhatsApp.',
    beneficiosJson = N'["Todo lo del plan Básico con más capacidad","Hasta 800 comprobantes SUNAT aceptados al mes","Hasta 6 usuarios, 3 sucursales y 4 000 productos","WhatsApp ilimitado + bot de pedidos","Hasta 5 conversaciones bot simultáneas","Cotizaciones, compras y clientes sin límite"]',
    precioMensualPen = 89.00,
    precioAnualPen = 890.00,
    maxUsuarios = 6,
    maxSucursales = 3,
    maxComprobantesSunatAceptados = 800,
    maxProductosActivos = 4000,
    maxBotConversacionesSimultaneas = 5,
    visibleEnCatalogoPublico = 1,
    orden = 20
WHERE planCode = N'emprendedor';
GO

UPDATE dbo.SaasPlan SET
    descripcionCorta = N'Alto volumen: varias sucursales, catálogo grande y bot con más concurrencia.',
    beneficiosJson = N'["Todo lo del plan Emprendedor para operación exigente","Hasta 3 000 comprobantes SUNAT aceptados al mes","Hasta 20 usuarios, 8 sucursales y 8 000 productos","WhatsApp ilimitado + bot de pedidos","Hasta 20 conversaciones bot simultáneas","Soporte prioritario"]',
    precioMensualPen = 169.00,
    precioAnualPen = 1690.00,
    maxUsuarios = 20,
    maxSucursales = 8,
    maxComprobantesSunatAceptados = 3000,
    maxProductosActivos = 8000,
    maxBotConversacionesSimultaneas = 20,
    visibleEnCatalogoPublico = 1,
    orden = 30
WHERE planCode = N'profesional';
GO

UPDATE dbo.SaasPlan SET
    maxProductosActivos = 500,
    maxBotConversacionesSimultaneas = 0,
    maxComprobantesSunatAceptados = 50
WHERE planCode = N'demo';
GO

/* ---------- Módulos: mismos módulos en Básico, Emprendedor y Profesional ---------- */
DECLARE @modsProf TABLE (modulo VARCHAR(64));
INSERT INTO @modsProf VALUES
('DASHBOARD'),('EMPRESA'),('VENTAS'),('COMPRAS'),('INVENTARIO'),('PRODUCTOS'),('CLIENTES'),
('FACTURACION'),('CONFIGURACION'),('CATALOGOS'),('CAJA'),('DESPACHOS'),('ANALISIS'),('REPORTES'),('UTILIDADES');

DECLARE @planesFull TABLE (planCode VARCHAR(30));
INSERT INTO @planesFull VALUES ('basico'),('emprendedor'),('profesional');

DELETE m
FROM dbo.SaasPlanModulo m
INNER JOIN @planesFull p ON p.planCode = m.planCode;

INSERT INTO dbo.SaasPlanModulo (planCode, moduloCodigo)
SELECT p.planCode, x.modulo
FROM @planesFull p
CROSS JOIN @modsProf x
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.SaasPlanModulo z
    WHERE z.planCode = p.planCode AND z.moduloCodigo = x.modulo
);
GO

/* ---------- Factiliza WHATSAPP en Básico (envío manual) ---------- */
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SaasPlanFactilizaServicio')
BEGIN
    INSERT INTO dbo.SaasPlanFactilizaServicio (planCode, idFactilizaConfig)
    SELECT N'basico', c.idFactilizaConfig
    FROM dbo.FactilizaConfig c
    WHERE c.nombre = N'Factiliza WHATSAPP' AND c.estado = 1
      AND NOT EXISTS (
        SELECT 1 FROM dbo.SaasPlanFactilizaServicio x
        WHERE x.planCode = N'basico' AND x.idFactilizaConfig = c.idFactilizaConfig
      );

    INSERT INTO dbo.SaasPlanFactilizaServicio (planCode, idFactilizaConfig)
    SELECT N'basico', c.idFactilizaConfig
    FROM dbo.FactilizaConfig c
    WHERE c.nombre = N'Factiliza TIPO CAMBIO' AND c.estado = 1
      AND NOT EXISTS (
        SELECT 1 FROM dbo.SaasPlanFactilizaServicio x
        WHERE x.planCode = N'basico' AND x.idFactilizaConfig = c.idFactilizaConfig
      );

    DELETE spf
    FROM dbo.SaasPlanFactilizaServicio spf
    INNER JOIN dbo.FactilizaConfig c ON c.idFactilizaConfig = spf.idFactilizaConfig
    WHERE spf.planCode = N'basico' AND c.nombre = N'Factiliza WHATSAPP BOT';

    DELETE spf
    FROM dbo.SaasPlanFactilizaServicio spf
    INNER JOIN dbo.FactilizaConfig c ON c.idFactilizaConfig = spf.idFactilizaConfig
    WHERE spf.planCode IN (N'basico', N'demo')
      AND c.nombre = N'Factiliza WHATSAPP BOT';
END
GO
