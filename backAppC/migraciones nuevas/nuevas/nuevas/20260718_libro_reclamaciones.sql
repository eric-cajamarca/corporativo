-- Libro de Reclamaciones virtual (proveedor SaaS: BUSINESS SOFT COMPANY S.A.C.)
-- Formato alineado al Anexo I del DS 011-2011-PCM.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LibroReclamaciones' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.LibroReclamaciones (
        idReclamacion UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_LibroReclamaciones_id DEFAULT (NEWID()),
        codigo VARCHAR(20) NOT NULL,
        tipo VARCHAR(10) NOT NULL,
        -- Consumidor
        consumidorNombre VARCHAR(200) NOT NULL,
        consumidorDocumentoTipo VARCHAR(20) NOT NULL,
        consumidorDocumentoNumero VARCHAR(30) NOT NULL,
        consumidorDomicilio VARCHAR(300) NOT NULL,
        consumidorTelefono VARCHAR(30) NULL,
        consumidorEmail VARCHAR(200) NOT NULL,
        esMenor BIT NOT NULL CONSTRAINT DF_LibroReclamaciones_esMenor DEFAULT (0),
        tutorNombre VARCHAR(200) NULL,
        -- Bien / servicio
        bienTipo VARCHAR(20) NOT NULL,
        bienDescripcion VARCHAR(500) NOT NULL,
        bienMonto DECIMAL(18, 6) NULL,
        -- Detalle
        detalle VARCHAR(2000) NOT NULL,
        pedidoConsumidor VARCHAR(1000) NULL,
        -- Gestión interna
        estado VARCHAR(20) NOT NULL CONSTRAINT DF_LibroReclamaciones_estado DEFAULT ('PENDIENTE'),
        respuestaProveedor VARCHAR(2000) NULL,
        fechaRespuesta DATETIME NULL,
        respondidoPor VARCHAR(200) NULL,
        ipOrigen VARCHAR(45) NULL,
        userAgent VARCHAR(400) NULL,
        fechaRegistro DATETIME NOT NULL CONSTRAINT DF_LibroReclamaciones_fecha DEFAULT (GETDATE()),
        CONSTRAINT PK_LibroReclamaciones PRIMARY KEY (idReclamacion),
        CONSTRAINT UQ_LibroReclamaciones_codigo UNIQUE (codigo),
        CONSTRAINT CK_LibroReclamaciones_tipo CHECK (tipo IN ('QUEJA', 'RECLAMO')),
        CONSTRAINT CK_LibroReclamaciones_bienTipo CHECK (bienTipo IN ('PRODUCTO', 'SERVICIO')),
        CONSTRAINT CK_LibroReclamaciones_estado CHECK (estado IN ('PENDIENTE', 'EN_PROCESO', 'RESPONDIDO', 'CERRADO'))
    );

    CREATE INDEX IX_LibroReclamaciones_fechaRegistro
        ON dbo.LibroReclamaciones (fechaRegistro DESC);

    CREATE INDEX IX_LibroReclamaciones_estado_fecha
        ON dbo.LibroReclamaciones (estado, fechaRegistro DESC);
END
GO
