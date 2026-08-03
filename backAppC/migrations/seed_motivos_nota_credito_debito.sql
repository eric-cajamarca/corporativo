-- ============================================================
-- Motivos SUNAT GLOBALES (todas las empresas usan las mismas tablas)
-- - MotivoNotaCredito  = Catálogo 09 (sin idEmpresa)
-- - MotivoNotaDebito   = Catálogo 10 (sin idEmpresa)
-- - Ventas.idMotivoNotaCredito / idMotivoNotaDebito + códigos
-- Idempotente: convierte tablas multiempresa previas a globales.
-- ============================================================

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
GO

-- ------------------------------------------------------------
-- 0) Quitar FKs de Ventas hacia motivos (para poder reconstruir catálogos)
-- ------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Ventas_MotivoNotaCredito')
  ALTER TABLE Ventas DROP CONSTRAINT FK_Ventas_MotivoNotaCredito;
GO
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Ventas_MotivoNotaDebito')
  ALTER TABLE Ventas DROP CONSTRAINT FK_Ventas_MotivoNotaDebito;
GO

IF COL_LENGTH('Ventas', 'idMotivoNotaCredito') IS NOT NULL
  UPDATE Ventas SET idMotivoNotaCredito = NULL WHERE idMotivoNotaCredito IS NOT NULL;
GO
IF COL_LENGTH('Ventas', 'idMotivoNotaDebito') IS NOT NULL
  UPDATE Ventas SET idMotivoNotaDebito = NULL WHERE idMotivoNotaDebito IS NOT NULL;
GO

-- ------------------------------------------------------------
-- 1) MotivoNotaCredito GLOBAL (Catálogo 09)
-- ------------------------------------------------------------
IF OBJECT_ID('MotivoNotaCredito', 'U') IS NULL
BEGIN
  CREATE TABLE MotivoNotaCredito (
    idMotivoNotaCredito UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    codigoSunat VARCHAR(2) NOT NULL,
    descripcion VARCHAR(150) NOT NULL,
    activo BIT NOT NULL CONSTRAINT DF_MotivoNotaCredito_activo DEFAULT (1),
    CONSTRAINT UQ_MotivoNotaCredito_codigoSunat UNIQUE (codigoSunat)
  );
END
ELSE
BEGIN
  -- Quitar vínculo multiempresa si existía
  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_MotivoNotaCredito_idEmpresa')
    ALTER TABLE MotivoNotaCredito DROP CONSTRAINT FK_MotivoNotaCredito_idEmpresa;

  IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_MotivoNotaCredito_EmpresaCodigo' AND object_id = OBJECT_ID('MotivoNotaCredito'))
    DROP INDEX UQ_MotivoNotaCredito_EmpresaCodigo ON MotivoNotaCredito;

  IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MotivoNotaCredito_idEmpresa' AND object_id = OBJECT_ID('MotivoNotaCredito'))
    DROP INDEX IX_MotivoNotaCredito_idEmpresa ON MotivoNotaCredito;

  IF COL_LENGTH('MotivoNotaCredito', 'idEmpresa') IS NOT NULL
  BEGIN
    DELETE FROM MotivoNotaCredito;
    ALTER TABLE MotivoNotaCredito DROP COLUMN idEmpresa;
  END

  IF COL_LENGTH('MotivoNotaCredito', 'activo') IS NULL
    ALTER TABLE MotivoNotaCredito ADD activo BIT NOT NULL CONSTRAINT DF_MotivoNotaCredito_activo DEFAULT (1);

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_MotivoNotaCredito_codigoSunat' AND object_id = OBJECT_ID('MotivoNotaCredito')
  )
  AND NOT EXISTS (
    SELECT 1 FROM sys.key_constraints
    WHERE name = 'UQ_MotivoNotaCredito_codigoSunat' AND parent_object_id = OBJECT_ID('MotivoNotaCredito')
  )
  BEGIN
    ALTER TABLE MotivoNotaCredito
      ADD CONSTRAINT UQ_MotivoNotaCredito_codigoSunat UNIQUE (codigoSunat);
  END
