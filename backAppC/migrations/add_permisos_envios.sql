-- Permisos para sidebar de envíos (programados y chofer)
-- Crea/actualiza permisos por empresa e inserta en RolPermisos según rol.descripcion.

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Empresas')
   AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Permisos')
   AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Rol')
   AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RolPermisos')
BEGIN
  -- Crear permisos si no existen
  INSERT INTO Permisos (idEmpresa, nombre, descripcion, modulo, estado)
  SELECT
    e.idEmpresa,
    v.nombre,
    v.descripcion,
    v.modulo,
    1
  FROM Empresas e
  CROSS APPLY (
    SELECT
      'VER_ENVIOS' AS nombre,
      'Ver envíos programados' AS descripcion,
      'ENVIOS' AS modulo
    UNION ALL
    SELECT
      'VER_ENVIOS_CHOFER' AS nombre,
      'Ver mis envíos (chofer)' AS descripcion,
      'ENVIOS' AS modulo
  ) v
  WHERE NOT EXISTS (
    SELECT 1
    FROM Permisos p
    WHERE p.idEmpresa = e.idEmpresa AND p.nombre = v.nombre
  );

  -- Asignar permisos a roles
  -- Chofer: VER_DESPACHOS ya puede existir, pero para envíos se requiere VER_ENVIOS_CHOFER (y también VER_ENVIOS si deseas ver envíos programados)
  INSERT INTO RolPermisos (idRol, idPermiso)
  SELECT
    r.idRol,
    p.idPermiso
  FROM Rol r
  INNER JOIN Permisos p
    ON p.idEmpresa = r.idEmpresa
   AND p.nombre = 'VER_ENVIOS_CHOFER'
  WHERE r.descripcion = 'Chofer'
    AND NOT EXISTS (
      SELECT 1 FROM RolPermisos rp
      WHERE rp.idRol = r.idRol AND rp.idPermiso = p.idPermiso
    );

  INSERT INTO RolPermisos (idRol, idPermiso)
  SELECT
    r.idRol,
    p.idPermiso
  FROM Rol r
  INNER JOIN Permisos p
    ON p.idEmpresa = r.idEmpresa
   AND p.nombre = 'VER_ENVIOS'
  WHERE r.descripcion IN ('Chofer', 'Vendedor')
    AND NOT EXISTS (
      SELECT 1 FROM RolPermisos rp
      WHERE rp.idRol = r.idRol AND rp.idPermiso = p.idPermiso
    );
END
GO

