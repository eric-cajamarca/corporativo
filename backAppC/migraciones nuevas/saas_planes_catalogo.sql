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
        (N'emprendedor', N'Emprendedor', N'Compras, ventas e inventario para empezar.',
         N'["Hasta 4 usuarios y 1 sucursal","Productos (categorías, marcas, impuestos), clientes y proveedores","Compras, ventas e inventario con lotes","Reportes esenciales de operación"]',
         59.00, 590.00, 4, 1, 1, 1, 10),
        (N'profesional', N'Profesional', N'Caja, créditos, análisis y reportes.',
         N'["Todo lo que tiene el plan emprendedor","Hasta 11 usuarios y hasta 3 sucursales","Caja, créditos y cuotas","Análisis financiero y reportes avanzados","Listas de precio y escenarios comerciales"]',
         149.00, 1490.00, 11, 3, 1, 1, 20),
        (N'empresarial', N'Empresarial', N'Escala, sucursales y multi-empresa.',
         N'["Todo lo que tiene el plan Profesional","Hasta 35 usuarios y hasta 99 sucursales","Multi-empresa y gestores (varias razones sociales)","Prioridad de soporte y opciones de escala (según contrato)","Integraciones y operación avanzada (según contrato)"]',
         399.00, 3990.00, 35, 99, 1, 1, 30),
        (N'demo', N'Demo', N'Prueba el sistema 14 días.',
         N'[]', 0.00, 0.00, 3, 1, 1, 0, 5),
        (N'enterprise', N'Enterprise', N'Licencia on-premise / corporativa.',
         N'[]', 0.00, 0.00, 99999, 99999, 1, 0, 0)
    ) AS s (planCode, nombre, descripcionCorta, beneficiosJson, precioMensualPen, precioAnualPen, maxUsuarios, maxSucursales, activo, visibleEnCatalogoPublico, orden)
    ON t.planCode = s.planCode
    WHEN NOT MATCHED THEN
        INSERT (planCode, nombre, descripcionCorta, beneficiosJson, precioMensualPen, precioAnualPen, maxUsuarios, maxSucursales, activo, visibleEnCatalogoPublico, orden)
        VALUES (s.planCode, s.nombre, s.descripcionCorta, s.beneficiosJson, s.precioMensualPen, s.precioAnualPen, s.maxUsuarios, s.maxSucursales, s.activo, s.visibleEnCatalogoPublico, s.orden);
END
GO
