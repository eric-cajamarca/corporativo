-- Migración: Habitaciones y Reservas para rubro HOTEL
-- Ejecutar una sola vez. Requiere: Empresas, Clientes, UsuarioWeb (opcional para idUsuario).

-- ========== 1. Habitaciones (por empresa) ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Habitaciones')
BEGIN
    CREATE TABLE Habitaciones (
        idHabitacion UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        numero VARCHAR(20) NOT NULL,
        tipo VARCHAR(80) NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'disponible'
            CHECK (estado IN ('disponible','ocupada','mantenimiento','reservada')),
        activo BIT NOT NULL DEFAULT 1,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Habitaciones_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT UQ_Habitaciones_EmpresaNumero UNIQUE (idEmpresa, numero)
    );
    CREATE INDEX IX_Habitaciones_EmpresaEstado ON Habitaciones(idEmpresa, estado);
END
GO

-- ========== 2. Reservas (por empresa, vinculada a habitación) ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Reservas')
BEGIN
    CREATE TABLE Reservas (
        idReserva UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idHabitacion UNIQUEIDENTIFIER NOT NULL,
        idCliente INT NULL,
        codigo VARCHAR(30) NOT NULL,
        nombreHuesped VARCHAR(200) NOT NULL,
        fechaEntrada DATE NOT NULL,
        fechaSalida DATE NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'confirmada'
            CHECK (estado IN ('confirmada','en_curso','cancelada','completada')),
        total DECIMAL(18,2) NOT NULL DEFAULT 0,
        observaciones VARCHAR(500) NULL,
        idUsuario UNIQUEIDENTIFIER NULL,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Reservas_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_Reservas_Habitacion FOREIGN KEY (idHabitacion) REFERENCES Habitaciones(idHabitacion),
        CONSTRAINT FK_Reservas_Cliente FOREIGN KEY (idCliente) REFERENCES Clientes(idCliente),
        CONSTRAINT FK_Reservas_Usuario FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario)
    );
    CREATE INDEX IX_Reservas_EmpresaFecha ON Reservas(idEmpresa, fechaEntrada);
    CREATE INDEX IX_Reservas_Habitacion ON Reservas(idHabitacion);
END
GO
