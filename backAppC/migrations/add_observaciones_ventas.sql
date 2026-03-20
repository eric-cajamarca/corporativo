-- Agrega columna observaciones a Ventas para notas del comprobante (Factura/Boleta).
-- compRelacionado queda exclusivo para comprobantes relacionados (NC, ND, etc.).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Ventas') AND name = 'observaciones')
BEGIN
  ALTER TABLE Ventas ADD observaciones VARCHAR(500) NULL;
END
