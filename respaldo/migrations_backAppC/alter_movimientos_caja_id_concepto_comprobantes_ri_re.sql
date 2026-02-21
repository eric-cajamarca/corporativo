-- 1. Agregar idConcepto a MovimientosCaja (FK a Concepto)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('MovimientosCaja') AND name = 'idConcepto'
)
BEGIN
  ALTER TABLE MovimientosCaja ADD idConcepto UNIQUEIDENTIFIER NULL;
  ALTER TABLE MovimientosCaja
    ADD CONSTRAINT FK_MovimientosCaja_idConcepto
    FOREIGN KEY (idConcepto) REFERENCES Concepto(idConcepto);
END
GO

-- 2. Insertar comprobantes RI (Recibo de Ingreso) y RE (Recibo de Egreso) por cada empresa existente
-- Comprobantes: idComprobante INT IDENTITY, idEmpresa, codigo VARCHAR(2), nombre, serie VARCHAR(4), numero INT, activo, usarEnVenta, usarEnCompra
INSERT INTO Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra)
SELECT e.idEmpresa, 'RI', 'Recibo de Ingreso', '0001', 0, 1, 0, 0
FROM Empresas e
WHERE NOT EXISTS (SELECT 1 FROM Comprobantes c WHERE c.idEmpresa = e.idEmpresa AND c.codigo = 'RI');
GO

INSERT INTO Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra)
SELECT e.idEmpresa, 'RE', 'Recibo de Egreso', '0001', 0, 1, 0, 0
FROM Empresas e
WHERE NOT EXISTS (SELECT 1 FROM Comprobantes c WHERE c.idEmpresa = e.idEmpresa AND c.codigo = 'RE');
GO
