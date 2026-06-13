-- Consolidar catálogo a 3 rubros activos: GEN, GRF, HOTEL
-- Ejecutar en ventana de mantenimiento. No elimina FK históricas.

DECLARE @idGEN INT = (SELECT idRubro FROM Rubros WHERE codigo = 'GEN');

IF @idGEN IS NOT NULL
BEGIN
    UPDATE e SET e.idRubro = @idGEN
    FROM Empresas e
    INNER JOIN Rubros r ON e.idRubro = r.idRubro
    WHERE r.codigo IN ('FERR', 'RETAIL', 'ROPA', 'REST');
END
GO

UPDATE Rubros SET activo = 0 WHERE codigo IN ('FERR', 'RETAIL', 'ROPA', 'REST');
GO

UPDATE Rubros SET activo = 1 WHERE codigo IN ('GEN', 'GRF', 'HOTEL');
GO
