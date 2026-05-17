IF COL_LENGTH('dbo.InventarioFisicoSesion', 'codigoUbicacionInventario') IS NULL
BEGIN
  ALTER TABLE dbo.InventarioFisicoSesion ADD codigoUbicacionInventario VARCHAR(20) NULL;
END
GO
