/**
 * Prueba local: precios unitarios SUNAT con precio CON IGV y SIN IGV.
 * Valida error 3271: cantidad × cac:Price ≈ LineExtensionAmount
 * y PricingReference (01) ≈ total/cantidad.
 *
 * Uso: node scripts/probar-precios-unitarios-sunat.js
 */

const {
  generarXmlUblFacturaBoleta
} = require("../services/generadorXmlUblSunat.service");
const {
  generarArchivosPlanosFacturaBoleta
} = require("../services/archivoPlanoFacturador.service");
const { buildFacturaBoletaJson } = require("../services/comprobanteJsonBuilder.service");

function redondear2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Equivalente a adminSPA venta-igv.util.ts armarDetallesConIgv */
function armarDetallesConIgv(lineas, porcentaje, precioIncluyeIgv, tieneIgvActivo) {
  const pct = Number(porcentaje) || 0;
  if (!tieneIgvActivo || pct <= 0) {
    return lineas.map((l) => {
      const bruto = redondear2((Number(l.cantidad) || 0) * (Number(l.pVenta) || 0));
      return { subtotal: bruto, total: bruto, igv: false };
    });
  }
  if (precioIncluyeIgv) {
    const brutos = lineas.map((l) =>
      redondear2((Number(l.cantidad) || 0) * (Number(l.pVenta) || 0))
    );
    const sumBrutos = redondear2(brutos.reduce((a, b) => a + b, 0));
    const igvEsperado = redondear2((sumBrutos * pct) / (100 + pct));
    const baseEsperada = redondear2(sumBrutos - igvEsperado);
    const bases = brutos.map((b) => redondear2((b * 100) / (100 + pct)));
    const sumBases = redondear2(bases.reduce((a, b) => a + b, 0));
    const diff = redondear2(baseEsperada - sumBases);
    if (bases.length && Math.abs(diff) >= 0.005) {
      bases[bases.length - 1] = redondear2(bases[bases.length - 1] + diff);
    }
    return brutos.map((bruto, i) => ({
      subtotal: bases[i],
      total: bruto,
      igv: true
    }));
  }
  const bases = lineas.map((l) =>
    redondear2((Number(l.cantidad) || 0) * (Number(l.pVenta) || 0))
  );
  const sumBases = redondear2(bases.reduce((a, b) => a + b, 0));
  const igvCab = redondear2(sumBases * (pct / 100));
  const igvLines = bases.map((b) => redondear2(b * (pct / 100)));
  const sumIgv = redondear2(igvLines.reduce((a, b) => a + b, 0));
  const diff = redondear2(igvCab - sumIgv);
  if (igvLines.length && Math.abs(diff) >= 0.005) {
    igvLines[igvLines.length - 1] = redondear2(igvLines[igvLines.length - 1] + diff);
  }
  return bases.map((base, i) => ({
    subtotal: base,
    total: redondear2(base + igvLines[i]),
    igv: true
  }));
}

function payloadBase(items, ventaMontos) {
  return {
    venta: {
      serie: "F002",
      numero: 1,
      fEmision: "2026-08-05 13:18:43",
      codigoComprobante: "01",
      condicionPago: "Contado",
      observaciones: "PRUEBA PRECIOS UNITARIOS",
      ...ventaMontos
    },
    empresa: {
      ruc: "20611268361",
      nombre: "MULTISERVICIOS GENERALES ACU E.I.R.L.",
      direccion: "AV. BUENAVENTURA JULCA",
      ubigeo: "060612",
      region: "Cajamarca",
      provincia: "Cutervo",
      distrito: "Santo Domingo de la Capilla"
    },
    cliente: {
      ruc: "20495782299",
      rSocial: "SERVICIOS GENERALES ROSELJE EIRL",
      tipoDocSunat: "6",
      direccion: "PJ. EL ROSARIO NRO. 130"
    },
    items,
    impuestos: [
      {
        codigoSunat: "1000",
        nombreTributo: "IGV",
        porcentaje: 18,
        afectacion: "10"
      }
    ]
  };
}

function extraerLineaXml(xml) {
  const lineExt = Number(
    (xml.match(/<cac:InvoiceLine>[\s\S]*?<cbc:LineExtensionAmount[^>]*>([\d.]+)</) || [])[1]
  );
  const cant = Number(
    (xml.match(/<cac:InvoiceLine>[\s\S]*?<cbc:InvoicedQuantity[^>]*>([\d.]+)</) || [])[1]
  );
  const precioRef = Number(
    (xml.match(
      /<cac:PricingReference>[\s\S]*?<cbc:PriceAmount[^>]*>([\d.]+)</
    ) || [])[1]
  );
  const valorUnit = Number(
    (xml.match(/<cac:Price>\s*<cbc:PriceAmount[^>]*>([\d.]+)</) || [])[1]
  );
  return { cant, lineExt, precioRef, valorUnit };
}

