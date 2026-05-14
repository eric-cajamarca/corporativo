const sql = require("mssql");

// exports.obtenerProductosTodosRepo = async (pool, empresa) => {
//   console.log('empresa in repo:', empresa);
//   const result = await pool
//     .request()
//     .input("idEmpresa", sql.UniqueIdentifier, empresa)
//     .query(`
//       SELECT
//           ss.idProducto,
//           p.codigo,
//           c.nombre as categoria,
//           p.descripcion,
//           m.nombre as marca,
//           pr.codigo as codigoPresentacion,
//           pr.descripcion as descripcionPres,
//           ss.idSucursal,
//           s.nombre as sucursal,
//           p.cUnitario,
//           pp.precio,
//           pp.idPrecio,
//           pp.idLista,
//           lp.nombre as nombreLista,  -- Nombre de la lista
//           lp.principal,              -- Si es lista principal
//           ss.cantidad as stock,
//           p.fProduccion,
//           p.fVencimiento
//       FROM StockSucursal ss
//       INNER JOIN Productos p ON ss.idProducto = p.idProducto
//       INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
//       INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
//       INNER JOIN Sucursal s ON ss.idSucursal = s.idSucursal
//       INNER JOIN Marcas m ON p.idMarca = m.idMarca
//       LEFT JOIN PreciosProducto pp ON p.idProducto = pp.idProducto
//       LEFT JOIN ListasPrecio lp ON pp.idLista = lp.idLista  -- Para info de la lista
//       WHERE ss.idEmpresa = @idEmpresa
//         AND (lp.activo = 1 OR lp.activo IS NULL);  -- Solo listas activas
//     `);

//   return result.recordset;
// };
const construirInClause = (request, ids, prefijo) => {
  const params = [];
  (ids || []).forEach((id, index) => {
    const key = `${prefijo}${index}`;
    request.input(key, sql.UniqueIdentifier, id);
    params.push(`@${key}`);
  });
  return params.length > 0 ? params.join(', ') : null;
};

