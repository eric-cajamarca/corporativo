/*
  Notas de crédito: F7 (sobre factura), B7 (sobre boleta) → SUNAT 07.
  Notas de débito: F8 (sobre factura), B8 (sobre boleta) → SUNAT 08.
  ComprobantesElectronicos.tipoComprobante sigue siendo 07 u 08.

  Idempotente: re-ejecutar no duplica B7/B8 si ya existen; UPDATE solo afecta filas con codigo 07 u 08.

  Ejecutar una vez contra la base de datos de la aplicación (empresas ya creadas y futuras: nuevas empresas usan crearComprobantesPredeterminados en código).
*/

IF EXISTS (SELECT 1 FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
           WHERE t.name = N'Comprobantes' AND s.name = N'dbo')
BEGIN
  UPDATE c
  SET c.codigo = 'F7',
      c.nombre = N'N.C. Electrónica (Factura)',
      c.usarEnVenta = 0
  FROM dbo.Comprobantes c
  WHERE c.codigo = '07';

  UPDATE c
  SET c.codigo = 'F8',
      c.nombre = N'N.D. Electrónica (Factura)',
      c.usarEnVenta = 0
  FROM dbo.Comprobantes c
  WHERE c.codigo = '08';

  INSERT INTO dbo.Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra)
  SELECT e.idEmpresa, 'B7', N'N.C. Electrónica (Boleta)', 'BC01', 0, 1, 0, 1
  FROM dbo.Empresas e
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Comprobantes x WHERE x.idEmpresa = e.idEmpresa AND x.codigo = 'B7'
  );

  INSERT INTO dbo.Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra)
  SELECT e.idEmpresa, 'B8', N'N.D. Electrónica (Boleta)', 'BD01', 0, 1, 0, 1
  FROM dbo.Empresas e
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Comprobantes x WHERE x.idEmpresa = e.idEmpresa AND x.codigo = 'B8'
  );
END
GO
