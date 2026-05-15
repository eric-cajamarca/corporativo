-- Conteo físico: ubicación de trabajo (reajustes aplican stock en esa ubicación con INVENTARIO_CONTROL_UBICACIONES activo).IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'InventarioFisicoSesion' AND COLUMN_NAME = 'idUbicacionInventario'
)
BEGIN
  ALTER TABLE dbo.InventarioFisicoSesion ADD idUbicacionInventario INT NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_InventarioFisicoSesion_UbicacionInventario'
)
BEGIN
  ALTER TABLE dbo.InventarioFisicoSesion
    ADD CONSTRAINT FK_InventarioFisicoSesion_UbicacionInventario
    FOREIGN KEY (idUbicacionInventario) REFERENCES dbo.UbicacionesPrioridad(idUbicacion);
END
GO



CREATE UNIQUE INDEX UX_Clientes_Empresa_RucNorm
ON Clientes (idEmpresa, ruc)
WHERE ruc IS NOT NULL AND ruc <> '';