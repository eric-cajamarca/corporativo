-- Auditoría de eventos de seguridad (login, logout, refresh).
-- Sesiones largas vía refresh token (hash en BD; el valor real solo en cookie HttpOnly).

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SeguridadAuditoria' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.SeguridadAuditoria (
        idAuditoria UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_SegAud_id DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NULL,
        idUsuario UNIQUEIDENTIFIER NULL,
        tipo VARCHAR(40) NOT NULL,
        detalle NVARCHAR(500) NULL,
        ipCliente VARCHAR(45) NULL,
        userAgent NVARCHAR(500) NULL,
        fecha DATETIME2 NOT NULL CONSTRAINT DF_SegAud_fecha DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_SeguridadAuditoria PRIMARY KEY (idAuditoria)
    );
    CREATE INDEX IX_SeguridadAuditoria_empresa_fecha ON dbo.SeguridadAuditoria (idEmpresa, fecha DESC);
    CREATE INDEX IX_SeguridadAuditoria_tipo_fecha ON dbo.SeguridadAuditoria (tipo, fecha DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SesionRefreshToken' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.SesionRefreshToken (
        idRefresh UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_SesRef_id DEFAULT NEWID(),
        idUsuario UNIQUEIDENTIFIER NOT NULL,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        tokenHash CHAR(64) NOT NULL,
        expira DATETIME2 NOT NULL,
        revocado BIT NOT NULL CONSTRAINT DF_SesRef_rev DEFAULT (0),
        creado DATETIME2 NOT NULL CONSTRAINT DF_SesRef_creado DEFAULT SYSUTCDATETIME(),
        ipCrear VARCHAR(45) NULL,
        userAgentCrear NVARCHAR(400) NULL,
        CONSTRAINT PK_SesionRefreshToken PRIMARY KEY (idRefresh)
    );
    CREATE UNIQUE INDEX UX_SesionRefreshToken_hashActivo
        ON dbo.SesionRefreshToken (tokenHash)
        WHERE revocado = 0;
    CREATE INDEX IX_SesionRefreshToken_usuario_empresa ON dbo.SesionRefreshToken (idUsuario, idEmpresa, revocado);
END
GO
