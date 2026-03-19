-- Vincular Envío con Despacho para obtener detalle desde DetalleDespachos
-- Opción A: idDespacho en Envios (sin crear EnviosDetalle)

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Envios') AND name = 'idDespacho'
)
BEGIN
  ALTER TABLE Envios
  ADD idDespacho UNIQUEIDENTIFIER NULL;

  ALTER TABLE Envios
  ADD CONSTRAINT FK_Envios_Despachos
  FOREIGN KEY (idDespacho) REFERENCES Despachos(idDespacho);

  CREATE INDEX IX_Envios_idDespacho ON Envios(idDespacho) WHERE idDespacho IS NOT NULL;
END
GO
