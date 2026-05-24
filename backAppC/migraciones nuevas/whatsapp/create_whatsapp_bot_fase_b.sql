-- Fase B: configuracion, catalogo indice, sinonimos, conversacion

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WhatsAppBotConfig')
BEGIN
    CREATE TABLE WhatsAppBotConfig (
        idEmpresa UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        activoBot BIT NOT NULL DEFAULT 1,
        idListaPrecio UNIQUEIDENTIFIER NULL,
        mensajeBienvenida NVARCHAR(500) NOT NULL DEFAULT 'Hola! Bienvenido. Escriba MENU para ver opciones.',
        mensajeNoRegistrado NVARCHAR(500) NOT NULL DEFAULT 'No encontramos su numero registrado. Contacte a la empresa para registrarse.',
        fActualizacion DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_WhatsAppBotConfig_Empresas FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WhatsAppBotCatalogoIndice')
BEGIN
    CREATE TABLE WhatsAppBotCatalogoIndice (
        idIndice UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idProducto UNIQUEIDENTIFIER NOT NULL,
        codigo VARCHAR(50) NOT NULL,
        descripcion NVARCHAR(300) NOT NULL,
        textoBusqueda NVARCHAR(2000) NOT NULL,
        precioLista DECIMAL(18, 6) NOT NULL DEFAULT 0,
        stockTotal DECIMAL(18, 6) NOT NULL DEFAULT 0,
        fSync DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_WhatsAppBotCatalogo_Empresas FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT UQ_WhatsAppBotCatalogo_EmpresaProducto UNIQUE (idEmpresa, idProducto)
    );
    CREATE INDEX IX_WhatsAppBotCatalogo_Empresa ON WhatsAppBotCatalogoIndice(idEmpresa);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WhatsAppBotSinonimo')
BEGIN
    CREATE TABLE WhatsAppBotSinonimo (
        idSinonimo UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        terminoEntrada NVARCHAR(120) NOT NULL,
        terminoBusqueda NVARCHAR(120) NOT NULL,
        fActualizacion DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_WhatsAppBotSinonimo_Empresas FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE
    );
    CREATE INDEX IX_WhatsAppBotSinonimo_Empresa ON WhatsAppBotSinonimo(idEmpresa, terminoEntrada);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WhatsAppBotConversacion')
BEGIN
    CREATE TABLE WhatsAppBotConversacion (
        idConversacion UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        telefonoCliente VARCHAR(20) NOT NULL,
        estado VARCHAR(40) NOT NULL DEFAULT 'menu',
        slotsJson NVARCHAR(MAX) NULL,
        candidatosJson NVARCHAR(MAX) NULL,
        fExpira DATETIME NOT NULL,
        fActualizacion DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_WhatsAppBotConversacion_Empresas FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT UQ_WhatsAppBotConversacion_EmpresaTel UNIQUE (idEmpresa, telefonoCliente)
    );
    CREATE INDEX IX_WhatsAppBotConversacion_Expira ON WhatsAppBotConversacion(idEmpresa, fExpira);
END
GO
