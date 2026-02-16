/**
 * Genera el contenido de los archivos planos del Facturador SUNAT SFS.
 * Estructuras alineadas con:
 * - otros/AnexosIyII_Formato1.3.xlsx (Factura y boleta 2.1, Nota 2.1)
 * - Archivos de muestra en otros/ (ej. 10456333538-01-F001-00000022.CAB, .DET, .TRI, .LEY, .ACA, .DPA, .PAG)
 * Tipos: 01 Factura, 03 Boleta (CAB 18 cols), 07 Nota de crédito, 08 Nota de débito (CAB 21 cols).
 * Campos separados por palote (|).
 */

const SEP = "|";

function toNum(v) {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function toStr(v) {
  return v != null ? String(v).trim() : "";
}

/** Monto con 2 decimales para archivos planos SUNAT. */
function monto2(v) {
  const n = toNum(v);
  return n.toFixed(2);
}

/** Cantidad con 3 decimales (DET). */
function cant3(v) {
  const n = toNum(v);
  return n.toFixed(3);
}

/** Valor unitario con 5 decimales (DET). */
function valor5(v) {
  const n = toNum(v);
  return n.toFixed(5);
}

function escPipe(s) {
  const t = String(s ?? "").trim();
  return t.replace(/\|/g, " ").replace(/\r?\n/g, " ");
}

/**
 * Fecha en formato YYYY-MM-DD para CAB.
 */
function fechaCab(fechaStr) {
  if (!fechaStr) return "";
  const s = String(fechaStr).trim();
  if (s.length >= 10) return s.substring(0, 10);
  return s;
}

/**
 * Hora en formato HH:MM:SS extraída de fEmision (VARCHAR(19) = YYYY-MM-DD HH:MM:SS).
 */
function horaCab(fechaStr) {
  if (!fechaStr) return "00:00:00";
  const s = String(fechaStr).trim();
  if (s.length >= 19) return s.substring(11, 19);
  if (s.length > 10 && s.charAt(10) === " ") return s.substring(11);
  return "00:00:00";
}

/**
 * Genera una línea CAB (cabecera) para Factura (01) o Boleta (03).
 * Anexos I y II Formato 1.3: exactamente 18 columnas en orden.
 */
function generarLineaCAB(payload, tipoComprobante) {
  const { venta = {}, cliente = {} } = payload;
  const tipoDoc = (cliente.tipoDocSunat || (cliente.ruc && String(cliente.ruc).length === 11 ? "6" : "1")).trim() || "1";
  const numDoc = toStr(cliente.ruc) || "00000000";
  const razon = escPipe(cliente.rSocial || cliente.razonSocial);
  const subtotal = toNum(venta.subtotal);
  const totalIgv = toNum(venta.igv);
  const totalDescuento = toNum(venta.descuentos);
  const total = toNum(venta.total);
  const otrosCargos = toNum(venta.otrosCargos);
  const totalPrecioVenta = subtotal + totalIgv;

  const campos = [
    "0101",                                    // 1 Tipo de operación
    fechaCab(venta.fEmision),                   // 2 Fecha de emisión
    horaCab(venta.fEmision),                    // 3 Hora de Emisión
    fechaCab(venta.fEmision),                   // 4 Fecha de vencimiento
    "0000",                                    // 5 Código domicilio fiscal / local emisor
    tipoDoc,                                   // 6 Tipo documento adquirente
    numDoc,                                    // 7 Número documento adquirente
    razon,                                     // 8 Razón social
    "PEN",                                     // 9 Tipo de moneda
    monto2(totalIgv),                          // 10 Sumatoria Tributos
    monto2(subtotal),                          // 11 Total valor de venta (base imponible)
    monto2(totalPrecioVenta),                  // 12 Total Precio de Venta
    monto2(totalDescuento),                    // 13 Total descuentos
    monto2(otrosCargos),                       // 14 Sumatoria otros Cargos
    "0.00",                                    // 15 Total Anticipos
    monto2(total),                             // 16 Importe total de la venta
    "2.1",                                    // 17 Versión UBL
    "2.0"                                     // 18 Customization Documento
  ];
  return campos.join(SEP) + SEP;
}

/**
 * Genera líneas DET (detalle), una por ítem. Anexos I y II: exactamente 36 columnas por línea.
 * Orden: 1-7 (unidad, cantidad, cod producto, cod SUNAT, descripción, valor unit., sum tributos);
 * 8-14 (IGV); 15-21 (ISC); 22-27 (Tributo Otro); 28-33 (ICBPER); 34-36 (precio unit., valor venta ítem, valor referencial).
 * Si el ítem tiene IGV 0 pero el comprobante es gravado (venta.igv > 0), se reparte IGV proporcionalmente.
 */
function generarLineasDET(items, venta) {
  const lineas = [];
  const detalle = Array.isArray(items) ? items : [];
  const totalSubtotal = detalle.reduce((s, d) => s + toNum(d.subtotal), 0);
  let totalIgvDoc = toNum(venta && venta.igv);
  if (totalIgvDoc === 0 && venta && toNum(venta.total) > toNum(venta.subtotal)) {
    totalIgvDoc = Math.round((toNum(venta.total) - toNum(venta.subtotal)) * 100) / 100;
  }

  const igvPorItem = detalle.map((d) => {
    const subtotalItem = toNum(d.subtotal);
    const totalItem = toNum(d.total);
    let igv = totalItem - subtotalItem;
    if (igv <= 0 && totalIgvDoc > 0 && totalSubtotal > 0 && subtotalItem > 0) {
      igv = Math.round((subtotalItem / totalSubtotal) * totalIgvDoc * 100) / 100;
    }
    return igv;
  });
  let sumaIgv = igvPorItem.reduce((a, b) => a + b, 0);
  if (totalIgvDoc > 0 && sumaIgv === 0 && igvPorItem.length > 0) {
    igvPorItem[0] = Math.round(totalIgvDoc * 100) / 100;
    sumaIgv = igvPorItem[0];
  }
  if (totalIgvDoc > 0 && sumaIgv > 0 && Math.abs(sumaIgv - totalIgvDoc) > 0.001) {
    const diff = Math.round((totalIgvDoc - sumaIgv) * 100) / 100;
    igvPorItem[0] = Math.round((igvPorItem[0] + diff) * 100) / 100;
  }

  const esExonerado = totalIgvDoc === 0;

  for (let i = 0; i < detalle.length; i++) {
    const d = detalle[i];
    const cantidad = toNum(d.cantidad);
    const pVenta = toNum(d.pVenta);
    const subtotalItem = toNum(d.subtotal);
    const igvItem = igvPorItem[i];
    const desc = escPipe(d.descripcion) || "Item";
    const codProducto = d.codigo || String(i + 1);

    const campos = [
      "NIU",                              // 1
      cant3(cantidad),                    // 2 cantidad 3 decimales
      codProducto,                        // 3
      "-",                                // 4 código SUNAT
      desc,                               // 5
      valor5(pVenta),                     // 6 valor unitario 5 decimales
      monto2(igvItem),                    // 7 sumatoria tributos ítem
      esExonerado ? "9997" : "1000",      // 8 código tributo
      esExonerado ? "0.00" : monto2(igvItem),  // 9 monto
      monto2(subtotalItem),               // 10 base
      esExonerado ? "EXO" : "IGV",        // 11 nombre
      esExonerado ? "VAT" : "10",         // 12 tipo
      esExonerado ? "20" : "10",          // 13 afectación (20=exonerado, 10=gravado)
      esExonerado ? "0.00" : "18",        // 14 porcentaje
      "-", "0.00", "",                    // 15-17
      "ISC", "EXC", "01", "2.00", "-", "", "", "",  // 18-25
      "0.00", "-",                        // 26-27
      "", "", "", "", "", "",             // 28-33
      valor5(pVenta),                     // 34 precio venta unitario
      monto2(subtotalItem),              // 35 valor venta ítem
      "0.00"                              // 36 valor referencial
    ];
    lineas.push(campos.join(SEP) + SEP);
  }
  if (lineas.length === 0) {
    const codTrib = esExonerado ? "9997" : "1000";
    const nomTrib = esExonerado ? "EXO" : "IGV";
    const tipoTrib = esExonerado ? "VAT" : "10";
    const afect = esExonerado ? "20" : "10";
    const pct = esExonerado ? "0.00" : "18";
    const vacio = [
      "NIU", "0.000", "1", "-", "Item", "0.00000", "0.00",
      codTrib, "0.00", "0.00", nomTrib, tipoTrib, afect, pct,
      "-", "0.00", "",
      "ISC", "EXC", "01", "2.00", "-", "", "", "",
      "0.00", "-", "", "", "", "", "", "",
      "0.00000", "0.00", "0.00"
    ];
    lineas.push(vacio.join(SEP) + SEP);
  }
  return lineas.join("\r\n");
}

/**
 * Genera contenido TRI (tributos generales). 5 columnas.
 * Gravado: 1000|IGV|10|base|monto. Exonerado: 9997|EXO|VAT|base|0.00
 */
function generarTRI(payload) {
  const { venta = {} } = payload;
  const base = toNum(venta.subtotal);
  let igv = toNum(venta.igv);
  if (igv === 0 && toNum(venta.total) > toNum(venta.subtotal)) {
    igv = Math.round((toNum(venta.total) - toNum(venta.subtotal)) * 100) / 100;
  }
  if (igv === 0) {
    return `9997|EXO|VAT|${monto2(base)}|0.00` + SEP;
  }
  return `1000|IGV|10|${monto2(base)}|${monto2(igv)}` + SEP;
}

/**
 * Genera contenido LEY (leyendas). 2 columnas: código | descripción.
 * Formato muestra: 1000|CERO CON 00/100 SOLES para total 0; si no SON X SOLES.
 */
function generarLEY(payload) {
  const { venta = {} } = payload;
  const total = toNum(venta.total);
  const texto = total > 0 ? `SON ${Math.round(total * 100) / 100} SOLES` : "CERO CON 00/100 SOLES";
  return `1000|${escPipe(texto)}` + SEP;
}

/**
 * Genera contenido ACA (adicionales de cabecera). Estructura muestra:
 * ||||009|PE|ubigeo|dirección cliente|-|-|-|
 */
function generarACA(payload) {
  const { cliente = {} } = payload;
  const direccion = escPipe(cliente.direccion || "");
  const ubigeo = toStr(cliente.ubigeo || "").replace(/\D/g, "").substring(0, 6) || "000000";
  const campos = ["", "", "", "", "009", "PE", ubigeo || "-", direccion || "-", "-", "-", "-", ""];
  return campos.join(SEP) + SEP;
}

/**
 * Genera contenido DPA (adicionales de detalle o datos pago). Estructura muestra: -|-|-|
 */
function generarDPA() {
  return "-|-|-" + SEP;
}

/**
 * Genera contenido PAG (medio de pago). Estructura muestra: Contado|-|-|
 */
function generarPAG(payload) {
  console.log("generarPAG", payload);
  if (!payload.venta.tipoComprobante == "03") {
    return "-|-|-" + SEP;
  }else{
  const medio = toStr(payload.venta && payload.venta.medioPago) || "Contado";
  return `${escPipe(medio)}|-|-` + SEP;
  }
}

/**
 * Genera los archivos planos (contenido como string) para Factura o Boleta.
 * @param {object} payload - { venta, empresa, cliente, items }
 * @param {string} tipoComprobante - "01" | "03"
 * @returns {{ cab, det, tri, ley, aca, dpa, pag }}
 */
function generarArchivosPlanosFacturaBoleta(payload, tipoComprobante) {
  return {
    cab: generarLineaCAB(payload, tipoComprobante),
    det: generarLineasDET(payload.items, payload.venta),
    tri: generarTRI(payload),
    ley: generarLEY(payload),
    aca: generarACA(payload),
    dpa: generarDPA(),
    pag: generarPAG(payload)
  };
}

/**
 * Genera línea CAB para Nota de crédito (07) o débito (08). Anexo Nota 2.1: 21 columnas.
 * payload.documentoReferencia: { tipoComprobanteRef, serieRef, numeroRef, motivo, codigoTipoNota }.
 * codigoTipoNota catálogo 52: 01=Anulación, 02=Corrección error descripción, 03=Corrección por montos, etc.
 */
function generarLineaCABNota(payload, tipoComprobante) {
  const { venta = {}, cliente = {}, documentoReferencia = {} } = payload;
  const tipoDoc = (cliente.tipoDocSunat || (cliente.ruc && String(cliente.ruc).length === 11 ? "6" : "1")).trim() || "1";
  const numDoc = toStr(cliente.ruc) || "00000000";
  const razon = escPipe(cliente.rSocial || cliente.razonSocial);
  const subtotal = toNum(venta.subtotal);
  const totalIgv = toNum(venta.igv);
  const totalDescuento = toNum(venta.descuentos);
  const total = toNum(venta.total);
  const otrosCargos = toNum(venta.otrosCargos);
  const totalPrecioVenta = subtotal + totalIgv;
  const tipoDocRef = toStr(documentoReferencia.tipoComprobanteRef) || "01";
  const serieRef = toStr(documentoReferencia.serieRef) || "";
  const numeroRef = toStr(documentoReferencia.numeroRef) || "";
  const serieNumeroRef = `${serieRef}-${numeroRef.replace(/\D/g, "").padStart(8, "0")}`.replace(/^-/, "");
  const motivo = escPipe(documentoReferencia.motivo || "Anulación de la operación");
  const codigoTipoNota = toStr(documentoReferencia.codigoTipoNota) || "01";

  const campos = [
    "0101",                                    // 1 Tipo de operación
    fechaCab(venta.fEmision),                   // 2 Fecha de emisión
    horaCab(venta.fEmision),                    // 3 Hora de Emisión
    "0000",                                    // 4 Código domicilio fiscal / local emisor
    tipoDoc,                                   // 5 Tipo documento adquirente
    numDoc,                                    // 6 Número documento adquirente
    razon,                                     // 7 Razón social
    "PEN",                                     // 8 Tipo de moneda
    codigoTipoNota,                            // 9 Código tipo Nota (catálogo 52)
    motivo,                                    // 10 Descripción motivo o sustento
    tipoDocRef,                                // 11 Tipo documento que modifica
    serieNumeroRef,                            // 12 Serie y número documento que modifica
    monto2(totalIgv),                          // 13 Sumatoria Tributos
    monto2(subtotal),                          // 14 Total valor de venta
    monto2(totalPrecioVenta),                  // 15 Total Precio de Venta
    monto2(totalDescuento),                    // 16 Total descuentos
    monto2(otrosCargos),                       // 17 Sumatoria otros Cargos
    "0.00",                                    // 18 Total Anticipos
    monto2(total),                             // 19 Importe total de la venta
    "2.1",                                     // 20 Versión UBL
    "2.0"                                      // 21 Customization Documento
  ];
  return campos.join(SEP) + SEP;
}

/**
 * Genera archivos planos para Nota de crédito (07) o Nota de débito (08).
 * Misma estructura DET, TRI, LEY, ACA, DPA, PAG que Factura/Boleta; CAB con 21 columnas (Nota 2.1).
 */
function generarArchivosPlanosNota(payload, tipoComprobante) {
  return {
    cab: generarLineaCABNota(payload, tipoComprobante),
    det: generarLineasDET(payload.items, payload.venta),
    tri: generarTRI(payload),
    ley: generarLEY(payload),
    aca: generarACA(payload),
    dpa: generarDPA(),
    pag: generarPAG(payload)
  };
}

/**
 * Genera contenidos para archivos planos según tipo de comprobante.
 * 01 Factura, 03 Boleta → CAB 18 cols (Factura y boleta 2.1).
 * 07 Nota de crédito, 08 Nota de débito → CAB 21 cols (Nota 2.1).
 */
function generarArchivosPlanos(payload, tipoComprobante) {
  const tt = String(tipoComprobante || "01").trim();
  if (tt === "07" || tt === "08") {
    return generarArchivosPlanosNota(payload, tt);
  }
  if (tt === "01" || tt === "03") {
    return generarArchivosPlanosFacturaBoleta(payload, tt);
  }
  return generarArchivosPlanosFacturaBoleta(payload, "03");
}

/**
 * Resumen Diario (RC) y Comunicación de Baja (RA): el Excel Anexos expone sobre todo estructura JSON.
 * Muchos Facturadores SFS usan XML/JSON para RC/RA. Si el tuyo usa archivos planos, se puede
 * añadir aquí generadores según el formato que exija el Facturador (ej. un .TXT por resumen).
 */

module.exports = {
  generarArchivosPlanos,
  generarLineaCAB,
  generarLineaCABNota,
  generarLineasDET,
  generarTRI,
  generarLEY,
  generarACA,
  generarDPA,
  generarPAG,
  generarArchivosPlanosFacturaBoleta,
  generarArchivosPlanosNota
};
