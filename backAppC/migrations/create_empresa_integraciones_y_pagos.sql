-- Tablas de soporte para verificación de empresas, integraciones por empresa,
-- billeteras digitales y pagos de suscripción SaaS.

-- ========== EmpresaVerificacion ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EmpresaVerificacion')
BEGIN
    CREATE TABLE EmpresaVerificacion (
        idVerificacion UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        telefono VARCHAR(20) NOT NULL,
        codigo VARCHAR(10) NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, VERIFICADO, EXPIRADO
        intentos INT NOT NULL DEFAULT 0,
        fCreacion DATETIME NOT NULL DEFAULT GETDATE(),
        fVerificacion DATETIME NULL,
        CONSTRAINT FK_EmpresaVerificacion_Empresas FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE
    );
    CREATE INDEX IX_EmpresaVerificacion_EmpresaEstado ON EmpresaVerificacion(idEmpresa, estado);
END
GO

-- ========== EmpresaIntegraciones ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EmpresaIntegraciones')
BEGIN
    CREATE TABLE EmpresaIntegraciones (
        idEmpresa UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        twilioHabilitado BIT NOT NULL DEFAULT 0,
        izipayHabilitado BIT NOT NULL DEFAULT 0,
        culqiHabilitado BIT NOT NULL DEFAULT 0,
        apisPeruHabilitado BIT NOT NULL DEFAULT 0,
        factilizaHabilitado BIT NOT NULL DEFAULT 0,
        fActualizacion DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_EmpresaIntegraciones_Empresas FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE
    );
END
GO

-- ========== EmpresaApiCredenciales ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EmpresaApiCredenciales')
BEGIN
    CREATE TABLE EmpresaApiCredenciales (
        idCredencial UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        proveedor VARCHAR(50) NOT NULL, -- 'twilio', 'izipay', 'culqi', 'apisperu', 'factiliza', etc.
        clave VARCHAR(100) NOT NULL,    -- ej. 'publicKey', 'secretKey', 'merchantId', 'accountSid'
        valor NVARCHAR(500) NOT NULL,
        descripcion VARCHAR(200) NULL,
        activo BIT NOT NULL DEFAULT 1,
        fCreacion DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_EmpresaApiCredenciales_Empresas FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE
    );
    CREATE INDEX IX_EmpresaApiCredenciales_EmpresaProveedor ON EmpresaApiCredenciales(idEmpresa, proveedor);
END
GO

-- ========== EmpresaBilleteras (configuración de billeteras digitales por empresa) ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EmpresaBilleteras')
BEGIN
    CREATE TABLE EmpresaBilleteras (
        idBilletera UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        nombre VARCHAR(50) NOT NULL,        -- 'YAPE', 'PLIN', etc.
        proveedorPasarela VARCHAR(50) NULL, -- 'izipay', 'culqi', otro
        activo BIT NOT NULL DEFAULT 1,
        fCreacion DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_EmpresaBilleteras_Empresas FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE
    );
    CREATE INDEX IX_EmpresaBilleteras_EmpresaNombre ON EmpresaBilleteras(idEmpresa, nombre);
END
GO

-- ========== PagosSuscripcionEmpresa ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PagosSuscripcionEmpresa')
BEGIN
    CREATE TABLE PagosSuscripcionEmpresa (
        idPago UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresaPrincipal UNIQUEIDENTIFIER NOT NULL, -- SaaS owner
        idEmpresaCliente UNIQUEIDENTIFIER NOT NULL,
        orderNumber VARCHAR(100) NOT NULL, -- patrón: idEmpresaCliente-UUID
        monto DECIMAL(18,2) NOT NULL,
        moneda VARCHAR(10) NOT NULL DEFAULT 'PEN',
        periodo VARCHAR(20) NOT NULL, -- ej. 'MENSUAL', 'ANUAL'
        origen VARCHAR(20) NOT NULL,  -- 'izipay', 'culqi'
        idTransaccionPasarela VARCHAR(100) NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, PAGADO, FALLIDO
        fCreacion DATETIME NOT NULL DEFAULT GETDATE(),
        fConfirmacion DATETIME NULL,
        CONSTRAINT FK_PagosSuscripcionEmpresa_Principal FOREIGN KEY (idEmpresaPrincipal) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_PagosSuscripcionEmpresa_Cliente FOREIGN KEY (idEmpresaCliente) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT UQ_PagosSuscripcionEmpresa_OrderNumber UNIQUE (orderNumber)
    );
    CREATE INDEX IX_PagosSuscripcionEmpresa_EmpresaEstado ON PagosSuscripcionEmpresa(idEmpresaCliente, estado);
END
GO

