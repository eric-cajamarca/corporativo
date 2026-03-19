-- Agregar estado de envío: NO_ENCONTRADO
-- Recomendado ejecutar después de crear tablas EstadosEnvio.
IF NOT EXISTS (
  SELECT 1 FROM EstadosEnvio WHERE nombre = 'NO_ENCONTRADO'
)
BEGIN
  INSERT INTO EstadosEnvio (nombre, descripcion, color, orden)
  VALUES ('NO_ENCONTRADO', 'No se encontró la mercadería', '#808080', 7);
END
GO

