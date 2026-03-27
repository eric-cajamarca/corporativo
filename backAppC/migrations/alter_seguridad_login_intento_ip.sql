-- IP del último intento de login (fallido o que llevó al bloqueo). Ejecutar una vez.
IF COL_LENGTH('dbo.SeguridadLoginIntento', 'ipUltimoIntento') IS NULL
BEGIN
    ALTER TABLE dbo.SeguridadLoginIntento
    ADD ipUltimoIntento VARCHAR(45) NULL;
END
GO
