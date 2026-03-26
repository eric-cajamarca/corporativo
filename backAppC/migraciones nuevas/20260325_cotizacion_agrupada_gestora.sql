-- Cotizacion agrupada (empresa gestora): una cabecera en Cotizaciones; detalle con idProducto / empresa de catalogo por linea.

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.Cotizaciones') AND name = N'esCotizacionAgrupada'
)
BEGIN
  ALTER TABLE dbo.Cotizaciones ADD esCotizacionAgrupada BIT NOT NULL CONSTRAINT DF_Cotizaciones_esCotizacionAgrupada DEFAULT 0;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.DetalleCotizacion') AND name = N'idProducto'
)
BEGIN
  ALTER TABLE dbo.DetalleCotizacion ADD idProducto UNIQUEIDENTIFIER NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.DetalleCotizacion') AND name = N'idEmpresaProducto'
)
BEGIN
  ALTER TABLE dbo.DetalleCotizacion ADD idEmpresaProducto UNIQUEIDENTIFIER NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.DetalleCotizacion') AND name = N'aliasEmpresa'
)
BEGIN
  ALTER TABLE dbo.DetalleCotizacion ADD aliasEmpresa VARCHAR(10) NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_DetalleCotizacion_idEmpresaProducto_Empresas'
)
BEGIN
  ALTER TABLE dbo.DetalleCotizacion
    ADD CONSTRAINT FK_DetalleCotizacion_idEmpresaProducto_Empresas
    FOREIGN KEY (idEmpresaProducto) REFERENCES dbo.Empresas(idEmpresa);
END
GO