exports.obtenerProductosTodosMultiEmpresaRepo = async (pool, idsEmpresa, idsSucursalesFiltro = null) => {
  try {
    const ids = (idsEmpresa || []).filter(Boolean);
    if (ids.length === 0) return [];
    // Primero, obtener productos básicos
    const request = pool.request();
    const inClause = construirInClause(request, ids, 'idEmpresa');
    const sucFilt = (idsSucursalesFiltro || []).filter(Boolean);
    const inSucClause = sucFilt.length > 0 ? construirInClause(request, sucFilt, 'idSuc') : null;
    const filtroSucursalSql = inSucClause ? ` AND ss.idSucursal IN (${inSucClause}) ` : '';
    /*
      Productos sin lotes: si hay filtro por sucursales de usuario, un CROSS APPLY estricto puede devolver 0 filas
      (p. ej. asignación desalineada) y el producto desaparece del listado. Se usa OUTER APPLY filtrado + fallback principal.
    */
    const applySucursalSinLotes = inSucClause
      ? `OUTER APPLY (
          SELECT TOP 1 su.idSucursal AS idSucursal
          FROM Sucursal su
          WHERE su.idEmpresa = p.idEmpresa
            AND ISNULL(su.estado, 1) = 1
            AND su.idSucursal IN (${inSucClause})
          ORDER BY su.nombre
        ) defFilt
        OUTER APPLY (
          SELECT TOP 1 su.idSucursal AS idSucursal
          FROM Sucursal su
          WHERE su.idEmpresa = p.idEmpresa
            AND ISNULL(su.estado, 1) = 1
          ORDER BY CASE WHEN ISNULL(su.esPrincipal, 0) = 1 THEN 0 ELSE 1 END, su.nombre
        ) defFb`
      : `CROSS APPLY (
          SELECT TOP 1 su.idSucursal AS idSucursal
          FROM Sucursal su
          WHERE su.idEmpresa = p.idEmpresa
            AND ISNULL(su.estado, 1) = 1
          ORDER BY CASE WHEN ISNULL(su.esPrincipal, 0) = 1 THEN 0 ELSE 1 END, su.nombre
        ) defFb`;
    const idSucursalSinLotesExpr = inSucClause
      ? 'COALESCE(defFilt.idSucursal, defFb.idSucursal)'
      : 'defFb.idSucursal';
    const result = await request.query(`
        SELECT 
            ss.idProducto,
            ss.idEmpresa,
            p.codigo,
            p.idCategoria,
            c.nombre as categoria,
            p.descripcion,
            ISNULL(p.permiteDescripcionEnVenta, 0) AS permiteDescripcionEnVenta,
            p.idMarca,
            m.nombre as marca,
            p.idPresentacion,
            pr.codigo as codigoPresentacion,
            pr.descripcion as descripcionPres,
            ss.idSucursal,
            s.nombre as sucursal,
            p.cUnitario,
            ss.cantidad as stock,
            p.tipoProducto,
            p.fProduccion,
            p.fVencimiento,
            p.estado,
            ISNULL(e.alias, e.nombreComercial) as aliasEmpresa,
            e.razon_Social as razonSocialEmpresa
        FROM (
          SELECT idEmpresa, idSucursal, idProducto, SUM(cantidadDisponible) AS cantidad
          FROM Lotes
          GROUP BY idEmpresa, idSucursal, idProducto
        ) ss
        INNER JOIN Productos p ON ss.idProducto = p.idProducto
        INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
        INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
        INNER JOIN Sucursal s ON ss.idSucursal = s.idSucursal AND ISNULL(s.estado, 1) = 1
        INNER JOIN Marcas m ON p.idMarca = m.idMarca
        INNER JOIN Empresas e ON ss.idEmpresa = e.idEmpresa
        WHERE ss.idEmpresa IN (${inClause}) ${filtroSucursalSql}

        UNION ALL

        SELECT 
            p.idProducto,
            p.idEmpresa,
            p.codigo,
            p.idCategoria,
            c2.nombre as categoria,
            p.descripcion,
            ISNULL(p.permiteDescripcionEnVenta, 0) AS permiteDescripcionEnVenta,
            p.idMarca,
            m2.nombre as marca,
            p.idPresentacion,
            pr2.codigo as codigoPresentacion,
            pr2.descripcion as descripcionPres,
            ${idSucursalSinLotesExpr} AS idSucursal,
            s2.nombre as sucursal,
            p.cUnitario,
            CAST(0 AS DECIMAL(18, 3)) AS stock,
            p.tipoProducto,
            p.fProduccion,
            p.fVencimiento,
            p.estado,
            ISNULL(e2.alias, e2.nombreComercial) as aliasEmpresa,
            e2.razon_Social as razonSocialEmpresa
        FROM Productos p
        INNER JOIN Categorias c2 ON p.idCategoria = c2.idCategoria
        INNER JOIN Presentacion pr2 ON p.idPresentacion = pr2.idPresentacion
        INNER JOIN Marcas m2 ON p.idMarca = m2.idMarca
        INNER JOIN Empresas e2 ON p.idEmpresa = e2.idEmpresa
        ${applySucursalSinLotes}
        INNER JOIN Sucursal s2 ON s2.idSucursal = ${idSucursalSinLotesExpr} AND ISNULL(s2.estado, 1) = 1
        WHERE p.idEmpresa IN (${inClause})
        AND NOT EXISTS (
          SELECT 1 FROM Lotes l
          WHERE l.idProducto = p.idProducto AND l.idEmpresa = p.idEmpresa
        )
      `);

    // Obtener precios por separado
    const preciosRequest = pool.request();
    const inClausePrecios = construirInClause(preciosRequest, ids, 'idEmpresaPrecio');
    const preciosResult = await preciosRequest.query(`
        SELECT 
            pp.idProducto,
            pp.idLista,
            pp.precio,
            pp.idPrecio,
            pp.fActualizacion,
            lp.nombre as nombreLista,
            lp.principal,
            m.simbolo as simboloMoneda
            
        FROM PreciosProducto pp
        INNER JOIN ListasPrecio lp ON pp.idLista = lp.idLista
        INNER JOIN Moneda m ON lp.idMoneda = m.idMoneda
        INNER JOIN Productos p ON pp.idProducto = p.idProducto
        WHERE p.idEmpresa IN (${inClausePrecios})
        AND lp.activo = 1
      `);

    // Crear mapa de precios
    const preciosMap = {};
    preciosResult.recordset.forEach(precio => {
      if (!preciosMap[precio.idProducto]) {
        preciosMap[precio.idProducto] = {};
      }
      preciosMap[precio.idProducto][precio.idLista] = {
        precio: precio.precio,
        idPrecio: precio.idPrecio,
        nombreLista: precio.nombreLista,
        principal: precio.principal,
        simboloMoneda: precio.simboloMoneda,
        fActualizacion: precio.fActualizacion

      };
      
    });

     // Combinar productos con precios
    const productos = result.recordset.map((producto) => {
      // Obtener precios del producto actual
      const preciosProducto = preciosMap[producto.idProducto] || {};
      
      // Buscar el precio principal (donde principal = true)
      const precioPrincipal = Object.values(preciosProducto).find(
        (p) => p.principal === true
      );

      return {
        idProducto: producto.idProducto,
        idEmpresa: producto.idEmpresa,
        codigo: producto.codigo,
        idCategoria: producto.idCategoria,
        categoria: producto.categoria,
        descripcion: producto.descripcion,
        permiteDescripcionEnVenta: !!(producto.permiteDescripcionEnVenta === true || producto.permiteDescripcionEnVenta === 1),
        idMarca: producto.idMarca,
        marca: producto.marca,
        idPresentacion: producto.idPresentacion,
        codigoPresentacion: producto.codigoPresentacion,
        descripcionPres: producto.descripcionPres,
        idSucursal: producto.idSucursal,
        sucursal: producto.sucursal,
        cUnitario: producto.cUnitario,
        pVenta: precioPrincipal ? precioPrincipal.precio:0,
        stock: producto.stock,
        tipoProducto: producto.tipoProducto,
        fProduccion: producto.fProduccion,
        fVencimiento: producto.fVencimiento,
        estado: !!(producto.estado === true || producto.estado === 1),
        precios: preciosProducto,
        aliasEmpresa: producto.aliasEmpresa || '',
        razonSocialEmpresa: producto.razonSocialEmpresa || '',
      };
    });   // Encontrar el precio principal (normal)
   

    // Combinar productos con precios
    // const productos = result.recordset.map((producto) => ({
    //   idProducto: producto.idProducto,
    //   codigo: producto.codigo,
    //   categoria: producto.categoria,
    //   descripcion: producto.descripcion,
    //   marca: producto.marca,
    //   codigoPresentacion: producto.codigoPresentacion,
    //   descripcionPres: producto.descripcionPres,
    //   idSucursal: producto.idSucursal,
    //   sucursal: producto.sucursal,
    //   cUnitario: producto.cUnitario,
    //   pVenta: precioNormal ? precioNormal.precio : null,
    //   stock: producto.stock,
    //   tipoProducto: producto.tipoProducto,
    //   fProduccion: producto.fProduccion,
    //   fVencimiento: producto.fVencimiento,
    //   precios: preciosMap[producto.idProducto] || {}
    // }));

    return productos;
  } catch (error) {
    throw new Error(`Repository Error: ${error.message}`);
  }
};
// exports.obtenerProductosTodosRepo = async (pool, idEmpresa) => {
//   try {
//     const result = await pool
//       .request()
//       .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
//       .query(`
//         SELECT 
//             ss.idProducto,
//             p.codigo,
//             c.nombre as categoria,
//             p.descripcion,
//             m.nombre as marca,
//             pr.codigo as codigoPresentacion,
//             pr.descripcion as descripcionPres,
//             ss.idSucursal,
//             s.nombre as sucursal,
//             p.cUnitario,
//             (
//                 SELECT 
//                     pp.idLista,
//                     pp.precio,
//                     pp.idPrecio,
//                     lp.nombre as nombreLista,
//                     lp.principal,
//                     m2.simbolo as simboloMoneda
//                 FROM PreciosProducto pp
//                 INNER JOIN ListasPrecio lp ON pp.idLista = lp.idLista
//                 INNER JOIN Moneda m2 ON lp.idMoneda = m2.idMoneda
//                 WHERE pp.idProducto = p.idProducto
//                 AND lp.activo = 1
//                 FOR JSON PATH
//             ) as preciosJson,
//             ss.cantidad as stock,
//             p.fProduccion,
//             p.fVencimiento
//         FROM StockSucursal ss
//         INNER JOIN Productos p ON ss.idProducto = p.idProducto
//         INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
//         INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
//         INNER JOIN Sucursal s ON ss.idSucursal = s.idSucursal
//         INNER JOIN Marcas m ON p.idMarca = m.idMarca
//         WHERE ss.idEmpresa = @idEmpresa
//       `);

