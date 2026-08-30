-- Leads de preventa EFAFERP (WhatsApp de la empresa principal)

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WhatsAppBotLeadComercial')
BEGIN
    CREATE TABLE WhatsAppBotLeadComercial (
        idLead UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        telefonoLog VARCHAR(40) NOT NULL,
        digitosCelular VARCHAR(20) NULL,
        nombre NVARCHAR(120) NULL,
        rubro NVARCHAR(80) NULL,
        rubroLibre NVARCHAR(160) NULL,
        necesidad NVARCHAR(400) NULL,
        intencionCompra VARCHAR(12) NULL,
        encaja VARCHAR(16) NULL,
        mejorHorario NVARCHAR(80) NULL,
        estado VARCHAR(30) NOT NULL DEFAULT 'nuevo',
        quiereLlamada BIT NOT NULL DEFAULT 0,
        ultimoMensaje NVARCHAR(500) NULL,
        fCreacion DATETIME NOT NULL DEFAULT GETDATE(),
        fActualizacion DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_WhatsAppBotLeadComercial_Empresas FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT UQ_WhatsAppBotLeadComercial_EmpresaTel UNIQUE (idEmpresa, telefonoLog)
    );
    CREATE INDEX IX_WhatsAppBotLeadComercial_EmpresaEstado
        ON WhatsAppBotLeadComercial(idEmpresa, estado, fActualizacion DESC);
END
GO
