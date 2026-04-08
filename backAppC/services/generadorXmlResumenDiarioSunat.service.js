/**
 * Genera XML UBL SummaryDocuments (Resumen Diario RC) para SUNAT.
 * Referencia: FE Primer - Resumen diario, nomenclatura {RUC}-RC-{YYYYMMDD}-{CORRELATIVO}.xml
 */

const NS_SUMMARY = "urn:sunat:names:specification:ubl:peru:schema:xsd:SummaryDocuments-1";
const NS_SAC_AGG = "urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1";
const NS_CAC = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
const NS_CBC = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
const NS_EXT = "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2";

function escXml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toNum(v) {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

/**
 * Genera el XML SummaryDocuments (resumen diario RC) sin firma.
 * @param {object} datos - { rucEmisor, razonSocialEmisor, fechaResumen (YYYYMMDD), correlativo, lineas }
 * @param {Array} lineas - Array de { tipoComprobante, serie, numero, fechaEmision, tipoDocReceptor, numeroDocReceptor, totalGravada, totalIgv, total, documentoReferencia?, serieReferencia? } (documentoReferencia para NC/ND)
 * @returns {string} XML
 */
function generarXmlResumenDiario(datos, lineas) {
  const ruc = String(datos.rucEmisor || "").replace(/\D/g, "").padStart(11, "0");
  const razon = escXml(datos.razonSocialEmisor || "");
  const fechaResumen = String(datos.fechaResumen || "").replace(/\D/g, "").slice(0, 8);
  const correlativo = String(datos.correlativo || "1").slice(0, 5);
  const idDoc = `RC-${fechaResumen}-${correlativo}`;

  const lineasXml = [];
  let idx = 1;
  for (const lin of lineas) {
    const tipo = String(lin.tipoComprobante || "03").trim();
    const serie = escXml(lin.serie || "");
    const numero = String(lin.numero || "").replace(/\D/g, "").padStart(8, "0");
    const fechaEmision = String(lin.fechaEmision || "").slice(0, 10).replace(/\D/g, "");
    const tipoDocReceptor = String(lin.tipoDocReceptor || "1").trim();
    const numDocReceptor = String(lin.numeroDocReceptor || "").replace(/\D/g, "").padStart(8, "0");
    const totalGravada = toNum(lin.totalGravada).toFixed(2);
    const totalIgv = toNum(lin.totalIgv).toFixed(2);
    const total = toNum(lin.total).toFixed(2);
    const estado = lin.estado != null ? parseInt(lin.estado, 10) : 1;

    let refXml = "";
    if ((tipo === "07" || tipo === "08") && (lin.serieReferencia || lin.numeroReferencia)) {
      const serRef = escXml(lin.serieReferencia || "");
      const numRef = String(lin.numeroReferencia || "").replace(/\D/g, "").padStart(8, "0");
      refXml = `
        <sac:BillingReference>
          <cbc:DocumentTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">03</cbc:DocumentTypeCode>
          <cbc:ID>${serRef}-${numRef}</cbc:ID>
        </sac:BillingReference>`;
    }

    lineasXml.push(`
    <sac:SummaryDocumentsLine>
      <cbc:LineID>${idx}</cbc:LineID>
      <cbc:DocumentTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">${tipo}</cbc:DocumentTypeCode>
      <cbc:DocumentSerialID>${serie}</cbc:DocumentSerialID>
      <cbc:StartDocumentNumber>${numero}</cbc:StartDocumentNumber>
      <cbc:EndDocumentNumber>${numero}</cbc:EndDocumentNumber>
      <sac:AccountingCustomerParty>
        <cbc:CustomerAccountID>${numDocReceptor}</cbc:CustomerAccountID>
        <cbc:AdditionalAccountID>${tipoDocReceptor}</cbc:AdditionalAccountID>
      </sac:AccountingCustomerParty>
      <sac:BillingPayment>
        <cbc:PaidAmount currencyID="PEN">${total}</cbc:PaidAmount>
        <cbc:InstructionID>1</cbc:InstructionID>
      </sac:BillingPayment>
      <sac:AllowanceCharge>
        <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
        <cbc:Amount currencyID="PEN">0.00</cbc:Amount>
      </sac:AllowanceCharge>
      <sac:TaxTotal>
        <cbc:TaxAmount currencyID="PEN">${totalIgv}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="PEN">${totalGravada}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="PEN">${totalIgv}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:ID schemeName="Codigo de tributos" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">1000</cbc:ID>
            <cbc:Name>IGV</cbc:Name>
            <cbc:TaxExemptionReasonCode listAgencyName="PE:SUNAT" listName="Afectacion del IGV" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07">10</cbc:TaxExemptionReasonCode>
            <cbc:Percent>18</cbc:Percent>
            <cac:TaxScheme>
              <cbc:ID schemeName="Codigo de tributos" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05">1000</cbc:ID>
              <cbc:Name>IGV</cbc:Name>
              <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </sac:TaxTotal>
      <cbc:TotalAmount currencyID="PEN">${total}</cbc:TotalAmount>
      <cbc:Status>${estado}</cbc:Status>${refXml}
    </sac:SummaryDocumentsLine>`);
    idx++;
  }

  const issueDate = fechaResumen.slice(0, 4) + "-" + fechaResumen.slice(4, 6) + "-" + fechaResumen.slice(6, 8);

  return `<?xml version="1.0" encoding="UTF-8"?>
<SummaryDocuments xmlns="${NS_SUMMARY}" xmlns:sac="${NS_SAC_AGG}" xmlns:cac="${NS_CAC}" xmlns:cbc="${NS_CBC}" xmlns:ext="${NS_EXT}">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>
  <cbc:CustomizationID>1.1</cbc:CustomizationID>
  <cbc:ID>${escXml(idDoc)}</cbc:ID>
  <cbc:ReferenceDate>${issueDate}</cbc:ReferenceDate>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cac:Signature>
    <cbc:ID>${escXml(ruc)}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${escXml(ruc)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${razon}</cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#SIGN-${escXml(ruc)}</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cbc:CustomerAccountID>${escXml(ruc)}</cbc:CustomerAccountID>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${razon}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  ${lineasXml.join("")}
</SummaryDocuments>`;
}

module.exports = { generarXmlResumenDiario };
