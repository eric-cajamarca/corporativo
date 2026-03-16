-- ============================================================
-- Ubicaciones por empresa/sucursal y jerarquía (Opción A)
-- 1) UNIQUE por (idSucursal, codigoUbicacion) en lugar de global
-- 2) idUbicacionPadre para jerarquía Piso -> Andamio
-- 3) Sucursal.esPrincipal para sucursal principal (dirección = dirección empresa)
-- ============================================================

-- ----- UbicacionesPrioridad: quitar UNIQUE global y poner por sucursal -----
DECLARE @ConstraintName NVARCHAR(200);
SELECT @ConstraintName = name
FROM sys.key_constraints
WHERE parent_object_id = OBJECT_ID('UbicacionesPrioridad') AND type = 'UQ';

IF @ConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE UbicacionesPrioridad DROP CONSTRAINT ' + @ConstraintName);
END
GO

-- UNIQUE por sucursal: mismo código permitido en sucursales distintas (cada empresa puede tener ANDAMIO1)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('UbicacionesPrioridad') AND name = 'UQ_UbicacionesPrioridad_SucursalCodigo')
BEGIN
    ALTER TABLE UbicacionesPrioridad ADD CONSTRAINT UQ_UbicacionesPrioridad_SucursalCodigo UNIQUE (idSucursal, codigoUbicacion);
END
GO

-- Jerarquía (Opción A): ubicaciones padre (ej. Piso 1) e hijas (ej. Andamio 1)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'UbicacionesPrioridad' AND COLUMN_NAME = 'idUbicacionPadre')
BEGIN
    ALTER TABLE UbicacionesPrioridad ADD idUbicacionPadre INT NULL;
    ALTER TABLE UbicacionesPrioridad ADD CONSTRAINT FK_UbicacionesPrioridad_Padre
        FOREIGN KEY (idUbicacionPadre) REFERENCES UbicacionesPrioridad(idUbicacion) ON DELETE NO ACTION;
END
GO

-- Índice para listados por sucursal y prioridad
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('UbicacionesPrioridad') AND name = 'IX_UbicacionesPrioridad_SucursalPrioridad')
BEGIN
    CREATE INDEX IX_UbicacionesPrioridad_SucursalPrioridad ON UbicacionesPrioridad(idSucursal, prioridad);
END
GO

-- ----- Sucursal: marcar sucursal principal (una por empresa) -----
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Sucursal' AND COLUMN_NAME = 'esPrincipal')
BEGIN
    ALTER TABLE Sucursal ADD esPrincipal BIT NOT NULL DEFAULT 0;
END
GO

-- Índice único filtrado: solo una sucursal principal por empresa
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Sucursal') AND name = 'IX_Sucursal_UnaPrincipalPorEmpresa')
BEGIN
    CREATE UNIQUE INDEX IX_Sucursal_UnaPrincipalPorEmpresa ON Sucursal(idEmpresa) WHERE esPrincipal = 1;
END
GO
