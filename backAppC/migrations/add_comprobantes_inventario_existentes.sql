-- =====================================================================
-- Agregar comprobantes de inventario a empresas existentes
-- II - Inventario Inicial, IN - Ingreso, IV - Inventario, SA - Salida
-- Solo inserta si la empresa NO tiene ya ese codigo
-- =====================================================================

-- II - Inventario Inicial
INSERT INTO Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo)
SELECT e.idEmpresa, 'II', 'Inventario Inicial', 'II01', 0, 1
FROM Empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM Comprobantes c WHERE c.idEmpresa = e.idEmpresa AND c.codigo = 'II'
);

-- IN - Ingreso
INSERT INTO Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo)
SELECT e.idEmpresa, 'IN', 'Ingreso', 'IN01', 0, 1
FROM Empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM Comprobantes c WHERE c.idEmpresa = e.idEmpresa AND c.codigo = 'IN'
);

-- IV - Inventario
INSERT INTO Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo)
SELECT e.idEmpresa, 'IV', 'Inventario', 'IV01', 0, 1
FROM Empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM Comprobantes c WHERE c.idEmpresa = e.idEmpresa AND c.codigo = 'IV'
);

-- SA - Salida
INSERT INTO Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo)
SELECT e.idEmpresa, 'SA', 'Salida', 'SA01', 0, 1
FROM Empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM Comprobantes c WHERE c.idEmpresa = e.idEmpresa AND c.codigo = 'SA'
);

-- Verificar resultado
SELECT e.razon_Social, c.codigo, c.nombre, c.serie
FROM Comprobantes c
INNER JOIN Empresas e ON c.idEmpresa = e.idEmpresa
WHERE c.codigo IN ('II', 'IN', 'IV', 'SA')
ORDER BY e.razon_Social, c.codigo;
