-- IP del último intento de login. Ejecutar una vez en SQL Server.
IF COL_LENGTH('dbo.SeguridadLoginIntento', 'ipUltimoIntento') IS NULL
BEGIN
    ALTER TABLE dbo.SeguridadLoginIntento
    ADD ipUltimoIntento VARCHAR(45) NULL;
END
GO
