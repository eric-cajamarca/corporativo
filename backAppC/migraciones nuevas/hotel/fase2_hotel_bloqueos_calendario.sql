-- Fase 2 HOTEL: bloqueos de habitación (mantenimiento, fuera de servicio)
-- Ejecutar una sola vez en la BD de la empresa hotelera.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HotelBloqueoHabitacion')
BEGIN
    CREATE TABLE HotelBloqueoHabitacion (
        idBloqueo UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idProductoHabitacion UNIQUEIDENTIFIER NOT NULL,
        fechaDesde DATETIME NOT NULL,
        fechaHasta DATETIME NOT NULL,
        motivo VARCHAR(30) NOT NULL DEFAULT 'mantenimiento'
            CHECK (motivo IN ('mantenimiento','admin','housekeeping')),
        observaciones VARCHAR(500) NULL,
        idUsuario UNIQUEIDENTIFIER NULL,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_HotelBloqueo_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_HotelBloqueo_Producto FOREIGN KEY (idProductoHabitacion) REFERENCES Productos(idProducto),
        CONSTRAINT FK_HotelBloqueo_Usuario FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario),
        CONSTRAINT CK_HotelBloqueo_Rango CHECK (fechaHasta > fechaDesde)
    );

    CREATE INDEX IX_HotelBloqueo_EmpresaHabitacion ON HotelBloqueoHabitacion(idEmpresa, idProductoHabitacion, fechaDesde, fechaHasta);
END
GO
