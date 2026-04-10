/*
  Comprobante 31 — Guía de Remisión Electrónica - Transportista (SUNAT Catálogo 01, código 31).
  Serie correlativa estándar GRE transportista en la app: V001 (alineado con guiaElectronica.service).

  Incluye:
  1) INSERT en Comprobantes por empresa que aún no tengan codigo '31'
  2) INSERT en Secuencias (V001) por sucursal
  3) (Opcional) Unifica el nombre del comprobante 09 como remitente

  Ejecutar una vez en SQL Server contra la base de datos de la aplicación.
*/
SET NOCOUNT ON;

-- 1) Comprobante GRE Transportista por empresa
INSERT INTO Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra)
SELECT e.idEmpresa,
       '31',
       'Guía de Remisión Electrónica - Transportista',
       'V001',
       0,
       1,
       1,
       1
FROM Empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM Comprobantes c
  WHERE c.idEmpresa = e.idEmpresa AND c.codigo = '31'
);

-- 2) Secuencia V001 por sucursal (misma convención que creación de empresa / otros comprobantes)
INSERT INTO Secuencias (idEmpresa, idSucursal, idComprobante, serie, ultimoNumero, fActualizacion)
SELECT s.idEmpresa, s.idSucursal, '31', 'V001', 0, GETDATE()
FROM Sucursal s
WHERE NOT EXISTS (
  SELECT 1 FROM Secuencias sec
  WHERE sec.idEmpresa = s.idEmpresa
    AND sec.idSucursal = s.idSucursal
    AND sec.idComprobante = '31'
    AND sec.serie = 'V001'
);

-- 3) Opcional: nombre explícito para GRE remitente (09), coherente con Cat. SUNAT 01
UPDATE c
SET c.nombre = 'Guía de Remisión Electrónica - Remitente'
FROM Comprobantes c
WHERE c.codigo = '09'
  AND RTRIM(LTRIM(ISNULL(c.nombre, ''))) IN (
        'Guía de Remisión Electrónica',
        'Guia de Remision Electronica',
        'Guía de Remisión electronica'
      );

-- Verificación
SELECT e.razon_Social, c.codigo, c.nombre, c.serie, c.numero
FROM Comprobantes c
INNER JOIN Empresas e ON e.idEmpresa = c.idEmpresa
WHERE c.codigo IN ('09', '31')
ORDER BY e.razon_Social, c.codigo;

GO
