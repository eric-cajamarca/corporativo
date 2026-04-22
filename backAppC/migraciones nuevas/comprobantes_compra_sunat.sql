-- Comprobante de compra según datos reales consultados en SUNAT (p. ej. vía Factiliza).
-- idEmpresa no se duplica: se obtiene por JOIN con Compras.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ComprobantesCompraSunat' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.ComprobantesCompraSunat (
        idComprobanteCompraSunat UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ComprobantesCompraSunat_id DEFAULT NEWID(),
        idCompra                  UNIQUEIDENTIFIER NOT NULL,
        rucEmisor                 VARCHAR(11)      NOT NULL,
        razonSocialEmisor         NVARCHAR(500)  NULL,
        tipoDocumento             VARCHAR(2)     NOT NULL,
        serie                     VARCHAR(10)    NOT NULL,
        numero                    VARCHAR(20)    NOT NULL,
        fechaEmision              DATE           NOT NULL,
        codigoMoneda              VARCHAR(3)     NULL,
        condicionPago             VARCHAR(10)    NOT NULL,
        fechaVencimiento          DATE           NULL,
        tipoCambio                DECIMAL(18, 6) NULL,
        subTotal                  DECIMAL(18, 6) NOT NULL CONSTRAINT DF_ComprobantesCompraSunat_sub DEFAULT 0,
        igv                       DECIMAL(18, 6) NOT NULL CONSTRAINT DF_ComprobantesCompraSunat_igv DEFAULT 0,
        exonerado                 DECIMAL(18, 6) NOT NULL CONSTRAINT DF_ComprobantesCompraSunat_exo DEFAULT 0,
        total                     DECIMAL(18, 6) NOT NULL CONSTRAINT DF_ComprobantesCompraSunat_tot DEFAULT 0,
        idUsuario                 UNIQUEIDENTIFIER NULL,
        fRegistro                 DATETIME2(0)   NOT NULL CONSTRAINT DF_ComprobantesCompraSunat_freg DEFAULT SYSDATETIME(),
        CONSTRAINT PK_ComprobantesCompraSunat PRIMARY KEY (idComprobanteCompraSunat),
        CONSTRAINT FK_ComprobantesCompraSunat_Compra FOREIGN KEY (idCompra) REFERENCES dbo.Compras(idCompra) ON DELETE CASCADE,
        CONSTRAINT CK_ComprobantesCompraSunat_condicion CHECK (condicionPago IN (N'CONTADO', N'CREDITO'))
    );

    CREATE UNIQUE INDEX UQ_ComprobantesCompraSunat_idCompra ON dbo.ComprobantesCompraSunat(idCompra);
END
GO
