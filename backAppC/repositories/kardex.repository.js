// repositories/kardex.repository.js
const sql = require('mssql');

function ventaExcluidaDeKardex(eliminado, idEstadoSunat) {
  if (eliminado) return true;
  const id = idEstadoSunat != null ? Number(idEstadoSunat) : null;
  return id === 4 || id === 8;
}

function etiquetaEstadoVenta(eliminado, idEstadoSunat) {
  if (eliminado) return 'Anulado';
  const id = idEstadoSunat != null ? Number(idEstadoSunat) : null;
  if (id === 4) return 'Rechazado SUNAT';
  if (id === 8) return 'Baja aceptada';
  return null;
}

/** Ventas vigentes para saldo inicial (no anuladas ni rechazadas). */
const FILTRO_VENTAS_ACTIVAS = `
  AND ISNULL(v.eliminado, 0) = 0
  AND (v.idEstadoSunat IS NULL OR v.idEstadoSunat NOT IN (4, 8))
`;

/** Devoluciones por anulación no forman parte del saldo histórico. */
const FILTRO_EXCLUIR_ANULACION_VENTA = `
  AND NOT (
    m.tipoMovimiento = 'EN'
    AND LTRIM(RTRIM(ISNULL(m.observaciones, ''))) LIKE 'Anulación de venta%'
  )
`;

/**
 * Excluye movimientos de inventario que duplican filas ya tomadas de Ventas/Compras.
 * Una venta genera DetalleVenta (VEN) y además SA en MovimientosInventario; solo debe verse VEN.
 * Una compra genera DetalleCompras (COM) y, si hubiera EN vinculado al mismo documento, solo debe verse COM.
 */
const FILTRO_MOV_INVENTARIO_SIN_DUPLICAR_VENTA_COMPRA = `
  AND NOT (
    m.tipoMovimiento = 'SA'
    AND (
      LTRIM(RTRIM(ISNULL(m.observaciones, ''))) = 'Venta'
      OR EXISTS (
        SELECT 1
        FROM Ventas v
        INNER JOIN DetalleVenta dv ON dv.idVenta = v.idVenta AND dv.idProducto = m.idProducto
        WHERE v.idEmpresa = m.idEmpresa
          AND NULLIF(LTRIM(RTRIM(m.docRelacionado)), '') IS NOT NULL
          AND (
            LTRIM(RTRIM(m.docRelacionado)) = LTRIM(RTRIM(v.compVenta))
            OR LTRIM(RTRIM(m.docRelacionado)) = LTRIM(RTRIM(ISNULL(v.serie, ''))) + ':' + LTRIM(RTRIM(ISNULL(v.numero, '')))
            OR LTRIM(RTRIM(m.docRelacionado)) = LTRIM(RTRIM(ISNULL(v.serie, ''))) + '-' + LTRIM(RTRIM(ISNULL(v.numero, '')))
          )
      )
    )
  )
  AND NOT (
    m.tipoMovimiento IN ('EN', 'AJ')
    AND EXISTS (
      SELECT 1
      FROM Compras c
      INNER JOIN DetalleCompras dc
        ON dc.idCompra = c.idCompra AND dc.idEmpresa = c.idEmpresa AND dc.idProducto = m.idProducto
      WHERE c.idEmpresa = m.idEmpresa
        AND NULLIF(LTRIM(RTRIM(m.docRelacionado)), '') IS NOT NULL
        AND (
          LTRIM(RTRIM(m.docRelacionado)) = LTRIM(RTRIM(c.compCompra))
          OR LTRIM(RTRIM(m.docRelacionado)) = LTRIM(RTRIM(ISNULL(c.serie, ''))) + ':' + LTRIM(RTRIM(ISNULL(c.numero, '')))
          OR LTRIM(RTRIM(m.docRelacionado)) = LTRIM(RTRIM(ISNULL(c.serie, ''))) + '-' + LTRIM(RTRIM(ISNULL(c.numero, '')))
        )
    )
  )
`;