function assertCasiIgual(actual, esperado, tol, msg) {
  if (Math.abs(actual - esperado) > tol) {
    throw new Error(`${msg}: esperado=${esperado}, actual=${actual}`);
  }
}

function probarCaso(nombre, lineasCarrito, precioIncluyeIgv) {
  const montos = armarDetallesConIgv(lineasCarrito, 18, precioIncluyeIgv, true);
  const items = lineasCarrito.map((l, i) => ({
    cantidad: l.cantidad,
    pVenta: l.pVenta,
    descripcion: l.descripcion || "Item",
    codigo: l.codigo || String(i + 1),
    subtotal: montos[i].subtotal,
    total: montos[i].total
  }));
  const ventaMontos = {
    subtotal: redondear2(items.reduce((s, it) => s + it.subtotal, 0)),
    igv: redondear2(items.reduce((s, it) => s + (it.total - it.subtotal), 0)),
    total: redondear2(items.reduce((s, it) => s + it.total, 0))
  };
  const payload = payloadBase(items, ventaMontos);

  const xml = generarXmlUblFacturaBoleta(payload, "01", "F002-00000099");
  const linea = extraerLineaXml(xml);
  const esperadoValor = Math.round((items[0].subtotal / items[0].cantidad) * 100000) / 100000;
  const esperadoPrecio = Math.round((items[0].total / items[0].cantidad) * 100000) / 100000;
  const producto = Math.round(linea.cant * linea.valorUnit * 100) / 100;

  assertCasiIgual(linea.valorUnit, esperadoValor, 0.00001, `${nombre}: valor unitario XML`);
  assertCasiIgual(linea.precioRef, esperadoPrecio, 0.00001, `${nombre}: precio referencia XML`);
  assertCasiIgual(producto, linea.lineExt, 0.01, `${nombre}: SUNAT 3271 cantidad×valor≈LineExtension`);
  assertCasiIgual(linea.lineExt, items[0].subtotal, 0.001, `${nombre}: LineExtension=subtotal`);

  // DET archivo plano: col 6 = valor sin IGV, col 34 = precio con IGV
  const planos = generarArchivosPlanosFacturaBoleta(payload, "01");
  const detCols = String(planos.det).trim().split("|");
  const detValor = Number(detCols[5]);
  const detPrecio = Number(detCols[33]);
  assertCasiIgual(detValor, esperadoValor, 0.00001, `${nombre}: DET col6 valor unitario`);
  assertCasiIgual(detPrecio, esperadoPrecio, 0.00001, `${nombre}: DET col34 precio unitario`);

  // JSON Facturador
  const json = buildFacturaBoletaJson(payload, "01");
  assertCasiIgual(json.items[0].valorUnitario, esperadoValor, 0.00001, `${nombre}: JSON valorUnitario`);
  assertCasiIgual(json.items[0].precioUnitario, esperadoPrecio, 0.00001, `${nombre}: JSON precioUnitario`);

  console.log(`OK  ${nombre}`);
  console.log(`    pVenta catálogo=${lineasCarrito[0].pVenta} | incluyeIGV=${precioIncluyeIgv}`);
  console.log(
    `    subtotal=${items[0].subtotal} total=${items[0].total} | valor=${linea.valorUnit} precio=${linea.precioRef}`
  );
  console.log(`    3271: ${linea.cant} × ${linea.valorUnit} = ${producto} ≈ ${linea.lineExt}`);
}

let fallos = 0;
try {
  // Caso real del ticket: diésel 33 × 25.30 CON IGV → error 3271 antes del fix
  probarCaso(
    "Precio CON IGV (caso diésel F002)",
    [{ cantidad: 33, pVenta: 25.3, descripcion: "DIESEL B5 S-50 UV", codigo: "10339" }],
    true
  );

  // Mismo importe final pero precio SIN IGV en catálogo
  // Base unitaria ≈ 25.30/1.18 → usamos 21.44068 redondeado a 5 dec típicos de lista
  probarCaso(
    "Precio SIN IGV (mismo producto)",
    [{ cantidad: 33, pVenta: 21.44068, descripcion: "DIESEL B5 S-50 UV", codigo: "10339" }],
    false
  );

  // Cantidad 1, precio con IGV
  probarCaso(
    "Precio CON IGV cantidad 1",
    [{ cantidad: 1, pVenta: 118.0, descripcion: "SERVICIO", codigo: "S1" }],
    true
  );

  // Cantidad 1, precio sin IGV
  probarCaso(
    "Precio SIN IGV cantidad 1",
    [{ cantidad: 1, pVenta: 100.0, descripcion: "SERVICIO", codigo: "S1" }],
    false
  );

  console.log("\nTodas las pruebas pasaron.");
} catch (e) {
  fallos = 1;
  console.error("\nFALLO:", e.message);
  process.exitCode = 1;
}

process.exit(fallos);
