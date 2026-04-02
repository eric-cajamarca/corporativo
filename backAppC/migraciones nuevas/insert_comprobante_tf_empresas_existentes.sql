/*
  Comprobante TF (Transferencia entre sucursales) para empresas que ya existían.
  Ejecutar una vez en SQL Server contra la base de datos de la aplicación.
*/
SET NOCOUNT ON;

-- Comprobante por empresa (si aún no existe)
INSERT INTO Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo)
SELECT e.idEmpresa, 'TF', 'Transferencia', 'TF01', 0, 1
FROM Empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM Comprobantes c
  WHERE c.idEmpresa = e.idEmpresa AND c.codigo = 'TF'
);

-- Secuencia TF01 por cada sucursal (misma convención que creación de empresa)
INSERT INTO Secuencias (idEmpresa, idSucursal, idComprobante, serie, ultimoNumero, fActualizacion)
SELECT s.idEmpresa, s.idSucursal, 'TF', 'TF01', 0, GETDATE()
FROM Sucursal s
WHERE NOT EXISTS (
  SELECT 1 FROM Secuencias sec
  WHERE sec.idEmpresa = s.idEmpresa
    AND sec.idSucursal = s.idSucursal
    AND sec.idComprobante = 'TF'
    AND sec.serie = 'TF01'
);

GO
