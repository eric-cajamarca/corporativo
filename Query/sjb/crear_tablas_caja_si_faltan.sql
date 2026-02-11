-- Ejecute este script si obtiene "Invalid object name 'AperturasCaja'".
-- Crea las tablas de apertura/cierre/movimientos de caja si no existen.
-- Requiere: Cajas, Sucursal, Empresas, UsuarioWeb, TiposMovimientoCaja, MediosPago, Moneda.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID(N'dbo.AperturasCaja'))
BEGIN
    CREATE TABLE AperturasCaja (
        idApertura UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idCaja UNIQUEIDENTIFIER NOT NULL,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idSucursal UNIQUEIDENTIFIER NOT NULL,
        idUsuario UNIQUEIDENTIFIER NOT NULL,
        fechaApertura DATETIME NOT NULL DEFAULT GETDATE(),
        montoInicial DECIMAL(18,2) NOT NULL DEFAULT 0,
        observaciones VARCHAR(200),
        estado BIT NOT NULL DEFAULT 1,
        FOREIGN KEY (idCaja) REFERENCES Cajas(idCaja),
        FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
        FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario)
    );
    -- Índice único filtrado: solo una caja abierta por idCaja (estado = 1)
    CREATE UNIQUE NONCLUSTERED INDEX UQ_AperturasCaja_CajaAbierta
        ON AperturasCaja(idCaja, estado) WHERE estado = 1;
    PRINT 'Tabla AperturasCaja creada.';
END
ELSE
    PRINT 'Tabla AperturasCaja ya existe.';
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID(N'dbo.CierresCaja'))
BEGIN
    CREATE TABLE CierresCaja (
        idCierre UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idApertura UNIQUEIDENTIFIER NOT NULL,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idSucursal UNIQUEIDENTIFIER NOT NULL,
        idUsuarioCierre UNIQUEIDENTIFIER NOT NULL,
        fechaCierre DATETIME NOT NULL DEFAULT GETDATE(),
        montoFinal DECIMAL(18,2) NOT NULL,
        diferencia DECIMAL(18,2) NOT NULL DEFAULT 0,
        observaciones VARCHAR(200),
        estado BIT NOT NULL DEFAULT 1,
        FOREIGN KEY (idApertura) REFERENCES AperturasCaja(idApertura),
        FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
        FOREIGN KEY (idUsuarioCierre) REFERENCES UsuarioWeb(idUsuario)
    );
    PRINT 'Tabla CierresCaja creada.';
END
ELSE
    PRINT 'Tabla CierresCaja ya existe.';
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID(N'dbo.MovimientosCaja'))
BEGIN
    CREATE TABLE MovimientosCaja (
        idMovimientoCaja UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idApertura UNIQUEIDENTIFIER NOT NULL,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idSucursal UNIQUEIDENTIFIER NOT NULL,
        idUsuario UNIQUEIDENTIFIER NOT NULL,
        idTipoMovimientoCaja INT NOT NULL,
        fechaMovimiento DATETIME NOT NULL DEFAULT GETDATE(),
        concepto VARCHAR(100) NOT NULL,
        monto DECIMAL(18,2) NOT NULL,
        idMediosPago INT NULL,
        idMoneda INT NOT NULL,
        documentoRelacionado VARCHAR(20) NULL,
        observaciones VARCHAR(200),
        FOREIGN KEY (idApertura) REFERENCES AperturasCaja(idApertura),
        FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
        FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario),
        FOREIGN KEY (idTipoMovimientoCaja) REFERENCES TiposMovimientoCaja(idTipoMovimientoCaja),
        FOREIGN KEY (idMediosPago) REFERENCES MediosPago(idMediosPago),
        FOREIGN KEY (idMoneda) REFERENCES Moneda(idMoneda)
    );
    PRINT 'Tabla MovimientosCaja creada.';
END
ELSE
    PRINT 'Tabla MovimientosCaja ya existe.';
GO

-- Columna idVenta en MovimientosCaja (para vincular movimientos de venta al contado y reflejar cambios de desglose)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MovimientosCaja') AND name = 'idVenta')
BEGIN
    ALTER TABLE MovimientosCaja ADD idVenta INT NULL;
    ALTER TABLE MovimientosCaja ADD CONSTRAINT FK_MovimientosCaja_Ventas FOREIGN KEY (idVenta) REFERENCES Ventas(idVenta);
    PRINT 'Columna idVenta agregada a MovimientosCaja.';
END
GO

-- Tabla desglose de pagos por venta (ej: 80 soles = 40 efectivo + 40 yape; si se cambia a 50+30 se actualiza aquí)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID(N'dbo.DetallePagoVenta'))
BEGIN
    CREATE TABLE DetallePagoVenta (
        idDetallePagoVenta INT IDENTITY(1,1) PRIMARY KEY,
        idVenta INT NOT NULL,
        idMediosPago INT NOT NULL,
        monto DECIMAL(18,2) NOT NULL,
        CONSTRAINT FK_DetallePagoVenta_Ventas FOREIGN KEY (idVenta) REFERENCES Ventas(idVenta) ON DELETE CASCADE,
        CONSTRAINT FK_DetallePagoVenta_MediosPago FOREIGN KEY (idMediosPago) REFERENCES MediosPago(idMediosPago)
    );
    CREATE INDEX IX_DetallePagoVenta_idVenta ON DetallePagoVenta(idVenta);
    PRINT 'Tabla DetallePagoVenta creada.';
END
GO

-- Tipo de movimiento "Apertura de caja" para que el monto inicial aparezca en ingresos con detalle
IF NOT EXISTS (SELECT 1 FROM TiposMovimientoCaja WHERE nombre = 'APERTURA_CAJA')
BEGIN
    INSERT INTO TiposMovimientoCaja (nombre, descripcion, tipo) VALUES
    ('APERTURA_CAJA', 'Ingreso por apertura de caja', 'I');
    PRINT 'Tipo APERTURA_CAJA agregado.';
END
GO
