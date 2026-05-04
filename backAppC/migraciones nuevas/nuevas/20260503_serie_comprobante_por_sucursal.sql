-- =====================================================================
-- Serie / correlativo por sucursal + sucursales vinculadas (series padre)
-- Comprobantes.idSucursal, Sucursal.idSucursalSeriesPadre, idDireccionEmpresa
-- Empresas.permitirVentaMultiSucursal
-- Ejecutar una vez contra la BD de la aplicación.
-- =====================================================================

SET NOCOUNT ON;

-- 1) Empresas: venta multi-sucursal opcional
IF COL_LENGTH('dbo.Empresas', 'permitirVentaMultiSucursal') IS NULL
BEGIN
  ALTER TABLE dbo.Empresas ADD permitirVentaMultiSucursal BIT NOT NULL
    CONSTRAINT DF_Empresas_permitirVentaMultiSucursal DEFAULT 0;
END
GO

-- 2) Sucursal: series compartidas + enlace a dirección SUNAT (codLocal)
IF COL_LENGTH('dbo.Sucursal', 'idSucursalSeriesPadre') IS NULL
BEGIN
  ALTER TABLE dbo.Sucursal ADD idSucursalSeriesPadre UNIQUEIDENTIFIER NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = 'FK_Sucursal_SeriesPadre' AND parent_object_id = OBJECT_ID('dbo.Sucursal')
)
BEGIN
  ALTER TABLE dbo.Sucursal ADD CONSTRAINT FK_Sucursal_SeriesPadre
    FOREIGN KEY (idSucursalSeriesPadre) REFERENCES dbo.Sucursal(idSucursal);
END
GO

IF COL_LENGTH('dbo.Sucursal', 'idDireccionEmpresa') IS NULL
BEGIN
  ALTER TABLE dbo.Sucursal ADD idDireccionEmpresa INT NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = 'FK_Sucursal_DireccionEmpresa' AND parent_object_id = OBJECT_ID('dbo.Sucursal')
)
BEGIN
  ALTER TABLE dbo.Sucursal ADD CONSTRAINT FK_Sucursal_DireccionEmpresa
    FOREIGN KEY (idDireccionEmpresa) REFERENCES dbo.DireccionEmpresa(idDireccionEmpresa);
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Sucursal')
    AND name = 'UQ_Sucursal_idDireccionEmpresa' AND is_unique = 1
)
BEGIN
  CREATE UNIQUE INDEX UQ_Sucursal_idDireccionEmpresa ON dbo.Sucursal(idDireccionEmpresa)
    WHERE idDireccionEmpresa IS NOT NULL;
END
GO

-- 3) Comprobantes: sucursal dueña de la serie/correlativo
IF COL_LENGTH('dbo.Comprobantes', 'idSucursal') IS NULL
BEGIN
  ALTER TABLE dbo.Comprobantes ADD idSucursal UNIQUEIDENTIFIER NULL;
END
GO

-- Back-fill: sucursal principal por empresa (si existe esPrincipal), si no la sucursal más antigua
IF COL_LENGTH('dbo.Sucursal', 'esPrincipal') IS NOT NULL
BEGIN
  UPDATE c
  SET c.idSucursal = sp.idSucursal
  FROM dbo.Comprobantes c
  INNER JOIN (
    SELECT s.idEmpresa, s.idSucursal
    FROM dbo.Sucursal s
    WHERE ISNULL(s.esPrincipal, 0) = 1
  ) sp ON sp.idEmpresa = c.idEmpresa
  WHERE c.idSucursal IS NULL;
END

UPDATE c
SET c.idSucursal = (
  SELECT TOP 1 s2.idSucursal
  FROM dbo.Sucursal s2
  WHERE s2.idEmpresa = c.idEmpresa
  ORDER BY s2.fRegistro ASC
)
FROM dbo.Comprobantes c
WHERE c.idSucursal IS NULL;
GO

