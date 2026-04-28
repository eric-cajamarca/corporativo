-- Sesiones de conteo físico (inicial / mensual) y líneas por producto.
-- Ejecutar en la base de datos de la aplicación.

IF OBJECT_ID('dbo.InventarioFisicoLinea', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.InventarioFisicoLinea (
    idLinea UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_InventarioFisicoLinea_id DEFAULT NEWID(),
    idSesion UNIQUEIDENTIFIER NOT NULL,
    idProducto UNIQUEIDENTIFIER NOT NULL,
    stockSistema DECIMAL(18, 3) NOT NULL CONSTRAINT DF_InventarioFisicoLinea_stockSistema DEFAULT (0),
    stockReal DECIMAL(18, 3) NULL,
    verificado BIT NOT NULL CONSTRAINT DF_InventarioFisicoLinea_verificado DEFAULT (0),
    notas NVARCHAR(500) NULL,
    fModificacion DATETIME2 NOT NULL CONSTRAINT DF_InventarioFisicoLinea_fMod DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_InventarioFisicoLinea PRIMARY KEY (idLinea),
    CONSTRAINT UQ_InventarioFisicoLinea_sesion_producto UNIQUE (idSesion, idProducto)
  );
END
GO

IF OBJECT_ID('dbo.InventarioFisicoSesion', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.InventarioFisicoSesion (
    idSesion UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_InventarioFisicoSesion_id DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NOT NULL,
    tipoConteo VARCHAR(20) NOT NULL,
    estado VARCHAR(20) NOT NULL CONSTRAINT DF_InventarioFisicoSesion_estado DEFAULT ('BORRADOR'),
    observaciones NVARCHAR(500) NULL,
    fCreacion DATETIME2 NOT NULL CONSTRAINT DF_InventarioFisicoSesion_fCreacion DEFAULT SYSUTCDATETIME(),
    idUsuarioCreacion UNIQUEIDENTIFIER NULL,
    CONSTRAINT PK_InventarioFisicoSesion PRIMARY KEY (idSesion)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_InventarioFisicoSesion_Empresa')
  ALTER TABLE dbo.InventarioFisicoSesion ADD CONSTRAINT FK_InventarioFisicoSesion_Empresa
    FOREIGN KEY (idEmpresa) REFERENCES dbo.Empresas(idEmpresa);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_InventarioFisicoSesion_Sucursal')
  ALTER TABLE dbo.InventarioFisicoSesion ADD CONSTRAINT FK_InventarioFisicoSesion_Sucursal
    FOREIGN KEY (idSucursal) REFERENCES dbo.Sucursal(idSucursal);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_InventarioFisicoLinea_Sesion')
  ALTER TABLE dbo.InventarioFisicoLinea ADD CONSTRAINT FK_InventarioFisicoLinea_Sesion
    FOREIGN KEY (idSesion) REFERENCES dbo.InventarioFisicoSesion(idSesion) ON DELETE CASCADE;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_InventarioFisicoLinea_Producto')
  ALTER TABLE dbo.InventarioFisicoLinea ADD CONSTRAINT FK_InventarioFisicoLinea_Producto
    FOREIGN KEY (idProducto) REFERENCES dbo.Productos(idProducto);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_InventarioFisicoSesion_EmpresaSucursalEstado')
  CREATE INDEX IX_InventarioFisicoSesion_EmpresaSucursalEstado
    ON dbo.InventarioFisicoSesion (idEmpresa, idSucursal, estado);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_InventarioFisicoLinea_Sesion')
  CREATE INDEX IX_InventarioFisicoLinea_Sesion ON dbo.InventarioFisicoLinea (idSesion);
GO
