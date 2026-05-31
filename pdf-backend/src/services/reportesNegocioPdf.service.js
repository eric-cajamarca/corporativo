/**
 * PDF de Reportes y Análisis del negocio: una sección (hoja) por cada reporte.
 */

function fc(n) {
  return Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(s) {
  return String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function bloqueSeccion(titulo, innerHtml, pageBreak = true) {
  const pb = pageBreak ? 'page-break-after: always;' : '';
  return `<section class="seccion-informe" style="${pb}"><h2 class="seccion-titulo">${esc(titulo)}</h2>${innerHtml}</section>`;
}

function tablaHtml(columnas, filas, vacio = 'Sin registros en el período.') {
  if (!filas || !filas.length) {
    return `<p class="nota">${vacio}</p>`;
  }
  const ths = columnas.map((c) => `<th${c.align === 'end' ? ' class="text-end"' : ''}>${esc(c.label)}</th>`).join('');
  const trs = filas
    .map((fila) => {
      const tds = columnas
        .map((c) => {
          const raw = fila[c.key];
          let val = raw;
          if (c.tipo === 'moneda') val = `S/ ${fc(raw)}`;
          else if (c.tipo === 'numero') val = fc(raw);
          else val = esc(raw);
          return `<td${c.align === 'end' ? ' class="text-end"' : ''}>${val}</td>`;
        })
        .join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');
  return `<table class="tabla-datos"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function tablaIndicadores(pares) {
  if (!pares.length) return '<p class="nota">Sin datos.</p>';
  const rows = pares.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="text-end"><strong>${v}</strong></td></tr>`).join('');
  return `<table class="tabla-kpi"><tbody>${rows}</tbody></table>`;
}

function construirHtmlReportesNegocio(datos) {
  const emp = datos.empresa || {};
  const razonSocial = esc((emp.razon_Social || emp.nombreComercial || emp.nombre || '').trim() || 'Empresa');
  const ruc = emp.ruc ? `RUC: ${esc(emp.ruc)}` : '';
  const periodo = esc(datos.periodoLabel || '');
  const periodoRapido = datos.periodoRapido ? esc(datos.periodoRapido) : '';
  const fechaGen = new Date().toLocaleString('es-PE');
  const secciones = [];

  const resumen = datos.resumenDashboard;
  if (resumen) {
    secciones.push(
      bloqueSeccion(
        'Resumen del período',
        `<p class="nota">Vista ejecutiva alineada al dashboard de reportes.</p>
        ${tablaIndicadores([
          ['Ventas totales', `S/ ${fc(resumen.ventasTotales)}`],
          ['Ingresos', `S/ ${fc(resumen.ingresos)}`],
          ['Costos asociados', `S/ ${fc((resumen.ingresos || 0) - (resumen.utilidadBruta || 0))}`],
          ['Utilidad bruta', `S/ ${fc(resumen.utilidadBruta)}`],
          ['Gastos operativos', `S/ ${fc(resumen.gastosOperativos)}`],
          ['Utilidad neta', `S/ ${fc(resumen.utilidadNeta)}`],
          ['ROI', `${Number(resumen.roi || 0).toFixed(2)}%`],
          ['Clientes activos', String(resumen.clientesActivos ?? 0)]
        ])}`
      )
    );
  }

  secciones.push(
    bloqueSeccion(
      '1. Reporte de ventas',
      `<p class="nota">Serie de ventas según el período seleccionado (${periodoRapido || 'dashboard'}).</p>
      ${tablaHtml(
        [
          { key: 'periodo', label: 'Período' },
          { key: 'ventas', label: 'Ventas (S/)', align: 'end', tipo: 'moneda' }
        ],
        datos.ventas || [],
        'No hay ventas registradas en el período.'
      )}`
    )
  );

  secciones.push(
    bloqueSeccion(
      '2. Reporte de compras',
      `<p class="nota">Compras agrupadas por proveedor entre ${periodo}.</p>
      ${tablaHtml(
        [
          { key: 'proveedor', label: 'Proveedor' },
          { key: 'numeroCompras', label: 'Nº compras', align: 'end', tipo: 'numero' },
          { key: 'totalItems', label: 'Ítems', align: 'end', tipo: 'numero' },
          { key: 'totalCompras', label: 'Total (S/)', align: 'end', tipo: 'moneda' }
        ],
        datos.compras || []
      )}
      ${datos.totalesCompras != null ? `<p class="total-line"><strong>Total compras:</strong> S/ ${fc(datos.totalesCompras)}</p>` : ''}`
    )
  );

  const inv = datos.inventario || [];
  const invLimit = datos.inventarioTruncado ? `<p class="nota">Mostrando ${inv.length} de ${datos.inventarioTotalFilas} productos.</p>` : '';
  secciones.push(
    bloqueSeccion(
      '3. Estado del inventario',
      `<p class="nota">Stock valorizado actual (snapshot al generar el reporte).</p>${invLimit}
      ${tablaHtml(
        [
          { key: 'codigo', label: 'Código' },
          { key: 'producto', label: 'Producto' },
          { key: 'categoria', label: 'Categoría' },
          { key: 'stockTotal', label: 'Stock', align: 'end', tipo: 'numero' },
          { key: 'valorInventario', label: 'Valor (S/)', align: 'end', tipo: 'moneda' }
        ],
        inv
      )}
      ${datos.totalValorInventario != null ? `<p class="total-line"><strong>Valor total inventario:</strong> S/ ${fc(datos.totalValorInventario)}</p>` : ''}`
    )
  );

  secciones.push(
    bloqueSeccion(
      '4. Análisis de clientes',
      `<p class="nota">Rentabilidad y comportamiento de compra (${periodo}).</p>
      ${tablaHtml(
        [
          { key: 'cliente', label: 'Cliente' },
          { key: 'numeroVentas', label: 'Nº ventas', align: 'end', tipo: 'numero' },
          { key: 'comprasTotales', label: 'Compras (S/)', align: 'end', tipo: 'moneda' },
          { key: 'ticketPromedio', label: 'Ticket prom.', align: 'end', tipo: 'moneda' },
          { key: 'ultimaCompra', label: 'Última compra' },
          { key: 'deudaPendiente', label: 'Deuda (S/)', align: 'end', tipo: 'moneda' }
        ],
        datos.clientes || []
      )}`
    )
  );

  const cred = datos.creditos;
  const filasCred = cred
    ? [
        ['Total créditos', String(cred.totalCreditos ?? 0)],
        ['Monto total créditos', `S/ ${fc(cred.montoTotalCreditos)}`],
        ['Créditos activos', String(cred.creditosActivos ?? 0)],
        ['Saldo pendiente total', `S/ ${fc(cred.saldoPendienteTotal)}`],
        ['Total cobrado', `S/ ${fc(cred.totalCobrado)}`],
        ['Eficiencia de cobro', `${Number(cred.eficienciaCobro || 0).toFixed(2)}%`]
      ]
    : [];
  secciones.push(
    bloqueSeccion(
      '5. Cartera de créditos',
      `<p class="nota">Estado de cuentas por cobrar y créditos otorgados.</p>
      ${tablaIndicadores(filasCred)}`
    )
  );

  secciones.push(
    bloqueSeccion(
      '6. Estado financiero',
      `<p class="nota">Ingresos, costos y utilidad bruta por período (${periodo}).</p>
      ${tablaHtml(
        [
          { key: 'periodo', label: 'Período' },
          { key: 'ingresos', label: 'Ingresos (S/)', align: 'end', tipo: 'moneda' },
          { key: 'costos', label: 'Costos (S/)', align: 'end', tipo: 'moneda' },
          { key: 'utilidadBruta', label: 'Utilidad bruta (S/)', align: 'end', tipo: 'moneda' }
        ],
        datos.utilidades || []
      )}`
    )
  );

  secciones.push(
    bloqueSeccion(
      '7. Productos más vendidos',
      `<p class="nota">Ranking por monto vendido en el período del dashboard.</p>
      ${tablaHtml(
        [
          { key: 'nombre', label: 'Producto' },
          { key: 'categoria', label: 'Categoría' },
          { key: 'ventas', label: 'Unidades', align: 'end', tipo: 'numero' },
          { key: 'monto', label: 'Monto (S/)', align: 'end', tipo: 'moneda' }
        ],
        datos.productos || []
      )}`
    )
  );

  secciones.push(
    bloqueSeccion(
      '8. Análisis de márgenes',
      `<p class="nota">Misma base de utilidades: margen bruto = ingresos − costos de ventas.</p>
      ${tablaHtml(
        [
          { key: 'periodo', label: 'Período' },
          { key: 'ingresos', label: 'Ingresos (S/)', align: 'end', tipo: 'moneda' },
          { key: 'costos', label: 'Costos (S/)', align: 'end', tipo: 'moneda' },
          {
            key: 'margenPct',
            label: 'Margen bruto %',
            align: 'end'
          }
        ],
        (datos.utilidades || []).map((u) => ({
          periodo: u.periodo,
          ingresos: u.ingresos,
          costos: u.costos,
          margenPct:
            Number(u.ingresos) > 0
              ? `${((Number(u.utilidadBruta || 0) / Number(u.ingresos)) * 100).toFixed(2)}%`
              : '0.00%'
        }))
      )}`,
      false
    )
  );

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Reportes del negocio</title>
<style>
@page { margin: 14mm 12mm; }
body{font-family:Arial,sans-serif;font-size:9px;color:#333;margin:0;padding:0}
.header-informe{border-bottom:2px solid #0056b3;padding-bottom:10px;margin-bottom:16px}
.header-informe h1{font-size:16px;color:#0056b3;margin:0 0 4px 0}
.meta{color:#666;font-size:8px}
.seccion-titulo{font-size:13px;color:#0056b3;border-bottom:1px solid #ccc;padding-bottom:6px;margin:0 0 10px 0}
.nota{font-size:7.5px;color:#666;font-style:italic;margin:0 0 8px 0}
.tabla-datos,.tabla-kpi{width:100%;border-collapse:collapse;margin:6px 0 10px 0;font-size:8px}
.tabla-datos th,.tabla-datos td,.tabla-kpi td{border:1px solid #bbb;padding:4px 5px;vertical-align:top}
.tabla-datos th{background:#e8eef4;font-weight:bold}
.text-end{text-align:right}
.total-line{margin-top:8px;font-size:9px}
</style></head><body>
  <div class="header-informe">
    <h1>Reportes y Análisis del negocio</h1>
    <div class="meta">${razonSocial}${ruc ? ' | ' + ruc : ''}</div>
    <div class="meta">Período: ${periodo}${periodoRapido ? ' (' + periodoRapido + ')' : ''} | Generado: ${fechaGen}</div>
  </div>
  ${secciones.join('\n')}
</body></html>`;
}

module.exports = { construirHtmlReportesNegocio };