const round3 = (n) => Math.round(n * 1000) / 1000;
const round2 = (n) => Math.round(n * 100) / 100;

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
    saldoMovSalidaResult,
    stockLotesResult
  ] = await Promise.all([
    pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .query(`
        SELECT p.idProducto, p.codigo, p.descripcion,
               ISNULL(pr.codigo, 'NIU') AS unidadMedida,
               ISNULL(pr.descripcion, 'UNIDAD') AS unidadDescripcion
        FROM Productos p
        LEFT JOIN Presentacion pr ON pr.idPresentacion = p.idPresentacion
        WHERE p.idEmpresa = @idEmpresa AND p.idProducto = @idProducto
      `),
    pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('fechaDesde', sql.DateTime, fechaDesde)
      .input('fechaHasta', sql.DateTime, fechaHasta)
      .query(`
        SELECT CONVERT(VARCHAR(19), c.fEmision, 120) AS fecha, 'COM' AS tipoMov,
               ISNULL(c.serie,'') + ':' + ISNULL(c.numero,'') AS nroDocum, c.idCompra AS idRef, 'COMPRA' AS tipoRef,
               ISNULL(c.serie,'') AS serie, ISNULL(c.numero,'') AS numero,
               RTRIM(LTRIM(ISNULL(comp.codigo, '00'))) AS tipoDocumento,
               dc.cantidad AS cantidadEntrada, dc.pUnitario AS pUnitarioEntrada, dc.total AS importeEntrada,
               0 AS cantidadSalida, 0 AS pUnitarioSalida, 0 AS importeSalida,
               0 AS costoUnitarioSalida, 0 AS eliminado, NULL AS idEstadoSunat, NULL AS observaciones
        FROM DetalleCompras dc
        INNER JOIN Compras c ON dc.idCompra = c.idCompra AND c.idEmpresa = dc.idEmpresa
        LEFT JOIN Comprobantes comp ON comp.idComprobante = c.idComprobante AND comp.idEmpresa = c.idEmpresa
        WHERE dc.idEmpresa = @idEmpresa AND dc.idProducto = @idProducto
          AND c.fEmision >= @fechaDesde AND c.fEmision < DATEADD(day, 1, @fechaHasta)
      `),
    pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('fechaDesde', sql.DateTime, fechaDesde)
      .input('fechaHasta', sql.DateTime, fechaHasta)
      .query(`
        SELECT CONVERT(VARCHAR(19), v.fEmision, 120) AS fecha, 'VEN' AS tipoMov,
               ISNULL(v.serie,'') + ':' + ISNULL(v.numero,'') AS nroDocum, v.idVenta AS idRef, 'VENTA' AS tipoRef,
               ISNULL(v.serie,'') AS serie, ISNULL(v.numero,'') AS numero,
               RTRIM(LTRIM(ISNULL(comp.codigo, '00'))) AS tipoDocumento,
               0 AS cantidadEntrada, 0 AS pUnitarioEntrada, 0 AS importeEntrada,
               dv.cantidad AS cantidadSalida, dv.pVenta AS pUnitarioSalida, dv.subtotal AS importeSalida,
               ISNULL(dv.costoUnitario, 0) AS costoUnitarioSalida,
               ISNULL(v.eliminado, 0) AS eliminado, v.idEstadoSunat, NULL AS observaciones
        FROM DetalleVenta dv
        INNER JOIN Ventas v ON dv.idVenta = v.idVenta
        LEFT JOIN Comprobantes comp ON comp.idComprobante = v.idComprobante AND comp.idEmpresa = v.idEmpresa
        WHERE v.idEmpresa = @idEmpresa AND dv.idProducto = @idProducto
          AND v.fEmision >= @fechaDesde AND v.fEmision < DATEADD(day, 1, @fechaHasta)
      `),
    pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('fechaDesde', sql.DateTime, fechaDesde)
      .input('fechaHasta', sql.DateTime, fechaHasta)
      .query(`
        SELECT CONVERT(VARCHAR(19), m.fMovimiento, 120) AS fecha, m.tipoMovimiento AS tipoMov,
               ISNULL(m.docRelacionado,'') AS nroDocum, m.idMovimiento AS idRef, 'MOVIMIENTO' AS tipoRef,
               CAST('' AS VARCHAR(20)) AS serie, ISNULL(m.docRelacionado,'') AS numero,
               '00' AS tipoDocumento,
               CASE WHEN m.tipoMovimiento IN ('EN','AJ') THEN m.cantidad ELSE 0 END AS cantidadEntrada,
               ISNULL(m.costoUnitario,0) AS pUnitarioEntrada,
               CASE WHEN m.tipoMovimiento IN ('EN','AJ') THEN m.cantidad * ISNULL(m.costoUnitario,0) ELSE 0 END AS importeEntrada,
               CASE WHEN m.tipoMovimiento = 'SA' THEN m.cantidad ELSE 0 END AS cantidadSalida,
               ISNULL(m.costoUnitario,0) AS pUnitarioSalida,
               CASE WHEN m.tipoMovimiento = 'SA' THEN m.cantidad * ISNULL(m.costoUnitario,0) ELSE 0 END AS importeSalida,
               ISNULL(m.costoUnitario, 0) AS costoUnitarioSalida,
               0 AS eliminado, NULL AS idEstadoSunat, m.observaciones
        FROM MovimientosInventario m
        WHERE m.idEmpresa = @idEmpresa AND m.idProducto = @idProducto
          AND m.fMovimiento >= @fechaDesde AND m.fMovimiento < DATEADD(day, 1, @fechaHasta)
          ${FILTRO_MOV_INVENTARIO_SIN_DUPLICAR_VENTA_COMPRA}
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
          ${FILTRO_MOV_INVENTARIO_SIN_DUPLICAR_VENTA_COMPRA}
          ${FILTRO_EXCLUIR_ANULACION_VENTA}
      `),
    pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('fechaDesde', sql.DateTime, fechaDesde)
      .query(`
        SELECT ISNULL(SUM(dv.cantidad),0) AS cantidad, ISNULL(SUM(dv.cantidad * ISNULL(dv.costoUnitario, 0)),0) AS importe
        FROM DetalleVenta dv INNER JOIN Ventas v ON dv.idVenta = v.idVenta
        WHERE v.idEmpresa = @idEmpresa AND dv.idProducto = @idProducto AND v.fEmision < @fechaDesde
          ${FILTRO_VENTAS_ACTIVAS}
      `),
    pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('fechaDesde', sql.DateTime, fechaDesde)
      .query(`
        SELECT ISNULL(SUM(m.cantidad),0) AS cantidad, ISNULL(SUM(m.cantidad * ISNULL(m.costoUnitario,0)),0) AS importe
        FROM MovimientosInventario m
        WHERE m.idEmpresa = @idEmpresa AND m.idProducto = @idProducto AND m.tipoMovimiento = 'SA' AND m.fMovimiento < @fechaDesde
          ${FILTRO_MOV_INVENTARIO_SIN_DUPLICAR_VENTA_COMPRA}
      `),
    pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .query(`
        SELECT
          CAST(COALESCE(SUM(l.cantidadDisponible), 0) AS DECIMAL(18, 3)) AS cantidad,
          CAST(COALESCE(SUM(l.cantidadDisponible * l.costoUnitario), 0) AS DECIMAL(18, 6)) AS importe
        FROM Lotes l
        WHERE l.idEmpresa = @idEmpresa AND l.idProducto = @idProducto AND l.cantidadDisponible > 0
      `)
  ]);

  const producto = productoResult.recordset && productoResult.recordset[0] ? productoResult.recordset[0] : null;
  if (!producto) return { producto: null, saldoInicial: null, filas: [], totales: null };

  const sc = saldoComprasResult.recordset && saldoComprasResult.recordset[0] ? saldoComprasResult.recordset[0] : { cantidad: 0, importe: 0 };
  const sme = saldoMovEntradaResult.recordset && saldoMovEntradaResult.recordset[0] ? saldoMovEntradaResult.recordset[0] : { cantidad: 0, importe: 0 };
  const sv = saldoVentasResult.recordset && saldoVentasResult.recordset[0] ? saldoVentasResult.recordset[0] : { cantidad: 0, importe: 0 };
  const sms = saldoMovSalidaResult.recordset && saldoMovSalidaResult.recordset[0] ? saldoMovSalidaResult.recordset[0] : { cantidad: 0, importe: 0 };
  const cantidadIniLedger = (parseFloat(sc.cantidad) || 0) + (parseFloat(sme.cantidad) || 0) - (parseFloat(sv.cantidad) || 0) - (parseFloat(sms.cantidad) || 0);
  const importeIniLedger = (parseFloat(sc.importe) || 0) + (parseFloat(sme.importe) || 0) - (parseFloat(sv.importe) || 0) - (parseFloat(sms.importe) || 0);

  const mapFilaBase = (r) => {
    const eliminado = !!r.eliminado;
    const idEstadoSunat = r.idEstadoSunat != null ? Number(r.idEstadoSunat) : null;
    const obs = r.observaciones != null ? String(r.observaciones).trim() : '';
    const esAnulacionVenta = r.tipoRef === 'MOVIMIENTO' && r.tipoMov === 'EN' && obs.startsWith('Anulación de venta');
    const excluidoVenta = r.tipoRef === 'VENTA' && ventaExcluidaDeKardex(eliminado, idEstadoSunat);
    const excluidoDeTotales = excluidoVenta || esAnulacionVenta;
    let estadoComprobante = null;
    if (excluidoVenta) estadoComprobante = etiquetaEstadoVenta(eliminado, idEstadoSunat);
    else if (esAnulacionVenta) estadoComprobante = 'Devolución por anulación';

    const cantidadEntrada = parseFloat(r.cantidadEntrada) || 0;
    const pUnitarioEntrada = parseFloat(r.pUnitarioEntrada) || 0;
    const cantidadSalida = parseFloat(r.cantidadSalida) || 0;
    const pUnitarioSalida = parseFloat(r.pUnitarioSalida) || 0;
    const costoUnitarioSalida = parseFloat(r.costoUnitarioSalida) || 0;
    const tipoDocumento = r.tipoDocumento != null && String(r.tipoDocumento).trim() !== ''
      ? String(r.tipoDocumento).trim()
      : '00';

    return {
      fecha: r.fecha,
      tipoMov: r.tipoMov,
      nroDocum: r.nroDocum,
      serie: r.serie != null ? String(r.serie).trim() : '',
      numero: r.numero != null ? String(r.numero).trim() : '',
      tipoDocumento,
      idRef: r.idRef,
      tipoRef: r.tipoRef,
      cantidadEntrada,
      pUnitarioEntrada,
      importeEntrada: cantidadEntrada > 0 ? round2(cantidadEntrada * pUnitarioEntrada) : 0,
      cantidadSalida,
      pUnitarioSalida,
      importeSalida: cantidadSalida > 0 ? round2(cantidadSalida * pUnitarioSalida) : 0,
      costoUnitarioSalida,
      excluidoDeTotales,
      estadoComprobante
    };
  };

  const todas = [
    ...(comprasResult.recordset || []).map(mapFilaBase),
    ...(ventasResult.recordset || []).map(mapFilaBase),
    ...(movResult.recordset || []).map(mapFilaBase)
  ].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

  const activas = todas.filter((f) => !f.excluidoDeTotales);
  const totalEntradaCant = activas.reduce((s, f) => s + f.cantidadEntrada, 0);
  const totalSalidaCant = activas.reduce((s, f) => s + f.cantidadSalida, 0);
  const netPeriodo = totalEntradaCant - totalSalidaCant;

  const stockLotesRow = stockLotesResult.recordset && stockLotesResult.recordset[0]
    ? stockLotesResult.recordset[0]
    : { cantidad: 0, importe: 0 };
  const stockLotes = parseFloat(stockLotesRow.cantidad) || 0;
  const stockImporteLotes = parseFloat(stockLotesRow.importe) || 0;
  const costoPromedioLotes = stockLotes > 0 ? stockImporteLotes / stockLotes : 0;

  let cantidadIni = cantidadIniLedger;
  let importeIni = importeIniLedger;
  const saldoFinalLedger = cantidadIniLedger + netPeriodo;
  const diferenciaStock = stockLotes - saldoFinalLedger;
  if (Math.abs(diferenciaStock) > 0.0001) {
    cantidadIni += diferenciaStock;
    importeIni += diferenciaStock * (costoPromedioLotes || (cantidadIniLedger > 0 ? importeIniLedger / cantidadIniLedger : 0));
  }

  let lastPpc = cantidadIni !== 0 ? importeIni / cantidadIni : costoPromedioLotes;
  let saldoCant = cantidadIni;
  let saldoValor = importeIni;

  const pUnitarioIni = cantidadIni !== 0 ? round2(importeIni / cantidadIni) : round2(lastPpc);
  const importeIniFinal = round2(cantidadIni * pUnitarioIni);
  saldoValor = importeIniFinal;
  lastPpc = cantidadIni !== 0 ? importeIniFinal / cantidadIni : lastPpc;

  const filasConSaldo = [];
  let totalSalidaImporteValorizado = 0;
  for (const f of todas) {
    let pUnitarioSalidaValorizado = 0;
    let importeSalidaValorizado = 0;

    if (!f.excluidoDeTotales) {
      if (f.cantidadEntrada > 0) {
        saldoValor += f.cantidadEntrada * f.pUnitarioEntrada;
        saldoCant += f.cantidadEntrada;
      }
      if (f.cantidadSalida > 0) {
        const ppc = saldoCant > 0 ? saldoValor / saldoCant : lastPpc;
        const costoSalida = f.costoUnitarioSalida > 0 ? f.costoUnitarioSalida : ppc;
        pUnitarioSalidaValorizado = round2(costoSalida);
        importeSalidaValorizado = round2(f.cantidadSalida * costoSalida);
        totalSalidaImporteValorizado += importeSalidaValorizado;
        saldoValor -= f.cantidadSalida * costoSalida;
        saldoCant -= f.cantidadSalida;
      }
      if (saldoCant !== 0) {
        lastPpc = saldoValor / saldoCant;
      }
    }

    const ppcSaldo = saldoCant !== 0 ? saldoValor / saldoCant : lastPpc;
    const saldoPUnitario = round2(ppcSaldo);
    const saldoCantidad = round3(saldoCant);
    const saldoImporte = round2(saldoCantidad * saldoPUnitario);

    filasConSaldo.push({
      fecha: f.fecha,
      tipoMov: f.tipoMov,
      nroDocum: f.nroDocum,
      serie: f.serie,
      numero: f.numero,
      tipoDocumento: f.tipoDocumento,
      idRef: f.idRef,
      tipoRef: f.tipoRef,
      cantidadEntrada: f.cantidadEntrada,
      pUnitarioEntrada: f.pUnitarioEntrada,
      importeEntrada: f.importeEntrada,
      cantidadSalida: f.cantidadSalida,
      pUnitarioSalida: f.pUnitarioSalida,
      importeSalida: f.importeSalida,
      pUnitarioSalidaValorizado,
      importeSalidaValorizado,
      saldoCantidad,
      saldoPUnitario,
      saldoImporte,
      excluidoDeTotales: f.excluidoDeTotales,
      estadoComprobante: f.estadoComprobante
    });
  }

  const totalEntradaImporte = activas.reduce((s, f) => s + f.importeEntrada, 0);
  const totalSalidaImporte = activas.reduce((s, f) => s + f.importeSalida, 0);
  const saldoFinalPUnit = saldoCant !== 0 ? round2(saldoValor / saldoCant) : round2(lastPpc);
  const saldoFinalCantidad = round3(saldoCant);
  const saldoFinalImporte = round2(saldoFinalCantidad * saldoFinalPUnit);

  return {
    producto: {
      idProducto: producto.idProducto,
      codigo: producto.codigo,
      descripcion: producto.descripcion,
      unidadMedida: producto.unidadMedida || 'NIU',
      unidadDescripcion: producto.unidadDescripcion || 'UNIDAD',
      tipoExistencia: '01',
      tipoExistenciaDescripcion: 'MERCADERIAS'
    },
    saldoInicial: {
      cantidad: round3(cantidadIni),
      pUnitario: pUnitarioIni,
      importe: importeIniFinal
    },
    filas: filasConSaldo,
    totales: {
      totalEntradaCantidad: totalEntradaCant,
      totalEntradaImporte: round2(totalEntradaImporte),
      totalSalidaCantidad: totalSalidaCant,
      totalSalidaImporte: round2(totalSalidaImporte),
      totalSalidaImporteValorizado: round2(totalSalidaImporteValorizado),
      saldoFinalCantidad: saldoFinalCantidad,
      saldoFinalImporte: saldoFinalImporte,
      saldoFinalPUnitario: saldoFinalPUnit,
      stockActualSistema: stockLotes
    }
  };
};

