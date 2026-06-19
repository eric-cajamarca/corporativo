-- Precios comerciales v3 (sin IGV), cotizaciones en Básico, textos WhatsApp.
-- Ejecutar después de saas_planes_catalogo.sql / saas_planes_reestructura_v2.sql.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SaasPlan')
BEGIN
    RAISERROR('Ejecute primero saas_planes_catalogo.sql', 16, 1);
    RETURN;
END
GO

UPDATE dbo.SaasPlan
SET descripcionCorta = N'Operación esencial: ventas, compras e inventario con FE.',
    beneficiosJson = N'["Hasta 2 usuarios y 1 sucursal","Ventas, compras, inventario, productos y clientes","Cotizaciones comerciales","Facturación electrónica SUNAT","Hasta 150 comprobantes SUNAT aceptados","Sin WhatsApp vinculado, caja ni créditos"]',
    precioMensualPen = 49.00,
    precioAnualPen = 490.00
WHERE planCode = N'basico';
GO

UPDATE dbo.SaasPlan
SET descripcionCorta = N'Caja, créditos, WhatsApp y operación completa para PYME.',
    beneficiosJson = N'["Todo lo del plan Básico","Hasta 4 usuarios y 1 sucursal","WhatsApp vinculado: envío de comprobantes y bot de atención","Caja, créditos y catálogos","Compras SUNAT (comprobantes de proveedor)","Hasta 500 comprobantes SUNAT aceptados"]',
    precioMensualPen = 89.00,
    precioAnualPen = 890.00
WHERE planCode = N'emprendedor';
GO

UPDATE dbo.SaasPlan
SET beneficiosJson = N'["Todo lo del plan Emprendedor","Hasta 11 usuarios y 3 sucursales","WhatsApp vinculado y bot con límites ampliados","Despachos, análisis financiero y reportes","Consultas placa/SOAT y utilidades de margen","Hasta 2 000 comprobantes SUNAT aceptados"]',
    precioMensualPen = 169.00,
    precioAnualPen = 1690.00
WHERE planCode = N'profesional';
GO

UPDATE dbo.SaasPlan
SET descripcionCorta = N'Licencia on-premise / servidor propio. Gestores multi-empresa (desde S/ 350/mes, cotización).'
WHERE planCode = N'enterprise';
GO
