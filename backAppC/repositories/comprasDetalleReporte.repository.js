const sql = require('mssql');

/**
 * Líneas de compra con cabecera para reporte detallado por comprobante.
 */
exports.listarLineasReporteDetallado = async (pool, opts) => {
  const { idEmpresa, fechaInicio, fechaFin, proveedorRucLike, proveedorRazonLike } = opts;

  const req = pool.request();
  req.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  req.input('fechaInicio', sql.Date, fechaInicio);
  req.input('fechaFin', sql.Date, fechaFin);

  let whereRuc = '';
  let whereRazon = '';
  if (proveedorRucLike) {
    req.input('rucProvLike', sql.NVarChar(20), proveedorRucLike);
    whereRuc = 'AND pr.ruc LIKE @rucProvLike';
  }
  if (proveedorRazonLike) {
    req.input('razonProvLike', sql.NVarChar(400), proveedorRazonLike);
    whereRazon = 'AND pr.rSocial LIKE @razonProvLike';
  }

  const result = await req.query(`
    SELECT
      c.idCompra,
      c.compCompra,
      c.serie,
      c.numero,
      CONVERT(VARCHAR(10), CAST(c.fEmision AS DATE), 103) AS fEmision,
      CAST(c.subTotal AS DECIMAL(18, 2)) AS subTotal,
      CAST(c.igv AS DECIMAL(18, 2)) AS igv,
      CAST(ISNULL(c.descuentos, 0) AS DECIMAL(18, 2)) AS descuentos,
      CAST(c.total AS DECIMAL(18, 2)) AS total,
      pr.ruc,
      pr.rSocial,
      ep.descripcion AS estadoPago,
      ISNULL(comp.nombre, '') AS tipoComprobante,
      RTRIM(LTRIM(ISNULL(comp.codigo, ''))) AS codigoComprobante,
      dc.idDetalleCompra,
      CAST(dc.cantidad AS DECIMAL(18, 3)) AS cantidad,
      CAST(dc.pUnitario AS DECIMAL(18, 6)) AS pUnitario,
      CAST(dc.total AS DECIMAL(18, 2)) AS importeLinea,
      ISNULL(p.codigo, '') AS codigo,
      ISNULL(p.descripcion, '') AS producto
    FROM Compras c
    INNER JOIN DetalleCompras dc ON dc.idCompra = c.idCompra AND dc.idEmpresa = c.idEmpresa
    INNER JOIN Productos p ON p.idProducto = dc.idProducto AND p.idEmpresa = dc.idEmpresa
    INNER JOIN Proveedores pr ON pr.idProveedor = c.idProveedor AND pr.idEmpresa = c.idEmpresa
    INNER JOIN EstadoPago ep ON ep.idEstadoPago = c.idEstadoPago
    LEFT JOIN Comprobantes comp ON comp.idComprobante = c.idComprobante AND comp.idEmpresa = c.idEmpresa
    WHERE c.idEmpresa = @idEmpresa
      AND CAST(c.fEmision AS DATE) >= @fechaInicio
      AND CAST(c.fEmision AS DATE) <= @fechaFin
      ${whereRuc}
      ${whereRazon}
    ORDER BY c.fEmision ASC, c.compCompra ASC, dc.idDetalleCompra ASC
  `);

  return result.recordset || [];
};
