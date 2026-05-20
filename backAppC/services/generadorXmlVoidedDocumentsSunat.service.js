/**
 * Genera XML UBL VoidedDocuments (Comunicación de baja RA) para SUNAT.
 * Referencia: FE Primer - Comunicación de baja, nomenclatura {RUC}-RA-{YYYYMMDD}-{CORRELATIVO}.xml
 * Comprobantes permitidos: 01 Factura, 07 NC, 08 ND (solo aceptados).
 */

/** Raíz del documento RA (UBL Perú). */
const NS_VOIDED = "urn:sunat:names:specification:ubl:peru:schema:xsd:VoidedDocuments-1";
/** sac:VoidedDocumentsLine / VoidedReasonDescription (SUNAT aggregate). Sin esto el prefijo sac: queda sin declarar y el XML no es válido. */
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

/**
 * Genera el XML VoidedDocuments (comunicación de baja RA) sin firma.
 * @param {object} datos - { rucEmisor, razonSocialEmisor, fechaReferencia (YYYYMMDD), fechaComunicacion (YYYYMMDD), correlativo }
 * @param {Array} lineas - Array de { tipoComprobante, serie, numero, motivoBaja }
 * @returns {string} XML
 */
function generarXmlVoidedDocuments(datos, lineas) {
  const ruc = String(datos.rucEmisor || "").replace(/\D/g, "").padStart(11, "0");
  const razon = escXml(datos.razonSocialEmisor || "");
  // fechaComunicacion: fecha de hoy (para ID e IssueDate)
  const fechaCom = String(datos.fechaComunicacion || "").replace(/\D/g, "").slice(0, 8);
  // fechaReferencia: fecha de emisión del comprobante a anular (para ReferenceDate)
  const fechaRef = String(datos.fechaReferencia || fechaCom).replace(/\D/g, "").slice(0, 8);
  const correlativo = String(datos.correlativo || "1").slice(0, 5);
  // ID usa la fecha de COMUNICACIÓN según documentación SUNAT: RA-{YYYYMMDD de comunicación}-{correlativo}
  const idDoc = `RA-${fechaCom}-${correlativo}`;
  // ReferenceDate: fecha de emisión de los comprobantes
  const referenceDate = fechaRef.slice(0, 4) + "-" + fechaRef.slice(4, 6) + "-" + fechaRef.slice(6, 8);
  // IssueDate: fecha de la comunicación de baja (hoy)
  const issueDate = fechaCom.slice(0, 4) + "-" + fechaCom.slice(4, 6) + "-" + fechaCom.slice(6, 8);


  const lineasXml = [];
  let idx = 1;
  for (const lin of lineas) {
    const tipo = String(lin.tipoComprobante || "01").trim();
    const serie = escXml(lin.serie || "");
    // DocumentNumberID: número sin padding de ceros según ejemplo oficial
    const numero = String(lin.numero || "").replace(/\D/g, "");
    const motivo = escXml(lin.motivoBaja || "Anulación de la operación");
    lineasXml.push(`
  <sac:VoidedDocumentsLine>
    <cbc:LineID>${idx}</cbc:LineID>
    <cbc:DocumentTypeCode>${tipo}</cbc:DocumentTypeCode>
    <sac:DocumentSerialID>${serie}</sac:DocumentSerialID>
    <sac:DocumentNumberID>${numero}</sac:DocumentNumberID>
    <sac:VoidReasonDescription>${motivo}</sac:VoidReasonDescription>
  </sac:VoidedDocumentsLine>`);
    idx++;
  }

  const result = `<?xml version="1.0" encoding="UTF-8"?>
<VoidedDocuments xmlns="${NS_VOIDED}" xmlns:sac="${NS_SAC_AGG}" xmlns:cac="${NS_CAC}" xmlns:cbc="${NS_CBC}" xmlns:ext="${NS_EXT}">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>
  <cbc:CustomizationID>1.0</cbc:CustomizationID>
  <cbc:ID>${escXml(idDoc)}</cbc:ID>
  <cbc:ReferenceDate>${referenceDate}</cbc:ReferenceDate>
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
        <cbc:URI>${escXml(ruc)}</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cbc:CustomerAssignedAccountID>${escXml(ruc)}</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>6</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${razon}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  ${lineasXml.join("")}
</VoidedDocuments>`;


  return result;
}

module.exports = { generarXmlVoidedDocuments };
