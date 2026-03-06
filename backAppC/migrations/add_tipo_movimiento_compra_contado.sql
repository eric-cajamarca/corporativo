-- Tipo de movimiento para compras al contado (egreso en caja / arqueo)
IF NOT EXISTS (SELECT 1 FROM TiposMovimientoCaja WHERE nombre = 'COMPRA_CONTADO')
BEGIN
    INSERT INTO TiposMovimientoCaja (nombre, descripcion, tipo) VALUES
    ('COMPRA_CONTADO', 'Egreso por compra de mercadería al contado', 'E');
END
GO
