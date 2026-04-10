/**
 * Compara C14N del Invoice: (A) sin firma nunca vs (B) firma insertada y eliminada (enveloped).
 */
const { SignedXml } = require("xml-crypto");
const { DOMParser, XMLSerializer } = require("@xmldom/xmldom");
const xpath = require("xpath");
const envelopedSignatures = require("xml-crypto/lib/enveloped-signature");

const NS = {
  UBL: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  CAC: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  CBC: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  EXT: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
  DS: "http://www.w3.org/2000/09/xmldsig#"
};

const unsignedXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="${NS.UBL}" xmlns:cac="${NS.CAC}" xmlns:cbc="${NS.CBC}" xmlns:ext="${NS.EXT}">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
</Invoice>`;

function getInvoiceCanon(xmlStr, signatureNodeForEnveloped) {
  const doc = new DOMParser().parseFromString(xmlStr);
  const sig = new SignedXml({
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
  });
  sig.addReference({
    xpath: "//*[local-name()='Invoice']",
    uri: "",
    isEmptyUri: true,
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature"]
  });
  const ref = sig.getReferences()[0];
  const invoice = xpath.select1("//*[local-name()='Invoice']", doc);
  sig.signatureNode = signatureNodeForEnveloped || null;
  return sig.getCanonReferenceXml(doc, ref, invoice);
}

// A: digest como al firmar (sin Signature en el árbol)
const canonA = getInvoiceCanon(unsignedXml, null);

// B: igual que al verificar — documento con firma, luego enveloped quita el nodo
const docB = new DOMParser().parseFromString(unsignedXml);
const extContent = xpath.select1("//*[local-name()='ExtensionContent']", docB);
const sigEl = docB.createElementNS(NS.DS, "ds:Signature");
sigEl.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:ds", NS.DS);
const sv = docB.createElementNS(NS.DS, "ds:SignatureValue");
sv.textContent = "dummy";
sigEl.appendChild(sv);
extContent.appendChild(sigEl);

const sigNode = xpath.select1(
  ".//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']",
  docB.documentElement
);
const xmlWithSig = new XMLSerializer().serializeToString(docB);
const canonB = getInvoiceCanon(xmlWithSig, sigNode);

// console.log("canonA === canonB", canonA === canonB);
// console.log("len A", canonA.length, "len B", canonB.length);
if (canonA !== canonB) {
  for (let i = 0; i < Math.min(canonA.length, canonB.length); i++) {
    if (canonA[i] !== canonB[i]) {
      // console.log("diff@", i, canonA.slice(i, i + 120));
      // console.log("    ", canonB.slice(i, i + 120));
      break;
    }
  }
}
