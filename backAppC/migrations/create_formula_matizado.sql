-- Fórmulas de matizado (el matizador las guarda al usarlas).
-- gramosPorGalon: receta por 1 envase de compra de la base (1 galón).
-- En la venta se escala por la cantidad descontada de la base (0.25 = un 1/4).

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'FormulaMatizado')
BEGIN
    CREATE TABLE dbo.FormulaMatizado (
        idFormula UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_FormulaMatizado_id DEFAULT (NEWID()),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        nombre VARCHAR(80) NOT NULL,
        marcaVehiculo VARCHAR(50) NULL,
        modeloVehiculo VARCHAR(50) NULL,
        placa VARCHAR(15) NULL,
        idProductoBase UNIQUEIDENTIFIER NULL,
        notas VARCHAR(200) NULL,
        idUsuario UNIQUEIDENTIFIER NULL,
        fCreacion DATETIME NOT NULL CONSTRAINT DF_FormulaMatizado_fCreacion DEFAULT (GETDATE()),
        estado BIT NOT NULL CONSTRAINT DF_FormulaMatizado_estado DEFAULT (1),
        CONSTRAINT PK_FormulaMatizado PRIMARY KEY (idFormula),
        CONSTRAINT FK_FormulaMatizado_Empresa FOREIGN KEY (idEmpresa) REFERENCES dbo.Empresas (idEmpresa),
        CONSTRAINT FK_FormulaMatizado_Producto FOREIGN KEY (idProductoBase) REFERENCES dbo.Productos (idProducto)
    );
    CREATE INDEX IX_FormulaMatizado_EmpresaNombre
        ON dbo.FormulaMatizado (idEmpresa, nombre)
        WHERE estado = 1;
    CREATE INDEX IX_FormulaMatizado_EmpresaPlaca
        ON dbo.FormulaMatizado (idEmpresa, placa)
        WHERE estado = 1 AND placa IS NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'FormulaMatizadoDetalle')
BEGIN
    CREATE TABLE dbo.FormulaMatizadoDetalle (
        idDetalle INT IDENTITY(1, 1) NOT NULL,
        idFormula UNIQUEIDENTIFIER NOT NULL,
        idProductoTinte UNIQUEIDENTIFIER NOT NULL,
        gramosPorGalon DECIMAL(18, 6) NOT NULL,
        CONSTRAINT PK_FormulaMatizadoDetalle PRIMARY KEY (idDetalle),
        CONSTRAINT FK_FormulaMatizadoDetalle_Formula FOREIGN KEY (idFormula)
            REFERENCES dbo.FormulaMatizado (idFormula),
        CONSTRAINT FK_FormulaMatizadoDetalle_Tinte FOREIGN KEY (idProductoTinte)
            REFERENCES dbo.Productos (idProducto),
        CONSTRAINT CK_FormulaMatizadoDetalle_gramos CHECK (gramosPorGalon > 0)
    );
    CREATE INDEX IX_FormulaMatizadoDetalle_Formula
        ON dbo.FormulaMatizadoDetalle (idFormula);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'VentaMatizado')
BEGIN
    CREATE TABLE dbo.VentaMatizado (
        idVentaMatizado UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_VentaMatizado_id DEFAULT (NEWID()),
        idVenta INT NOT NULL,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idProductoBase UNIQUEIDENTIFIER NOT NULL,
        nombreColor VARCHAR(80) NULL,
        marcaVehiculo VARCHAR(50) NULL,
        placa VARCHAR(15) NULL,
        factorEscala DECIMAL(18, 6) NOT NULL,
        idFormula UNIQUEIDENTIFIER NULL,
        cargoMatizado DECIMAL(18, 6) NULL,
        CONSTRAINT PK_VentaMatizado PRIMARY KEY (idVentaMatizado),
        CONSTRAINT FK_VentaMatizado_Empresa FOREIGN KEY (idEmpresa) REFERENCES dbo.Empresas (idEmpresa)
    );
    CREATE INDEX IX_VentaMatizado_Venta ON dbo.VentaMatizado (idVenta, idEmpresa);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'VentaMatizadoTinte')
BEGIN
    CREATE TABLE dbo.VentaMatizadoTinte (
        idVentaMatizadoTinte INT IDENTITY(1, 1) NOT NULL,
        idVentaMatizado UNIQUEIDENTIFIER NOT NULL,
        idProductoTinte UNIQUEIDENTIFIER NOT NULL,
        gramos DECIMAL(18, 6) NOT NULL,
        cantidadStock DECIMAL(18, 6) NOT NULL,
        CONSTRAINT PK_VentaMatizadoTinte PRIMARY KEY (idVentaMatizadoTinte),
        CONSTRAINT FK_VentaMatizadoTinte_Cab FOREIGN KEY (idVentaMatizado)
            REFERENCES dbo.VentaMatizado (idVentaMatizado)
    );
    CREATE INDEX IX_VentaMatizadoTinte_Cab ON dbo.VentaMatizadoTinte (idVentaMatizado);
END
GO
