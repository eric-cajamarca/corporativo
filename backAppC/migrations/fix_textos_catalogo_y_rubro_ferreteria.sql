-- Textos de catálogo y rubro Ferretería (checklist EFAFERP).
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'MediosPago')
BEGIN
    UPDATE MediosPago
    SET descripcion = REPLACE(descripcion, 'MASTERCAD', 'MASTERCARD')
    WHERE descripcion LIKE '%MASTERCAD%';
END

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Moneda')
BEGIN
    UPDATE Moneda
    SET descripcion = N'DÓLAR AMERICANO'
    WHERE descripcion LIKE '%DOLLAR AMERICANO%'
       OR descripcion LIKE '%DOLAR AMERICANO%';
END

IF EXISTS (SELECT 1 FROM Rubros WHERE codigo = 'FERR')
    UPDATE Rubros SET activo = 1, nombre = ISNULL(NULLIF(LTRIM(RTRIM(nombre)), ''), N'Ferretería') WHERE codigo = 'FERR';
ELSE
    INSERT INTO Rubros (codigo, nombre, descripcion, activo)
    VALUES ('FERR', N'Ferretería', N'Facturación estándar; tope 22 líneas por factura.', 1);