END
GO

;WITH Cat09 AS (
  SELECT * FROM (VALUES
    ('01', 'Anulación de la operación'),
    ('02', 'Anulación por error en el RUC'),
    ('03', 'Corrección por error en la descripción'),
    ('04', 'Descuento global'),
    ('05', 'Descuento por ítem'),
    ('06', 'Devolución total'),
    ('07', 'Devolución por ítem'),
    ('08', 'Bonificación'),
    ('09', 'Disminución en el valor'),
    ('10', 'Otros conceptos'),
    ('11', 'Ajustes de operaciones de exportación'),
    ('12', 'Ajustes afectos al IVAP'),
    ('13', 'Corrección monto neto pendiente / fechas o montos de cuotas')
  ) AS v(codigoSunat, descripcion)
)
MERGE MotivoNotaCredito AS t
USING Cat09 AS s
ON t.codigoSunat = s.codigoSunat
WHEN MATCHED AND (t.descripcion <> s.descripcion) THEN
  UPDATE SET descripcion = s.descripcion, activo = 1
WHEN NOT MATCHED BY TARGET THEN
  INSERT (codigoSunat, descripcion, activo)
  VALUES (s.codigoSunat, s.descripcion, 1);
GO

-- ------------------------------------------------------------
-- 2) MotivoNotaDebito GLOBAL (Catálogo 10)
-- ------------------------------------------------------------
IF OBJECT_ID('MotivoNotaDebito', 'U') IS NULL
BEGIN
  CREATE TABLE MotivoNotaDebito (
    idMotivoNotaDebito UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    codigoSunat VARCHAR(2) NOT NULL,
    descripcion VARCHAR(150) NOT NULL,
    activo BIT NOT NULL CONSTRAINT DF_MotivoNotaDebito_activo DEFAULT (1),
    CONSTRAINT UQ_MotivoNotaDebito_codigoSunat UNIQUE (codigoSunat)
  );
END
ELSE
BEGIN
  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_MotivoNotaDebito_idEmpresa')
    ALTER TABLE MotivoNotaDebito DROP CONSTRAINT FK_MotivoNotaDebito_idEmpresa;

  IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_MotivoNotaDebito_EmpresaCodigo' AND object_id = OBJECT_ID('MotivoNotaDebito'))
    DROP INDEX UQ_MotivoNotaDebito_EmpresaCodigo ON MotivoNotaDebito;

  IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MotivoNotaDebito_idEmpresa' AND object_id = OBJECT_ID('MotivoNotaDebito'))
    DROP INDEX IX_MotivoNotaDebito_idEmpresa ON MotivoNotaDebito;

  IF COL_LENGTH('MotivoNotaDebito', 'idEmpresa') IS NOT NULL
  BEGIN
    DELETE FROM MotivoNotaDebito;
    ALTER TABLE MotivoNotaDebito DROP COLUMN idEmpresa;
  END

  IF COL_LENGTH('MotivoNotaDebito', 'activo') IS NULL
    ALTER TABLE MotivoNotaDebito ADD activo BIT NOT NULL CONSTRAINT DF_MotivoNotaDebito_activo DEFAULT (1);

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_MotivoNotaDebito_codigoSunat' AND object_id = OBJECT_ID('MotivoNotaDebito')
  )
  AND NOT EXISTS (
    SELECT 1 FROM sys.key_constraints
    WHERE name = 'UQ_MotivoNotaDebito_codigoSunat' AND parent_object_id = OBJECT_ID('MotivoNotaDebito')
  )
  BEGIN
    ALTER TABLE MotivoNotaDebito
      ADD CONSTRAINT UQ_MotivoNotaDebito_codigoSunat UNIQUE (codigoSunat);
  END
END
GO

;WITH Cat10 AS (
  SELECT * FROM (VALUES
    ('01', 'Intereses por mora'),
    ('02', 'Aumento en el valor'),
    ('03', 'Penalidades / otros conceptos')
  ) AS v(codigoSunat, descripcion)
)
MERGE MotivoNotaDebito AS t
USING Cat10 AS s
ON t.codigoSunat = s.codigoSunat
WHEN MATCHED AND (t.descripcion <> s.descripcion) THEN
  UPDATE SET descripcion = s.descripcion, activo = 1