//     // Procesar resultados
//     const productos = result.recordset.map((producto) => ({
//       idProducto: producto.idProducto,
//       codigo: producto.codigo,
//       categoria: producto.categoria,
//       descripcion: producto.descripcion,
//       marca: producto.marca,
//       codigoPresentacion: producto.codigoPresentacion,
//       descripcionPres: producto.descripcionPres,
//       idSucursal: producto.idSucursal,
//       sucursal: producto.sucursal,
//       cUnitario: producto.cUnitario,
//       stock: producto.stock,
//       fProduccion: producto.fProduccion,
//       fVencimiento: producto.fVencimiento,
      
//       // Convertir JSON a objeto y crear mapa rápido
//       precios: producto.preciosJson
//         ? JSON.parse(producto.preciosJson).reduce((map, precio) => {
//             map[precio.idLista] = {
//               precio: precio.precio,
//               idPrecio: precio.idPrecio,
//               nombreLista: precio.nombreLista,
//               principal: precio.principal,
//               simboloMoneda: precio.simboloMoneda,
//             };
//             return map;
//           }, {})
//         : {},
//     }));

//     console.log('Productos obtenidos en repo:', productos.length);

//     return productos;
//   } catch (error) {
//     throw new Error(`Repository Error: ${error.message}`);
//   }
// };

