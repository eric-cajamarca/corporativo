/*
  Agrega CCI (código de cuenta interbancario) a CuentasBancarias.
  Usado en checkout SaaS (depósito) y en configuración de cuentas.
*/
IF COL_LENGTH('dbo.CuentasBancarias', 'cci') IS NULL
BEGIN
  ALTER TABLE dbo.CuentasBancarias
    ADD cci VARCHAR(20) NULL;
END
GO
