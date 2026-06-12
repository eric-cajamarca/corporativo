/*
  Permisos para reportes detallados de compras y ventas (PDF/Excel).
  Ejecutar en cada base de datos de empresa / tenant.
*/
SET NOCOUNT ON;

INSERT INTO dbo.Permisos (idEmpresa, nombre, descripcion, modulo, estado)
SELECT e.idEmpresa, N'REPORTE_DETALLADO_COMPRAS', N'Ver reporte detallado de compras (PDF/Excel)', N'COMPRAS', 1
FROM dbo.Empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.Permisos p
  WHERE p.idEmpresa = e.idEmpresa AND p.nombre = N'REPORTE_DETALLADO_COMPRAS'
);

INSERT INTO dbo.Permisos (idEmpresa, nombre, descripcion, modulo, estado)
SELECT e.idEmpresa, N'REPORTE_DETALLADO_VENTAS', N'Ver reporte detallado de ventas (PDF/Excel)', N'VENTAS', 1
FROM dbo.Empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.Permisos p
  WHERE p.idEmpresa = e.idEmpresa AND p.nombre = N'REPORTE_DETALLADO_VENTAS'
);

GO
