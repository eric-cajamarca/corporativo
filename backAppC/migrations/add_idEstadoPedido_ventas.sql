-- Agregar columna idEstadoPedido a Ventas (estado global del pedido/entrega a nivel cabecera).
-- Si todos los ítems se entregan el mismo día, se puede marcar la venta como Entregado.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Ventas') AND name = 'idEstadoPedido'
)
BEGIN
  ALTER TABLE Ventas ADD idEstadoPedido INT NULL;
  ALTER TABLE Ventas
    ADD CONSTRAINT FK_Ventas_idEstadoPedido
    FOREIGN KEY (idEstadoPedido) REFERENCES EstadosPedidos(idEstadoPedido);
  CREATE INDEX IX_Ventas_idEstadoPedido ON Ventas(idEstadoPedido);
END
GO
