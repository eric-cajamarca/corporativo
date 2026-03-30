/**
 * Genera XML UBL 2.1 para Factura/Boleta (Peru SUNAT) a partir del mismo payload que los archivos planos.
 * Estructura UBL 2.1 Perú (compatible con Facturador y con envío directo).
 * Para envío directo, cac:Signature/cbc:Note debe indicar "del Contribuyente", no "Facturador SUNAT (SEE-SFS)" (manual del programador).
 * Referencias: UBL 2.1, CustomizationID 2.0 (Peru).
 */

const { escribirXmlFirma } = require("../utils/facturadorSunat.util");
const { numeroALetras } = require("../utils/numeroALetras.util");

const NS = {
  UBL: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  CAC: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  CBC: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  EXT: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
  DS: "http://www.w3.org/2000/09/xmldsig#"
};

function toNum(v) {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function toStr(v) {
  return v != null ? String(v).trim() : "";
}

function escXml(s) {
  if (s == null) return "";
  const t = String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
  return t;
}

function fechaParte(fechaStr) {
  if (!fechaStr) return { fecha: "", hora: "00:00:00" };
  const s = String(fechaStr).trim();
  const fecha = s.length >= 10 ? s.substring(0, 10) : "";
  const hora = s.length >= 19 ? s.substring(11, 19) : s.length > 10 && s.charAt(10) === " " ? s.substring(11) : "00:00:00";
  return { fecha, hora };
}

/** Catálogo forma de pago SUNAT (ej. 009 contado, 010 crédito). */
function normalizarCodigoFormaPagoSunat(cod) {
  const s = toStr(cod);
  if (s === "10") return "010";
  return s;
}

/**
 * Términos de pago UBL 2.1 para factura/boleta: FormaPago + cuotas (monto y fecha) cuando aplica crédito.
 * Alineado a guía XML factura electrónica Perú / RS sobre comprobantes al crédito.
 */
function resolverPagoFacturaBoletaUbl(venta, fechaEmisionYmd) {
  const codFp =
    normalizarCodigoFormaPagoSunat(toStr(venta.codigoCondicionPago)) ||
    (toStr(venta.condicionPago).toUpperCase().includes("CREDITO") ? "010" : "009");
  const ventaCredito = codFp === "010" || /credito/i.test(toStr(venta.condicionPago));
  const codComp = toStr(venta.codigoComprobante);
  const esFacturaOBoleta = codComp === "01" || codComp === "03";
  const cuotasRaw = Array.isArray(venta.cuotas) ? venta.cuotas : [];
  const cuotas = cuotasRaw.filter((c) => toNum(c.total) > 0.001);
  const emitirCuotasUbl = esFacturaOBoleta && ventaCredito && cuotas.length > 0;

  const paymentMeansId = ventaCredito ? "010" : "009";

  let dueDate = fechaEmisionYmd;
  if (emitirCuotasUbl) {
    const fechas = cuotas
      .map((c) => toStr(c.fechaPago).slice(0, 10))
      .filter((f) => f.length === 10)
      .sort();
    if (fechas.length) dueDate = fechas[fechas.length - 1];
  } else if (ventaCredito && toStr(venta.fVencimiento)) {
    const fv = fechaParte(venta.fVencimiento);
    if (fv.fecha) dueDate = fv.fecha;
  }

  let paymentTermsXml = `
  <cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID>
    <cbc:PaymentMeansID>${escXml(paymentMeansId)}</cbc:PaymentMeansID>
  </cac:PaymentTerms>`;

  if (emitirCuotasUbl) {
    for (let i = 0; i < cuotas.length; i++) {
      const c = cuotas[i];
      const n = c.numeroCuota != null ? Number(c.numeroCuota) : i + 1;
      const idCuota = `Cuota${String(Number.isFinite(n) ? n : i + 1).padStart(3, "0")}`;
      const monto = toNum(c.total);
      let fpago = toStr(c.fechaPago).slice(0, 10);
      if (!fpago) fpago = dueDate;
      paymentTermsXml += `
  <cac:PaymentTerms>
    <cbc:ID>${escXml(idCuota)}</cbc:ID>
    <cbc:PaymentMeansID>${escXml(idCuota)}</cbc:PaymentMeansID>
    <cbc:Amount currencyID="PEN">${monto.toFixed(2)}</cbc:Amount>
    <cbc:PaymentDueDate>${escXml(fpago)}</cbc:PaymentDueDate>
  </cac:PaymentTerms>`;
    }
  }

  return { dueDate, paymentMeansId, paymentTermsXml, ventaCredito, emitirCuotasUbl };
}

/**
 * Resuelve tributo principal para XML/planos desde payload.impuestos y monto de IGV.
 * Catálogo 05: 1000=IGV, 9997=EXO. Catálogo 07: 10=Gravado, 20=Exonerado.
 * @param {Array} impuestos - payload.impuestos (codigoSunat, descripcion, porcentaje)
 * @param {number} igv - venta.igv
 * @returns {{ codTributo: string, nombreTributo: string, afectacionIgv: string, porcentajeIgv: string }}
 */
function resolverTributoPrincipal(impuestos, igv) {
  const lista = Array.isArray(impuestos) ? impuestos : [];
  const esGravado = igv > 0;
  if (esGravado) {
    const igvImp = lista.find(i => String(i.codigoSunat || "").trim() === "1000") ||
      lista.find(i => (Number(i.porcentaje) || 0) > 0);
    return {
      codTributo: (igvImp && String(igvImp.codigoSunat || "").trim()) ? String(igvImp.codigoSunat).trim() : "1000",
      nombreTributo: (igvImp && (igvImp.descripcion || "").trim()) ? String(igvImp.descripcion).trim() : "IGV",
      afectacionIgv: "10",
      porcentajeIgv: (igvImp && (igvImp.porcentaje != null)) ? String(Number(igvImp.porcentaje)) : "18"
    };
  }
  const exoImp = lista.find(i => String(i.codigoSunat || "").trim() === "9997") ||
    lista.find(i => (Number(i.porcentaje) || 0) === 0);
  return {
    codTributo: (exoImp && String(exoImp.codigoSunat || "").trim()) ? String(exoImp.codigoSunat).trim() : "9997",
    nombreTributo: (exoImp && (exoImp.descripcion || "").trim()) ? String(exoImp.descripcion).trim() : "EXO",
    afectacionIgv: "20",
    porcentajeIgv: "0"
  };
}

/**
 * Genera el XML UBL 2.1 Invoice (Factura 01 o Boleta 03) sin firma.
 * La firma debe aplicarse con el certificado (Facturador o módulo de firma).
 * @param {object} payload - { venta, empresa, cliente, items }
 * @param {string} tipoComprobante - "01" | "03"
 * @param {string} numeroComprobante - Serie-Numero (ej: F001-00000001 o B001-00000008)
 * @returns {string} XML UBL 2.1
 */
function generarXmlUblFacturaBoleta(payload, tipoComprobante, numeroComprobante) {
  const { venta = {}, empresa = {}, cliente = {}, items = [] } = payload;
  const tipoDoc = toStr(cliente.tipoDocSunat) || (String(cliente.ruc).length === 11 ? "6" : "1");
  const numDoc = toStr(cliente.ruc) || "00000000";
  const rucEmisor = toStr(empresa.ruc).replace(/\D/g, "").padStart(11, "0");
  const razonEmisor = escXml(empresa.nombre);
  const razonCliente = escXml(cliente.rSocial || cliente.razonSocial);
  const subtotal = toNum(venta.subtotal);
  let igv = toNum(venta.igv);
  if (igv === 0 && toNum(venta.total) > toNum(venta.subtotal)) {
    igv = Math.round((toNum(venta.total) - toNum(venta.subtotal)) * 100) / 100;
  }
  const total = toNum(venta.total);
  const descuentos = toNum(venta.descuentos);
  const { fecha, hora } = fechaParte(venta.fEmision);
  const tipoCod = String(tipoComprobante || "01").trim();
  const tributo = resolverTributoPrincipal(payload.impuestos || [], igv);
  const codTributo = tributo.codTributo;
  const nombreTributo = tributo.nombreTributo;
  const afectacionIgv = tributo.afectacionIgv;
  const porcentajeIgv = tributo.porcentajeIgv;

  const montoEnLetras = numeroALetras(total);
  const observaciones = toStr(venta.observaciones) || toStr(venta.compRelacionado);
  const ventaParaPago = {
    ...venta,
    codigoComprobante: toStr(venta.codigoComprobante) || String(tipoComprobante || "01").trim()
  };
  const pagoUbl = resolverPagoFacturaBoletaUbl(ventaParaPago, fecha || new Date().toISOString().slice(0, 10));
  const dueDateInvoice = pagoUbl.dueDate || fecha;
  const dirEmisor = toStr(empresa.direccion) || "-";
  const dirCliente = toStr(cliente.direccion) || "-";

  const lineas = [];
  let idx = 1;
  for (const it of items) {
    const cant = toNum(it.cantidad);
    const pUnit = toNum(it.pVenta);
    const lineExt = toNum(it.subtotal);
    const taxAmount = toNum(it.total) - lineExt;
    const desc = escXml(it.descripcion || "Item");
    const codProducto = escXml(it.codigo || String(idx));
    lineas.push(`
    <cac:InvoiceLine>
      <cbc:ID>${idx}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="ZZ" unitCodeListAgencyName="United Nations Economic Commission for Europe" unitCodeListID="UN/ECE rec 20">${cant.toFixed(3)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="PEN">${lineExt.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:PricingReference>
        <cac:AlternativeConditionPrice>
          <cbc:PriceAmount currencyID="PEN">${pUnit.toFixed(5)}</cbc:PriceAmount>
          <cbc:PriceTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Precio" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo16">01</cbc:PriceTypeCode>
        </cac:AlternativeConditionPrice>
      </cac:PricingReference>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="PEN">${taxAmount.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="PEN">${lineExt.toFixed(2)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="PEN">${taxAmount.toFixed(2)}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:Percent>${porcentajeIgv}.00</cbc:Percent>
            <cbc:TaxExemptionReasonCode listAgencyName="PE:SUNAT" listName="Afectacion del IGV" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07">${afectacionIgv}</cbc:TaxExemptionReasonCode>
            <cac:TaxScheme>
              <cbc:ID schemeAgencyName="PE:SUNAT" schemeID="UN/ECE 5153" schemeName="Codigo de tributos">${codTributo}</cbc:ID>
              <cbc:Name>${nombreTributo}</cbc:Name>
              <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Description>${desc}</cbc:Description>
        <cac:SellersItemIdentification>
          <cbc:ID>${codProducto}</cbc:ID>
        </cac:SellersItemIdentification>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="PEN">${pUnit.toFixed(5)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`);
    idx++;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="${NS.UBL}" xmlns:cac="${NS.CAC}" xmlns:cbc="${NS.CBC}" xmlns:ext="${NS.EXT}">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${escXml(numeroComprobante)}</cbc:ID>
  <cbc:IssueDate>${fecha}</cbc:IssueDate>
  <cbc:IssueTime>${hora}</cbc:IssueTime>
  <cbc:DueDate>${escXml(dueDateInvoice)}</cbc:DueDate>
  <cbc:InvoiceTypeCode listAgencyName="PE:SUNAT" listID="0101" listName="Tipo de Documento" listSchemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo51" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01" name="Tipo de Operacion">${tipoCod}</cbc:InvoiceTypeCode>
  <cbc:Note languageLocaleID="1000">${escXml(montoEnLetras)}</cbc:Note>${observaciones ? '\n  <cbc:Note languageLocaleID="1000">' + escXml(observaciones) + '</cbc:Note>' : ''}
  <cbc:DocumentCurrencyCode listAgencyName="United Nations Economic Commission for Europe" listID="ISO 4217 Alpha" listName="Currency">PEN</cbc:DocumentCurrencyCode>
  <cac:Signature>
    <cbc:ID>${rucEmisor}</cbc:ID>
    <cbc:Note>Elaborado por Sistema de Emision Electronica del Contribuyente</cbc:Note>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${rucEmisor}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${razonEmisor}</cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>SIGN</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeAgencyName="PE:SUNAT" schemeID="6" schemeName="Documento de Identidad" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${rucEmisor}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${razonEmisor}</cbc:Name>
      </cac:PartyName>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${razonEmisor}</cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
          <cbc:CitySubdivisionName>-</cbc:CitySubdivisionName>
          <cbc:CityName>-</cbc:CityName>
          <cbc:CountrySubentity>-</cbc:CountrySubentity>
          <cbc:CountrySubentityCode>000000</cbc:CountrySubentityCode>
          <cbc:District>-</cbc:District>
          <cac:AddressLine>
            <cbc:Line>${escXml(dirEmisor)}</cbc:Line>
          </cac:AddressLine>
          <cac:Country>
            <cbc:IdentificationCode>PE</cbc:IdentificationCode>
          </cac:Country>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeAgencyName="PE:SUNAT" schemeID="${tipoDoc}" schemeName="Documento de Identidad" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${numDoc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${razonCliente}</cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:AddressTypeCode>-</cbc:AddressTypeCode>
          <cbc:CitySubdivisionName>-</cbc:CitySubdivisionName>
          <cbc:CityName>-</cbc:CityName>
          <cbc:CountrySubentity>-</cbc:CountrySubentity>
          <cbc:CountrySubentityCode>220901</cbc:CountrySubentityCode>
          <cbc:District>-</cbc:District>
          <cac:AddressLine>
            <cbc:Line>${escXml(dirCliente)}</cbc:Line>
          </cac:AddressLine>
          <cac:Country>
            <cbc:IdentificationCode>PE</cbc:IdentificationCode>
          </cac:Country>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  ${pagoUbl.paymentTermsXml}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="PEN">${igv.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="PEN">${subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="PEN">${igv.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID schemeAgencyName="PE:SUNAT" schemeID="UN/ECE 5153" schemeName="Codigo de tributos">${codTributo}</cbc:ID>
          <cbc:Name>${nombreTributo}</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="PEN">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="PEN">${total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="PEN">${descuentos.toFixed(2)}</cbc:AllowanceTotalAmount>
    <cbc:ChargeTotalAmount currencyID="PEN">0.00</cbc:ChargeTotalAmount>
    <cbc:PrepaidAmount currencyID="PEN">0.00</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="PEN">${total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lineas.join("")}
</Invoice>`;
  return xml;
}

/**
 * Genera XML UBL 2.1 CreditNote (07) para Nota de Crédito.
 * Payload: { venta, empresa, cliente, items, documentoReferencia: { tipoComprobanteRef, serieRef, numeroRef }, motivo: { codigo, descripcion } }
 * motivo.codigo = Catálogo 09 SUNAT (01-13).
 */
function generarXmlUblCreditNote(payload, numeroComprobante) {
  const { venta = {}, empresa = {}, cliente = {}, items = [], documentoReferencia = {}, motivo = {} } = payload;
  const tipoDoc = toStr(cliente.tipoDocSunat) || (String(cliente.ruc).length === 11 ? "6" : "1");
  const numDoc = toStr(cliente.ruc) || "00000000";
  const rucEmisor = toStr(empresa.ruc).replace(/\D/g, "").padStart(11, "0");
  const razonEmisor = escXml(empresa.nombre);
  const razonCliente = escXml(cliente.rSocial || cliente.razonSocial);
  const subtotal = toNum(venta.subtotal);
  let igv = toNum(venta.igv);
  if (igv === 0 && toNum(venta.total) > toNum(venta.subtotal)) {
    igv = Math.round((toNum(venta.total) - toNum(venta.subtotal)) * 100) / 100;
  }
  const total = toNum(venta.total);
  const { fecha, hora } = fechaParte(venta.fEmision);
  const tributo = resolverTributoPrincipal(payload.impuestos || [], igv);
  const tipoRef = String(documentoReferencia.tipoComprobanteRef || "01").trim();
  const serieRef = toStr(documentoReferencia.serieRef);
  const numeroRef = toStr(documentoReferencia.numeroRef).replace(/\D/g, "");
  const docRefId = serieRef && numeroRef ? `${serieRef}-${numeroRef.padStart(8, "0")}` : "";
  const codigoMotivo = toStr(motivo.codigo) || "01";
  const descripcionMotivo = escXml(motivo.descripcion || "Anulación de la operación");

  const lineas = [];
  let idx = 1;
  for (const it of items) {
    const cant = toNum(it.cantidad);
    const pUnit = toNum(it.pVenta);
    const lineExt = toNum(it.subtotal);
    const taxAmount = toNum(it.total) - lineExt;
    const desc = escXml(it.descripcion || "Item");
    lineas.push(`
    <cac:CreditNoteLine>
      <cbc:ID>${idx}</cbc:ID>
      <cbc:CreditedQuantity unitCode="NIU" unitCodeListID="UN/ECE rec 20">${cant}</cbc:CreditedQuantity>
      <cbc:LineExtensionAmount currencyID="PEN">${lineExt.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:PricingReference>
        <cac:AlternativeConditionPrice>
          <cbc:PriceAmount currencyID="PEN">${pUnit.toFixed(2)}</cbc:PriceAmount>
          <cbc:PriceTypeCode listName="Tipo de Precio" listAgencyName="PE:SUNAT" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo16">01</cbc:PriceTypeCode>
        </cac:AlternativeConditionPrice>
      </cac:PricingReference>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="PEN">${taxAmount.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="PEN">${lineExt.toFixed(2)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="PEN">${taxAmount.toFixed(2)}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:ID schemeName="Codigo de tributos" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">${tributo.codTributo}</cbc:ID>
            <cbc:Name>${tributo.nombreTributo}</cbc:Name>
            <cbc:TaxExemptionReasonCode listAgencyName="PE:SUNAT" listName="Afectacion del IGV" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07">${tributo.afectacionIgv}</cbc:TaxExemptionReasonCode>
            <cbc:Percent>${tributo.porcentajeIgv}</cbc:Percent>
            <cac:TaxScheme>
              <cbc:ID schemeName="Codigo de tributos" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">${tributo.codTributo}</cbc:ID>
              <cbc:Name>${tributo.nombreTributo}</cbc:Name>
              <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Description>${desc}</cbc:Description>
        <cac:SellersItemIdentification>
          <cbc:ID>${idx}</cbc:ID>
        </cac:SellersItemIdentification>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="PEN">${pUnit.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:CreditNoteLine>`);
    idx++;
  }

  const NS_CN = "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2";
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="${NS_CN}" xmlns:cac="${NS.CAC}" xmlns:cbc="${NS.CBC}" xmlns:ext="${NS.EXT}" Id="SUNAT">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${escXml(numeroComprobante)}</cbc:ID>
  <cbc:IssueDate>${fecha}</cbc:IssueDate>
  <cbc:IssueTime>${hora}</cbc:IssueTime>
  <cbc:CreditNoteTypeCode listAgencyName="PE:SUNAT" listName="Motivo de nota de credito" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo09">${codigoMotivo}</cbc:CreditNoteTypeCode>
  <cbc:DocumentCurrencyCode listName="Tipo de Moneda" listAgencyName="PE:SUNAT" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo02">PEN</cbc:DocumentCurrencyCode>
  <cac:Signature>
    <cbc:ID>${rucEmisor}-${numeroComprobante}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${rucEmisor}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${razonEmisor}</cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#SIGN-${rucEmisor}</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cbc:CustomerAssignedAccountID>${rucEmisor}</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>6</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${razonEmisor}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cbc:CustomerAssignedAccountID>${numDoc}</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>${tipoDoc}</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${razonCliente}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  ${docRefId ? `<cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${escXml(docRefId)}</cbc:ID>
      <cbc:DocumentTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">${tipoRef}</cbc:DocumentTypeCode>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>` : ""}
  <cac:DiscrepancyResponse>
    <cbc:ReferenceID>${escXml(codigoMotivo)}</cbc:ReferenceID>
    <cbc:ResponseCode>${escXml(codigoMotivo)}</cbc:ResponseCode>
    <cbc:Description>${descripcionMotivo}</cbc:Description>
  </cac:DiscrepancyResponse>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="PEN">${igv.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="PEN">${subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="PEN">${igv.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID schemeName="Codigo de tributos" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">${tributo.codTributo}</cbc:ID>
        <cbc:Name>${tributo.nombreTributo}</cbc:Name>
        <cbc:TaxExemptionReasonCode listAgencyName="PE:SUNAT" listName="Afectacion del IGV" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07">${tributo.afectacionIgv}</cbc:TaxExemptionReasonCode>
        <cbc:Percent>${tributo.porcentajeIgv}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID schemeName="Codigo de tributos" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">${tributo.codTributo}</cbc:ID>
          <cbc:Name>${tributo.nombreTributo}</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="PEN">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="PEN">${total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="PEN">${total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lineas.join("")}
</CreditNote>`;
  return xml;
}

/**
 * Genera XML UBL 2.1 DebitNote (08) para Nota de Débito.
 * Payload: mismo que CreditNote; motivo opcional (SUNAT puede no exigir catálogo para ND).
 */
function generarXmlUblDebitNote(payload, numeroComprobante) {
  const { venta = {}, empresa = {}, cliente = {}, items = [], documentoReferencia = {}, motivo = {} } = payload;
  const tipoDoc = toStr(cliente.tipoDocSunat) || (String(cliente.ruc).length === 11 ? "6" : "1");
  const numDoc = toStr(cliente.ruc) || "00000000";
  const rucEmisor = toStr(empresa.ruc).replace(/\D/g, "").padStart(11, "0");
  const razonEmisor = escXml(empresa.nombre);
  const razonCliente = escXml(cliente.rSocial || cliente.razonSocial);
  const subtotal = toNum(venta.subtotal);
  let igv = toNum(venta.igv);
  if (igv === 0 && toNum(venta.total) > toNum(venta.subtotal)) {
    igv = Math.round((toNum(venta.total) - toNum(venta.subtotal)) * 100) / 100;
  }
  const total = toNum(venta.total);
  const { fecha, hora } = fechaParte(venta.fEmision);
  const tributo = resolverTributoPrincipal(payload.impuestos || [], igv);
  const tipoRef = String(documentoReferencia.tipoComprobanteRef || "01").trim();
  const serieRef = toStr(documentoReferencia.serieRef);
  const numeroRef = toStr(documentoReferencia.numeroRef).replace(/\D/g, "");
  const docRefId = serieRef && numeroRef ? `${serieRef}-${numeroRef.padStart(8, "0")}` : "";
  const descripcionMotivo = escXml(motivo.descripcion || "Otros conceptos");

  const lineas = [];
  let idx = 1;
  for (const it of items) {
    const cant = toNum(it.cantidad);
    const pUnit = toNum(it.pVenta);
    const lineExt = toNum(it.subtotal);
    const taxAmount = toNum(it.total) - lineExt;
    const desc = escXml(it.descripcion || "Item");
    lineas.push(`
    <cac:DebitNoteLine>
      <cbc:ID>${idx}</cbc:ID>
      <cbc:DebitedQuantity unitCode="NIU" unitCodeListID="UN/ECE rec 20">${cant}</cbc:DebitedQuantity>
      <cbc:LineExtensionAmount currencyID="PEN">${lineExt.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:PricingReference>
        <cac:AlternativeConditionPrice>
          <cbc:PriceAmount currencyID="PEN">${pUnit.toFixed(2)}</cbc:PriceAmount>
          <cbc:PriceTypeCode listName="Tipo de Precio" listAgencyName="PE:SUNAT" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo16">01</cbc:PriceTypeCode>
        </cac:AlternativeConditionPrice>
      </cac:PricingReference>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="PEN">${taxAmount.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="PEN">${lineExt.toFixed(2)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="PEN">${taxAmount.toFixed(2)}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:ID schemeName="Codigo de tributos" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">${tributo.codTributo}</cbc:ID>
            <cbc:Name>${tributo.nombreTributo}</cbc:Name>
            <cbc:TaxExemptionReasonCode listAgencyName="PE:SUNAT" listName="Afectacion del IGV" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07">${tributo.afectacionIgv}</cbc:TaxExemptionReasonCode>
            <cbc:Percent>${tributo.porcentajeIgv}</cbc:Percent>
            <cac:TaxScheme>
              <cbc:ID schemeName="Codigo de tributos" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">${tributo.codTributo}</cbc:ID>
              <cbc:Name>${tributo.nombreTributo}</cbc:Name>
              <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Description>${desc}</cbc:Description>
        <cac:SellersItemIdentification>
          <cbc:ID>${idx}</cbc:ID>
        </cac:SellersItemIdentification>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="PEN">${pUnit.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:DebitNoteLine>`);
    idx++;
  }

  const NS_DN = "urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2";
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DebitNote xmlns="${NS_DN}" xmlns:cac="${NS.CAC}" xmlns:cbc="${NS.CBC}" xmlns:ext="${NS.EXT}" Id="SUNAT">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${escXml(numeroComprobante)}</cbc:ID>
  <cbc:IssueDate>${fecha}</cbc:IssueDate>
  <cbc:IssueTime>${hora}</cbc:IssueTime>
  <cbc:DocumentCurrencyCode listName="Tipo de Moneda" listAgencyName="PE:SUNAT" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo02">PEN</cbc:DocumentCurrencyCode>
  <cac:Signature>
    <cbc:ID>${rucEmisor}-${numeroComprobante}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${rucEmisor}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${razonEmisor}</cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#SIGN-${rucEmisor}</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cbc:CustomerAssignedAccountID>${rucEmisor}</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>6</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${razonEmisor}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cbc:CustomerAssignedAccountID>${numDoc}</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>${tipoDoc}</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${razonCliente}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  ${docRefId ? `<cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${escXml(docRefId)}</cbc:ID>
      <cbc:DocumentTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">${tipoRef}</cbc:DocumentTypeCode>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>` : ""}
  <cac:DiscrepancyResponse>
    <cbc:Description>${descripcionMotivo}</cbc:Description>
  </cac:DiscrepancyResponse>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="PEN">${igv.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="PEN">${subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="PEN">${igv.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID schemeName="Codigo de tributos" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">${tributo.codTributo}</cbc:ID>
        <cbc:Name>${tributo.nombreTributo}</cbc:Name>
        <cbc:TaxExemptionReasonCode listAgencyName="PE:SUNAT" listName="Afectacion del IGV" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07">${tributo.afectacionIgv}</cbc:TaxExemptionReasonCode>
        <cbc:Percent>${tributo.porcentajeIgv}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID schemeName="Codigo de tributos" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">${tributo.codTributo}</cbc:ID>
          <cbc:Name>${tributo.nombreTributo}</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="PEN">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="PEN">${total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="PEN">${total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lineas.join("")}
</DebitNote>`;
  return xml;
}

/**
 * Genera el XML UBL 2.1 y lo escribe en la carpeta Firma del Facturador.
 * @param {object} payload - { venta, empresa, cliente, items }
 * @param {string} tipoComprobante - "01" | "03"
 * @param {string} numeroComprobante - Serie-Numero (ej: F001-00000001)
 * @param {string} base - Nombre base sin extensión (ej: 20100066603-01-F001-00000001)
 * @param {string} rutaCarpetaFacturadorSunat - Ruta base del Facturador
 * @returns {{ ok: boolean, rutaEscrita?: string, error?: string }}
 */
function generarYEscribirXmlUblEnFirma(payload, tipoComprobante, numeroComprobante, base, rutaCarpetaFacturadorSunat) {
  const xml = generarXmlUblFacturaBoleta(payload, tipoComprobante, numeroComprobante);
  return escribirXmlFirma(rutaCarpetaFacturadorSunat, base, xml);
}

module.exports = {
  generarXmlUblFacturaBoleta,
  generarXmlUblCreditNote,
  generarXmlUblDebitNote,
  generarYEscribirXmlUblEnFirma
};
