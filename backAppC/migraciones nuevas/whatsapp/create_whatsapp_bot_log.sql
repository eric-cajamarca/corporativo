-- Log de mensajes entrantes/salientes del bot WhatsApp (Piloto A)

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WhatsAppBotLog')
BEGIN
    CREATE TABLE WhatsAppBotLog (
        idLog UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        direccion VARCHAR(10) NOT NULL,
        telefonoCliente VARCHAR(20) NOT NULL,
        messageId VARCHAR(100) NULL,
        texto NVARCHAR(2000) NOT NULL,
        fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_WhatsAppBotLog_Empresas FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT CK_WhatsAppBotLog_direccion CHECK (direccion IN ('in', 'out'))
    );
    CREATE INDEX IX_WhatsAppBotLog_Empresa ON WhatsAppBotLog(idEmpresa, fRegistro DESC);
END
GO
