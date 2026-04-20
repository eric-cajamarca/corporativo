-- Ajuste comercial/técnico: plan demo = 1 usuario (plaza) y 1 sucursal / dirección según contrato.
-- Idempotente. Ejecutar en bases que ya tenían demo con 3 usuarios en catálogo.

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SaasPlan')
BEGIN
    UPDATE dbo.SaasPlan
    SET maxUsuarios = 1, maxSucursales = 1
    WHERE LOWER(LTRIM(RTRIM(planCode))) = N'demo';
END
GO