/**
 * Lista productos de la empresa para el kardex completo (formato 13.1).
 */
exports.listarProductosParaKardex = async (pool, idEmpresa) => {
  const r = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT p.idProducto, p.codigo, p.descripcion,
             ISNULL(pr.codigo, 'NIU') AS unidadMedida,
             ISNULL(pr.descripcion, 'UNIDAD') AS unidadDescripcion
      FROM Productos p
      LEFT JOIN Presentacion pr ON pr.idPresentacion = p.idPresentacion
      WHERE p.idEmpresa = @idEmpresa
        AND ISNULL(p.estado, 1) = 1
      ORDER BY p.codigo, p.descripcion
    `);
  return r.recordset || [];
};

/**
 * Cabecera empresa + establecimiento (sucursal principal) para formato 13.1.
 */
exports.obtenerCabeceraEmpresaKardex = async (pool, idEmpresa) => {
  const r = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        e.razon_Social AS razonSocial,
        e.razon_Social AS nombre,
        e.ruc,
        e.correo,
        e.celular AS telefono,
        e.rubro,
        ISNULL(s.direccion, de.direccion) AS direccion,
        ISNULL(s.nombre, 'ALMACEN GENERAL') AS establecimiento
      FROM Empresas e
      LEFT JOIN Sucursal s ON s.idEmpresa = e.idEmpresa AND ISNULL(s.esPrincipal, 0) = 1
      LEFT JOIN DireccionEmpresa de ON e.idEmpresa = de.idEmpresa AND de.principal = 1
      WHERE e.idEmpresa = @idEmpresa
    `);
  return r.recordset && r.recordset[0] ? r.recordset[0] : null;
};
