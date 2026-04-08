-- Migración: Agregar estado "Baja Aceptada" (código 08) a EstadosSunat
-- Este estado se usa cuando una comunicación de baja es aceptada por SUNAT

IF NOT EXISTS (SELECT 1 FROM EstadosSunat WHERE codigo = '08')
BEGIN
  INSERT INTO EstadosSunat (codigo, descripcion)
  VALUES ('08', 'Baja Aceptada');
  PRINT 'Estado 08 (Baja Aceptada) agregado a EstadosSunat';
END
ELSE
BEGIN
  PRINT 'Estado 08 ya existe en EstadosSunat';
END
GO