exports.obtenerProductosCompras = async (pool, idEmpresa, idsSucursalesFiltro = null) => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'08e109'},body:JSON.stringify({sessionId:'08e109',location:'productos.repository.js:obtenerProductosCompras:entry',message:'pool at entry',data:{poolConnected:pool?.connected},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    // Primero, obtener productos básicos (obtenerProductosCompras)
    const reqCompras = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    let filtroSucCompras = '';
    const sf = (idsSucursalesFiltro || []).filter(Boolean);
    if (sf.length > 0) {
      const ph = sf.map((id, i) => {
        const k = `idSucComp${i}`;
        reqCompras.input(k, sql.UniqueIdentifier, id);
        return `@${k}`;
      });
      filtroSucCompras = ` AND ss.idSucursal IN (${ph.join(', ')}) `;
    }
    const result = await reqCompras.query(`
        SELECT 
            ss.idProducto,
            p.codigo,
            c.nombre as categoria,
            p.idCategoria,            
            p.descripcion,
            p.idMarca,
            m.nombre as marca,
            p.idPresentacion,
            pr.codigo as codigoPresentacion,
            pr.descripcion as descripcionPres,
            ss.idSucursal,
            s.nombre as sucursal,
            p.cUnitario,
            ss.cantidad as stock,
            p.fProduccion,
            p.fVencimiento
        FROM (SELECT idEmpresa, idSucursal, idProducto, SUM(cantidadDisponible) AS cantidad FROM Lotes GROUP BY idEmpresa, idSucursal, idProducto) ss
        INNER JOIN Productos p ON ss.idProducto = p.idProducto
        INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
        INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
        INNER JOIN Sucursal s ON ss.idSucursal = s.idSucursal AND ISNULL(s.estado, 1) = 1
        INNER JOIN Marcas m ON p.idMarca = m.idMarca
        WHERE ss.idEmpresa = @idEmpresa ${filtroSucCompras}
      `);

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'08e109'},body:JSON.stringify({sessionId:'08e109',location:'productos.repository.js:obtenerProductosCompras:beforeSecondRequest',message:'pool before second request',data:{poolConnected:pool?.connected},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    // Obtener precios por separado
    const preciosResult = await pool
      .request()
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT 
            pp.idProducto,
            pp.idLista,
            pp.precio,
            pp.idPrecio,
            pp.fActualizacion,
            lp.nombre as nombreLista,
            lp.principal,
            m.simbolo as simboloMoneda
            
        FROM PreciosProducto pp
        INNER JOIN ListasPrecio lp ON pp.idLista = lp.idLista
        INNER JOIN Moneda m ON lp.idMoneda = m.idMoneda
        INNER JOIN Productos p ON pp.idProducto = p.idProducto
        WHERE p.idEmpresa = @idEmpresa
        AND lp.activo = 1
      `);

    // Crear mapa de precios
    const preciosMap = {};
    preciosResult.recordset.forEach(precio => {
      if (!preciosMap[precio.idProducto]) {
        preciosMap[precio.idProducto] = {};
      }
      preciosMap[precio.idProducto][precio.idLista] = {
        precio: precio.precio,
        idPrecio: precio.idPrecio,
        nombreLista: precio.nombreLista,
        principal: precio.principal,
        simboloMoneda: precio.simboloMoneda,
        fActualizacion: precio.fActualizacion

      };
      
    });

     // Combinar productos con precios
    const productos = result.recordset.map((producto) => {
      // Obtener precios del producto actual
      const preciosProducto = preciosMap[producto.idProducto] || {};
      
      // Buscar el precio principal (donde principal = true)
      const precioPrincipal = Object.values(preciosProducto).find(
        (p) => p.principal === true
      );

      return {
        idProducto: producto.idProducto,
        codigo: producto.codigo,
        idCategoria: producto.idCategoria,
        categoria: producto.categoria,
        descripcion: producto.descripcion,
        idMarca: producto.idMarca,
        marca: producto.marca,
        idPresentacion: producto.idPresentacion,
        codigoPresentacion: producto.codigoPresentacion,
        descripcionPres: producto.descripcionPres,
        idSucursal: producto.idSucursal,
        sucursal: producto.sucursal,
        cUnitario: producto.cUnitario,
        pVenta: precioPrincipal ? precioPrincipal.precio:0, // ← AQUÍ ESTÁ LA CORRECCIÓN
        stock: producto.stock,
        tipoProducto: producto.tipoProducto,
        fProduccion: producto.fProduccion,
        fVencimiento: producto.fVencimiento,
        // precios: preciosProducto,
      };
    });   // Encontrar el precio principal (normal)

    
    return productos;
  } catch (error) {
    throw new Error(`Repository Error: ${error.message}`);
  }
};

exports.obtenerProductoPorIdRepo = async (pool, idProducto, idEmpresa) => {
  try {
    // SIEMPRE usa sql.UniqueIdentifier para UUIDs (regla 1.4)
    const result = await pool
      .request()
      .input("idProducto", sql.UniqueIdentifier, idProducto)
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT
          p.idProducto,
          p.Codigo,
          p.descripcion,
          ISNULL(p.permiteDescripcionEnVenta, 0) AS permiteDescripcionEnVenta,
          p.idCategoria,
          p.idMarca,
          p.idPresentacion,
          p.tipoProducto,
          p.cUnitario,
          p.fProduccion,
          p.fVencimiento,
          p.vecesVendidas,
          p.facturar,
          c.nombre as categoria,
          m.nombre as marca,
          pr.codigo as codigoPresentacion,
          pr.descripcion as presentacion,
          p.estado,
          p.alertaMinimo,
          p.alertaMaximo,
          CONVERT(VARCHAR(19), p.FIngreso, 120) as fechaIngreso,
          CONVERT(VARCHAR(19), p.fProduccion, 120) as fechaProduccion,
          CONVERT(VARCHAR(19), p.fVencimiento, 120) as fechaVencimiento
        FROM Productos p
        INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
        INNER JOIN Marcas m ON p.idMarca = m.idMarca
        INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
        WHERE p.idProducto = @idProducto
        AND p.idEmpresa = @idEmpresa
      `);

    // NUNCA retornes fechas sin formatear (regla 1.4)
    if (result.recordset.length > 0) {
      const producto = result.recordset[0];
      return producto;
    }

    return null;
  } catch (error) {
    throw new Error(`Repository Error: ${error.message}`);
  }
};

/** idEmpresa dueña del registro de producto (clave idProducto). */
exports.obtenerIdEmpresaProductoPorId = async (pool, idProducto) => {
  try {
    const result = await pool
      .request()
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .query('SELECT idEmpresa FROM Productos WHERE idProducto = @idProducto');
    return result.recordset?.[0]?.idEmpresa ?? null;
  } catch (error) {
    throw new Error(`Repository Error: ${error.message}`);
  }
};

