-- Ventas corporativas: venta agrupada + venta por empresa
IF OBJECT_ID('dbo.VentaAgrupada', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.VentaAgrupada (
    idVentaAgrupada UNIQUEIDENTIFIER PRIMARY KEY NOT NULL DEFAULT NEWID(),
    idEmpresaCobradora UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NOT NULL,
    idCliente INT NULL,
    fEmision DATETIME NOT NULL DEFAULT GETDATE(),
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    igv DECIMAL(18,2) NOT NULL DEFAULT 0,
    descuentos DECIMAL(18,2) NOT NULL DEFAULT 0,
    total DECIMAL(18,2) NOT NULL DEFAULT 0,
    idEstadoPago INT NOT NULL DEFAULT 1,
    idUsuario UNIQUEIDENTIFIER NOT NULL,
    fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
    eliminado BIT NOT NULL DEFAULT 0,
    CONSTRAINT FK_VentaAgrupada_Empresas FOREIGN KEY (idEmpresaCobradora) REFERENCES Empresas(idEmpresa),
    CONSTRAINT FK_VentaAgrupada_Sucursal FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal)
  );
  CREATE INDEX IX_VentaAgrupada_EmpresaCobradora ON dbo.VentaAgrupada(idEmpresaCobradora);
  CREATE INDEX IX_VentaAgrupada_Fecha ON dbo.VentaAgrupada(fEmision);
END;
GO

IF OBJECT_ID('dbo.VentaEmpresa', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.VentaEmpresa (
    idVentaEmpresa UNIQUEIDENTIFIER PRIMARY KEY NOT NULL DEFAULT NEWID(),
    idVentaAgrupada UNIQUEIDENTIFIER NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idVenta INT NULL,
    idComprobante INT NOT NULL,
    serie VARCHAR(4) NOT NULL,
    numero VARCHAR(8) NOT NULL,
    compVenta VARCHAR(13) NOT NULL,
    fEmision DATETIME NOT NULL,
    fVencimiento DATETIME NOT NULL,
    idCliente INT NOT NULL,
    idMoneda INT NOT NULL,
    tCambio DECIMAL(10,4) NOT NULL DEFAULT 1,
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    igv DECIMAL(18,2) NOT NULL DEFAULT 0,
    exonerado DECIMAL(18,2) NOT NULL DEFAULT 0,
    gratuito DECIMAL(18,2) NOT NULL DEFAULT 0,
    otrosCargos DECIMAL(18,2) NOT NULL DEFAULT 0,
    descuentos DECIMAL(18,2) NOT NULL DEFAULT 0,
    total DECIMAL(18,2) NOT NULL DEFAULT 0,
    idMediosPago VARCHAR(20) NOT NULL,
    idEstadoPedido INT NOT NULL DEFAULT 1,
    idEstadoPago INT NOT NULL DEFAULT 1,
    idEstadoSunat INT NOT NULL DEFAULT 0,
    tipoComprobante VARCHAR(2) NOT NULL,
    compRelacionado VARCHAR(30) NULL,
    observaciones VARCHAR(500) NULL,
    idUsuario UNIQUEIDENTIFIER NOT NULL,
    fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
    eliminado BIT NOT NULL DEFAULT 0,
    CONSTRAINT FK_VentaEmpresa_VentaAgrupada FOREIGN KEY (idVentaAgrupada) REFERENCES VentaAgrupada(idVentaAgrupada),
    CONSTRAINT FK_VentaEmpresa_Empresas FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa)
  );
  CREATE INDEX IX_VentaEmpresa_Empresa ON dbo.VentaEmpresa(idEmpresa);
  CREATE INDEX IX_VentaEmpresa_VentaAgrupada ON dbo.VentaEmpresa(idVentaAgrupada);
END;
GO

IF OBJECT_ID('dbo.DetalleVentaEmpresa', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.DetalleVentaEmpresa (
    idDetalleVentaEmpresa INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
    idVentaEmpresa UNIQUEIDENTIFIER NOT NULL,
    idProducto UNIQUEIDENTIFIER NOT NULL,
    cantidad DECIMAL(18,3) NOT NULL,
    pVenta DECIMAL(18,5) NOT NULL,
    descuento DECIMAL(18,2) NULL DEFAULT 0,
    subtotal DECIMAL(18,2) NOT NULL,
    igv BIT NOT NULL DEFAULT 0,
    isc BIT NOT NULL DEFAULT 0,
    total DECIMAL(18,2) NOT NULL,
    cantEntregada DECIMAL(18,3) NOT NULL DEFAULT 0,
    idEstadoPedido INT NOT NULL DEFAULT 1,
    costoUnitario DECIMAL(18,6) NOT NULL DEFAULT 0,
    costoTotal DECIMAL(18,6) NOT NULL DEFAULT 0,
    CONSTRAINT FK_DetalleVentaEmpresa_VentaEmpresa FOREIGN KEY (idVentaEmpresa) REFERENCES VentaEmpresa(idVentaEmpresa)
  );
  CREATE INDEX IX_DetalleVentaEmpresa_VentaEmpresa ON dbo.DetalleVentaEmpresa(idVentaEmpresa);
END;
GO

