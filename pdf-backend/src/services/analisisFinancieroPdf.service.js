/**
 * HTML del informe de análisis financiero (una sección por hoja A4).
 */

function fc(n) {
  return Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fp(n) {
  if (n == null || Number.isNaN(Number(n))) return '0.00%';
  const v = Number(n);
  const pct = Math.abs(v) <= 1 && v !== 0 ? v * 100 : v;
  return `${pct.toFixed(2)}%`;
}

function fratio(n) {
  if (n == null || Number.isNaN(Number(n))) return '0.00x';
  return `${Number(n).toFixed(2)}x`;
}

function esc(s) {
  return String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function filaKpi(etiqueta, valor) {
  return `<tr><td>${etiqueta}</td><td class="text-end"><strong>${valor}</strong></td></tr>`;
}

function bloqueSeccion(titulo, innerHtml, pageBreak = true) {
  const pb = pageBreak ? 'page-break-after: always;' : '';
  return `<section class="seccion-informe" style="${pb}"><h2 class="seccion-titulo">${esc(titulo)}</h2>${innerHtml}</section>`;
}

function badgeEstado(estado) {
  const e = String(estado || '').toUpperCase();
  const cls =
    e === 'OPTIMO' ? 'estado-optimo' : e === 'ACEPTABLE' ? 'estado-aceptable' : e === 'PREOCUPANTE' ? 'estado-preocupante' : 'estado-critico';
  return `<span class="badge-estado ${cls}">${esc(estado || '—')}</span>`;
}

/** Formato valor según nombre de ratio crítico */
function valorRatioCritico(rc) {
  const nombre = String(rc.nombre || '').toLowerCase();
  const v = Number(rc.valor || 0);
  if (nombre.includes('día') || nombre.includes('ciclo')) return `${Math.round(v)} días`;
  if (nombre.includes('margen') || nombre.includes('endeudamiento') || nombre.includes('roa') || nombre.includes('roe')) {
    return fp(v);
  }
  if (nombre.includes('liquidez')) return fratio(v);
  return v < 2 && v > -2 && Math.abs(v) <= 1 ? fp(v) : fratio(v);
}

function htmlBalanceDetallado(b, tituloExtra = '') {
  const titulo = esc(b.periodo) + (tituloExtra ? ` ${tituloExtra}` : '');
  const pasivoPatrimonio = Number(b.pasivoTotal || 0) + Number(b.patrimonio || 0);
  return `
    <div class="bloque-periodo">
      <h3 class="subtitulo-periodo">Período: ${titulo}</h3>
      <div class="dos-columnas">
        <div class="col-balance">
          <h4 class="col-titulo activo">ACTIVO</h4>
          <table class="tabla-lineas">
            <tr><td>Inventario valorizado</td><td class="text-end">S/ ${fc(b.inventarioTotal)}</td></tr>
            <tr><td>Cuentas por cobrar</td><td class="text-end">S/ ${fc(b.cuentasPorCobrar)}</td></tr>
            <tr><td>Flujo neto de caja (período)</td><td class="text-end">S/ ${fc(b.flujoNetoCaja)}</td></tr>
            <tr class="subtotal"><td><strong>Activo corriente</strong></td><td class="text-end"><strong>S/ ${fc(b.activoCorriente)}</strong></td></tr>
            <tr><td>Activo fijo</td><td class="text-end">S/ ${fc(b.activoFijo)}</td></tr>
            <tr class="total"><td><strong>TOTAL ACTIVO</strong></td><td class="text-end"><strong>S/ ${fc(b.activoTotal)}</strong></td></tr>
          </table>
        </div>
        <div class="col-balance">
          <h4 class="col-titulo pasivo">PASIVO Y PATRIMONIO</h4>
          <table class="tabla-lineas">
            <tr><td>Pasivo corriente</td><td class="text-end">S/ ${fc(b.pasivoCorriente)}</td></tr>
            <tr><td>Pasivo largo plazo</td><td class="text-end">S/ ${fc(b.pasivoLargoPlazo)}</td></tr>
            <tr class="subtotal"><td><strong>Total pasivo</strong></td><td class="text-end"><strong>S/ ${fc(b.pasivoTotal)}</strong></td></tr>
            <tr><td>Patrimonio</td><td class="text-end">S/ ${fc(b.patrimonio)}</td></tr>
            <tr class="total"><td><strong>TOTAL PASIVO + PATRIMONIO</strong></td><td class="text-end"><strong>S/ ${fc(pasivoPatrimonio)}</strong></td></tr>
          </table>
        </div>
      </div>
      <div class="indicadores-balance">
        <span><strong>Liquidez:</strong> ${fratio(b.ratioLiquidez)}</span>
        <span class="sep">|</span>
        <span><strong>Endeudamiento:</strong> ${fp(b.ratioEndeudamiento)}</span>
      </div>
    </div>`;
}

function htmlEstadoResultadosVertical(er) {
  return `
    <div class="bloque-periodo">
      <h3 class="subtitulo-periodo">Período: ${esc(er.periodo)}</h3>
      <table class="tabla-lineas tabla-er-vertical">
        <tr><td>Ingresos / Ventas</td><td class="text-end text-ingreso">S/ ${fc(er.ingresos)}</td></tr>
        <tr><td>(−) Costo de ventas</td><td class="text-end text-egreso">S/ ${fc(er.costoVentas)}</td></tr>
        <tr class="subtotal"><td><strong>= Utilidad bruta</strong></td><td class="text-end"><strong>S/ ${fc(er.utilidadBruta)}</strong></td></tr>
        <tr><td>(−) Gastos de operación</td><td class="text-end text-egreso">S/ ${fc(er.gastosOperacion)}</td></tr>
        <tr class="subtotal"><td><strong>= Utilidad operativa</strong></td><td class="text-end"><strong>S/ ${fc(er.utilidadOperacion)}</strong></td></tr>
        <tr><td>(−) Gastos financieros</td><td class="text-end text-egreso">S/ ${fc(er.gastosFinancieros)}</td></tr>
        <tr class="subtotal"><td><strong>= Utilidad antes de impuestos</strong></td><td class="text-end"><strong>S/ ${fc(er.utilidadAntesImpuestos)}</strong></td></tr>
        <tr><td>(−) Impuestos</td><td class="text-end text-egreso">S/ ${fc(er.impuestos)}</td></tr>
        <tr class="total"><td><strong>= UTILIDAD NETA</strong></td><td class="text-end"><strong>S/ ${fc(er.utilidadNeta)}</strong></td></tr>
      </table>
    </div>`;
}

function construirHtmlAnalisisFinanciero(datos) {
  const emp = datos.empresa || {};
  const razonSocial = esc((emp.razon_Social || emp.nombreComercial || emp.nombre || '').trim() || 'Empresa');
  const ruc = emp.ruc ? `RUC: ${esc(emp.ruc)}` : '';
  const periodo = esc(datos.periodoLabel || datos.periodo || '');
  const fechaGen = new Date().toLocaleString('es-PE');
  const secciones = [];

  const d = datos.dashboard;
  if (d) {
    secciones.push(
      bloqueSeccion(
        '1. Dashboard ejecutivo',
        `<table class="tabla-kpi">
        ${filaKpi('<strong>Ventas totales</strong>', `S/ ${fc(d.ventasTotales)}`)}
        ${filaKpi('<strong>Costo de ventas</strong>', `S/ ${fc(d.costoVentas)}`)}
        ${filaKpi('<strong>Utilidad bruta</strong>', `S/ ${fc(d.utilidadBruta)}`)}
        ${filaKpi('<strong>Gastos operativos</strong>', `S/ ${fc(d.gastosOperativos)}`)}
        ${filaKpi('<strong>Utilidad operativa</strong>', `S/ ${fc(d.utilidadOperativa)}`)}
        ${filaKpi('<strong>Utilidad neta</strong>', `S/ ${fc(d.utilidadNeta)}`)}
        ${filaKpi('<strong>Flujo de caja (período)</strong>', `S/ ${fc(d.flujoCaja)}`)}
        ${filaKpi('<strong>Efectivo en período</strong>', `S/ ${fc(d.ingresosEfectivo)}`)}
        ${filaKpi('<strong>Margen bruto</strong>', fp(d.margenBruto))}
        ${filaKpi('<strong>Margen operativo</strong>', fp(d.margenOperativo))}
        ${filaKpi('<strong>Margen neto</strong>', fp(d.margenNeto))}
        ${filaKpi('<strong>Crecimiento ventas</strong>', fp(d.crecimientoVentas))}
        ${filaKpi('<strong>ROI (s/ activo)</strong>', fp(d.roi))}
        ${filaKpi('<strong>Inventario</strong>', `S/ ${fc(d.inventarioTotal)}`)}
        ${filaKpi('<strong>Por cobrar</strong>', `S/ ${fc(d.cuentasPorCobrar)}`)}
        ${filaKpi('<strong>Por pagar</strong>', `S/ ${fc(d.cuentasPorPagar)}`)}
        ${filaKpi('<strong>Patrimonio estimado</strong>', `S/ ${fc(d.patrimonio)}`)}
      </table>`
      )
    );
  }

  const balances = Array.isArray(datos.balanceList) ? datos.balanceList : datos.balance ? [datos.balance] : [];
  if (balances.length) {
    const filasResumen = balances
      .map(
        (b) =>
          `<tr>
        <td>${esc(b.periodo)}</td>
        <td class="text-end">${fc(b.activoCorriente)}</td>
        <td class="text-end">${fc(b.activoFijo)}</td>
        <td class="text-end">${fc(b.activoTotal)}</td>
        <td class="text-end">${fc(b.pasivoTotal)}</td>
        <td class="text-end">${fc(b.patrimonio)}</td>
        <td class="text-end">${fratio(b.ratioLiquidez)}</td>
        <td class="text-end">${fp(b.ratioEndeudamiento)}</td>
      </tr>`
      )
      .join('');

    let htmlBalance = `
      <p class="nota">Patrimonio estimado = Inventario + CxC + Flujo caja del período − CxP (sin aperturas de caja).</p>
      <h3>Resumen comparativo</h3>
      <table class="tabla-compacta"><thead><tr>
        <th>Período</th><th class="text-end">Act. corriente</th><th class="text-end">Act. fijo</th>
        <th class="text-end">Total activo</th><th class="text-end">Total pasivo</th><th class="text-end">Patrimonio</th>
        <th class="text-end">Liquidez</th><th class="text-end">Endeud.</th>
      </tr></thead><tbody>${filasResumen}</tbody></table>
      <h3>Detalle por período</h3>`;

    balances.forEach((b, idx) => {
      const esUltimo = idx === balances.length - 1;
      const extra = balances.length > 1 && esUltimo ? '(consolidado)' : '';
      htmlBalance += htmlBalanceDetallado(b, extra);
    });

    secciones.push(bloqueSeccion('2. Balance general', htmlBalance));
  }

  const flujo = datos.flujoCaja;
  if (flujo) {
    const conceptos = (flujo.resumenConceptos || [])
      .map((c) => `<tr><td>${esc(c.concepto)}</td><td class="text-end">${fc(c.importe)}</td></tr>`)
      .join('');
    const ing = (flujo.movimientosIngresos || [])
      .map((m) => `<tr><td>${esc(m.formaPago)}</td><td class="text-end">${fc(m.importe)}</td></tr>`)
      .join('');
    const egr = (flujo.movimientosEgresos || [])
      .map((m) => `<tr><td>${esc(m.formaPago)}</td><td class="text-end">${fc(m.importe)}</td></tr>`)
      .join('');
    secciones.push(
      bloqueSeccion(
        '3. Flujo de caja (sin aperturas)',
        `<p class="nota">Período: ${esc(flujo.fechaInicio)} — ${esc(flujo.fechaFin)}</p>
        <p><strong>Flujo neto:</strong> S/ ${fc(flujo.flujoNeto)} | <strong>Efectivo neto:</strong> S/ ${fc(flujo.flujoNetoEfectivo)} | <strong>Patrimonio est.:</strong> S/ ${fc(flujo.patrimonioEstimado)}</p>
        <h3>Resumen por concepto</h3>
        <table><thead><tr><th>Concepto</th><th class="text-end">Importe</th></tr></thead><tbody>${conceptos || '<tr><td colspan="2">Sin movimientos</td></tr>'}</tbody></table>
        <h3>Ingresos por forma de pago</h3>
        <table><thead><tr><th>Forma pago</th><th class="text-end">Importe</th></tr></thead><tbody>${ing || '<tr><td colspan="2">—</td></tr>'}</tbody>
        <tfoot><tr><td><strong>Total ingresos</strong></td><td class="text-end"><strong>${fc(flujo.totalIngresos)}</strong></td></tr></tfoot></table>
        <h3>Egresos por forma de pago</h3>
        <table><thead><tr><th>Forma pago</th><th class="text-end">Importe</th></tr></thead><tbody>${egr || '<tr><td colspan="2">—</td></tr>'}</tbody>
        <tfoot><tr><td><strong>Total egresos</strong></td><td class="text-end"><strong>${fc(flujo.totalEgresos)}</strong></td></tr></tfoot></table>`
      )
    );
  }

  const serie = datos.flujoSerie?.serie;
  if (Array.isArray(serie) && serie.length) {
    const filas = serie
      .map(
        (r) =>
          `<tr><td>${esc(r.periodo)}</td><td class="text-end">${fc(r.totalIngresos)}</td>
        <td class="text-end">${fc(r.totalEgresos)}</td><td class="text-end">${fc(r.flujoNeto)}</td>
        <td class="text-end">${fc(r.flujoNetoEfectivo)}</td><td class="text-end">${fc(r.patrimonio)}</td></tr>`
      )
      .join('');
    secciones.push(
      bloqueSeccion(
        '3b. Flujo de caja — serie mensual',
        `<table><thead><tr><th>Mes</th><th class="text-end">Ingresos</th><th class="text-end">Egresos</th>
        <th class="text-end">Flujo neto</th><th class="text-end">Efectivo</th><th class="text-end">Patrimonio est.</th></tr></thead><tbody>${filas}</tbody></table>`
      )
    );
  }

  const ers = Array.isArray(datos.estadoResultadosList) ? datos.estadoResultadosList : [];
  if (ers.length) {
    const filasTabla = ers
      .map(
        (er) =>
          `<tr>
        <td>${esc(er.periodo)}</td>
        <td class="text-end">${fc(er.ingresos)}</td>
        <td class="text-end">${fc(er.costoVentas)}</td>
        <td class="text-end">${fc(er.utilidadBruta)}</td>
        <td class="text-end">${fc(er.gastosOperacion)}</td>
        <td class="text-end">${fc(er.utilidadOperacion)}</td>
        <td class="text-end">${fc(er.gastosFinancieros)}</td>
        <td class="text-end">${fc(er.utilidadAntesImpuestos)}</td>
        <td class="text-end">${fc(er.impuestos)}</td>
        <td class="text-end"><strong>${fc(er.utilidadNeta)}</strong></td>
      </tr>`
      )
      .join('');

    const totales = ers.reduce(
      (acc, er) => ({
        ingresos: acc.ingresos + Number(er.ingresos || 0),
        costoVentas: acc.costoVentas + Number(er.costoVentas || 0),
        utilidadBruta: acc.utilidadBruta + Number(er.utilidadBruta || 0),
        gastosOperacion: acc.gastosOperacion + Number(er.gastosOperacion || 0),
        utilidadOperacion: acc.utilidadOperacion + Number(er.utilidadOperacion || 0),
        gastosFinancieros: acc.gastosFinancieros + Number(er.gastosFinancieros || 0),
        utilidadAntesImpuestos: acc.utilidadAntesImpuestos + Number(er.utilidadAntesImpuestos || 0),
        impuestos: acc.impuestos + Number(er.impuestos || 0),
        utilidadNeta: acc.utilidadNeta + Number(er.utilidadNeta || 0)
      }),
      {
        ingresos: 0,
        costoVentas: 0,
        utilidadBruta: 0,
        gastosOperacion: 0,
        utilidadOperacion: 0,
        gastosFinancieros: 0,
        utilidadAntesImpuestos: 0,
        impuestos: 0,
        utilidadNeta: 0
      }
    );

    let htmlEr = `
      <h3>Tabla comparativa (todos los períodos)</h3>
      <table class="tabla-compacta tabla-er"><thead><tr>
        <th>Período</th><th class="text-end">Ingresos</th><th class="text-end">Costo ventas</th>
        <th class="text-end">Util. bruta</th><th class="text-end">Gastos op.</th><th class="text-end">Util. oper.</th>
        <th class="text-end">Gastos fin.</th><th class="text-end">UAI</th><th class="text-end">Impuestos</th><th class="text-end">Util. neta</th>
      </tr></thead><tbody>${filasTabla}</tbody>`;

    if (ers.length > 1) {
      htmlEr += `<tfoot><tr class="total">
        <td><strong>TOTAL</strong></td>
        <td class="text-end"><strong>${fc(totales.ingresos)}</strong></td>
        <td class="text-end"><strong>${fc(totales.costoVentas)}</strong></td>
        <td class="text-end"><strong>${fc(totales.utilidadBruta)}</strong></td>
        <td class="text-end"><strong>${fc(totales.gastosOperacion)}</strong></td>
        <td class="text-end"><strong>${fc(totales.utilidadOperacion)}</strong></td>
        <td class="text-end"><strong>${fc(totales.gastosFinancieros)}</strong></td>
        <td class="text-end"><strong>${fc(totales.utilidadAntesImpuestos)}</strong></td>
        <td class="text-end"><strong>${fc(totales.impuestos)}</strong></td>
        <td class="text-end"><strong>${fc(totales.utilidadNeta)}</strong></td>
      </tr></tfoot>`;
    }
    htmlEr += `</table><h3>Estado de resultados — detalle por período</h3>`;

    ers.forEach((er) => {
      htmlEr += htmlEstadoResultadosVertical(er);
    });

    secciones.push(bloqueSeccion('4. Estado de resultados', htmlEr));
  }

  const gastos = Array.isArray(datos.gastos) ? datos.gastos : [];
  if (gastos.length) {
    const filas = gastos
      .map(
        (g) =>
          `<tr><td>${esc(g.fecha)}</td><td>${esc(g.tipo)}</td><td>${esc(g.descripcion || '')}</td><td class="text-end">${fc(g.monto)}</td></tr>`
      )
      .join('');
    const total = gastos.reduce((s, g) => s + Number(g.monto || 0), 0);
    secciones.push(
      bloqueSeccion(
        '5. Gastos operativos registrados',
        `<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th class="text-end">Monto</th></tr></thead>
        <tbody>${filas}</tbody><tfoot><tr><td colspan="3"><strong>Total</strong></td><td class="text-end"><strong>${fc(total)}</strong></td></tr></tfoot></table>
        <p class="nota">Registro manual. Para soporte fiscal use compras con factura de proveedor.</p>`
      )
    );
  }

  const rat = datos.ratios;
  if (rat) {
    secciones.push(
      bloqueSeccion(
        '6. Ratios financieros (completo)',
        `<div class="grid-ratios">
        <div class="bloque-ratio">
          <h3>Liquidez</h3>
          <table class="tabla-kpi">
            ${filaKpi('Ratio corriente', fratio(rat.ratioLiquidezCorriente))}
            ${filaKpi('Ratio ácido', fratio(rat.ratioLiquidezAcida))}
            ${filaKpi('Ratio inmediato', fratio(rat.ratioLiquidezInmediata))}
          </table>
          <p class="hint">Óptimo: corriente &gt; 1.5, ácido &gt; 0.8</p>
        </div>
        <div class="bloque-ratio">
          <h3>Solvencia</h3>
          <table class="tabla-kpi">
            ${filaKpi('Deuda total', fp(rat.ratioDeudaTotal))}
            ${filaKpi('Deuda / Patrimonio', fratio(rat.ratioDeudaPatrimonio))}
            ${filaKpi('Nivel endeudamiento', fp(rat.nivelEndeudamiento))}
            ${filaKpi('Cobertura intereses', rat.coberturaIntereses != null && rat.coberturaIntereses > 0 ? fratio(rat.coberturaIntereses) : 'N/D')}
          </table>
          <p class="hint">Óptimo: deuda total &lt; 60%</p>
        </div>
        <div class="bloque-ratio">
          <h3>Rentabilidad</h3>
          <table class="tabla-kpi">
            ${filaKpi('Margen bruto', fp(rat.margenBruto))}
            ${filaKpi('Margen operativo', fp(rat.margenOperativo))}
            ${filaKpi('Margen neto', fp(rat.margenNeto))}
            ${filaKpi('ROA (retorno activos)', fp(rat.ROA))}
            ${filaKpi('ROE (retorno patrimonio)', fp(rat.ROE))}
            ${filaKpi('ROI', fp(rat.ROI))}
          </table>
        </div>
        <div class="bloque-ratio">
          <h3>Eficiencia y rotación</h3>
          <table class="tabla-kpi">
            ${filaKpi('Rotación inventario', `${Number(rat.rotacionInventario || 0).toFixed(2)} veces/año`)}
            ${filaKpi('Rotación cuentas por cobrar', `${Number(rat.rotacionCuentasCobrar || 0).toFixed(2)} veces/año`)}
            ${filaKpi('Rotación cuentas por pagar', `${Number(rat.rotacionCuentasPagar || 0).toFixed(2)} veces/año`)}
            ${filaKpi('Ciclo conversión de efectivo', `${Number(rat.cicloConversionEfectivo || 0)} días`)}
          </table>
          <p class="hint">Óptimo: ciclo de conversión &lt; 60 días</p>
        </div>
      </div>`
      )
    );
  } else {
    secciones.push(
      bloqueSeccion(
        '6. Ratios financieros',
        '<p class="nota">No se pudieron calcular los ratios para este informe. Verifique que el backend de análisis esté activo y vuelva a generar el PDF.</p>'
      )
    );
  }

  const diag = datos.diagnostico;
  if (diag) {
    const fort = (diag.fortalezas || []).map((f, i) => `<li><strong>${i + 1}.</strong> ${esc(f)}</li>`).join('');
    const deb = (diag.debilidades || []).map((f, i) => `<li><strong>${i + 1}.</strong> ${esc(f)}</li>`).join('');
    const rec = (diag.recomendaciones || []).map((f, i) => `<li><strong>${i + 1}.</strong> ${esc(f)}</li>`).join('');
    const ratiosCriticos = Array.isArray(diag.ratiosCriticos) ? diag.ratiosCriticos : [];
    const filasRc = ratiosCriticos
      .map(
        (rc) =>
          `<tr>
        <td>${esc(rc.nombre)}</td>
        <td class="text-end">${valorRatioCritico(rc)}</td>
        <td>${esc(rc.rangoOptimo)}</td>
        <td>${badgeEstado(rc.estado)}</td>
      </tr>`
      )
      .join('');

    secciones.push(
      bloqueSeccion(
        '7. Diagnóstico financiero',
        `<div class="diag-resumen">
          <p><strong>Salud financiera:</strong> <span class="salud-${esc(String(diag.saludFinanciera || '').toLowerCase())}">${esc(diag.saludFinanciera)}</span></p>
          <p><strong>Puntuación global:</strong> ${esc(diag.puntuacion)} / 100</p>
        </div>
        <h3>Ratios críticos evaluados</h3>
        <table><thead><tr><th>Indicador</th><th class="text-end">Valor</th><th>Rango óptimo</th><th>Estado</th></tr></thead>
        <tbody>${filasRc || '<tr><td colspan="4">Sin ratios críticos calculados</td></tr>'}</tbody></table>
        <h3>Fortalezas</h3><ul class="lista-diag">${fort || '<li>—</li>'}</ul>
        <h3>Debilidades</h3><ul class="lista-diag">${deb || '<li>—</li>'}</ul>
        <h3>Recomendaciones</h3><ul class="lista-diag">${rec || '<li>—</li>'}</ul>`,
        false
      )
    );
  } else {
    secciones.push(
      bloqueSeccion(
        '7. Diagnóstico financiero',
        '<p class="nota">No se pudo generar el diagnóstico. Revise la conexión con el API de análisis e intente de nuevo.</p>',
        false
      )
    );
  }

  if (!secciones.length) {
    secciones.push(bloqueSeccion('Informe', '<p>Sin datos para el período seleccionado.</p>', false));
  }

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Análisis Financiero</title>
<style>
@page { margin: 16mm 12mm; }
body{font-family:Arial,sans-serif;font-size:9px;color:#333;margin:0;padding:0}
.header-informe{border-bottom:2px solid #0056b3;padding-bottom:10px;margin-bottom:16px}
.header-informe h1{font-size:16px;color:#0056b3;margin:0 0 4px 0}
.meta{color:#666;font-size:8px}
.seccion-titulo{font-size:13px;color:#0056b3;border-bottom:1px solid #ccc;padding-bottom:6px;margin:0 0 10px 0}
h3{font-size:10px;margin:12px 0 6px 0;color:#333}
h4.col-titulo{font-size:10px;margin:0 0 6px 0}
h4.activo{color:#0056b3}
h4.pasivo{color:#b71c1c}
.subtitulo-periodo{font-size:10px;color:#555;margin:10px 0 6px 0;border-left:3px solid #0056b3;padding-left:8px}
table{width:100%;border-collapse:collapse;margin:6px 0 10px 0;font-size:8px}
th,td{border:1px solid #bbb;padding:4px 5px;vertical-align:top}
th{background:#e8eef4;font-weight:bold}
.text-end{text-align:right}
.tabla-kpi td:first-child{width:58%}
.tabla-compacta{font-size:7.5px}
.tabla-compacta th,.tabla-compacta td{padding:3px 4px}
.tabla-er thead th{font-size:7px}
.nota,.hint{font-size:7px;color:#666;font-style:italic;margin:4px 0}
.dos-columnas{display:table;width:100%;margin-bottom:8px}
.col-balance{display:table-cell;width:49%;vertical-align:top;padding-right:1%}
.col-balance + .col-balance{padding-left:8px;border-left:1px solid #ddd}
.tabla-lineas tr.subtotal td{background:#f5f8fc;font-weight:bold}
.tabla-lineas tr.total td{background:#e8eef4;font-weight:bold}
.text-ingreso{color:#1b5e20}
.text-egreso{color:#b71c1c}
.bloque-periodo{margin-bottom:14px;padding-bottom:10px;border-bottom:1px dashed #ddd}
.indicadores-balance{margin-top:6px;font-size:8px}
.indicadores-balance .sep{margin:0 6px;color:#999}
.grid-ratios{display:block}
.bloque-ratio{margin-bottom:12px;padding:8px;background:#fafbfc;border:1px solid #e0e0e0}
.bloque-ratio h3{margin-top:0}
.badge-estado{display:inline-block;padding:2px 6px;border-radius:3px;font-size:7px;font-weight:bold}
.estado-optimo{background:#d4edda;color:#155724}
.estado-aceptable{background:#cce5ff;color:#004085}
.estado-preocupante{background:#fff3cd;color:#856404}
.estado-critico{background:#f8d7da;color:#721c24}
.diag-resumen{padding:8px;background:#f0f4f8;border:1px solid #0056b3;margin-bottom:10px}
.salud-excelente,.salud-buena{color:#155724;font-weight:bold}
.salud-regular{color:#856404;font-weight:bold}
.salud-deficiente{color:#721c24;font-weight:bold}
.lista-diag{margin:4px 0 10px 0;padding-left:20px}
.lista-diag li{margin-bottom:4px}
</style></head><body>
  <div class="header-informe">
    <h1>Análisis financiero — Informe completo</h1>
    <div class="meta">${razonSocial}${ruc ? ' | ' + ruc : ''}</div>
    <div class="meta">Período del informe: ${periodo} | Generado: ${fechaGen}</div>
  </div>
  ${secciones.join('\n')}
</body></html>`;
}

module.exports = { construirHtmlAnalisisFinanciero };
