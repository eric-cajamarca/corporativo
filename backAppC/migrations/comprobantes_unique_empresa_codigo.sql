-- Permite tener RC y RA con la misma serie "-" (código SUNAT).
-- La unicidad pasa a ser por (idEmpresa, codigo) en lugar de (idEmpresa, serie).
USE SistemaInventario;
GO

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_Comprobantes_EmpresaSerie' AND parent_object_id = OBJECT_ID('Comprobantes'))
BEGIN
    ALTER TABLE Comprobantes DROP CONSTRAINT UQ_Comprobantes_EmpresaSerie;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_Comprobantes_EmpresaCodigo' AND parent_object_id = OBJECT_ID('Comprobantes'))
BEGIN
    ALTER TABLE Comprobantes ADD CONSTRAINT UQ_Comprobantes_EmpresaCodigo UNIQUE (idEmpresa, codigo);
END
GO
