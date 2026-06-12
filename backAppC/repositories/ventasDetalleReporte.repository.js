const sql = require('mssql');

/**
 * Líneas de venta con cabecera para reporte detallado por comprobante.
 */
exports.listarLineasReporteDetallado = async (pool, opts) => {
  const { idEmpresa, fechaInicio, fechaFin, clienteRucLike, clienteRazonLike } = opts;

  const req = pool.request();
  req.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  req.input('fechaInicio', sql.Date, fechaInicio);
  req.input('fechaFin', sql.Date, fechaFin);

  let whereRuc = '';
  let whereRazon = '';
  if (clienteRucLike) {
    req.input('rucCliLike', sql.NVarChar(20), clienteRucLike);
    whereRuc = 'AND cl.ruc LIKE @rucCliLike';
  }
  if (clienteRazonLike) {
    req.input('razonCliLike', sql.NVarChar(400), clienteRazonLike);
    whereRazon = 'AND cl.rSocial LIKE @razonCliLike';
  }

  const result = await req.query(`
    SELECT
      v.idVenta,
      v.compVenta,
      v.serie,
      v.numero,
      CONVERT(VARCHAR(10), CAST(v.fEmision AS DATE), 103) AS fEmision,
      CAST(v.subtotal AS DECIMAL(18, 2)) AS subTotal,
      CAST(v.igv AS DECIMAL(18, 2)) AS igv,
      CAST(ISNULL(v.descuentos, 0) AS DECIMAL(18, 2)) AS descuentos,
      CAST(v.total AS DECIMAL(18, 2)) AS total,
      cl.ruc,
      cl.rSocial,
      ep.descripcion AS estadoPago,
      ISNULL(comp.nombre, '') AS tipoComprobante,
      RTRIM(LTRIM(ISNULL(comp.codigo, ''))) AS codigoComprobante,
      dv.idDetalle,
      CAST(dv.cantidad AS DECIMAL(18, 3)) AS cantidad,
      CAST(dv.pVenta AS DECIMAL(18, 6)) AS pUnitario,
      CAST(dv.total AS DECIMAL(18, 2)) AS importeLinea,
      ISNULL(p.codigo, '') AS codigo,
      ISNULL(NULLIF(RTRIM(dv.descripcionLinea), ''), p.descripcion) AS producto
    FROM Ventas v
    INNER JOIN DetalleVenta dv ON dv.idVenta = v.idVenta
    INNER JOIN Productos p ON p.idProducto = dv.idProducto AND p.idEmpresa = v.idEmpresa
    INNER JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
    INNER JOIN EstadoPago ep ON ep.idEstadoPago = v.idEstadoPago
    LEFT JOIN Comprobantes comp ON comp.idComprobante = v.idComprobante AND comp.idEmpresa = v.idEmpresa
    WHERE v.idEmpresa = @idEmpresa
      AND ISNULL(v.eliminado, 0) = 0
      AND CAST(v.fEmision AS DATE) >= @fechaInicio
      AND CAST(v.fEmision AS DATE) <= @fechaFin
      ${whereRuc}
      ${whereRazon}
    ORDER BY v.fEmision ASC, v.compVenta ASC, dv.idDetalle ASC
  `);

  return result.recordset || [];
};
