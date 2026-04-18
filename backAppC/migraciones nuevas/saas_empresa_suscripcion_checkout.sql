-- Suscripción por empresa (SaaS / Enterprise) y checkout público Culqi (orderNumber CHK-*)
-- Ejecutar en la misma base que Empresas.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EmpresaSuscripcion')
BEGIN
    CREATE TABLE dbo.EmpresaSuscripcion (
        idSuscripcion UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        planCode VARCHAR(30) NOT NULL,
        billingCycle VARCHAR(10) NULL,
        estado VARCHAR(30) NOT NULL,
        fechaInicio DATETIME NOT NULL DEFAULT GETDATE(),
        fechaFin DATETIME NULL,
        idCheckoutOrigen UNIQUEIDENTIFIER NULL,
        migracionDemoPendiente BIT NOT NULL DEFAULT 0,
        CONSTRAINT UQ_EmpresaSuscripcion_Empresa UNIQUE (idEmpresa),
        CONSTRAINT FK_EmpresaSuscripcion_Empresa FOREIGN KEY (idEmpresa) REFERENCES dbo.Empresas(idEmpresa) ON DELETE CASCADE
    );
    CREATE INDEX IX_EmpresaSuscripcion_EstadoFin ON dbo.EmpresaSuscripcion(estado, fechaFin);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SuscripcionCheckoutPendiente')
BEGIN
    CREATE TABLE dbo.SuscripcionCheckoutPendiente (
        idCheckout UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        orderNumber VARCHAR(120) NOT NULL,
        planCode VARCHAR(30) NOT NULL,
        billingCycle VARCHAR(10) NOT NULL,
        monto DECIMAL(18,2) NOT NULL,
        moneda VARCHAR(10) NOT NULL DEFAULT 'PEN',
        estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
        idEmpresaPrincipal UNIQUEIDENTIFIER NOT NULL,
        idEmpresaCliente UNIQUEIDENTIFIER NULL,
        emailContacto VARCHAR(200) NULL,
        idTransaccionPasarela VARCHAR(120) NULL,
        fCreacion DATETIME NOT NULL DEFAULT GETDATE(),
        fConfirmacion DATETIME NULL,
        CONSTRAINT UQ_SuscripcionCheckout_OrderNumber UNIQUE (orderNumber),
        CONSTRAINT FK_SuscripcionCheckout_Principal FOREIGN KEY (idEmpresaPrincipal) REFERENCES dbo.Empresas(idEmpresa),
        CONSTRAINT FK_SuscripcionCheckout_Cliente FOREIGN KEY (idEmpresaCliente) REFERENCES dbo.Empresas(idEmpresa)
    );
    CREATE INDEX IX_SuscripcionCheckout_Cliente ON dbo.SuscripcionCheckoutPendiente(idEmpresaCliente, estado);
    CREATE INDEX IX_SuscripcionCheckout_Estado ON dbo.SuscripcionCheckoutPendiente(estado, fCreacion);
END
GO

-- Empresas existentes: licencia enterprise (sin enforcement SaaS hasta activar modo)
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'EmpresaSuscripcion')
   AND EXISTS (SELECT * FROM sys.tables WHERE name = 'Empresas')
BEGIN
    INSERT INTO dbo.EmpresaSuscripcion (idSuscripcion, idEmpresa, planCode, billingCycle, estado, fechaInicio, fechaFin, idCheckoutOrigen, migracionDemoPendiente)
    SELECT NEWID(), e.idEmpresa, 'enterprise', NULL, 'ENTERPRISE', GETDATE(), NULL, NULL, 0
    FROM dbo.Empresas e
    WHERE NOT EXISTS (SELECT 1 FROM dbo.EmpresaSuscripcion s WHERE s.idEmpresa = e.idEmpresa);
END
GO
