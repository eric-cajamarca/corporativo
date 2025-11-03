--PROCEDIMIENTOS ALMACENADOS PARA VENTAS

--sp_DescontarStock – lo llamas antes de insertar DetalleVenta.

CREATE OR ALTER PROC dbo.sp_DescontarStock
    @idEmpresa  UNIQUEIDENTIFIER,
    @idSucursal UNIQUEIDENTIFIER,
    @idProducto UNIQUEIDENTIFIER,
    @cantidad   DECIMAL(18,2)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.StockSucursal
    SET    cantidad = cantidad - @cantidad
    OUTPUT DELETED.cantidad AS stockAntes, INSERTED.cantidad AS stockDespues
    WHERE  idEmpresa  = @idEmpresa
      AND  idSucursal = @idSucursal
      AND  idProducto = @idProducto
      AND  cantidad  >= @cantidad;          -- evita negativos

    IF @@ROWCOUNT = 0
        THROW 51000, 'Stock insuficiente o producto no existe', 1;
END
GO

--sp_RestaurarStock – lo llamas cuando anules la venta.
CREATE OR ALTER PROC dbo.sp_RestaurarStock
    @idEmpresa  UNIQUEIDENTIFIER,
    @idSucursal UNIQUEIDENTIFIER,
    @idProducto UNIQUEIDENTIFIER,
    @cantidad   DECIMAL(18,2)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.StockSucursal
    SET    cantidad = cantidad + @cantidad
    OUTPUT DELETED.cantidad AS stockAntes, INSERTED.cantidad AS stockDespues
    WHERE  idEmpresa  = @idEmpresa
      AND  idSucursal = @idSucursal
      AND  idProducto = @idProducto;

    IF @@ROWCOUNT = 0  -- si no existe el registro, lo creas (opcional)
    BEGIN
        INSERT dbo.StockSucursal(idEmpresa, idSucursal, idProducto, cantidad, idUsuario)
        VALUES (@idEmpresa, @idSucursal, @idProducto, @cantidad, @idUsuario);  -- envía también el idUsuario
    END
END
GO
