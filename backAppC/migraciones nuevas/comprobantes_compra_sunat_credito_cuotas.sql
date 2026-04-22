-- Crédito compra SUNAT: vencimiento en cabecera + cuotas (notificaciones / WhatsApp).
-- No reutiliza PagosCuotas/CuotasCredito (FK a crédito de clientes).
-- Si la tabla se creó con comprobantes_compra_sunat.sql ya incluye fechaVencimiento; si no, se agrega aquí.

IF COL_LENGTH('dbo.ComprobantesCompraSunat', 'fechaVencimiento') IS NULL
BEGIN
    ALTER TABLE dbo.ComprobantesCompraSunat ADD fechaVencimiento DATE NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CuotasCompraSunat' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CuotasCompraSunat (
        idCuota                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_CuotasCompraSunat_id DEFAULT NEWID(),
        idComprobanteCompraSunat UNIQUEIDENTIFIER NOT NULL,
        numeroCuota              INT            NOT NULL,
        fechaVencimiento         DATE           NOT NULL,
        montoCuota               DECIMAL(18, 6) NOT NULL,
        saldoPendiente           DECIMAL(18, 6) NOT NULL,
        fRegistro                DATETIME2(0)   NOT NULL CONSTRAINT DF_CuotasCompraSunat_freg DEFAULT SYSDATETIME(),
        CONSTRAINT PK_CuotasCompraSunat PRIMARY KEY (idCuota),
        CONSTRAINT FK_CuotasCompraSunat_Comprobante FOREIGN KEY (idComprobanteCompraSunat)
            REFERENCES dbo.ComprobantesCompraSunat (idComprobanteCompraSunat) ON DELETE CASCADE
    );

    CREATE INDEX IX_CuotasCompraSunat_Comprobante ON dbo.CuotasCompraSunat (idComprobanteCompraSunat);
    CREATE INDEX IX_CuotasCompraSunat_FechaVenc ON dbo.CuotasCompraSunat (fechaVencimiento);
END
GO
