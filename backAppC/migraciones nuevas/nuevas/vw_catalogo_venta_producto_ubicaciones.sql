/*
  Vistas alineadas al modal "Buscar productos" (Nueva venta).
  Misma lógica que productos.repository.js:
    - Stock total = SUM(Lotes.cantidadDisponible) por empresa + sucursal + producto
    - Productos sin lotes = stock 0 en sucursal principal/asignada
    - pVenta = precio de la lista marcada principal (ListasPrecio.principal = 1)
    - Ubicaciones = UbicacionesPrioridad + LotesUbicacion (detalle del ícono "Ubic.")

  Uso (reemplazar GUID):
    SELECT * FROM dbo.vw_CatalogoVentaProductoSucursal
    WHERE idEmpresa = '...' AND codigo LIKE '%gloss%';

    SELECT * FROM dbo.vw_CatalogoVentaStockUbicacion
    WHERE idEmpresa = '...' AND idProducto = '...' AND idSucursal = '...';
*/

SET NOCOUNT ON;
GO

/* -------------------------------------------------------------------------- */
/* 1) Catálogo venta: una fila por producto + empresa + sucursal (modal)        */
/* -------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.vw_CatalogoVentaProductoSucursal', N'V') IS NOT NULL
  DROP VIEW dbo.vw_CatalogoVentaProductoSucursal;
GO

CREATE VIEW dbo.vw_CatalogoVentaProductoSucursal
AS
WITH StockLote AS (
  SELECT
    l.idEmpresa,
    l.idSucursal,
    l.idProducto,
    CAST(SUM(l.cantidadDisponible) AS DECIMAL(18, 3)) AS stock
  FROM dbo.Lotes l
  GROUP BY l.idEmpresa, l.idSucursal, l.idProducto
),
PrecioPrincipal AS (
  SELECT
    pp.idProducto,
    pp.precio,
    lp.nombre AS nombreLista,
    m.simbolo AS simboloMoneda,
    ROW_NUMBER() OVER (
      PARTITION BY pp.idProducto
      ORDER BY CASE WHEN lp.principal = 1 THEN 0 ELSE 1 END, pp.fActualizacion DESC
    ) AS rn
  FROM dbo.PreciosProducto pp
  INNER JOIN dbo.ListasPrecio lp ON lp.idLista = pp.idLista AND lp.activo = 1
  INNER JOIN dbo.Moneda m ON m.idMoneda = lp.idMoneda
),
/* Productos con stock en lotes (por sucursal) */
ConLotes AS (
  SELECT
    ss.idEmpresa,
    ss.idSucursal,
    ss.idProducto,
    p.codigo,
    p.idCategoria,
    c.nombre AS categoria,
    p.descripcion,
    CAST(ISNULL(p.permiteDescripcionEnVenta, 0) AS BIT) AS permiteDescripcionEnVenta,
    p.idMarca,
    m.nombre AS marca,
    p.idPresentacion,
    pr.codigo AS codigoPresentacion,
    pr.descripcion AS descripcionPres,
    s.nombre AS sucursal,
    p.cUnitario,
    ss.stock,
    p.tipoProducto,
    p.fProduccion,
    p.fVencimiento,
    CAST(ISNULL(p.estado, 1) AS BIT) AS estado,
    ISNULL(e.alias, e.nombreComercial) AS aliasEmpresa,
    e.razon_Social AS razonSocialEmpresa,
    pp.precio AS pVenta,
    pp.nombreLista,
    pp.simboloMoneda,
    CAST(1 AS BIT) AS tieneLotes
  FROM StockLote ss
  INNER JOIN dbo.Productos p ON p.idProducto = ss.idProducto AND p.idEmpresa = ss.idEmpresa
  INNER JOIN dbo.Categorias c ON c.idCategoria = p.idCategoria
  INNER JOIN dbo.Presentacion pr ON pr.idPresentacion = p.idPresentacion
  INNER JOIN dbo.Sucursal s ON s.idSucursal = ss.idSucursal AND ISNULL(s.estado, 1) = 1
  INNER JOIN dbo.Marcas m ON m.idMarca = p.idMarca
  INNER JOIN dbo.Empresas e ON e.idEmpresa = ss.idEmpresa
  LEFT JOIN PrecioPrincipal pp ON pp.idProducto = p.idProducto AND pp.rn = 1
  WHERE ISNULL(p.estado, 1) = 1
),
/* Productos activos sin ningún lote (stock 0 en sucursal principal) */
SinLotes AS (
  SELECT
    p.idEmpresa,
    defSuc.idSucursal,
    p.idProducto,
    p.codigo,
    p.idCategoria,
    c.nombre AS categoria,
    p.descripcion,
    CAST(ISNULL(p.permiteDescripcionEnVenta, 0) AS BIT) AS permiteDescripcionEnVenta,
    p.idMarca,
    m.nombre AS marca,
    p.idPresentacion,
    pr.codigo AS codigoPresentacion,
    pr.descripcion AS descripcionPres,
    s.nombre AS sucursal,
    p.cUnitario,
    CAST(0 AS DECIMAL(18, 3)) AS stock,
    p.tipoProducto,
    p.fProduccion,
    p.fVencimiento,
    CAST(ISNULL(p.estado, 1) AS BIT) AS estado,
    ISNULL(e.alias, e.nombreComercial) AS aliasEmpresa,
    e.razon_Social AS razonSocialEmpresa,
    pp.precio AS pVenta,
    pp.nombreLista,
    pp.simboloMoneda,
    CAST(0 AS BIT) AS tieneLotes
  FROM dbo.Productos p
  INNER JOIN dbo.Categorias c ON c.idCategoria = p.idCategoria
  INNER JOIN dbo.Presentacion pr ON pr.idPresentacion = p.idPresentacion
  INNER JOIN dbo.Marcas m ON m.idMarca = p.idMarca
  INNER JOIN dbo.Empresas e ON e.idEmpresa = p.idEmpresa
  CROSS APPLY (
    SELECT TOP (1) su.idSucursal
    FROM dbo.Sucursal su
    WHERE su.idEmpresa = p.idEmpresa
      AND ISNULL(su.estado, 1) = 1
    ORDER BY
      CASE WHEN ISNULL(su.esPrincipal, 0) = 1 THEN 0 ELSE 1 END,
      su.nombre
  ) defSuc
  INNER JOIN dbo.Sucursal s ON s.idSucursal = defSuc.idSucursal
  LEFT JOIN PrecioPrincipal pp ON pp.idProducto = p.idProducto AND pp.rn = 1
  WHERE ISNULL(p.estado, 1) = 1
    AND NOT EXISTS (
      SELECT 1
      FROM dbo.Lotes l
      WHERE l.idProducto = p.idProducto
        AND l.idEmpresa = p.idEmpresa
    )
)
SELECT
  idEmpresa,
  idSucursal,
  idProducto,
  codigo,
  idCategoria,
  categoria,
  descripcion,
  permiteDescripcionEnVenta,
  idMarca,
  marca,
  idPresentacion,
  codigoPresentacion,
  descripcionPres,
  /* Columna "U.Medida" del modal (prioriza descripción de presentación) */
  COALESCE(NULLIF(LTRIM(RTRIM(descripcionPres)), ''), NULLIF(LTRIM(RTRIM(codigoPresentacion)), ''), N'—') AS unidadMedida,
  sucursal,
  cUnitario,
  stock,
  tipoProducto,
  CONVERT(VARCHAR(19), fProduccion, 120) AS fProduccion,
  CONVERT(VARCHAR(19), fVencimiento, 120) AS fVencimiento,
  estado,
  aliasEmpresa,
  razonSocialEmpresa,
  ISNULL(pVenta, 0) AS pVenta,
  nombreLista,
  simboloMoneda,
  tieneLotes
