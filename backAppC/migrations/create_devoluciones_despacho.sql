-- Crea tablas para devoluciones de despacho (cabecera y detalle)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DevolucionesDespacho')
BEGIN
  CREATE TABLE DevolucionesDespacho (
    idDevolucionDespacho UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idDespacho UNIQUEIDENTIFIER NOT NULL,
    idVenta INT NOT NULL,
    idUsuario UNIQUEIDENTIFIER NOT NULL,
    fechaDevolucion DATETIME NOT NULL DEFAULT GETDATE(),
    observaciones VARCHAR(500) NULL,
    CONSTRAINT PK_DevolucionesDespacho PRIMARY KEY (idDevolucionDespacho)
  );
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DevolucionesDespachoDetalle')
BEGIN
  CREATE TABLE DevolucionesDespachoDetalle (
    idDevolucionDetalle UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    idDevolucionDespacho UNIQUEIDENTIFIER NOT NULL,
    idDetalleDespacho UNIQUEIDENTIFIER NOT NULL,
    idDetalleVenta INT NOT NULL,
    idProducto UNIQUEIDENTIFIER NOT NULL,
    cantidadDevuelta DECIMAL(18,3) NOT NULL,
    notas VARCHAR(200) NULL,
    CONSTRAINT PK_DevolucionesDespachoDetalle PRIMARY KEY (idDevolucionDetalle)
  );
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DevolucionesDespacho_EmpresaDespacho')
BEGIN
  CREATE INDEX IX_DevolucionesDespacho_EmpresaDespacho
  ON DevolucionesDespacho(idEmpresa, idDespacho);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DevolucionesDespachoDetalle_Devolucion')
BEGIN
  CREATE INDEX IX_DevolucionesDespachoDetalle_Devolucion
  ON DevolucionesDespachoDetalle(idDevolucionDespacho);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DevolucionesDespachoDetalle_DetalleDespacho')
BEGIN
  CREATE INDEX IX_DevolucionesDespachoDetalle_DetalleDespacho
  ON DevolucionesDespachoDetalle(idDetalleDespacho);
END
