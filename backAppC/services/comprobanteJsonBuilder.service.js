/**
 * Construye el objeto JSON del comprobante electrónico a partir de los datos de venta/empresa/cliente/items (BD)
 * para guardar en sunat_archivos/sfs/DATA según instructivo del Facturador SUNAT.
 */

function toNum(v) {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function toStr(v) {
  return v != null ? String(v).trim() : "";
}

/**
 * Formato fecha para SUNAT: YYYY-MM-DD
 */
function fechaSunat(fechaStr) {
  if (!fechaStr) return "";
  const s = String(fechaStr).trim();
  if (s.length >= 10) return s.substring(0, 10);
  return s;
}

/**
 * Arma el JSON de factura (01) o boleta (03) desde el payload de obtenerComprobanteParaPdf.
 * @param {object} payload - { venta, empresa, cliente, items }
 * @param {string} tipoComprobante - "01" | "03"
 * @returns {object} Objeto listo para JSON.stringify y guardar en DATA
 */
function buildFacturaBoletaJson(payload, tipoComprobante) {
  const { venta = {}, empresa = {}, cliente = {}, items = [] } = payload;
  const codigo = toStr(venta.codigoComprobante) || (tipoComprobante === "01" ? "01" : "03");
  const tipoDocCliente = (cliente.tipoDocSunat || (cliente.ruc && String(cliente.ruc).length === 11 ? "6" : "1")).trim() || "1";
  const numeroDocCliente = toStr(cliente.ruc) || "00000000";

  const totalGravada = toNum(venta.subtotal);
  const totalIgv = toNum(venta.igv);
  const totalDescuento = toNum(venta.descuentos);
  const total = toNum(venta.total);

  const codFp =
    String(venta.codigoCondicionPago || "").trim() === "10"
      ? "010"
      : String(venta.codigoCondicionPago || "").trim() || (/credito/i.test(String(venta.condicionPago || "")) ? "010" : "009");
  const cuotasLista = Array.isArray(venta.cuotas) ? venta.cuotas : [];
  let fechaVenJson = fechaSunat(venta.fVencimiento);
  if (codFp === "010" && cuotasLista.length > 0) {
    const fechas = cuotasLista
      .map((c) => fechaSunat(c.fechaPago))
      .filter(Boolean)
      .sort();
    if (fechas.length) fechaVenJson = fechas[fechas.length - 1];
  }

  const itemsMap = (Array.isArray(items) ? items : []).map((d, i) => {
    const cantidad = toNum(d.cantidad);
    const pVenta = toNum(d.pVenta);
    const subtotal = toNum(d.subtotal);
    const totalItem = toNum(d.total);
    const igvItem = totalItem - subtotal;
    return {
      numeroOrden: i + 1,
      codigo: "",
      descripcion: toStr(d.descripcion) || "Item",
      unidad: "NIU",
      cantidad,
      valorUnitario: pVenta,
      precioUnitario: pVenta,
      subtotal,
      tipoIgv: "10",
      igv: igvItem,
      total: totalItem
    };
  });

  return {
    ublVersion: "2.1",
    customizationID: "2.0",
    tipoComprobante: tipoComprobante,
    serie: toStr(venta.serie),
    numero: String(venta.numero ?? "").replace(/\D/g, "").padStart(8, "0"),
    fechaEmision: fechaSunat(venta.fEmision),
    fechaVencimiento: fechaVenJson,
    codigoFormaPagoSUNAT: codFp,
    moneda: "PEN",
    tipoOperacion: "0101",
    emisor: {
      ruc: toStr(empresa.ruc).padStart(11, "0"),
      razonSocial: toStr(empresa.nombre),
      nombreComercial: toStr(empresa.nombre),
      domicilioFiscal: {
        ubigueo: "",
        direccion: toStr(empresa.direccion),
        urbanizacion: "",
        departamento: "",
        provincia: "",
        distrito: "",
        codigoPais: "PE"
      }
    },
    cliente: {
      tipoDocumento: tipoDocCliente,
      numeroDocumento: numeroDocCliente,
      razonSocial: toStr(cliente.rSocial || cliente.razonSocial),
      direccion: toStr(cliente.direccion),
      ubigueo: ""
    },
    totales: {
      totalGravada,
      totalExonerada: 0,
      totalInafecta: 0,
      totalGratuita: 0,
      subtotal: totalGravada,
      totalIgv,
      totalIsc: 0,
      totalOtrosTributos: 0,
      totalDescuento: totalDescuento,
      totalOtrosCargos: 0,
      total,
      totalLetras: ""
    },
    leyendas: [{ codigo: "1000", valor: "" }],
    items: itemsMap.length ? itemsMap : [{ numeroOrden: 1, codigo: "", descripcion: "Item", unidad: "NIU", cantidad: 0, valorUnitario: 0, precioUnitario: 0, subtotal: 0, tipoIgv: "10", igv: 0, total: 0 }],
    guias: [],
    relacionados: [],
    cuotas:
      codFp === "010" && (codigo === "01" || codigo === "03") && cuotasLista.length > 0
        ? cuotasLista.map((c, i) => ({
            numeroCuota: c.numeroCuota != null ? Number(c.numeroCuota) : i + 1,
            importe: Number(c.total || 0).toFixed(2),
            fechaPago: fechaSunat(c.fechaPago)
          }))
        : []
  };
}

/**
 * Arma el JSON de nota de crédito (07) o débito (08). documentoReferencia mínimo.
 */
function buildNotaJson(payload, tipoComprobante, documentoReferencia = {}) {
  const base = buildFacturaBoletaJson(payload, tipoComprobante);
  base.documentoReferencia = {
    tipoComprobante: toStr(documentoReferencia.tipoComprobante) || "01",
    serie: toStr(documentoReferencia.serie),
    numero: String(documentoReferencia.numero ?? "").replace(/\D/g, "").padStart(8, "0"),
    fechaEmision: fechaSunat(documentoReferencia.fechaEmision),
    tipoNota: tipoComprobante === "07" ? "01" : "01",
    descripcion: toStr(documentoReferencia.descripcion) || "Ajuste"
  };
  return base;
}

/**
 * Construye el JSON del comprobante según tipo (01, 03, 07, 08).
 * @param {object} payload - Resultado de ventasRepository.obtenerComprobanteParaPdf
 * @param {string} tipoComprobante - "01" | "03" | "07" | "08"
 * @param {object} [documentoReferencia] - Para 07/08: { tipoComprobante, serie, numero, fechaEmision, descripcion }
 */
function buildComprobanteJson(payload, tipoComprobante, documentoReferencia) {
  const tt = String(tipoComprobante || "01").trim();
  if (tt === "07" || tt === "08") {
    return buildNotaJson(payload, tt, documentoReferencia || {});
  }
  return buildFacturaBoletaJson(payload, tt === "03" ? "03" : "01");
}

module.exports = {
  buildComprobanteJson,
  buildFacturaBoletaJson,
  buildNotaJson
};
