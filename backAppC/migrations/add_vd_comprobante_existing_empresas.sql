-- Agrega comprobante VD (Vale Despacho) a empresas que no lo tengan.
-- Ejecutar después de create_rubros_config_vales_anticipo.sql

INSERT INTO Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra)
SELECT e.idEmpresa, 'VD', 'Vale Despacho', 'VD01', 0, 1, 1, 0
FROM Empresas e
WHERE NOT EXISTS (SELECT 1 FROM Comprobantes c WHERE c.idEmpresa = e.idEmpresa AND c.codigo = 'VD');
GO

INSERT INTO Secuencias (idEmpresa, idSucursal, idComprobante, serie, ultimoNumero, fActualizacion)
SELECT s.idEmpresa, s.idSucursal, 'VD', 'VD01', 0, GETDATE()
FROM Sucursal s
WHERE NOT EXISTS (SELECT 1 FROM Secuencias sq WHERE sq.idEmpresa = s.idEmpresa AND sq.idSucursal = s.idSucursal AND sq.idComprobante = 'VD' AND sq.serie = 'VD01');
GO
