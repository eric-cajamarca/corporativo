// repositories/kardex.repository.js
const sql = require('mssql');

/**
 * Obtiene datos para el kardex de un producto en un rango de fechas.
 * Fuentes: Compras (DetalleCompras), Ventas (DetalleVenta), MovimientosInventario.
 * Retorna: producto, saldoInicial (cantidad, pUnitario, importe), filas ordenadas por fecha, totales.
 */
exports.obtenerKardex = async (pool, idEmpresa, idProducto, fechaDesde, fechaHasta) => {
  const req = pool.request();
  req.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  req.input('idProducto', sql.UniqueIdentifier, idProducto);
  req.input('fechaDesde', sql.DateTime, fechaDesde);
  req.input('fechaHasta', sql.DateTime, fechaHasta);

  const [
    productoResult,
    comprasResult,
    ventasResult,
    movResult,
    saldoComprasResult,
    saldoMovEntradaResult,
    saldoVentasResult,
    saldoMovSalidaResult
  ] = await Promise.all([
    pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .query(`
        SELECT idProducto, codigo, descripcion FROM Productos
        WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto
      `),
    pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('fechaDesde', sql.DateTime, fechaDesde)
      .input('fechaHasta', sql.DateTime, fechaHasta)
      .query(`
        SELECT CONVERT(VARCHAR(19), c.fEmision, 120) AS fecha, 'COM' AS tipoMov,
               ISNULL(c.serie,'') + ':' + ISNULL(c.numero,'') AS nroDocum, c.idCompra AS idRef, 'COMPRA' AS tipoRef,
               dc.cantidad AS cantidadEntrada, dc.pUnitario AS pUnitarioEntrada, dc.total AS importeEntrada,
               0 AS cantidadSalida, 0 AS pUnitarioSalida, 0 AS importeSalida
        FROM DetalleCompras dc
        INNER JOIN Compras c ON dc.idCompra = c.idCompra AND c.idEmpresa = dc.idEmpresa
        WHERE dc.idEmpresa = @idEmpresa AND dc.idProducto = @idProducto
          AND c.fEmision >= @fechaDesde AND c.fEmision <= @fechaHasta
      `),
    pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('fechaDesde', sql.DateTime, fechaDesde)
      .input('fechaHasta', sql.DateTime, fechaHasta)
      .query(`
        SELECT CONVERT(VARCHAR(19), v.fEmision, 120) AS fecha, 'VEN' AS tipoMov,
               ISNULL(v.serie,'') + ':' + ISNULL(v.numero,'') AS nroDocum, v.idVenta AS idRef, 'VENTA' AS tipoRef,
               0 AS cantidadEntrada, 0 AS pUnitarioEntrada, 0 AS importeEntrada,
               dv.cantidad AS cantidadSalida, dv.pVenta AS pUnitarioSalida, dv.subtotal AS importeSalida
        FROM DetalleVenta dv
        INNER JOIN Ventas v ON dv.idVenta = v.idVenta
        WHERE v.idEmpresa = @idEmpresa AND dv.idProducto = @idProducto
          AND v.fEmision >= @fechaDesde AND v.fEmision <= @fechaHasta
      `),
    pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('fechaDesde', sql.DateTime, fechaDesde)
      .input('fechaHasta', sql.DateTime, fechaHasta)
      .query(`
        SELECT CONVERT(VARCHAR(19), m.fMovimiento, 120) AS fecha, m.tipoMovimiento AS tipoMov,
               ISNULL(m.docRelacionado,'') AS nroDocum, m.idMovimiento AS idRef, 'MOVIMIENTO' AS tipoRef,
               CASE WHEN m.tipoMovimiento IN ('EN','AJ') THEN m.cantidad ELSE 0 END AS cantidadEntrada,
               ISNULL(m.costoUnitario,0) AS pUnitarioEntrada,
               CASE WHEN m.tipoMovimiento IN ('EN','AJ') THEN m.cantidad * ISNULL(m.costoUnitario,0) ELSE 0 END AS importeEntrada,
               CASE WHEN m.tipoMovimiento = 'SA' THEN m.cantidad ELSE 0 END AS cantidadSalida,
               ISNULL(m.costoUnitario,0) AS pUnitarioSalida,
               CASE WHEN m.tipoMovimiento = 'SA' THEN m.cantidad * ISNULL(m.costoUnitario,0) ELSE 0 END AS importeSalida
        FROM MovimientosInventario m
        WHERE m.idEmpresa = @idEmpresa AND m.idProducto = @idProducto
          AND m.fMovimiento >= @fechaDesde AND m.fMovimiento <= @fechaHasta
      `),
    pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('fechaDesde', sql.DateTime, fechaDesde)
      .query(`
        SELECT ISNULL(SUM(dc.cantidad),0) AS cantidad, ISNULL(SUM(dc.total),0) AS importe
        FROM DetalleCompras dc INNER JOIN Compras c ON dc.idCompra = c.idCompra AND c.idEmpresa = dc.idEmpresa
        WHERE dc.idEmpresa = @idEmpresa AND dc.idProducto = @idProducto AND c.fEmision < @fechaDesde
      `),
    pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('fechaDesde', sql.DateTime, fechaDesde)
      .query(`
        SELECT ISNULL(SUM(m.cantidad),0) AS cantidad, ISNULL(SUM(m.cantidad * ISNULL(m.costoUnitario,0)),0) AS importe
        FROM MovimientosInventario m
        WHERE m.idEmpresa = @idEmpresa AND m.idProducto = @idProducto AND m.tipoMovimiento IN ('EN','AJ') AND m.fMovimiento < @fechaDesde
      `),
    pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('fechaDesde', sql.DateTime, fechaDesde)
      .query(`
        SELECT ISNULL(SUM(dv.cantidad),0) AS cantidad, ISNULL(SUM(dv.subtotal),0) AS importe
        FROM DetalleVenta dv INNER JOIN Ventas v ON dv.idVenta = v.idVenta
        WHERE v.idEmpresa = @idEmpresa AND dv.idProducto = @idProducto AND v.fEmision < @fechaDesde
      `),
    pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('fechaDesde', sql.DateTime, fechaDesde)
      .query(`
        SELECT ISNULL(SUM(m.cantidad),0) AS cantidad, ISNULL(SUM(m.cantidad * ISNULL(m.costoUnitario,0)),0) AS importe
        FROM MovimientosInventario m
        WHERE m.idEmpresa = @idEmpresa AND m.idProducto = @idProducto AND m.tipoMovimiento = 'SA' AND m.fMovimiento < @fechaDesde
      `)
  ]);

  const producto = productoResult.recordset && productoResult.recordset[0] ? productoResult.recordset[0] : null;
  if (!producto) return { producto: null, saldoInicial: null, filas: [], totales: null };

  const sc = saldoComprasResult.recordset && saldoComprasResult.recordset[0] ? saldoComprasResult.recordset[0] : { cantidad: 0, importe: 0 };
  const sme = saldoMovEntradaResult.recordset && saldoMovEntradaResult.recordset[0] ? saldoMovEntradaResult.recordset[0] : { cantidad: 0, importe: 0 };
  const sv = saldoVentasResult.recordset && saldoVentasResult.recordset[0] ? saldoVentasResult.recordset[0] : { cantidad: 0, importe: 0 };
  const sms = saldoMovSalidaResult.recordset && saldoMovSalidaResult.recordset[0] ? saldoMovSalidaResult.recordset[0] : { cantidad: 0, importe: 0 };
  let cantidadIni = (parseFloat(sc.cantidad) || 0) + (parseFloat(sme.cantidad) || 0) - (parseFloat(sv.cantidad) || 0) - (parseFloat(sms.cantidad) || 0);
  let importeIni = (parseFloat(sc.importe) || 0) + (parseFloat(sme.importe) || 0) - (parseFloat(sv.importe) || 0) - (parseFloat(sms.importe) || 0);
  const pUnitarioIni = cantidadIni > 0 ? importeIni / cantidadIni : 0;

  const filasCompras = (comprasResult.recordset || []).map(r => ({
    fecha: r.fecha,
    tipoMov: r.tipoMov,
    nroDocum: r.nroDocum,
    idRef: r.idRef,
    tipoRef: r.tipoRef,
    cantidadEntrada: parseFloat(r.cantidadEntrada) || 0,
    pUnitarioEntrada: parseFloat(r.pUnitarioEntrada) || 0,
    importeEntrada: parseFloat(r.importeEntrada) || 0,
    cantidadSalida: 0,
    pUnitarioSalida: 0,
    importeSalida: 0
  }));
  const filasVentas = (ventasResult.recordset || []).map(r => ({
    fecha: r.fecha,
    tipoMov: r.tipoMov,
    nroDocum: r.nroDocum,
    idRef: r.idRef,
    tipoRef: r.tipoRef,
    cantidadEntrada: 0,
    pUnitarioEntrada: 0,
    importeEntrada: 0,
    cantidadSalida: parseFloat(r.cantidadSalida) || 0,
    pUnitarioSalida: parseFloat(r.pUnitarioSalida) || 0,
    importeSalida: parseFloat(r.importeSalida) || 0
  }));
  const filasMov = (movResult.recordset || []).map(r => ({
    fecha: r.fecha,
    tipoMov: r.tipoMov,
    nroDocum: r.nroDocum,
    idRef: r.idRef,
    tipoRef: r.tipoRef,
    cantidadEntrada: parseFloat(r.cantidadEntrada) || 0,
    pUnitarioEntrada: parseFloat(r.pUnitarioEntrada) || 0,
    importeEntrada: parseFloat(r.importeEntrada) || 0,
    cantidadSalida: parseFloat(r.cantidadSalida) || 0,
    pUnitarioSalida: parseFloat(r.pUnitarioSalida) || 0,
    importeSalida: parseFloat(r.importeSalida) || 0
  }));

  const todas = [...filasCompras, ...filasVentas, ...filasMov].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

  let saldoCant = cantidadIni;
  let saldoImporte = importeIni;
  const filasConSaldo = [];
  for (const f of todas) {
    saldoCant += f.cantidadEntrada - f.cantidadSalida;
    saldoImporte += f.importeEntrada - f.importeSalida;
    const pUnitSaldo = saldoCant > 0 ? saldoImporte / saldoCant : 0;
    filasConSaldo.push({
      ...f,
      saldoCantidad: Math.round(saldoCant * 1000) / 1000,
      saldoPUnitario: Math.round(pUnitSaldo * 100) / 100,
      saldoImporte: Math.round(saldoImporte * 100) / 100
    });
  }

  const totalEntradaCant = todas.reduce((s, f) => s + f.cantidadEntrada, 0);
  const totalEntradaImporte = todas.reduce((s, f) => s + f.importeEntrada, 0);
  const totalSalidaCant = todas.reduce((s, f) => s + f.cantidadSalida, 0);
  const totalSalidaImporte = todas.reduce((s, f) => s + f.importeSalida, 0);

  return {
    producto: {
      idProducto: producto.idProducto,
      codigo: producto.codigo,
      descripcion: producto.descripcion
    },
    saldoInicial: {
      cantidad: cantidadIni,
      pUnitario: pUnitarioIni,
      importe: importeIni
    },
    filas: filasConSaldo,
    totales: {
      totalEntradaCantidad: totalEntradaCant,
      totalEntradaImporte: totalEntradaImporte,
      totalSalidaCantidad: totalSalidaCant,
      totalSalidaImporte: totalSalidaImporte,
      saldoFinalCantidad: saldoCant,
      saldoFinalImporte: saldoImporte
    }
  };
};
