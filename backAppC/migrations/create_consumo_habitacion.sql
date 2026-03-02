-- Consumo registrado por habitación (producto ZZ), sin generar venta aún.
-- Permite agregar productos consumidos a una habitación y luego generar la venta.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ConsumoHabitacion')
BEGIN
    CREATE TABLE ConsumoHabitacion (
        idConsumo UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idProductoHabitacion UNIQUEIDENTIFIER NOT NULL,
        idProducto UNIQUEIDENTIFIER NOT NULL,
        cantidad DECIMAL(18,3) NOT NULL,
        pUnitario DECIMAL(18,6) NOT NULL DEFAULT 0,
        idUsuario UNIQUEIDENTIFIER NULL,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_ConsumoHabitacion_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_ConsumoHabitacion_ProductoHabitacion FOREIGN KEY (idProductoHabitacion) REFERENCES Productos(idProducto),
        CONSTRAINT FK_ConsumoHabitacion_Producto FOREIGN KEY (idProducto) REFERENCES Productos(idProducto),
        CONSTRAINT FK_ConsumoHabitacion_Usuario FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario)
    );
    CREATE INDEX IX_ConsumoHabitacion_EmpresaHabitacion ON ConsumoHabitacion(idEmpresa, idProductoHabitacion);
END
GO