/**
 * Obtiene idProducto por cada descripción que coincida exactamente (trim, misma empresa).
 * Retorna array { descripcion, idProducto } para usar en compras al cargar XML.
 */
exports.obtenerProductosPorDescripcionRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT idProducto, LTRIM(RTRIM(descripcion)) AS descripcion
      FROM Productos
      WHERE idEmpresa = @idEmpresa AND descripcion IS NOT NULL
    `);
  return result.recordset || [];
};

/** Productos con presentación Servicios código ZZ (habitaciones para hotel). */
exports.obtenerProductosHabitacionRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("codigoPresentacion", sql.VarChar(10), "ZZ")
    .query(`
      SELECT p.idProducto, p.codigo, p.descripcion, pr.codigo AS codigoPresentacion
      FROM Productos p
      INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
      WHERE p.idEmpresa = @idEmpresa AND pr.codigo = @codigoPresentacion
      ORDER BY p.codigo
    `);
  return result.recordset || [];
};

exports.buscarIdUsuarioEnEmpresa = async (pool, idUsuario, idEmpresa) => {
  const r = await pool
    .request()
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT idUsuario FROM UsuarioWeb WHERE idUsuario = @idUsuario AND idEmpresa = @idEmpresa');
  return r.recordset?.[0]?.idUsuario ?? null;
};

exports.buscarPrimerIdUsuarioEmpresa = async (pool, idEmpresa) => {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT TOP 1 idUsuario FROM UsuarioWeb WHERE idEmpresa = @idEmpresa');
  return r.recordset?.[0]?.idUsuario ?? null;
};

exports.incrementarCorrelativo = async (transaction, idEmpresa) => {
  return transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      UPDATE Correlativos WITH (UPDLOCK, HOLDLOCK)
      SET numero = numero + 1
      OUTPUT INSERTED.numero
      WHERE idEmpresa = @idEmpresa
    `);
};

