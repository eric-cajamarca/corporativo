-- Forzamos permisos de envíos para roles que representen al chofer/ conductor.
-- Objetivo: que el sidebar muestre:
--  - Envios programados (/envios) con VER_ENVIOS
--  - Mis envíos (Chofer) (/envios/mis-envios) con VER_ENVIOS_CHOFER

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Empresas')
   AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Permisos')
   AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Rol')
   AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RolPermisos')
BEGIN
  -- Asegurar permisos (idempotente)
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
    SELECT 1 FROM Permisos p
    WHERE p.idEmpresa = e.idEmpresa AND p.nombre = v.nombre
  );

  -- Resolver roles: por descripción normalizada
  ;WITH RolesChofer AS (
    SELECT r.idRol, r.idEmpresa, r.descripcion
    FROM Rol r
    WHERE UPPER(LTRIM(RTRIM(r.descripcion))) IN ('CHOFER', 'CONDUCTOR')
  )
  -- Asignar VER_ENVIOS_CHOFER al chofer
  INSERT INTO RolPermisos (idRol, idPermiso)
  SELECT rc.idRol, p.idPermiso
  FROM RolesChofer rc
  INNER JOIN Permisos p
    ON p.idEmpresa = rc.idEmpresa AND p.nombre = 'VER_ENVIOS_CHOFER'
  WHERE NOT EXISTS (
    SELECT 1 FROM RolPermisos rp
    WHERE rp.idRol = rc.idRol AND rp.idPermiso = p.idPermiso
  );

  -- Asignar VER_ENVIOS al chofer (para que también vea envíos programados)
  INSERT INTO RolPermisos (idRol, idPermiso)
  SELECT rc.idRol, p.idPermiso
  FROM RolesChofer rc
  INNER JOIN Permisos p
    ON p.idEmpresa = rc.idEmpresa AND p.nombre = 'VER_ENVIOS'
  WHERE NOT EXISTS (
    SELECT 1 FROM RolPermisos rp
    WHERE rp.idRol = rc.idRol AND rp.idPermiso = p.idPermiso
  );
END
GO

