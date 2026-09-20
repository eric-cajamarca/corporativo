-- Fase 5 HOTEL: reservas de grupo y factura única de hospedaje (también adelantada).
-- El consumo sigue en cada habitación. La salida operativa no espera la factura de la empresa.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HotelGrupos')
BEGIN
    CREATE TABLE HotelGrupos (
        idGrupo UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idCliente INT NULL,
        codigo VARCHAR(30) NOT NULL,
        nombre VARCHAR(200) NOT NULL,
        fechaEntrada DATE NOT NULL,
        fechaSalida DATE NOT NULL,
        hospedajeFacturado BIT NOT NULL CONSTRAINT DF_HotelGrupos_hospedajeFacturado DEFAULT 0,
        idVentaHospedaje INT NULL,
        estado VARCHAR(20) NOT NULL CONSTRAINT DF_HotelGrupos_estado DEFAULT 'activo',
        observaciones VARCHAR(500) NULL,
        idUsuario UNIQUEIDENTIFIER NULL,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_HotelGrupos_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_HotelGrupos_Cliente FOREIGN KEY (idCliente) REFERENCES Clientes(idCliente),
        CONSTRAINT CK_HotelGrupos_estado CHECK (estado IN ('activo','cerrado','cancelado')),
        CONSTRAINT UQ_HotelGrupos_EmpresaCodigo UNIQUE (idEmpresa, codigo)
    );
    CREATE INDEX IX_HotelGrupos_EmpresaEstado ON HotelGrupos(idEmpresa, estado);
    CREATE INDEX IX_HotelGrupos_EmpresaFechas ON HotelGrupos(idEmpresa, fechaEntrada, fechaSalida);
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Reservas')
BEGIN
    IF COL_LENGTH('dbo.Reservas', 'idGrupo') IS NULL
        ALTER TABLE Reservas ADD idGrupo UNIQUEIDENTIFIER NULL;

    IF COL_LENGTH('dbo.Reservas', 'habitacionFacturada') IS NULL
        ALTER TABLE Reservas ADD habitacionFacturada BIT NOT NULL CONSTRAINT DF_Reservas_habitacionFacturada DEFAULT 0;

    IF COL_LENGTH('dbo.Reservas', 'idVentaHabitacion') IS NULL
        ALTER TABLE Reservas ADD idVentaHabitacion INT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Reservas_Grupo')
        ALTER TABLE Reservas ADD CONSTRAINT FK_Reservas_Grupo
            FOREIGN KEY (idGrupo) REFERENCES HotelGrupos(idGrupo);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Reservas_EmpresaGrupo' AND object_id = OBJECT_ID('Reservas'))
        CREATE INDEX IX_Reservas_EmpresaGrupo ON Reservas(idEmpresa, idGrupo);
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Estancias')
BEGIN
    IF COL_LENGTH('dbo.Estancias', 'idGrupo') IS NULL
        ALTER TABLE Estancias ADD idGrupo UNIQUEIDENTIFIER NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Estancias_Grupo')
        ALTER TABLE Estancias ADD CONSTRAINT FK_Estancias_Grupo
            FOREIGN KEY (idGrupo) REFERENCES HotelGrupos(idGrupo);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Estancias_EmpresaGrupo' AND object_id = OBJECT_ID('Estancias'))
        CREATE INDEX IX_Estancias_EmpresaGrupo ON Estancias(idEmpresa, idGrupo);
END
GO
