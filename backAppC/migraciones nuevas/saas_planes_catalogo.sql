-- Catálogo comercial de planes SaaS (montos y límites configurables en BD).
-- Si la tabla está vacía, el backend sigue usando el catálogo en código (saasPlanes.service).

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SaasPlan')
BEGIN
    CREATE TABLE dbo.SaasPlan (
        planCode VARCHAR(30) NOT NULL PRIMARY KEY,
        nombre NVARCHAR(120) NOT NULL,
        descripcionCorta NVARCHAR(300) NOT NULL,
        beneficiosJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_SaasPlan_beneficios DEFAULT (N'[]'),
        precioMensualPen DECIMAL(18,2) NOT NULL CONSTRAINT DF_SaasPlan_mensual DEFAULT (0),
        precioAnualPen DECIMAL(18,2) NOT NULL CONSTRAINT DF_SaasPlan_anual DEFAULT (0),
        maxUsuarios INT NOT NULL CONSTRAINT DF_SaasPlan_maxUsu DEFAULT (0),
        maxSucursales INT NOT NULL CONSTRAINT DF_SaasPlan_maxSuc DEFAULT (0),
        activo BIT NOT NULL CONSTRAINT DF_SaasPlan_activo DEFAULT (1),
        visibleEnCatalogoPublico BIT NOT NULL CONSTRAINT DF_SaasPlan_visPub DEFAULT (0),
        orden INT NOT NULL CONSTRAINT DF_SaasPlan_orden DEFAULT (0)
    );
    CREATE INDEX IX_SaasPlan_activoVis ON dbo.SaasPlan(activo, visibleEnCatalogoPublico, orden);
END
GO

-- Semilla idempotente (ajuste precios en producción según contrato comercial)
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SaasPlan')
BEGIN
    MERGE dbo.SaasPlan AS t
    USING (VALUES
        (N'basico', N'Básico', N'Operación esencial: ventas, compras e inventario con FE.',
         N'["Hasta 2 usuarios y 1 sucursal","Ventas, compras, inventario, productos y clientes","Cotizaciones comerciales","Facturación electrónica SUNAT","Hasta 150 comprobantes SUNAT aceptados","Sin WhatsApp vinculado, caja ni créditos"]',
         49.00, 490.00, 2, 1, 1, 1, 15),
        (N'emprendedor', N'Emprendedor', N'Caja, créditos, WhatsApp y operación completa para PYME.',
         N'["Todo lo del plan Básico","Hasta 4 usuarios y 1 sucursal","WhatsApp vinculado: envío de comprobantes y bot de atención","Caja, créditos y catálogos","Compras SUNAT (comprobantes de proveedor)","Hasta 500 comprobantes SUNAT aceptados"]',
         89.00, 890.00, 4, 1, 1, 1, 20),
        (N'profesional', N'Profesional', N'Despachos, reportes, análisis y escala comercial.',
         N'["Todo lo del plan Emprendedor","Hasta 11 usuarios y 3 sucursales","WhatsApp vinculado y bot con límites ampliados","Despachos, análisis financiero y reportes","Consultas placa/SOAT y utilidades de margen","Hasta 2 000 comprobantes SUNAT aceptados"]',
         169.00, 1690.00, 11, 3, 1, 1, 30),
        (N'empresarial', N'Empresarial (legado)', N'Plan legado; contacte soporte para migrar a Profesional.',
         N'[]', 399.00, 3990.00, 35, 99, 1, 0, 90),
        (N'demo', N'Demo', N'Prueba el sistema 14 días.',
         N'[]', 0.00, 0.00, 1, 1, 1, 0, 5),
        (N'enterprise', N'Enterprise', N'Licencia on-premise / servidor propio. Gestores multi-empresa.',
         N'[]', 0.00, 0.00, 99999, 99999, 1, 0, 0)
    ) AS s (planCode, nombre, descripcionCorta, beneficiosJson, precioMensualPen, precioAnualPen, maxUsuarios, maxSucursales, activo, visibleEnCatalogoPublico, orden)
    ON t.planCode = s.planCode
    WHEN NOT MATCHED THEN
        INSERT (planCode, nombre, descripcionCorta, beneficiosJson, precioMensualPen, precioAnualPen, maxUsuarios, maxSucursales, activo, visibleEnCatalogoPublico, orden)
        VALUES (s.planCode, s.nombre, s.descripcionCorta, s.beneficiosJson, s.precioMensualPen, s.precioAnualPen, s.maxUsuarios, s.maxSucursales, s.activo, s.visibleEnCatalogoPublico, s.orden);
END
GO