FROM ConLotes

UNION ALL

SELECT
  idEmpresa,
  idSucursal,
  idProducto,
  codigo,
  idCategoria,
  categoria,
  descripcion,
  permiteDescripcionEnVenta,
  idMarca,
  marca,
  idPresentacion,
  codigoPresentacion,
  descripcionPres,
  COALESCE(NULLIF(LTRIM(RTRIM(descripcionPres)), ''), NULLIF(LTRIM(RTRIM(codigoPresentacion)), ''), N'—') AS unidadMedida,
  sucursal,
  cUnitario,
  stock,
  tipoProducto,
  CONVERT(VARCHAR(19), fProduccion, 120) AS fProduccion,
  CONVERT(VARCHAR(19), fVencimiento, 120) AS fVencimiento,
  estado,
  aliasEmpresa,
  razonSocialEmpresa,
  ISNULL(pVenta, 0) AS pVenta,
  nombreLista,
  simboloMoneda,
  tieneLotes
FROM SinLotes;
GO

/* -------------------------------------------------------------------------- */
/* 2) Stock por ubicación (modal ojo "Ubic." en buscador)                     */
/* -------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.vw_CatalogoVentaStockUbicacion', N'V') IS NOT NULL
  DROP VIEW dbo.vw_CatalogoVentaStockUbicacion;
GO

CREATE VIEW dbo.vw_CatalogoVentaStockUbicacion
AS
/* Solo filas con cantidad en LotesUbicacion (> 0). Para listar TODAS las ubicaciones de la sucursal
   (incluidas en 0) use la consulta parametrizada del final del script. */
