-- adminRequiere2FA = 1 (default): exige 2FA TOTP para roles elevados. = 0: no exige (corporativo).
IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = 'Empresas' AND c.name = 'adminRequiere2FA'
)
BEGIN
  ALTER TABLE Empresas ADD adminRequiere2FA BIT NOT NULL DEFAULT 1;
END
GO
