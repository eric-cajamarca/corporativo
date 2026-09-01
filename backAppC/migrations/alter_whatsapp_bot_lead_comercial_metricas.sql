-- Embudo comercial: ofreció demo + registro de empresa + cola de revisión.
-- La landing /suscribirse/demo NO escribe en esta tabla.

IF OBJECT_ID('WhatsAppBotLeadComercial', 'U') IS NOT NULL
   AND COL_LENGTH('WhatsAppBotLeadComercial', 'ofrecioDemo') IS NULL
BEGIN
    ALTER TABLE WhatsAppBotLeadComercial ADD
        ofrecioDemo BIT NOT NULL CONSTRAINT DF_WhatsAppBotLeadComercial_ofrecioDemo DEFAULT 0;
END
GO

IF OBJECT_ID('WhatsAppBotLeadComercial', 'U') IS NOT NULL
   AND COL_LENGTH('WhatsAppBotLeadComercial', 'fOfrecioDemo') IS NULL
BEGIN
    ALTER TABLE WhatsAppBotLeadComercial ADD fOfrecioDemo DATETIME NULL;
END
GO

IF OBJECT_ID('WhatsAppBotLeadComercial', 'U') IS NOT NULL
   AND COL_LENGTH('WhatsAppBotLeadComercial', 'idEmpresaRegistrada') IS NULL
BEGIN
    ALTER TABLE WhatsAppBotLeadComercial ADD idEmpresaRegistrada UNIQUEIDENTIFIER NULL;
END
GO

IF OBJECT_ID('WhatsAppBotLeadComercial', 'U') IS NOT NULL
   AND COL_LENGTH('WhatsAppBotLeadComercial', 'fRegistroEmpresa') IS NULL
BEGIN
    ALTER TABLE WhatsAppBotLeadComercial ADD fRegistroEmpresa DATETIME NULL;
END
GO

IF OBJECT_ID('WhatsAppBotLeadComercial', 'U') IS NOT NULL
   AND COL_LENGTH('WhatsAppBotLeadComercial', 'notaRevision') IS NULL
BEGIN
    ALTER TABLE WhatsAppBotLeadComercial ADD notaRevision NVARCHAR(500) NULL;
END
GO

IF OBJECT_ID('WhatsAppBotLeadComercial', 'U') IS NOT NULL
   AND COL_LENGTH('WhatsAppBotLeadComercial', 'fRevision') IS NULL
BEGIN
    ALTER TABLE WhatsAppBotLeadComercial ADD fRevision DATETIME NULL;
END
GO

IF OBJECT_ID('WhatsAppBotLeadComercial', 'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_WhatsAppBotLeadComercial_DemoEmpresa'
          AND object_id = OBJECT_ID('WhatsAppBotLeadComercial')
   )
BEGIN
    CREATE INDEX IX_WhatsAppBotLeadComercial_DemoEmpresa
        ON WhatsAppBotLeadComercial(idEmpresa, ofrecioDemo, idEmpresaRegistrada);
END
GO
