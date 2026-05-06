/*
  Compatibilidad API: asigna permisos en RolPermisos para roles operativos
  tras validar acciones por permiso (no solo por nombre de rol).

  - Vendedor: paquete amplio equivalente al acceso que antes otorgaba el código con rol "Vendedor".
  - Despachador: despachos + envíos + lecturas mínimas de ventas/clientes.
  - Almacenero: compras, lotes e inventario (detalle compras / stock sucursal).

  Requisitos: tablas Rol, Permisos, RolPermisos; permisos ya creados por empresa
  (p. ej. inicializar permisos desde la app). Solo inserta si existe idPermiso.

  Idempotente: no duplica filas en RolPermisos.
*/

SET NOCOUNT ON;

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Rol')
   AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Permisos')
   AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RolPermisos')
BEGIN
  /* ---------- Vendedor ---------- */
  INSERT INTO RolPermisos (idRol, idPermiso)
  SELECT
    r.idRol,
    p.idPermiso
  FROM Rol r
  INNER JOIN Permisos p
    ON p.idEmpresa = r.idEmpresa
   AND p.estado = 1
  INNER JOIN (
    VALUES
      ('VER_DASHBOARD'),
      ('VER_VENTAS'),
      ('CREAR_VENTAS'),
      ('EDITAR_VENTAS'),
      ('ANULAR_VENTAS'),
      ('VER_CLIENTES'),
      ('CREAR_CLIENTES'),
      ('EDITAR_CLIENTES'),
      ('VER_CREDITOS'),
      ('CREAR_CREDITOS'),
      ('REGISTRAR_PAGOS'),
      ('VER_DESPACHOS'),
      ('CREAR_DESPACHOS'),
      ('EDITAR_DESPACHOS'),
      ('VER_ENVIOS'),
      ('VER_PROVEEDORES'),
      ('CREAR_PROVEEDORES'),
      ('EDITAR_PROVEEDORES'),
      ('VER_PRODUCTOS'),
      ('VER_CAJA'),
      ('ABRIR_CAJA'),
      ('CERRAR_CAJA'),
      ('REGISTRAR_MOVIMIENTOS'),
      ('VER_ARQUEO'),
      ('VER_INVENTARIO'),
      ('VER_ANALISIS'),
      ('EXPORTAR_REPORTES'),
      ('VER_CONFIGURACION'),
      ('VER_EMPRESA'),
      ('VER_REPORTES'),
      ('GENERAR_REPORTES')
  ) AS nom(nombre)
    ON p.nombre = nom.nombre
  WHERE UPPER(LTRIM(RTRIM(r.descripcion))) = 'VENDEDOR'
    AND NOT EXISTS (
      SELECT 1
      FROM RolPermisos rp
      WHERE rp.idRol = r.idRol
        AND rp.idPermiso = p.idPermiso
    );

  /* ---------- Despachador (nombre exacto o variantes comunes) ---------- */
  INSERT INTO RolPermisos (idRol, idPermiso)
  SELECT
    r.idRol,
    p.idPermiso
  FROM Rol r
  INNER JOIN Permisos p
    ON p.idEmpresa = r.idEmpresa
   AND p.estado = 1
  INNER JOIN (
    VALUES
      ('VER_DESPACHOS'),
      ('CREAR_DESPACHOS'),
      ('EDITAR_DESPACHOS'),
      ('VER_ENVIOS'),
      ('VER_VENTAS'),
      ('VER_CLIENTES')
  ) AS nom(nombre)
    ON p.nombre = nom.nombre
  WHERE UPPER(LTRIM(RTRIM(r.descripcion))) = 'DESPACHADOR'
    AND NOT EXISTS (
      SELECT 1
      FROM RolPermisos rp
      WHERE rp.idRol = r.idRol
        AND rp.idPermiso = p.idPermiso
    );

  /* ---------- Almacenero ---------- */
  INSERT INTO RolPermisos (idRol, idPermiso)
  SELECT
    r.idRol,
    p.idPermiso
  FROM Rol r
  INNER JOIN Permisos p
    ON p.idEmpresa = r.idEmpresa
   AND p.estado = 1
  INNER JOIN (
    VALUES
      ('VER_COMPRAS'),
      ('CREAR_COMPRAS'),
      ('EDITAR_COMPRAS'),
      ('VER_INVENTARIO'),
      ('GESTIONAR_LOTES'),
      ('TRANSFERIR_STOCK'),
      ('VER_PRODUCTOS'),
      ('VER_PROVEEDORES'),
      ('CREAR_PROVEEDORES'),
      ('EDITAR_PROVEEDORES'),
      ('VER_DASHBOARD')
  ) AS nom(nombre)
    ON p.nombre = nom.nombre
  WHERE UPPER(LTRIM(RTRIM(r.descripcion))) = 'ALMACENERO'
    AND NOT EXISTS (
      SELECT 1
      FROM RolPermisos rp
      WHERE rp.idRol = r.idRol
        AND rp.idPermiso = p.idPermiso
    );
END
GO
