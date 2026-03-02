-- Migración: Reservas usan producto habitación (catálogo); se elimina tabla Habitaciones.
-- Ejecutar después de create_habitaciones_reservas.sql si ya se ejecutó; si no, crear Reservas directo con idProductoHabitacion.

-- ========== 1. Si existe tabla Reservas con idHabitacion, migrar a idProductoHabitacion ==========
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Reservas')
   AND EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Reservas' AND COLUMN_NAME = 'idHabitacion')
BEGIN
    -- Quitar FK a Habitaciones
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Reservas_Habitacion')
        ALTER TABLE Reservas DROP CONSTRAINT FK_Reservas_Habitacion;

    -- Agregar columna nueva (nullable para migración)
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Reservas' AND COLUMN_NAME = 'idProductoHabitacion')
    BEGIN
        ALTER TABLE Reservas ADD idProductoHabitacion UNIQUEIDENTIFIER NULL;
    END

    -- Sin equivalencia Habitaciones -> Productos; filas existentes quedan con idProductoHabitacion NULL
    ALTER TABLE Reservas DROP COLUMN idHabitacion;

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Reservas_ProductoHabitacion')
        ALTER TABLE Reservas ADD CONSTRAINT FK_Reservas_ProductoHabitacion
            FOREIGN KEY (idProductoHabitacion) REFERENCES Productos(idProducto);
END
GO

-- ========== 2. Estado reserva: vigente | sin_efecto ==========
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Reservas')
BEGIN
    -- Quitar check antiguo si existe
    DECLARE @ck NVARCHAR(200);
    SELECT @ck = name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('Reservas') AND definition LIKE '%estado%';
    IF @ck IS NOT NULL EXEC('ALTER TABLE Reservas DROP CONSTRAINT ' + @ck);

    -- Mapear valores antiguos a vigente/sin_efecto
    UPDATE Reservas SET estado = 'vigente'  WHERE estado IN ('confirmada','en_curso');
    UPDATE Reservas SET estado = 'sin_efecto' WHERE estado IN ('cancelada','completada') OR estado NOT IN ('vigente','sin_efecto');

    ALTER TABLE Reservas ADD CONSTRAINT CK_Reservas_Estado CHECK (estado IN ('vigente','sin_efecto'));
END
GO

-- ========== 3. Eliminar tabla Habitaciones ==========
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Habitaciones')
    DROP TABLE Habitaciones;
GO

-- ========== 4. Si Reservas no existía, crearla con idProductoHabitacion (sin Habitaciones) ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Reservas')
BEGIN
    CREATE TABLE Reservas (
        idReserva UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idProductoHabitacion UNIQUEIDENTIFIER NOT NULL,
        idCliente INT NULL,
        codigo VARCHAR(30) NOT NULL,
        nombreHuesped VARCHAR(200) NOT NULL,
        fechaEntrada DATE NOT NULL,
        fechaSalida DATE NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente','sin_efecto')),
        total DECIMAL(18,2) NOT NULL DEFAULT 0,
        observaciones VARCHAR(500) NULL,
        idUsuario UNIQUEIDENTIFIER NULL,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Reservas_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_Reservas_ProductoHabitacion FOREIGN KEY (idProductoHabitacion) REFERENCES Productos(idProducto),
        CONSTRAINT FK_Reservas_Cliente FOREIGN KEY (idCliente) REFERENCES Clientes(idCliente),
        CONSTRAINT FK_Reservas_Usuario FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario)
    );
    CREATE INDEX IX_Reservas_EmpresaFecha ON Reservas(idEmpresa, fechaEntrada);
    CREATE INDEX IX_Reservas_ProductoHabitacion ON Reservas(idProductoHabitacion);
END
GO
