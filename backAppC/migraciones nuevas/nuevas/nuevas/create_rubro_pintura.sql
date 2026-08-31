-- Rubro Pintura (matizador). Código de sistema: PINT

IF NOT EXISTS (SELECT 1 FROM dbo.Rubros WHERE codigo = 'PINT')
BEGIN
    INSERT INTO dbo.Rubros (codigo, nombre, descripcion, activo)
    VALUES ('PINT', 'Pintura', 'Tienda de pinturas; fórmulas de matizado y venta por gramos.', 1);
END
ELSE
BEGIN
    UPDATE dbo.Rubros
    SET activo = 1,
        nombre = 'Pintura',
        descripcion = 'Tienda de pinturas; fórmulas de matizado y venta por gramos.'
    WHERE codigo = 'PINT';
END
GO
