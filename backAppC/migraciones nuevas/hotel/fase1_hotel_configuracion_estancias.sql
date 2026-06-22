-- Fase 1 HOTEL: ConfiguracionHotel, Estancias, evolución Reservas y ConsumoHabitacion
-- Ejecutar una sola vez en la BD de la empresa hotelera.

-- ========== 1. ConfiguracionHotel ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ConfiguracionHotel')
BEGIN
    CREATE TABLE ConfiguracionHotel (
        idEmpresa UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        horaCheckIn TIME NOT NULL DEFAULT '14:00:00',
        horaCheckOut TIME NOT NULL DEFAULT '11:00:00',
        horaCorteDia TIME NOT NULL DEFAULT '11:00:00',
        minutosLimpieza INT NOT NULL DEFAULT 30,
        nochesMinimasWalkIn INT NOT NULL DEFAULT 1,
        permitirWalkInSinReserva BIT NOT NULL DEFAULT 1,
        fActualizacion DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_ConfiguracionHotel_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE
    );
END
GO

-- ========== 2. Estancias (huésped in-house) ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Estancias')
BEGIN
    CREATE TABLE Estancias (
        idEstancia UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idProductoHabitacion UNIQUEIDENTIFIER NOT NULL,
        idReserva UNIQUEIDENTIFIER NULL,
        idCliente INT NULL,
        nombreHuesped VARCHAR(200) NOT NULL,
        checkIn DATETIME NOT NULL,
        checkOutPrevisto DATETIME NOT NULL,
        checkOutReal DATETIME NULL,
        estadoEstancia VARCHAR(20) NOT NULL DEFAULT 'activa'
            CHECK (estadoEstancia IN ('activa','checkout','cancelada')),
        tarifaNoche DECIMAL(18,6) NOT NULL DEFAULT 0,
        totalHabitacion DECIMAL(18,2) NOT NULL DEFAULT 0,
        idVenta INT NULL,
        idUsuario UNIQUEIDENTIFIER NULL,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Estancias_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_Estancias_ProductoHabitacion FOREIGN KEY (idProductoHabitacion) REFERENCES Productos(idProducto),
        CONSTRAINT FK_Estancias_Cliente FOREIGN KEY (idCliente) REFERENCES Clientes(idCliente),
        CONSTRAINT FK_Estancias_Usuario FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario)
    );
    CREATE INDEX IX_Estancias_EmpresaHabitacionEstado ON Estancias(idEmpresa, idProductoHabitacion, estadoEstancia);
    CREATE INDEX IX_Estancias_EmpresaActiva ON Estancias(idEmpresa, estadoEstancia) WHERE estadoEstancia = 'activa';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Estancias_Reserva')
BEGIN
    ALTER TABLE Estancias ADD CONSTRAINT FK_Estancias_Reserva
        FOREIGN KEY (idReserva) REFERENCES Reservas(idReserva);
END
GO

-- ========== 3. Reservas: idEstancia + estados booking ==========
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Reservas')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Reservas' AND COLUMN_NAME = 'idEstancia')
        ALTER TABLE Reservas ADD idEstancia UNIQUEIDENTIFIER NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Reservas_Estancia')
        ALTER TABLE Reservas ADD CONSTRAINT FK_Reservas_Estancia
            FOREIGN KEY (idEstancia) REFERENCES Estancias(idEstancia);

    -- Migrar estados legacy
    UPDATE Reservas SET estado = 'confirmada' WHERE estado IN ('vigente', 'confirmada');
    UPDATE Reservas SET estado = 'cancelada' WHERE estado IN ('sin_efecto', 'cancelada', 'completada', 'en_curso');
    UPDATE Reservas SET estado = 'confirmada' WHERE estado NOT IN ('confirmada','cancelada','no_show','convertida');

    DECLARE @ckRes NVARCHAR(200);
    SELECT @ckRes = name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('Reservas') AND definition LIKE '%estado%';
    IF @ckRes IS NOT NULL EXEC('ALTER TABLE Reservas DROP CONSTRAINT ' + @ckRes);

    ALTER TABLE Reservas ADD CONSTRAINT CK_Reservas_Estado
        CHECK (estado IN ('confirmada','cancelada','no_show','convertida'));
END
GO

-- ========== 4. ConsumoHabitacion: idEstancia + estadoConsumo ==========
-- Nota: cada ALTER en batch separado (GO). SQL Server compila el batch entero y falla
-- si un UPDATE referencia una columna recién agregada en el mismo batch.

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ConsumoHabitacion')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ConsumoHabitacion' AND COLUMN_NAME = 'idEstancia')
        ALTER TABLE ConsumoHabitacion ADD idEstancia UNIQUEIDENTIFIER NULL;
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ConsumoHabitacion')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ConsumoHabitacion' AND COLUMN_NAME = 'estadoConsumo')
        ALTER TABLE ConsumoHabitacion ADD estadoConsumo VARCHAR(20) NOT NULL
            CONSTRAINT DF_ConsumoHabitacion_estadoConsumo DEFAULT 'pendiente';
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ConsumoHabitacion')
   AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Estancias')
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ConsumoHabitacion_Estancia')
BEGIN
    ALTER TABLE ConsumoHabitacion ADD CONSTRAINT FK_ConsumoHabitacion_Estancia
        FOREIGN KEY (idEstancia) REFERENCES Estancias(idEstancia);
END
GO
