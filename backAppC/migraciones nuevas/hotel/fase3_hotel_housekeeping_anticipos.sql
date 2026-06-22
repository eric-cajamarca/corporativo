-- Fase 3 HOTEL: Housekeeping, anticipos, recargos early/late, trazabilidad venta-estancia
-- Ejecutar una sola vez en la BD de la empresa hotelera.

-- ========== 1. Housekeeping por habitación ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HotelHousekeeping')
BEGIN
    CREATE TABLE HotelHousekeeping (
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idProductoHabitacion UNIQUEIDENTIFIER NOT NULL,
        estadoLimpieza VARCHAR(20) NOT NULL
            CONSTRAINT DF_HotelHousekeeping_estado DEFAULT 'limpia',
        observaciones VARCHAR(500) NULL,
        fActualizacion DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_HotelHousekeeping PRIMARY KEY (idEmpresa, idProductoHabitacion),
        CONSTRAINT FK_HotelHousekeeping_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_HotelHousekeeping_Habitacion FOREIGN KEY (idProductoHabitacion) REFERENCES Productos(idProducto),
        CONSTRAINT CK_HotelHousekeeping_estado CHECK (estadoLimpieza IN ('sucia','en_limpieza','limpia','fuera_servicio'))
    );
    CREATE INDEX IX_HotelHousekeeping_EmpresaEstado ON HotelHousekeeping(idEmpresa, estadoLimpieza);
END
GO

-- ========== 2. Anticipos / señas ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HotelAnticipos')
BEGIN
    CREATE TABLE HotelAnticipos (
        idAnticipo UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idReserva UNIQUEIDENTIFIER NULL,
        idEstancia UNIQUEIDENTIFIER NULL,
        monto DECIMAL(18,2) NOT NULL,
        concepto VARCHAR(200) NULL,
        idVenta INT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        idUsuario UNIQUEIDENTIFIER NULL,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_HotelAnticipos_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_HotelAnticipos_Reserva FOREIGN KEY (idReserva) REFERENCES Reservas(idReserva),
        CONSTRAINT FK_HotelAnticipos_Estancia FOREIGN KEY (idEstancia) REFERENCES Estancias(idEstancia),
        CONSTRAINT CK_HotelAnticipos_estado CHECK (estado IN ('pendiente','aplicado','anulado')),
        CONSTRAINT CK_HotelAnticipos_monto CHECK (monto > 0)
    );
    CREATE INDEX IX_HotelAnticipos_EmpresaEstado ON HotelAnticipos(idEmpresa, estado);
    CREATE INDEX IX_HotelAnticipos_Reserva ON HotelAnticipos(idEmpresa, idReserva) WHERE idReserva IS NOT NULL;
    CREATE INDEX IX_HotelAnticipos_Estancia ON HotelAnticipos(idEmpresa, idEstancia) WHERE idEstancia IS NOT NULL;
END
GO

-- ========== 3. Recargos early/late en ConfiguracionHotel ==========
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ConfiguracionHotel')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ConfiguracionHotel' AND COLUMN_NAME = 'recargoEarlyCheckIn')
        ALTER TABLE ConfiguracionHotel ADD recargoEarlyCheckIn DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_ConfigHotel_recargoEarly DEFAULT 0;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ConfiguracionHotel' AND COLUMN_NAME = 'recargoLateCheckOut')
        ALTER TABLE ConfiguracionHotel ADD recargoLateCheckOut DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_ConfigHotel_recargoLate DEFAULT 0;
END
GO

-- ========== 4. Trazabilidad venta ↔ estancia ==========
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Ventas')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Ventas' AND COLUMN_NAME = 'idEstanciaHotel')
        ALTER TABLE Ventas ADD idEstanciaHotel UNIQUEIDENTIFIER NULL;
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Ventas')
   AND EXISTS (SELECT * FROM sys.tables WHERE name = 'Estancias')
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Ventas_EstanciaHotel')
BEGIN
    ALTER TABLE Ventas ADD CONSTRAINT FK_Ventas_EstanciaHotel
        FOREIGN KEY (idEstanciaHotel) REFERENCES Estancias(idEstancia);
END
GO

PRINT 'Fase 3 hotel: tablas y columnas aplicadas (idempotente).';