SELECT
  l.idEmpresa,
  l.idSucursal,
  l.idProducto,
  p.codigo,
  p.descripcion,
  s.nombre AS sucursal,
  up.idUbicacion,
  RTRIM(LTRIM(ISNULL(up.codigoUbicacion, N''))) AS codigoUbicacion,
  up.prioridad,
  CAST(SUM(lu.cantidad) AS DECIMAL(18, 3)) AS cantidadUbicacion
FROM dbo.Lotes l
INNER JOIN dbo.Productos p ON p.idProducto = l.idProducto AND p.idEmpresa = l.idEmpresa
INNER JOIN dbo.Sucursal s ON s.idSucursal = l.idSucursal AND ISNULL(s.estado, 1) = 1
INNER JOIN dbo.LotesUbicacion lu ON lu.idLote = l.idLote AND lu.cantidad > 0
INNER JOIN dbo.UbicacionesPrioridad up ON up.idUbicacion = lu.idUbicacion AND up.idSucursal = l.idSucursal
WHERE l.cantidadDisponible > 0
GROUP BY
  l.idEmpresa,
  l.idSucursal,
  l.idProducto,
  p.codigo,
  p.descripcion,
  s.nombre,
  up.idUbicacion,
  up.codigoUbicacion,
  up.prioridad;
GO

/* -------------------------------------------------------------------------- */
/* 3) Vista combinada: catálogo + ubicaciones en texto y JSON                   */
/* -------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.vw_CatalogoVentaProductoConUbicaciones', N'V') IS NOT NULL
  DROP VIEW dbo.vw_CatalogoVentaProductoConUbicaciones;
GO

CREATE VIEW dbo.vw_CatalogoVentaProductoConUbicaciones
AS
SELECT
  cat.idEmpresa,
  cat.idSucursal,
  cat.idProducto,
  cat.codigo,
  cat.categoria,
  cat.marca,
  cat.descripcion,
  cat.unidadMedida,
  cat.pVenta,
  cat.sucursal,
  cat.stock AS stockTotal,
  cat.aliasEmpresa,
  cat.razonSocialEmpresa,
  cat.estado,
  cat.tieneLotes,
  /* Texto legible: A-01: 10.000, B-02: 5.000 */
  STUFF((
    SELECT N', ' + u.codigoUbicacion + N': ' + CONVERT(NVARCHAR(32), u.cantidadUbicacion)
    FROM dbo.vw_CatalogoVentaStockUbicacion u
    WHERE u.idEmpresa = cat.idEmpresa
      AND u.idSucursal = cat.idSucursal
      AND u.idProducto = cat.idProducto
      AND u.cantidadUbicacion > 0
    ORDER BY u.prioridad, u.idUbicacion
    FOR XML PATH(''), TYPE
  ).value(N'.', N'NVARCHAR(MAX)'), 1, 2, N'') AS ubicacionesResumen,
  /* JSON para consumo programático */
  (
    SELECT
      u.idUbicacion,
      u.codigoUbicacion,
      u.prioridad,
      u.cantidadUbicacion
    FROM dbo.vw_CatalogoVentaStockUbicacion u
    WHERE u.idEmpresa = cat.idEmpresa
      AND u.idSucursal = cat.idSucursal
      AND u.idProducto = cat.idProducto
    ORDER BY u.prioridad, u.idUbicacion
    FOR JSON PATH
  ) AS ubicacionesJson
FROM dbo.vw_CatalogoVentaProductoSucursal cat;
GO

PRINT N'Vistas creadas: vw_CatalogoVentaProductoSucursal, vw_CatalogoVentaStockUbicacion, vw_CatalogoVentaProductoConUbicaciones';
GO

