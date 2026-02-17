/**
 * Genera XML UBL 2.1 para Factura/Boleta (Peru SUNAT) a partir del mismo payload que los archivos planos.
 * El XML se escribe en la carpeta Firma del Facturador para que pueda ser enviado a SUNAT.
 * No reemplaza el flujo de archivos planos; es una alternativa (generar XML directo → escribir Firma → enviar).
 *
 * Importante: SUNAT exige XML firmado digitalmente. Este módulo genera el UBL sin firma (Signature es plantilla).
 * Para producción: el Facturador SFS debe firmar el XML que está en Firma antes de enviar, o se debe añadir
 * un paso de firma con el certificado (ConfiguracionFacturacionElectronica.certificadoDigital y claveCertificado).
 *
 * Referencias: UBL 2.1, CustomizationID 2.0 (Peru), estructura según ejemplos SUNAT/Greenter.
 */

const { escribirXmlFirma } = require("../utils/facturadorSunat.util");

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

  const lineas = [];
  let idx = 1;
  for (const it of items) {
    const cant = toNum(it.cantidad);
    const pUnit = toNum(it.pVenta);
    const lineExt = toNum(it.subtotal);
    const taxAmount = toNum(it.total) - lineExt;
    const desc = escXml(it.descripcion || "Item");
    lineas.push(`
    <cac:InvoiceLine>
      <cbc:ID>${idx}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="NIU" unitCodeListID="UN/ECE rec 20">${cant}</cbc:InvoicedQuantity>
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
            <cbc:ID schemeName="Codigo de tributos" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">${codTributo}</cbc:ID>
            <cbc:Name>${nombreTributo}</cbc:Name>
            <cbc:TaxExemptionReasonCode listAgencyName="PE:SUNAT" listName="Afectacion del IGV" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07">${afectacionIgv}</cbc:TaxExemptionReasonCode>
            <cbc:Percent>${porcentajeIgv}</cbc:Percent>
            <cac:TaxScheme>
              <cbc:ID schemeName="Codigo de tributos" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">${codTributo}</cbc:ID>
              <cbc:Name>${nombreTributo}</cbc:Name>
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
    </cac:InvoiceLine>`);
    idx++;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="${NS.UBL}" xmlns:cac="${NS.CAC}" xmlns:cbc="${NS.CBC}" xmlns:ext="${NS.EXT}" Id="SUNAT">
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
  <cbc:InvoiceTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">${tipoCod}</cbc:InvoiceTypeCode>
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
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="PEN">${igv.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="PEN">${subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="PEN">${igv.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID schemeName="Codigo de tributos" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">${codTributo}</cbc:ID>
        <cbc:Name>${nombreTributo}</cbc:Name>
        <cbc:TaxExemptionReasonCode listAgencyName="PE:SUNAT" listName="Afectacion del IGV" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07">${afectacionIgv}</cbc:TaxExemptionReasonCode>
        <cbc:Percent>${porcentajeIgv}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID schemeName="Codigo de tributos" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">${codTributo}</cbc:ID>
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
    <cbc:PayableAmount currencyID="PEN">${total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lineas.join("")}
</Invoice>`;
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
  generarYEscribirXmlUblEnFirma
};