exports.obtenerSiguienteCodigoProductoFallback = async (transaction, idEmpresa) => {
  return transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT ISNULL(MAX(TRY_CAST(RTRIM(LTRIM(Codigo)) AS INT)), 10000) + 1 AS siguiente
      FROM Productos WITH (UPDLOCK, HOLDLOCK)
      WHERE idEmpresa = @idEmpresa
    `);
};

exports.contarProductoPorCodigo = async (transaction, idEmpresa, codigo) => {
  return transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('Codigo', sql.VarChar(50), codigo)
    .query(`
      SELECT COUNT(1) AS n
      FROM Productos
      WHERE idEmpresa = @idEmpresa
        AND RTRIM(LTRIM(Codigo)) = @Codigo
    `);
};

exports.insertarProducto = async (transaction, row) => {
  return transaction
    .request()
    .input('idProducto', sql.UniqueIdentifier, row.idProducto)
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('Codigo', sql.VarChar, row.Codigo)
    .input('idCategoria', sql.Int, row.idCategoria)
    .input('descripcion', sql.VarChar, row.descripcion)
    .input('idMarca', sql.Int, row.idMarca)
    .input('idPresentacion', sql.Int, row.idPresentacion)
    .input('cUnitario', sql.Decimal(18, 5), row.cUnitario)
    .input('fProduccion', sql.VarChar, row.fProduccion)
    .input('fVencimiento', sql.VarChar, row.fVencimiento)
    .input('alertaMinimo', sql.Decimal(18, 2), row.alertaMinimo)
    .input('alertaMaximo', sql.Decimal(18, 2), row.alertaMaximo)
    .input('VecesVendidas', sql.Int, row.VecesVendidas)
    .input('facturar', sql.VarChar, row.facturar)
    .input('idUsuario', sql.UniqueIdentifier, row.idUsuario)
    .input('FIngreso', sql.DateTime, row.FIngreso)
    .input('estado', sql.Bit, row.estado)
    .input('tipoProducto', sql.Char(1), row.tipoProducto)
    .input('permiteDescripcionEnVenta', sql.Bit, row.permiteDescripcionEnVenta ? 1 : 0)
    .query(
      'INSERT INTO Productos (idProducto, idEmpresa, Codigo, idCategoria, descripcion, idMarca, idPresentacion, cUnitario, fProduccion, fVencimiento, alertaMinimo, alertaMaximo, VecesVendidas, facturar, idUsuario, FIngreso, estado, tipoProducto, permiteDescripcionEnVenta) VALUES (@idProducto, @idEmpresa, @Codigo, @idCategoria, @descripcion, @idMarca, @idPresentacion, @cUnitario, @fProduccion, @fVencimiento, @alertaMinimo, @alertaMaximo, @VecesVendidas, @facturar, @idUsuario, @FIngreso, @estado, @tipoProducto, @permiteDescripcionEnVenta)'
    );
};

exports.insertarLoteInicial = async (transaction, row) => {
  return transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, row.idProducto)
    .input('idSucursal', sql.UniqueIdentifier, row.idSucursal)
    .input('costoUnitario', sql.Decimal(18, 6), row.costoUnitario)
    .input('cantidadIngresada', sql.Decimal(18, 2), row.cantidadIngresada)
    .input('cantidadDisponible', sql.Decimal(18, 2), row.cantidadDisponible)
    .query(
      'INSERT INTO Lotes (idLote, idEmpresa, idProducto, idSucursal, costoUnitario, cantidadIngresada, cantidadDisponible) VALUES (NEWID(), @idEmpresa, @idProducto, @idSucursal, @costoUnitario, @cantidadIngresada, @cantidadDisponible)'
    );
};

exports.actualizarProductoCompra = async (pool, detalle) => {
  return pool
    .request()
    .input('idProducto', sql.UniqueIdentifier, detalle.idProducto)
    .input('idEmpresa', sql.UniqueIdentifier, detalle.idEmpresa)
    .input('Codigo', sql.VarChar, detalle.Codigo)
    .input('idCategoria', sql.Int, detalle.idCategoria)
    .input('descripcion', sql.VarChar, detalle.descripcion)
    .input('idMarca', sql.Int, detalle.idMarca)
    .input('idPresentacion', sql.Int, detalle.idPresentacion)
    .input('cUnitario', sql.Decimal(18, 5), detalle.cUnitario)
    .input('fProduccion', sql.VarChar, detalle.fProduccion)
    .input('fVencimiento', sql.VarChar, detalle.fVencimiento)
    .query(
      'UPDATE Productos SET Codigo = @Codigo, idCategoria = @idCategoria, descripcion = @descripcion, idPresentacion = @idPresentacion, cUnitario = @cUnitario, fProduccion = @fProduccion, fVencimiento = @fVencimiento WHERE idProducto = @idProducto AND idEmpresa = @idEmpresa'
    );
};

exports.insertarProductoCompraValores = async (transaction, detalle) => {
  return transaction
    .request()
    .input('idProducto', sql.UniqueIdentifier, detalle.idProducto)
    .input('idEmpresa', sql.UniqueIdentifier, detalle.idEmpresa)
    .input('Codigo', sql.VarChar, detalle.Codigo)
    .input('idCategoria', sql.Int, detalle.idCategoria)
    .input('descripcion', sql.VarChar, detalle.descripcion)
    .input('idMarca', sql.Int, detalle.idMarca)
    .input('idPresentacion', sql.Int, detalle.idPresentacion)
    .input('cUnitario', sql.Decimal(18, 5), detalle.cUnitario)
    .input('fProduccion', sql.VarChar, detalle.fProduccion)
    .input('fVencimiento', sql.VarChar, detalle.fVencimiento)
    .input('alertaMinimo', sql.Decimal, detalle.alertaMinimo)
    .input('alertaMaximo', sql.Decimal, detalle.alertaMaximo)
    .input('VecesVendidas', sql.Int, detalle.VecesVendidas)
    .input('facturar', sql.VarChar, detalle.facturar)
    .input('idUsuario', sql.UniqueIdentifier, detalle.idUsuario)
    .input('FIngreso', sql.DateTime, detalle.FIngreso)
    .input('estado', sql.Bit, detalle.estado)
    .query(
      'INSERT INTO Productos VALUES (@idProducto, @idEmpresa, @Codigo, @idCategoria, @descripcion, @idMarca, @idPresentacion, @cUnitario, @fProduccion, @fVencimiento, @alertaMinimo, @alertaMaximo, @VecesVendidas, @facturar, @idUsuario, @FIngreso, @estado)'
    );
};

/**
 * Cuenta líneas en ventas o compras que impiden borrar el producto (integridad documental).
 * @param {import('mssql').Transaction} transaction
 */
exports.contarLineasHistoricasVentasCompras = async (transaction, idProducto, idEmpresa) => {
  const r = await transaction
    .request()
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        ISNULL((
          SELECT COUNT_BIG(1) FROM DetalleVenta dv
          INNER JOIN Ventas v ON v.idVenta = dv.idVenta
          WHERE dv.idProducto = @idProducto AND v.idEmpresa = @idEmpresa
        ), 0)
        + ISNULL((
          SELECT COUNT_BIG(1) FROM DetalleCompras dc
          INNER JOIN Compras c ON c.idCompra = dc.idCompra AND c.idEmpresa = dc.idEmpresa
          WHERE dc.idProducto = @idProducto AND c.idEmpresa = @idEmpresa
        ), 0) AS n
    `);
  return Number(r.recordset[0]?.n || 0);
};

/**
 * Elimina dependencias de inventario/precios/etc. No borra Productos ni valida ventas/compras.
 * @param {import('mssql').Transaction} transaction
 */
