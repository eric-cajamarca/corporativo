-- Conversión de unidades de venta (ferretería / pintura).
-- El lote sigue en la unidad de compra (Presentación).
-- factorCompraAInterna: 1 envase de compra = N unidades internas (1 galón = 32).
-- factorAInterna en cada fila de venta: un 1/4 = 8 internos → resta 8/32 = 0.25 del lote.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ProductoUnidadConversion')
BEGIN
    CREATE TABLE dbo.ProductoUnidadConversion (
        idProducto UNIQUEIDENTIFIER NOT NULL,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        unidadInternaNombre VARCHAR(50) NOT NULL,
        factorCompraAInterna DECIMAL(18, 6) NOT NULL,
        activo BIT NOT NULL CONSTRAINT DF_ProductoUnidadConversion_activo DEFAULT (1),
        CONSTRAINT PK_ProductoUnidadConversion PRIMARY KEY (idProducto),
        CONSTRAINT FK_ProductoUnidadConversion_Producto FOREIGN KEY (idProducto) REFERENCES dbo.Productos (idProducto),
        CONSTRAINT FK_ProductoUnidadConversion_Empresa FOREIGN KEY (idEmpresa) REFERENCES dbo.Empresas (idEmpresa),
        CONSTRAINT CK_ProductoUnidadConversion_factor CHECK (factorCompraAInterna > 0)
    );
    CREATE INDEX IX_ProductoUnidadConversion_Empresa
        ON dbo.ProductoUnidadConversion (idEmpresa)
        INCLUDE (activo);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ProductoUnidadVenta')
BEGIN
    CREATE TABLE dbo.ProductoUnidadVenta (
        idUnidadVenta UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ProductoUnidadVenta_id DEFAULT (NEWID()),
        idProducto UNIQUEIDENTIFIER NOT NULL,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        nombre VARCHAR(50) NOT NULL,
        factorAInterna DECIMAL(18, 6) NOT NULL,
        precio DECIMAL(18, 6) NULL,
        visibleEnPos BIT NOT NULL CONSTRAINT DF_ProductoUnidadVenta_visible DEFAULT (1),
        orden INT NOT NULL CONSTRAINT DF_ProductoUnidadVenta_orden DEFAULT (0),
        CONSTRAINT PK_ProductoUnidadVenta PRIMARY KEY (idUnidadVenta),
        CONSTRAINT FK_ProductoUnidadVenta_Producto FOREIGN KEY (idProducto) REFERENCES dbo.Productos (idProducto),
        CONSTRAINT FK_ProductoUnidadVenta_Empresa FOREIGN KEY (idEmpresa) REFERENCES dbo.Empresas (idEmpresa),
        CONSTRAINT CK_ProductoUnidadVenta_factor CHECK (factorAInterna > 0)
    );
    CREATE INDEX IX_ProductoUnidadVenta_EmpresaProducto
        ON dbo.ProductoUnidadVenta (idEmpresa, idProducto);
END
GO
