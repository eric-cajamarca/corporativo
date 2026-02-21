-- Migración: tablas para módulo Créditos (CreditosClientes, CuotasCredito, PagosCuotas).
-- Requiere: Empresas, Clientes, Ventas (opcional), UsuarioWeb, MediosPago. Ejecutar una sola vez.

-- CreditosClientes: créditos por cobrar asociados a ventas o manuales
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CreditosClientes')
BEGIN
    CREATE TABLE CreditosClientes (
        idCredito UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idCliente INT NOT NULL,
        idVenta INT NULL,
        idUsuarioCredito UNIQUEIDENTIFIER NOT NULL,
        fechaCredito DATETIME NOT NULL DEFAULT GETDATE(),
        montoTotal DECIMAL(18,2) NOT NULL,
        plazoDias INT NOT NULL,
        tasaInteres DECIMAL(5,2) NOT NULL DEFAULT 0,
        estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
        observaciones VARCHAR(500) NULL,
        CONSTRAINT FK_CreditosClientes_idEmpresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa),
        CONSTRAINT FK_CreditosClientes_idCliente FOREIGN KEY (idCliente) REFERENCES Clientes(idCliente),
        CONSTRAINT FK_CreditosClientes_idUsuarioCredito FOREIGN KEY (idUsuarioCredito) REFERENCES UsuarioWeb(idUsuario)
    );
    CREATE INDEX IX_CreditosClientes_idEmpresa ON CreditosClientes(idEmpresa);
    CREATE INDEX IX_CreditosClientes_idCliente ON CreditosClientes(idCliente);
    CREATE INDEX IX_CreditosClientes_idVenta ON CreditosClientes(idVenta);
END
GO

-- CuotasCredito: cuotas de cada crédito (PENDIENTE, PAGADO, VENCIDO)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CuotasCredito')
BEGIN
    CREATE TABLE CuotasCredito (
        idCuota UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idCredito UNIQUEIDENTIFIER NOT NULL,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        numeroCuota INT NOT NULL,
        fechaVencimiento DATE NOT NULL,
        montoCuota DECIMAL(18,2) NOT NULL,
        interes DECIMAL(18,2) NOT NULL DEFAULT 0,
        capital DECIMAL(18,2) NOT NULL,
        saldoPendiente DECIMAL(18,2) NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
        fechaPago DATETIME NULL,
        CONSTRAINT FK_CuotasCredito_idCredito FOREIGN KEY (idCredito) REFERENCES CreditosClientes(idCredito) ON DELETE CASCADE,
        CONSTRAINT FK_CuotasCredito_idEmpresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa)
    );
    CREATE INDEX IX_CuotasCredito_idCredito ON CuotasCredito(idCredito);
    CREATE INDEX IX_CuotasCredito_idEmpresa ON CuotasCredito(idEmpresa);
    CREATE INDEX IX_CuotasCredito_estado ON CuotasCredito(estado);
END
GO

-- PagosCuotas: registros de pago de cada cuota (cobranza)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PagosCuotas')
BEGIN
    CREATE TABLE PagosCuotas (
        idPagoCuota UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idCuota UNIQUEIDENTIFIER NOT NULL,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idUsuarioPago UNIQUEIDENTIFIER NOT NULL,
        fechaPago DATETIME NOT NULL DEFAULT GETDATE(),
        montoPagado DECIMAL(18,2) NOT NULL,
        idMediosPago INT NULL,
        idMoneda INT NULL DEFAULT 1,
        numeroRecibo VARCHAR(50) NULL,
        observaciones VARCHAR(500) NULL,
        CONSTRAINT FK_PagosCuotas_idCuota FOREIGN KEY (idCuota) REFERENCES CuotasCredito(idCuota),
        CONSTRAINT FK_PagosCuotas_idEmpresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa),
        CONSTRAINT FK_PagosCuotas_idUsuarioPago FOREIGN KEY (idUsuarioPago) REFERENCES UsuarioWeb(idUsuario)
    );
    CREATE INDEX IX_PagosCuotas_idCuota ON PagosCuotas(idCuota);
    CREATE INDEX IX_PagosCuotas_idEmpresa ON PagosCuotas(idEmpresa);
END
GO