exports.eliminarFilasRelacionadasProducto = async (transaction, idProducto, idEmpresa) => {
  const exec = (sql) =>
    transaction
      .request()
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(sql);

  await exec(`
    IF OBJECT_ID('dbo.ConsumoHabitacion','U') IS NOT NULL
      DELETE FROM dbo.ConsumoHabitacion WHERE idEmpresa = @idEmpresa AND (idProducto = @idProducto OR idProductoHabitacion = @idProducto);
  `);
  await exec(`
    IF OBJECT_ID('dbo.Tanques','U') IS NOT NULL
      DELETE FROM dbo.Tanques WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto;
  `);
  await exec(`
    IF OBJECT_ID('dbo.InventarioFisicoLinea','U') IS NOT NULL
      DELETE FROM dbo.InventarioFisicoLinea WHERE idProducto = @idProducto;
  `);
  await exec(`
    IF OBJECT_ID('dbo.DetalleValeDespacho','U') IS NOT NULL
      DELETE FROM dbo.DetalleValeDespacho WHERE idProducto = @idProducto;
  `);
  await exec(`
    IF OBJECT_ID('dbo.DetalleCotizacion','U') IS NOT NULL AND COL_LENGTH('dbo.DetalleCotizacion','idProducto') IS NOT NULL
      DELETE FROM dbo.DetalleCotizacion WHERE idProducto = @idProducto;
  `);
  await exec(`
    IF OBJECT_ID('dbo.Reservas','U') IS NOT NULL AND COL_LENGTH('dbo.Reservas', 'idProductoHabitacion') IS NOT NULL
      UPDATE dbo.Reservas SET idProductoHabitacion = NULL WHERE idProductoHabitacion = @idProducto;
  `);
  await exec(`DELETE FROM DetalleDespachos WHERE idProducto = @idProducto;`);
  await exec(`DELETE FROM ProductosCompuestos WHERE idProductoHijo = @idProducto;`);
  await exec(`DELETE FROM ProductosCompuestos WHERE idProductoPadre = @idProducto;`);
  await exec(`
    IF OBJECT_ID('dbo.VarianteAtributos','U') IS NOT NULL AND OBJECT_ID('dbo.VariantesProducto','U') IS NOT NULL
      DELETE va FROM dbo.VarianteAtributos va
      INNER JOIN dbo.VariantesProducto vp ON vp.idVariante = va.idVariante
      WHERE vp.idProductoBase = @idProducto;
  `);
  await exec(`
    IF OBJECT_ID('dbo.VariantesProducto','U') IS NOT NULL
      DELETE FROM dbo.VariantesProducto WHERE idProductoBase = @idProducto;
  `);
  await exec(`
    IF OBJECT_ID('dbo.MovimientosDetalle','U') IS NOT NULL
      DELETE md FROM dbo.MovimientosDetalle md
      INNER JOIN dbo.MovimientosInventario m ON m.idMovimiento = md.idMovimiento
      WHERE m.idEmpresa = @idEmpresa AND m.idProducto = @idProducto;
  `);
  await exec(
    `DELETE FROM MovimientosInventario WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto;`
  );
  await exec(`
    IF OBJECT_ID('dbo.LotesUbicacion','U') IS NOT NULL
      DELETE lu FROM dbo.LotesUbicacion lu
      INNER JOIN dbo.Lotes l ON l.idLote = lu.idLote
      WHERE l.idEmpresa = @idEmpresa AND l.idProducto = @idProducto;
  `);
  await exec(`DELETE FROM Lotes WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto;`);
  await exec(`
    IF OBJECT_ID('dbo.StockSucursal','U') IS NOT NULL
      DELETE FROM dbo.StockSucursal WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto;
  `);
  await exec(`DELETE FROM PreciosProducto WHERE idProducto = @idProducto;`);
  await exec(`
    IF OBJECT_ID('dbo.DetalleAsientos','U') IS NOT NULL
      UPDATE dbo.DetalleAsientos SET idProducto = NULL WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto;
  `);
};

/** DELETE de la fila en Productos (usar tras eliminarFilasRelacionadasProducto). Acepta pool o transacción. */
exports.eliminarProductoPorId = async (poolOrTransaction, idProducto, idEmpresa) => {
  return poolOrTransaction
    .request()
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('DELETE FROM Productos WHERE idProducto = @idProducto AND idEmpresa = @idEmpresa');
};

/** Solo cambia el bit estado (catálogo activo/inactivo). */
/**
 * Actualiza solo descripción, categoría y presentación (pantalla conteo físico).
 * Acepta pool o transacción.
 */
exports.actualizarMaestroConteoFisico = async (conn, { idEmpresa, idProducto, descripcion, idCategoria, idPresentacion, idMarca }) => {
  const desc = descripcion != null ? String(descripcion).trim().substring(0, 200) : null;
  if (!desc) {
    throw new Error('La descripción no puede quedar vacía');
  }
  const req = conn
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('descripcion', sql.VarChar(200), desc)
    .input('idCategoria', sql.Int, idCategoria)
    .input('idPresentacion', sql.Int, idPresentacion);
  if (idMarca != null && Number.isInteger(Number(idMarca)) && Number(idMarca) > 0) {
    req.input('idMarca', sql.Int, Number(idMarca));
    return req.query(`
      UPDATE dbo.Productos
      SET descripcion = @descripcion, idCategoria = @idCategoria, idPresentacion = @idPresentacion, idMarca = @idMarca
      WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto AND estado = 1
    `);
  }
  return req.query(`
    UPDATE dbo.Productos
    SET descripcion = @descripcion, idCategoria = @idCategoria, idPresentacion = @idPresentacion
    WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto AND estado = 1
  `);
};

exports.actualizarEstadoProductoPorId = async (pool, idProducto, idEmpresa, estadoActivo) => {
  return pool
    .request()
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('estado', sql.Bit, estadoActivo ? 1 : 0)
    .query(
      'UPDATE Productos SET estado = @estado WHERE idProducto = @idProducto AND idEmpresa = @idEmpresa'
    );
};