IF EXISTS (SELECT 1 FROM dbo.Comprobantes WHERE idSucursal IS NULL)
BEGIN
  RAISERROR('Migracion: quedaron Comprobantes sin idSucursal. Revise Sucursal por empresa.', 16, 1);
  RETURN;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = 'FK_Comprobantes_Sucursal' AND parent_object_id = OBJECT_ID('dbo.Comprobantes')
)
BEGIN
  ALTER TABLE dbo.Comprobantes ADD CONSTRAINT FK_Comprobantes_Sucursal
    FOREIGN KEY (idSucursal) REFERENCES dbo.Sucursal(idSucursal);
END
GO

ALTER TABLE dbo.Comprobantes ALTER COLUMN idSucursal UNIQUEIDENTIFIER NOT NULL;
GO

-- Quitar unicidad solo por empresa+codigo; nueva clave incluye sucursal
IF EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.Comprobantes') AND name = 'UQ_Comprobantes_EmpresaCodigo'
)
  ALTER TABLE dbo.Comprobantes DROP CONSTRAINT UQ_Comprobantes_EmpresaCodigo;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.Comprobantes') AND name = 'UQ_Comprobantes_EmpresaSucursalCodigo'
)
  ALTER TABLE dbo.Comprobantes ADD CONSTRAINT UQ_Comprobantes_EmpresaSucursalCodigo
    UNIQUE (idEmpresa, idSucursal, codigo);
GO

-- Sucursales no principales comparten series con la principal (hasta que el usuario cree series propias)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Sucursal') AND name = 'esPrincipal')
BEGIN
  UPDATE s
  SET s.idSucursalSeriesPadre = pr.idSucursal
  FROM dbo.Sucursal s
  INNER JOIN (
    SELECT s2.idEmpresa, s2.idSucursal
    FROM dbo.Sucursal s2
    WHERE ISNULL(s2.esPrincipal, 0) = 1
  ) pr ON pr.idEmpresa = s.idEmpresa
  WHERE ISNULL(s.esPrincipal, 0) = 0
    AND s.idSucursal <> pr.idSucursal
    AND s.idSucursalSeriesPadre IS NULL;
END
GO

-- Principal: enlace a dirección fiscal principal (codLocal para UBL)
UPDATE s
SET s.idDireccionEmpresa = de.idDireccionEmpresa
FROM dbo.Sucursal s
INNER JOIN dbo.DireccionEmpresa de ON de.idEmpresa = s.idEmpresa AND de.principal = 1
WHERE EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Sucursal') AND name = 'esPrincipal')
  AND ISNULL(s.esPrincipal, 0) = 1
  AND s.idDireccionEmpresa IS NULL;
GO

-- SP: correlativo por fila Comprobantes (PK idComprobante). La fila ya está en la sucursal efectiva.
IF OBJECT_ID('dbo.sp_ObtenerSiguienteCorrelativo', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_ObtenerSiguienteCorrelativo;
GO

CREATE PROCEDURE dbo.sp_ObtenerSiguienteCorrelativo
  @idEmpresa UNIQUEIDENTIFIER,
  @idComprobante INT,
  @serieOut VARCHAR(4) OUTPUT,
  @numeroOut VARCHAR(8) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @num INT;

  UPDATE c WITH (UPDLOCK, HOLDLOCK)
  SET c.numero = ISNULL(c.numero, 0) + 1
  FROM dbo.Comprobantes c
  WHERE c.idEmpresa = @idEmpresa AND c.idComprobante = @idComprobante;

  SELECT @num = c.numero, @serieOut = c.serie
  FROM dbo.Comprobantes c
  WHERE c.idEmpresa = @idEmpresa AND c.idComprobante = @idComprobante;

  IF @num IS NULL
  BEGIN
    DECLARE @msg NVARCHAR(300) = N'Comprobante no encontrado para idEmpresa=' + CAST(@idEmpresa AS NVARCHAR(36)) + N', idComprobante=' + CAST(@idComprobante AS NVARCHAR(10));
    RAISERROR(@msg, 16, 1);
    RETURN;
  END;

  SET @numeroOut = RIGHT('00000000' + CAST(@num AS VARCHAR(8)), 8);
END;
GO

PRINT 'Migracion 20260503_serie_comprobante_por_sucursal aplicada.';
GO
