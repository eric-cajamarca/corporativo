function escapeHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtFechaPeriodo(iso) {
  if (!iso) return '';
  const p = String(iso).slice(0, 10).split('-');
  if (p.length !== 3) return iso;
  return `${p[2]}-${p[1]}-${p[0]}`;
}

function fmtFechaUi(iso) {
  if (!iso) return '';
  const p = String(iso).slice(0, 10).split('-');
  if (p.length !== 3) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

function fmtNum(n, dec = 2) {
  const x = Number(n);
  if (!Number.isFinite(x) || Math.abs(x) < 0.0000001) return '';
  return x.toLocaleString('es-PE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtSaldo(n, dec = 2) {
  const x = Number(n);
  if (!Number.isFinite(x)) return dec === 3 ? '0.000' : '0.00';
  return x.toLocaleString('es-PE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Encabezado de empresa (sin fecha de reporte ni chrome de página). */
function construirEncabezadoEmpresa(empresa) {
  const emp = empresa || {};
  const nombre = emp.razonSocial || emp.nombre || '';
  const lineas = [];
  if (emp.direccion) lineas.push(`Dirección: ${escapeHtml(emp.direccion)}`);
  if (emp.rubro) lineas.push(`Rubro: ${escapeHtml(emp.rubro)}`);
  if (emp.ruc) lineas.push(`RUC: ${escapeHtml(emp.ruc)}`);
  if (emp.telefono) lineas.push(`Cel: ${escapeHtml(emp.telefono)}`);
  if (emp.correo) lineas.push(`Correo: ${escapeHtml(emp.correo)}`);

  const logoHtml =
    emp.logo && String(emp.logo).startsWith('data:')
      ? `<img src="${emp.logo}" alt="Logo" class="logo-empresa" />`
      : '';

  return `
    <div class="encabezado-empresa">
      <table class="tabla-encabezado">
        <tr>
          <td class="col-logo">${logoHtml}</td>
          <td class="col-datos">
            <div class="nombre-empresa">${escapeHtml(nombre)}</div>
            <div class="datos-empresa">${lineas.join('<br>')}</div>
          </td>
        </tr>
      </table>
    </div>`;
}

function estilosBase() {
  return `
    body { font-family: Arial, sans-serif; font-size: 8px; margin: 0; padding: 10px; color: #222; }
    .encabezado-empresa { border-bottom: 3px solid #0056b3; padding-bottom: 8px; margin-bottom: 10px; }
    .tabla-encabezado { width: 100%; border-collapse: collapse; }
    .tabla-encabezado td { border: none; vertical-align: top; }
    .col-logo { width: 90px; }
    .logo-empresa { max-width: 80px; max-height: 70px; object-fit: contain; }
    .nombre-empresa { font-size: 13px; font-weight: bold; color: #0056b3; margin-bottom: 4px; }
    .datos-empresa { font-size: 8px; color: #444; line-height: 1.35; }
    .titulo-formato { text-align: center; font-size: 11px; font-weight: bold; margin: 0 0 8px; color: #1F4E79; }
    .meta-empresa { width: 100%; margin-bottom: 10px; font-size: 9px; border-collapse: collapse; }
    .meta-empresa td { padding: 2px 4px; }
    .bloque-producto { page-break-inside: avoid; margin-bottom: 14px; }
    .meta-producto { width: 100%; margin-bottom: 4px; font-size: 8px; border-collapse: collapse; }
    .meta-producto td { padding: 2px 4px; vertical-align: top; width: 50%; }
    .tabla-kardex { width: 100%; border-collapse: collapse; font-size: 7px; }
    .tabla-kardex th, .tabla-kardex td { border: 1px solid #999; padding: 2px 3px; }
    .tabla-kardex th { background: #2E75B6; color: #fff; font-weight: bold; text-align: center; }
    .tabla-kardex .c { text-align: center; }
    .tabla-kardex .r { text-align: right; }
    .fila-total td { background: #2E75B6; color: #fff; font-weight: bold; }
    .sin-datos { text-align: center; color: #666; padding: 24px; }
    .tabla-kardex-simple { width: 100%; border-collapse: collapse; font-size: 8px; }
    .tabla-kardex-simple th, .tabla-kardex-simple td { border: 1px solid #999; padding: 3px 4px; }
    .tabla-kardex-simple th { background: #2E75B6; color: #fff; font-weight: bold; text-align: center; }
  `;
}

function construirBloqueProducto(prod) {
  const filasHtml = (prod.filas || [])
    .map(
      (f) => `
      <tr>
        <td class="c">${escapeHtml(f.fecha)}</td>
        <td class="c">${escapeHtml(f.tipoDocumento)}</td>
        <td class="c">${escapeHtml(f.serie)}</td>
        <td class="c">${escapeHtml(f.numero)}</td>
        <td>${escapeHtml(f.tipoOperacion)}</td>
        <td class="r">${fmtNum(f.cantidadEntrada, 3)}</td>
        <td class="r">${fmtNum(f.costoUnitarioEntrada)}</td>
        <td class="r">${fmtNum(f.importeEntrada)}</td>
        <td class="r">${fmtNum(f.cantidadSalida, 3)}</td>
        <td class="r">${fmtNum(f.costoUnitarioSalida)}</td>
        <td class="r">${fmtNum(f.importeSalida)}</td>
        <td class="r">${fmtSaldo(f.saldoCantidad, 3)}</td>
        <td class="r">${fmtSaldo(f.saldoCostoUnitario)}</td>
        <td class="r">${fmtSaldo(f.saldoImporte)}</td>
      </tr>`
    )
    .join('');

  const tot = prod.totales || {};
  const tipoTxt = `${prod.tipoExistencia || '01'} ${prod.tipoExistenciaDescripcion || 'MERCADERIAS'}`;

  return `
    <div class="bloque-producto">
      <table class="meta-producto">
        <tr>
          <td><strong>CODIGO DE EXISTENCIA:</strong> ${escapeHtml(prod.codigo || '')}</td>
          <td><strong>TIPO:</strong> ${escapeHtml(tipoTxt)}</td>
        </tr>
        <tr>
          <td><strong>DESCRIPCION:</strong> ${escapeHtml(prod.descripcion || '')}</td>
          <td><strong>UNIDAD DE MEDIDA:</strong> ${escapeHtml(prod.unidadMedida || 'NIU')}</td>
        </tr>
      </table>
      <table class="tabla-kardex">
        <thead>
          <tr>
            <th colspan="4">DOCUMENTO</th>
            <th rowspan="2">TIPO DE OPERACION</th>
            <th colspan="3">ENTRADAS</th>
            <th colspan="3">SALIDAS</th>
            <th colspan="3">SALDO FINAL</th>
          </tr>
          <tr>
            <th>FECHA</th>
            <th>TIPO</th>
            <th>SERIE</th>
            <th>NUMERO</th>
            <th>CANT.</th>
            <th>C.UNIT.</th>
            <th>IMPORTE</th>
            <th>CANT.</th>
            <th>C.UNIT.</th>
            <th>IMPORTE</th>
            <th>CANT.</th>
            <th>C.UNIT.</th>
            <th>IMPORTE</th>
          </tr>
        </thead>
        <tbody>
          ${filasHtml || '<tr><td colspan="14" class="c">Sin movimientos</td></tr>'}
        </tbody>
        <tfoot>
          <tr class="fila-total">
            <td colspan="5" class="r"><strong>TOTAL:</strong></td>
            <td class="r">${fmtSaldo(tot.totalEntradaCantidad, 3)}</td>
            <td></td>
            <td class="r">${fmtSaldo(tot.totalEntradaImporte)}</td>
            <td class="r">${fmtSaldo(tot.totalSalidaCantidad, 3)}</td>
            <td></td>
            <td class="r">${fmtSaldo(tot.totalSalidaImporte)}</td>
            <td class="r">${fmtSaldo(tot.saldoFinalCantidad, 3)}</td>
            <td class="r">${fmtSaldo(tot.saldoFinalCostoUnitario)}</td>
            <td class="r">${fmtSaldo(tot.saldoFinalImporte)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function construirHtmlKardex131(datos) {
  const empresa = datos.empresa || {};
  const periodo = datos.periodo || {};
  const productos = Array.isArray(datos.productos) ? datos.productos : [];
  const fechaDesde = fmtFechaPeriodo(periodo.fechaDesde);
  const fechaHasta = fmtFechaPeriodo(periodo.fechaHasta);

  const bloques = productos.map((p) => construirBloqueProducto(p)).join('');
  const sinDatos =
    productos.length === 0
      ? '<p class="sin-datos">No hay productos con movimientos o saldo en el periodo seleccionado.</p>'
      : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Formato 13.1 Kardex</title>
  <style>${estilosBase()}</style>
</head>
<body>
  ${construirEncabezadoEmpresa(empresa)}
  <div class="titulo-formato">FORMATO 13.1 REGISTRO DE INVENTARIO PERMANENTE VALORIZADO - DETALLE DE INVENTARIO VALORIZADO</div>
  <table class="meta-empresa">
    <tr><td><strong>PERIODO:</strong> ${escapeHtml(fechaDesde)} AL ${escapeHtml(fechaHasta)}</td></tr>
    <tr><td><strong>RUC:</strong> ${escapeHtml(empresa.ruc || '')}</td></tr>
    <tr><td><strong>RAZON SOCIAL:</strong> ${escapeHtml(empresa.razonSocial || empresa.nombre || '')}</td></tr>
    <tr><td><strong>ESTABLECIMIENTO:</strong> ${escapeHtml(empresa.establecimiento || 'ALMACEN GENERAL')}</td></tr>
  </table>
  ${sinDatos}
  ${bloques}
</body>
</html>`;
}

/** PDF de kardex de un solo producto (sin UI de la aplicación). */
function construirHtmlKardexProducto(datos) {
  const empresa = datos.empresa || {};
  const producto = datos.producto || {};
  const saldoInicial = datos.saldoInicial || {};
  const filas = Array.isArray(datos.filas) ? datos.filas : [];
  const totales = datos.totales || {};
  const fechaDesde = datos.fechaDesde || '';
  const fechaHasta = datos.fechaHasta || '';

  const filaSaldo = `
    <tr>
      <td colspan="3"><strong>***SALDO INICIAL***</strong></td>
      <td class="r">-</td><td class="r">-</td><td class="r">-</td>
      <td class="r">-</td><td class="r">-</td><td class="r">-</td>
      <td class="r">${fmtSaldo(saldoInicial.cantidad, 3)}</td>
      <td class="r">${fmtSaldo(saldoInicial.pUnitario)}</td>
      <td class="r">${fmtSaldo(saldoInicial.importe)}</td>
    </tr>`;

  const filasHtml = filas
    .map(
      (f) => `
      <tr>
        <td class="c">${escapeHtml(fmtFechaUi(f.fecha))}</td>
        <td>${escapeHtml(f.tipoMov || '')}${f.estadoComprobante ? ` (${escapeHtml(f.estadoComprobante)})` : ''}</td>
        <td>${escapeHtml(f.nroDocum || '')}</td>
        <td class="r">${fmtNum(f.cantidadEntrada, 3) || '-'}</td>
        <td class="r">${fmtNum(f.pUnitarioEntrada) || '-'}</td>
        <td class="r">${fmtNum(f.importeEntrada) || '-'}</td>
        <td class="r">${fmtNum(f.cantidadSalida, 3) || '-'}</td>
        <td class="r">${fmtNum(f.pUnitarioSalida) || '-'}</td>
        <td class="r">${fmtNum(f.importeSalida) || '-'}</td>
        <td class="r">${fmtSaldo(f.saldoCantidad, 3)}</td>
        <td class="r">${fmtSaldo(f.saldoPUnitario)}</td>
        <td class="r">${fmtSaldo(f.saldoImporte)}</td>
      </tr>`
    )
    .join('');

  const filaTotales = `
    <tr class="fila-total">
      <td colspan="3"><strong>TOTALES:</strong></td>
      <td class="r">${fmtSaldo(totales.totalEntradaCantidad, 3)}</td>
      <td class="r">-</td>
      <td class="r">${fmtSaldo(totales.totalEntradaImporte)}</td>
      <td class="r">${fmtSaldo(totales.totalSalidaCantidad, 3)}</td>
      <td class="r">-</td>
      <td class="r">${fmtSaldo(totales.totalSalidaImporte)}</td>
      <td class="r">${fmtSaldo(totales.saldoFinalCantidad, 3)}</td>
      <td class="r">${totales.saldoFinalPUnitario != null ? fmtSaldo(totales.saldoFinalPUnitario) : '-'}</td>
      <td class="r">${fmtSaldo(totales.saldoFinalImporte)}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Kardex</title>
  <style>${estilosBase()}
    .tabla-kardex-simple .c { text-align: center; }
    .tabla-kardex-simple .r { text-align: right; }
  </style>
</head>
<body>
  ${construirEncabezadoEmpresa(empresa)}
  <div class="titulo-formato">KARDEX DE PRODUCTO</div>
  <table class="meta-empresa">
    <tr><td><strong>Periodo:</strong> ${escapeHtml(fmtFechaUi(fechaDesde))} al ${escapeHtml(fmtFechaUi(fechaHasta))}</td></tr>
    <tr><td><strong>Producto:</strong> ${escapeHtml(producto.descripcion || '')}</td></tr>
    <tr><td><strong>Código:</strong> ${escapeHtml(producto.codigo || '')}</td></tr>
  </table>
  <table class="tabla-kardex-simple">
    <thead>
      <tr>
        <th>Fecha</th>
        <th>TipoMov</th>
        <th>NroDocum</th>
        <th colspan="3">INGRESOS</th>
        <th colspan="3">EGRESOS</th>
        <th colspan="3">SALDOS</th>
      </tr>
      <tr>
        <th></th><th></th><th></th>
        <th>Cantidad</th><th>P.Unitario</th><th>Importe S/.</th>
        <th>Cantidad</th><th>P.Unitario</th><th>Importe S/.</th>
        <th>Cantidad</th><th>P.Unitario</th><th>Importe S/.</th>
      </tr>
    </thead>
    <tbody>
      ${filaSaldo}
      ${filasHtml}
      ${filaTotales}
    </tbody>
  </table>
</body>
</html>`;
}

module.exports = { construirHtmlKardex131, construirHtmlKardexProducto };