/* -------------------------------------------------------------------------- */
/* 4) Procedimiento: ubicaciones como COLUMNAS (PIVOT dinámico)                 */
/*    Cada codigoUbicacion = una columna; valor = cantidad en esa ubicación.  */
/* -------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.sp_CatalogoVentaProductoUbicacionesPivot', N'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_CatalogoVentaProductoUbicacionesPivot;
GO

CREATE PROCEDURE dbo.sp_CatalogoVentaProductoUbicacionesPivot
  @idEmpresa UNIQUEIDENTIFIER,
  @idSucursal UNIQUEIDENTIFIER = NULL,
  @termino NVARCHAR(200) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF @idEmpresa IS NULL
  BEGIN
    RAISERROR(N'idEmpresa es obligatorio.', 16, 1);
    RETURN;
  END;

  DECLARE @term NVARCHAR(200) = NULLIF(LTRIM(RTRIM(@termino)), N'');

  IF OBJECT_ID(N'tempdb..#DetalleUbic', N'U') IS NOT NULL
    DROP TABLE #DetalleUbic;

  /*
    Una fila por producto/sucursal/ubicación (cantidad 0 si no hay stock en esa ubicación).
    Misma lógica que el popup "Ubic." del modal de ventas.
  */
  SELECT
    cat.idEmpresa,
    cat.idSucursal,
    cat.idProducto,
    cat.codigo,
    cat.categoria,
    cat.marca,
    cat.descripcion,
    cat.unidadMedida,
    cat.pVenta,
    cat.sucursal,
    cat.stock AS stockTotal,
    cat.aliasEmpresa,
    cat.razonSocialEmpresa,
    cat.estado,
    up.idUbicacion,
    up.prioridad,
    COALESCE(
      NULLIF(RTRIM(LTRIM(ISNULL(up.codigoUbicacion, N''))), N''),
      CONCAT(N'UB_', CONVERT(NVARCHAR(20), up.idUbicacion))
    ) AS colUbicacion,
    CAST(ISNULL(SUM(lu.cantidad), 0) AS DECIMAL(18, 3)) AS cantidadUbicacion
  INTO #DetalleUbic
  FROM dbo.vw_CatalogoVentaProductoSucursal cat
  INNER JOIN dbo.UbicacionesPrioridad up ON up.idSucursal = cat.idSucursal
  LEFT JOIN dbo.Lotes l
    ON l.idSucursal = cat.idSucursal
   AND l.idEmpresa = cat.idEmpresa
   AND l.idProducto = cat.idProducto
   AND l.cantidadDisponible > 0
  LEFT JOIN dbo.LotesUbicacion lu
    ON lu.idLote = l.idLote
   AND lu.idUbicacion = up.idUbicacion
   AND lu.cantidad > 0
  WHERE cat.idEmpresa = @idEmpresa
    AND (@idSucursal IS NULL OR cat.idSucursal = @idSucursal)
    AND (
      @term IS NULL
      OR cat.codigo LIKE N'%' + @term + N'%'
      OR cat.descripcion LIKE N'%' + @term + N'%'
      OR cat.marca LIKE N'%' + @term + N'%'
      OR cat.categoria LIKE N'%' + @term + N'%'
    )
  GROUP BY
    cat.idEmpresa,
    cat.idSucursal,
    cat.idProducto,
    cat.codigo,
    cat.categoria,
    cat.marca,
    cat.descripcion,
    cat.unidadMedida,
    cat.pVenta,
    cat.sucursal,
    cat.stock,
    cat.aliasEmpresa,
    cat.razonSocialEmpresa,
    cat.estado,
    up.idUbicacion,
    up.prioridad,
    up.codigoUbicacion;

  DECLARE @cols NVARCHAR(MAX);

  SELECT @cols = STRING_AGG(QUOTENAME(colUbicacion), N',') WITHIN GROUP (ORDER BY prioridad, idUbicacion)
  FROM (
    SELECT DISTINCT colUbicacion, prioridad, idUbicacion
    FROM #DetalleUbic
  ) u;

  /* Sin ubicaciones configuradas: devolver catálogo sin columnas dinámicas */
  IF @cols IS NULL OR LEN(@cols) = 0
  BEGIN
    SELECT DISTINCT
      idEmpresa,
      idSucursal,
      idProducto,
      codigo,
      categoria,
      marca,
      descripcion,
      unidadMedida,
      pVenta,
      sucursal,
      stockTotal,
      aliasEmpresa,
      razonSocialEmpresa,
      estado
    FROM #DetalleUbic
    ORDER BY descripcion, codigo, sucursal;
    RETURN;
  END;

  DECLARE @sql NVARCHAR(MAX) = N'
    SELECT
      idEmpresa,
      idSucursal,
      idProducto,
      codigo,
      categoria,
      marca,
      descripcion,
      unidadMedida,
      pVenta,
      sucursal,
      stockTotal,
      aliasEmpresa,
      razonSocialEmpresa,
      estado,
      ' + @cols + N'
    FROM (
      SELECT
        idEmpresa,
        idSucursal,
        idProducto,
        codigo,
        categoria,
        marca,
        descripcion,
        unidadMedida,
        pVenta,
        sucursal,
        stockTotal,
        aliasEmpresa,
        razonSocialEmpresa,
        estado,
        colUbicacion,
        cantidadUbicacion
      FROM #DetalleUbic
    ) src
    PIVOT (
      SUM(cantidadUbicacion) FOR colUbicacion IN (' + @cols + N')
    ) p
    ORDER BY descripcion, codigo, sucursal;
  ';

  EXEC sys.sp_executesql @sql;
