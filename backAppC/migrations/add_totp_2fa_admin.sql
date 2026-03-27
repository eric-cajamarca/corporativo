-- 2FA TOTP solo para flujos de administrador (UsuarioWeb / acceso empresa sin usuario colaborador)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = 'UsuarioWeb' AND c.name = 'totpSecret'
)
BEGIN
  ALTER TABLE UsuarioWeb ADD totpSecret NVARCHAR(128) NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = 'UsuarioWeb' AND c.name = 'totpEnabled'
)
BEGIN
  ALTER TABLE UsuarioWeb ADD totpEnabled BIT NOT NULL DEFAULT 0;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = 'Empresas' AND c.name = 'totpSecret'
)
BEGIN
  ALTER TABLE Empresas ADD totpSecret NVARCHAR(128) NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = 'Empresas' AND c.name = 'totpEnabled'
)
BEGIN
  ALTER TABLE Empresas ADD totpEnabled BIT NOT NULL DEFAULT 0;
END
GO
