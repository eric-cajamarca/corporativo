-- Reestructura comercial SaaS (2026): plan Básico, precios actualizados, Empresarial fuera del catálogo público.
-- Ejecutar en bases que ya tienen SaasPlan / SaasPlanModulo.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SaasPlan')
BEGIN
    RAISERROR('Ejecute primero saas_planes_catalogo.sql', 16, 1);
    RETURN;
END
GO

/* ---------- Catálogo SaasPlan ---------- */
MERGE dbo.SaasPlan AS t
USING (VALUES
    (N'basico', N'Básico', N'Operación esencial: ventas, compras e inventario con FE.',
     N'["Hasta 2 usuarios y 1 sucursal","Ventas, compras, inventario, productos y clientes","Cotizaciones comerciales","Facturación electrónica SUNAT","Hasta 150 comprobantes SUNAT aceptados","Sin WhatsApp vinculado, caja ni créditos"]',
     49.00, 490.00, 2, 1, 150, 1, 1, 15),
    (N'emprendedor', N'Emprendedor', N'Caja, créditos, WhatsApp y operación completa para PYME.',
     N'["Todo lo del plan Básico","Hasta 4 usuarios y 1 sucursal","WhatsApp vinculado: envío de comprobantes y bot de atención","Caja, créditos y catálogos","Compras SUNAT (comprobantes de proveedor)","Hasta 500 comprobantes SUNAT aceptados"]',
     89.00, 890.00, 4, 1, 500, 1, 1, 20),
    (N'profesional', N'Profesional', N'Despachos, reportes, análisis y escala comercial.',
     N'["Todo lo del plan Emprendedor","Hasta 11 usuarios y 3 sucursales","WhatsApp vinculado y bot con límites ampliados","Despachos, análisis financiero y reportes","Consultas placa/SOAT y utilidades de margen","Hasta 2 000 comprobantes SUNAT aceptados"]',
     169.00, 1690.00, 11, 3, 2000, 1, 1, 30)
) AS s (planCode, nombre, descripcionCorta, beneficiosJson, precioMensualPen, precioAnualPen, maxUsuarios, maxSucursales, maxComprobantesSunatAceptados, activo, visibleEnCatalogoPublico, orden)
ON t.planCode = s.planCode
WHEN MATCHED THEN
    UPDATE SET
        nombre = s.nombre,
        descripcionCorta = s.descripcionCorta,
        beneficiosJson = s.beneficiosJson,
        precioMensualPen = s.precioMensualPen,
        precioAnualPen = s.precioAnualPen,
        maxUsuarios = s.maxUsuarios,
        maxSucursales = s.maxSucursales,
        maxComprobantesSunatAceptados = s.maxComprobantesSunatAceptados,
        activo = s.activo,
        visibleEnCatalogoPublico = s.visibleEnCatalogoPublico,
        orden = s.orden
WHEN NOT MATCHED THEN
    INSERT (planCode, nombre, descripcionCorta, beneficiosJson, precioMensualPen, precioAnualPen, maxUsuarios, maxSucursales, maxComprobantesSunatAceptados, activo, visibleEnCatalogoPublico, orden)
    VALUES (s.planCode, s.nombre, s.descripcionCorta, s.beneficiosJson, s.precioMensualPen, s.precioAnualPen, s.maxUsuarios, s.maxSucursales, s.maxComprobantesSunatAceptados, s.activo, s.visibleEnCatalogoPublico, s.orden);
GO

UPDATE dbo.SaasPlan
SET visibleEnCatalogoPublico = 0,
    descripcionCorta = N'Plan legado; contacte soporte para migrar a Profesional.'
WHERE planCode = N'empresarial';
GO

UPDATE dbo.SaasPlan
SET descripcionCorta = N'Licencia on-premise / servidor propio. Gestores multi-empresa.',
    visibleEnCatalogoPublico = 0
WHERE planCode = N'enterprise';
GO

UPDATE dbo.SaasPlan
SET descripcionCorta = N'Prueba el sistema 14 días.',
    visibleEnCatalogoPublico = 0,
    maxComprobantesSunatAceptados = 50
WHERE planCode = N'demo';
GO

/* ---------- Módulos por plan ---------- */
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SaasPlanModulo')
BEGIN
    DECLARE @m TABLE (planCode VARCHAR(30), modulo VARCHAR(64));
    INSERT INTO @m VALUES
    ('basico','DASHBOARD'),('basico','EMPRESA'),('basico','VENTAS'),('basico','COMPRAS'),('basico','INVENTARIO'),
    ('basico','PRODUCTOS'),('basico','CLIENTES'),('basico','FACTURACION'),('basico','CONFIGURACION');

    MERGE dbo.SaasPlanModulo AS t
    USING @m AS s ON t.planCode = s.planCode AND t.moduloCodigo = s.modulo
    WHEN NOT MATCHED THEN INSERT (planCode, moduloCodigo) VALUES (s.planCode, s.modulo);

    IF NOT EXISTS (SELECT 1 FROM dbo.SaasPlanModulo WHERE planCode = 'profesional' AND moduloCodigo = 'UTILIDADES')
        INSERT INTO dbo.SaasPlanModulo (planCode, moduloCodigo) VALUES ('profesional', 'UTILIDADES');
END
GO

/* ---------- Factiliza: Básico solo SUNAT ---------- */
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SaasPlanFactilizaServicio')
BEGIN
    INSERT INTO dbo.SaasPlanFactilizaServicio (planCode, idFactilizaConfig)
    SELECT N'basico', c.idFactilizaConfig
    FROM dbo.FactilizaConfig c
    WHERE c.nombre = N'Factiliza SUNAT' AND c.estado = 1
      AND NOT EXISTS (
        SELECT 1 FROM dbo.SaasPlanFactilizaServicio x
        WHERE x.planCode = N'basico' AND x.idFactilizaConfig = c.idFactilizaConfig
      );
END
GO
