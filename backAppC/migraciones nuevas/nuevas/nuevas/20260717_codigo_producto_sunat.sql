-- Código producto SUNAT (Catálogo 25 anexos 25.1 / 25.2 / 25.3)
-- Ejecutar una sola vez. Seed de filas: node scripts/seed-catalogo-producto-sunat.js

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CatProductoSunatAnexo')
BEGIN
    CREATE TABLE CatProductoSunatAnexo (
        codigo CHAR(8) NOT NULL,
        anexo VARCHAR(5) NOT NULL,
        descripcion VARCHAR(500) NOT NULL,
        partidaArancelaria VARCHAR(300) NULL,
        activo BIT NOT NULL CONSTRAINT DF_CatProductoSunatAnexo_activo DEFAULT (1),
        CONSTRAINT PK_CatProductoSunatAnexo PRIMARY KEY (codigo, anexo),
        CONSTRAINT CK_CatProductoSunatAnexo_anexo CHECK (anexo IN ('25.1', '25.2', '25.3')),
        CONSTRAINT CK_CatProductoSunatAnexo_codigo CHECK (codigo LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]')
    );
    CREATE INDEX IX_CatProductoSunatAnexo_anexo ON CatProductoSunatAnexo(anexo) WHERE activo = 1;
    CREATE INDEX IX_CatProductoSunatAnexo_descripcion ON CatProductoSunatAnexo(descripcion);
END
GO

IF COL_LENGTH('Productos', 'codigoProductoSunat') IS NULL
BEGIN
    ALTER TABLE Productos ADD codigoProductoSunat VARCHAR(8) NULL;
END
GO

IF COL_LENGTH('Productos', 'requiereCodigoSunat') IS NULL
BEGIN
    ALTER TABLE Productos ADD requiereCodigoSunat BIT NULL;
END
GO

IF COL_LENGTH('Productos', 'revisadoSunat') IS NULL
BEGIN
    ALTER TABLE Productos ADD revisadoSunat BIT NOT NULL CONSTRAINT DF_Productos_revisadoSunat DEFAULT (0);
END
GO

IF COL_LENGTH('Productos', 'anexoSunatSugerido') IS NULL
BEGIN
    ALTER TABLE Productos ADD anexoSunatSugerido VARCHAR(5) NULL;
END
GO

IF COL_LENGTH('Productos', 'codigoSunatSugerido') IS NULL
BEGIN
    ALTER TABLE Productos ADD codigoSunatSugerido VARCHAR(8) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_Productos_Empresa_CodigoProductoSunat'
      AND object_id = OBJECT_ID('Productos')
)
BEGIN
    CREATE INDEX IX_Productos_Empresa_CodigoProductoSunat
        ON Productos(idEmpresa, codigoProductoSunat)
        WHERE codigoProductoSunat IS NOT NULL;
END
GO
