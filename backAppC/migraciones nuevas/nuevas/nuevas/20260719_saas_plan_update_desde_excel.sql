-- Actualiza dbo.SaasPlan desde docs/plan.xlsx (precios/usuarios/sucursales).
-- NO modifica planCode ni nombre.
-- Límites SUNAT/productos ajustados a precios Perú (S/49 / S/89 / S/169 / S/399):
--   demo         30 FE/mes · 200 productos
--   básico       120 FE/mes · 600 productos   (~4 docs/día, catálogo local chico)
--   emprendedor  450 FE/mes · 2 000 productos (~15 docs/día, PYME)
--   profesional  1 200 FE/mes · 4 000 productos
--   empresarial  2 500 FE/mes · 7 000 productos
-- Nota: basico.beneficiosJson del Excel tenía JSON roto; aquí va válido.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SaasPlan')
BEGIN
    RAISERROR('No existe dbo.SaasPlan. Ejecute antes el catálogo/migraciones SaaS.', 16, 1);
    RETURN;
END
GO

UPDATE dbo.SaasPlan SET
    descripcionCorta = N'Incluye todo el sistema + whatsapp vinculado.',
    beneficiosJson = N'["Hasta 4 usuarios y 1 sucursal","Hasta 120 comprobantes SUNAT aceptados al mes","Hasta 600 productos en catálogo","Incluye WhatsApp vinculado"]',
    precioMensualPen = 49.00,
    precioAnualPen = 490.00,
    maxUsuarios = 4,
    maxSucursales = 1,
    activo = 1,
    visibleEnCatalogoPublico = 1,
    orden = 15,
    maxComprobantesSunatAceptados = 120,
    maxProductosActivos = 600,
    maxBotConversacionesSimultaneas = 0
WHERE planCode = N'basico';
GO

UPDATE dbo.SaasPlan SET
    descripcionCorta = N'Prueba el sistema 14 días.',
    beneficiosJson = N'["Hasta 2 usuarios y 1 sucursal","Hasta 30 comprobantes SUNAT al mes","Hasta 200 productos en catálogo","WhatsApp manual (sin bot de pedidos)"]',
    precioMensualPen = 0.00,
    precioAnualPen = 0.00,
    maxUsuarios = 2,
    maxSucursales = 1,
    activo = 1,
    visibleEnCatalogoPublico = 1,
    orden = 5,
    maxComprobantesSunatAceptados = 30,
    maxProductosActivos = 200,
    maxBotConversacionesSimultaneas = 0
WHERE planCode = N'demo';
GO

UPDATE dbo.SaasPlan SET
    descripcionCorta = N'Incluye todo el básico con límites apliados + bot whatsapp.',
    beneficiosJson = N'["Hasta 8 usuarios y 2 sucursales","Hasta 450 comprobantes SUNAT aceptados al mes","Hasta 2 000 productos en catálogo","WhatsApp vinculado + bot de pedidos"]',
    precioMensualPen = 89.00,
    precioAnualPen = 890.00,
    maxUsuarios = 8,
    maxSucursales = 2,
    activo = 1,
    visibleEnCatalogoPublico = 1,
    orden = 20,
    maxComprobantesSunatAceptados = 450,
    maxProductosActivos = 2000,
    maxBotConversacionesSimultaneas = 3
WHERE planCode = N'emprendedor';
GO

UPDATE dbo.SaasPlan SET
    descripcionCorta = N'Incluye todo el plan profesional con límites ampliados.',
    beneficiosJson = N'["Hasta 16 usuarios y 4 sucursales","Hasta 2 500 comprobantes SUNAT aceptados al mes","Hasta 7 000 productos en catálogo","WhatsApp vinculado y bot con límites ampliados","Prioridad de soporte"]',
    precioMensualPen = 399.00,
    precioAnualPen = 3990.00,
    maxUsuarios = 16,
    maxSucursales = 4,
    activo = 1,
    visibleEnCatalogoPublico = 1,
    orden = 40,
    maxComprobantesSunatAceptados = 2500,
    maxProductosActivos = 7000,
    maxBotConversacionesSimultaneas = 5
WHERE planCode = N'empresarial';
GO

UPDATE dbo.SaasPlan SET
    descripcionCorta = N'Licencia on-premise / servidor propio. Gestores multi-empresa (desde S/ 399/mes, cotización).',
    beneficiosJson = N'["Solicitar cotización","Límites ampliados a solicitud"]',
    precioMensualPen = 399.00,
    precioAnualPen = 3990.00,
    maxUsuarios = 0,
    maxSucursales = 0,
    activo = 1,
    visibleEnCatalogoPublico = 0,
    orden = 50,
    maxComprobantesSunatAceptados = 0,
    maxProductosActivos = 0,
    maxBotConversacionesSimultaneas = 0
WHERE planCode = N'enterprise';
GO

UPDATE dbo.SaasPlan SET
    descripcionCorta = N'Incluye todo el plan emprendedor con límites ampliados.',
    beneficiosJson = N'["Hasta 12 usuarios y 3 sucursales","Hasta 1 200 comprobantes SUNAT aceptados al mes","Hasta 4 000 productos en catálogo","WhatsApp vinculado y bot con límites ampliados"]',
    precioMensualPen = 169.00,
    precioAnualPen = 1690.00,
    maxUsuarios = 12,
    maxSucursales = 3,
    activo = 1,
    visibleEnCatalogoPublico = 1,
    orden = 30,
    maxComprobantesSunatAceptados = 1200,
    maxProductosActivos = 4000,
    maxBotConversacionesSimultaneas = 4
WHERE planCode = N'profesional';
GO

-- Verificación rápida
SELECT
    planCode,
    nombre,
    precioMensualPen,
    maxComprobantesSunatAceptados,
    maxProductosActivos,
    maxUsuarios,
    maxSucursales,
    orden
FROM dbo.SaasPlan
WHERE planCode IN (N'basico', N'demo', N'emprendedor', N'empresarial', N'enterprise', N'profesional')
ORDER BY orden, planCode;
GO
