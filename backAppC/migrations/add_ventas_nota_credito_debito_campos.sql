-- Campos para Notas de Crédito/Débito: documento de referencia y motivo (Catálogo 09 para NC).
-- tipoComprobanteRef: 01 Factura, 03 Boleta (origen de la NC/ND).
-- codigoMotivoNotaCredito: Catálogo 09 SUNAT (01-13), solo para NC (07).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Ventas') AND name = 'tipoComprobanteRef')
  ALTER TABLE Ventas ADD tipoComprobanteRef VARCHAR(2) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Ventas') AND name = 'codigoMotivoNotaCredito')
  ALTER TABLE Ventas ADD codigoMotivoNotaCredito VARCHAR(2) NULL;
GO
