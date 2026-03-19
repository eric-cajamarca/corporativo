-- Asigna el permiso VER_DESPACHOS al rol "Chofer" (si existe) para que el sidebar muestre el módulo.

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Rol') 
   AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Permisos')
   AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RolPermisos')
BEGIN
  INSERT INTO RolPermisos (idRol, idPermiso)
  SELECT
    r.idRol,
    p.idPermiso
  FROM Rol r
  INNER JOIN Permisos p
    ON p.idEmpresa = r.idEmpresa
    AND p.nombre = 'VER_DESPACHOS'
  WHERE r.descripcion = 'Chofer'
    AND NOT EXISTS (
      SELECT 1
      FROM RolPermisos rp
      WHERE rp.idRol = r.idRol
        AND rp.idPermiso = p.idPermiso
    );
END
GO

