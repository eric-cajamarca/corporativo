-- Tanques por producto combustible (grifo). Un producto del catálogo con categoría Combustibles puede tener un tanque.
-- No duplica productos: idProducto referencia Productos(idProducto).

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Tanques')
BEGIN
    CREATE TABLE Tanques (
        idTanque UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idProducto UNIQUEIDENTIFIER NOT NULL,
        idSucursal UNIQUEIDENTIFIER NULL,
        capacidad DECIMAL(18,3) NOT NULL DEFAULT 0,
        cantidadActual DECIMAL(18,3) NOT NULL DEFAULT 0,
        unidad VARCHAR(10) NOT NULL DEFAULT 'GL',
        fRegistro DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_Tanques_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_Tanques_Producto FOREIGN KEY (idProducto) REFERENCES Productos(idProducto),
        CONSTRAINT FK_Tanques_Sucursal FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal)
    );
    CREATE UNIQUE INDEX UQ_Tanques_EmpresaProductoSucursal ON Tanques(idEmpresa, idProducto, idSucursal);
    CREATE INDEX IX_Tanques_Empresa ON Tanques(idEmpresa);
END
GO