END;
GO

PRINT N'Procedimiento creado: sp_CatalogoVentaProductoUbicacionesPivot';
GO

/*
  --- Ejemplos ---

  -- Mismas columnas que el modal (empresa del token en la app):
  SELECT TOP 100
    aliasEmpresa,
    codigo,
    categoria,
    marca,
    descripcion,
    unidadMedida,
    pVenta,
    sucursal,
    stock
  FROM dbo.vw_CatalogoVentaProductoSucursal
  WHERE idEmpresa = @idEmpresa
    AND (
      codigo LIKE N'%gloss%'
      OR descripcion LIKE N'%gloss%'
      OR marca LIKE N'%gloss%'
      OR categoria LIKE N'%gloss%'
    )
  ORDER BY descripcion, codigo;

  -- Catálogo + ubicaciones (una fila por producto/sucursal, JSON/resumen):
  SELECT TOP 100
    codigo, descripcion, stockTotal, ubicacionesResumen, ubicacionesJson
  FROM dbo.vw_CatalogoVentaProductoConUbicaciones
  WHERE idEmpresa = @idEmpresa
    AND descripcion LIKE N'%brava%';

  -- RECOMENDADO: ubicaciones como COLUMNAS (cantidad por ubicación):
  EXEC dbo.sp_CatalogoVentaProductoUbicacionesPivot
    @idEmpresa = 'TU-GUID-EMPRESA';

  -- Misma empresa, una sucursal y filtro de texto:
  EXEC dbo.sp_CatalogoVentaProductoUbicacionesPivot
    @idEmpresa = 'TU-GUID-EMPRESA',
    @idSucursal = 'TU-GUID-SUCURSAL',
    @termino = N'gloss';

  -- Detalle ubicaciones de un producto (como el popup del ojo):
  SELECT *
  FROM dbo.vw_CatalogoVentaStockUbicacion
  WHERE idEmpresa = @idEmpresa
    AND idSucursal = @idSucursal
    AND idProducto = @idProducto
  ORDER BY prioridad, idUbicacion;

  Nota: la fila "Sin ubicación asignada (solo en lotes)" del API se calcula en Node cuando
  SUM(Lotes.cantidadDisponible) > SUM(LotesUbicacion.cantidad). No está en la vista.

  -- Igual que GET /productos/:id/stock-ubicaciones (popup ojo en modal ventas):
  DECLARE @idEmpresa UNIQUEIDENTIFIER = '...';
  DECLARE @idSucursal UNIQUEIDENTIFIER = '...';
  DECLARE @idProducto UNIQUEIDENTIFIER = '...';

  SELECT
    up.idUbicacion,
    RTRIM(LTRIM(ISNULL(up.codigoUbicacion, N''))) AS codigoUbicacion,
    up.prioridad,
    CAST(ISNULL(SUM(lu.cantidad), 0) AS DECIMAL(18, 3)) AS cantidad
  FROM dbo.UbicacionesPrioridad up
  LEFT JOIN dbo.Lotes l
    ON l.idSucursal = up.idSucursal
   AND l.idEmpresa = @idEmpresa
   AND l.idProducto = @idProducto
   AND l.cantidadDisponible > 0
  LEFT JOIN dbo.LotesUbicacion lu
    ON lu.idLote = l.idLote
   AND lu.idUbicacion = up.idUbicacion
   AND lu.cantidad > 0
  WHERE up.idSucursal = @idSucursal
  GROUP BY up.idUbicacion, up.codigoUbicacion, up.prioridad
  ORDER BY up.prioridad, up.idUbicacion;
*/
