-- El código de catálogo queda en VARCHAR(20). Códigos vacíos o más largos
-- en la importación reciben el correlativo interno.
IF COL_LENGTH('dbo.Productos', 'codigo') IS NOT NULL
   AND COL_LENGTH('dbo.Productos', 'codigo') > 20
BEGIN
  IF EXISTS (
    SELECT 1 FROM sys.key_constraints
    WHERE name = 'UQ_Productos_EmpresaCodigo'
      AND parent_object_id = OBJECT_ID('dbo.Productos')
  )
  BEGIN
    ALTER TABLE dbo.Productos DROP CONSTRAINT UQ_Productos_EmpresaCodigo;
  END

  ALTER TABLE dbo.Productos ALTER COLUMN codigo VARCHAR(20) NOT NULL;

  ALTER TABLE dbo.Productos ADD CONSTRAINT UQ_Productos_EmpresaCodigo UNIQUE (idEmpresa, codigo);
END