exports.actualizarProductoFlexible = async (pool, detalle) => {
  const request = pool
    .request()
    .input('idProducto', sql.UniqueIdentifier, detalle.idProducto)
    .input('idEmpresa', sql.UniqueIdentifier, detalle.idEmpresa)
    .input('Codigo', sql.VarChar, detalle.Codigo)
    .input('idCategoria', sql.Int, detalle.idCategoria)
    .input('descripcion', sql.VarChar, detalle.descripcion)
    .input('idMarca', sql.Int, detalle.idMarca)
    .input('idPresentacion', sql.Int, detalle.idPresentacion)
    .input('cUnitario', sql.Decimal(18, 5), detalle.cUnitario)
    .input('fProduccion', sql.VarChar, detalle.fProduccion)
    .input('fVencimiento', sql.VarChar, detalle.fVencimiento);
  let updateSql =
    'UPDATE Productos SET Codigo = @Codigo, idCategoria = @idCategoria, descripcion = @descripcion, idMarca = @idMarca, idPresentacion = @idPresentacion, cUnitario = @cUnitario, fProduccion = @fProduccion, fVencimiento = @fVencimiento';
  if (detalle.tipoProducto !== undefined) {
    request.input('tipoProducto', sql.Char(1), detalle.tipoProducto);
    updateSql += ', tipoProducto = @tipoProducto';
  }
  if (detalle.alertaMinimo !== undefined) {
    request.input('alertaMinimo', sql.Decimal(18, 2), detalle.alertaMinimo);
    updateSql += ', alertaMinimo = @alertaMinimo';
  }
  if (detalle.alertaMaximo !== undefined) {
    request.input('alertaMaximo', sql.Decimal(18, 2), detalle.alertaMaximo);
    updateSql += ', alertaMaximo = @alertaMaximo';
  }
  if (detalle.estado !== undefined) {
    request.input('estado', sql.Bit, detalle.estado);
    updateSql += ', estado = @estado';
  }
  if (detalle.permiteDescripcionEnVenta !== undefined) {
    request.input('permiteDescripcionEnVenta', sql.Bit, detalle.permiteDescripcionEnVenta);
    updateSql += ', permiteDescripcionEnVenta = @permiteDescripcionEnVenta';
  }
  updateSql += ' WHERE idProducto = @idProducto AND idEmpresa = @idEmpresa';
  return request.query(updateSql);
};

/**
 * Stock por ubicación (LotesUbicacion) de un producto en sucursal. Lista todas las ubicaciones de la sucursal con cantidad (0 si no hay lote).
 */
exports.listarStockUbicacionesProductoSucursal = async (pool, idEmpresa, idSucursal, idProducto) => {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      SELECT
        up.idUbicacion,
        RTRIM(LTRIM(ISNULL(up.codigoUbicacion, ''))) AS codigoUbicacion,
        up.prioridad,
        CAST(ISNULL(SUM(lu.cantidad), 0) AS DECIMAL(18, 3)) AS cantidad
      FROM UbicacionesPrioridad up
      LEFT JOIN Lotes l ON l.idSucursal = up.idSucursal
        AND l.idEmpresa = @idEmpresa
        AND l.idProducto = @idProducto
        AND l.cantidadDisponible > 0
      LEFT JOIN LotesUbicacion lu ON lu.idLote = l.idLote AND lu.idUbicacion = up.idUbicacion AND lu.cantidad > 0
      WHERE up.idSucursal = @idSucursal
      GROUP BY up.idUbicacion, up.codigoUbicacion, up.prioridad
      ORDER BY up.prioridad ASC, up.idUbicacion
    `);
  const rows = (r.recordset || []).map((row) => ({
    idUbicacion: row.idUbicacion != null ? Number(row.idUbicacion) : null,
    codigoUbicacion: row.codigoUbicacion != null ? String(row.codigoUbicacion).trim() : '',
    prioridad: row.prioridad != null ? Number(row.prioridad) : 0,
    cantidad: row.cantidad != null ? Number(row.cantidad) : 0
  }));

  const rTot = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      SELECT CAST(COALESCE(SUM(l.cantidadDisponible), 0) AS DECIMAL(18, 3)) AS totalLotes
      FROM Lotes l
      WHERE l.idEmpresa = @idEmpresa AND l.idSucursal = @idSucursal AND l.idProducto = @idProducto
    `);
  const rLu = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      SELECT CAST(COALESCE(SUM(lu.cantidad), 0) AS DECIMAL(18, 3)) AS totalLu
      FROM LotesUbicacion lu
      INNER JOIN Lotes l ON l.idLote = lu.idLote
      WHERE l.idEmpresa = @idEmpresa AND l.idSucursal = @idSucursal AND l.idProducto = @idProducto
    `);
  const totalLotes = rTot.recordset && rTot.recordset[0] ? Number(rTot.recordset[0].totalLotes) || 0 : 0;
  const totalLu = rLu.recordset && rLu.recordset[0] ? Number(rLu.recordset[0].totalLu) || 0 : 0;
  const diff = totalLotes - totalLu;
  if (diff > 0.0005) {
    rows.push({
      idUbicacion: -1,
      codigoUbicacion: 'Sin ubicación asignada (solo en lotes)',
      prioridad: 999999,
      cantidad: diff,
      esSinUbicacion: true
    });
  }
  return rows;
};