WHEN NOT MATCHED BY TARGET THEN
  INSERT (codigoSunat, descripcion, activo)
  VALUES (s.codigoSunat, s.descripcion, 1);
GO

-- ------------------------------------------------------------
-- 3) Columnas de vínculo en Ventas
-- ------------------------------------------------------------
IF COL_LENGTH('Ventas', 'codigoMotivoNotaDebito') IS NULL
  ALTER TABLE Ventas ADD codigoMotivoNotaDebito VARCHAR(2) NULL;
GO
IF COL_LENGTH('Ventas', 'idMotivoNotaCredito') IS NULL
  ALTER TABLE Ventas ADD idMotivoNotaCredito UNIQUEIDENTIFIER NULL;
GO
IF COL_LENGTH('Ventas', 'idMotivoNotaDebito') IS NULL
  ALTER TABLE Ventas ADD idMotivoNotaDebito UNIQUEIDENTIFIER NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Ventas_MotivoNotaCredito')
BEGIN
  ALTER TABLE Ventas WITH NOCHECK
    ADD CONSTRAINT FK_Ventas_MotivoNotaCredito
    FOREIGN KEY (idMotivoNotaCredito)
    REFERENCES MotivoNotaCredito(idMotivoNotaCredito);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Ventas_MotivoNotaDebito')
BEGIN
  ALTER TABLE Ventas WITH NOCHECK
    ADD CONSTRAINT FK_Ventas_MotivoNotaDebito
    FOREIGN KEY (idMotivoNotaDebito)
    REFERENCES MotivoNotaDebito(idMotivoNotaDebito);
END
GO

-- ------------------------------------------------------------
-- 4) Backfill por código SUNAT (catálogo global)
-- ------------------------------------------------------------
UPDATE v
SET v.idMotivoNotaCredito = m.idMotivoNotaCredito
FROM Ventas v
INNER JOIN MotivoNotaCredito m ON m.codigoSunat = v.codigoMotivoNotaCredito
WHERE v.codigoMotivoNotaCredito IS NOT NULL
  AND v.idMotivoNotaCredito IS NULL;
GO

UPDATE v
SET v.codigoMotivoNotaDebito = COALESCE(
  NULLIF(LTRIM(RTRIM(v.codigoMotivoNotaDebito)), ''),
  NULLIF(LTRIM(RTRIM(v.codigoMotivoNotaCredito)), ''),
  '01'
)
FROM Ventas v
INNER JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
WHERE UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) IN ('F8', 'B8', '08')
  AND v.codigoMotivoNotaDebito IS NULL;
GO

UPDATE v
SET v.idMotivoNotaDebito = m.idMotivoNotaDebito
FROM Ventas v
INNER JOIN MotivoNotaDebito m ON m.codigoSunat = v.codigoMotivoNotaDebito
INNER JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
WHERE v.idMotivoNotaDebito IS NULL
  AND v.codigoMotivoNotaDebito IS NOT NULL
  AND UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) IN ('F8', 'B8', '08');
GO

UPDATE v
SET v.idMotivoNotaCredito = NULL, v.codigoMotivoNotaCredito = NULL
FROM Ventas v
INNER JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
WHERE UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) IN ('F8', 'B8', '08');
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_Ventas_MotivoNC' AND object_id = OBJECT_ID('Ventas')
)
BEGIN
  CREATE INDEX IX_Ventas_MotivoNC ON Ventas(idMotivoNotaCredito)
    WHERE idMotivoNotaCredito IS NOT NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_Ventas_MotivoND' AND object_id = OBJECT_ID('Ventas')
)
BEGIN
  CREATE INDEX IX_Ventas_MotivoND ON Ventas(idMotivoNotaDebito)
    WHERE idMotivoNotaDebito IS NOT NULL;
END
GO

PRINT 'OK: MotivoNotaCredito y MotivoNotaDebito son catálogos globales.';
GO
