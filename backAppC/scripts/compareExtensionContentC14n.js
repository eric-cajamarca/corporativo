/** Compara C14N del Invoice con ExtensionContent self-close vs explícito vacío (sin firma). */
const { SignedXml } = require("xml-crypto");
const { DOMParser } = require("@xmldom/xmldom");
const xpath = require("xpath");

const NS = {
  UBL: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  CAC: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  CBC: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  EXT: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
};

function miniInvoice(extContentTag) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="${NS.UBL}" xmlns:cac="${NS.CAC}" xmlns:cbc="${NS.CBC}" xmlns:ext="${NS.EXT}">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      ${extContentTag}
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
</Invoice>`;
}

function canonInvoiceBody(xmlStr) {
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
  sig.signatureNode = null;
  return sig.getCanonReferenceXml(doc, ref, invoice);
}

const a = canonInvoiceBody(miniInvoice("<ext:ExtensionContent/>"));
const b = canonInvoiceBody(miniInvoice("<ext:ExtensionContent></ext:ExtensionContent>"));
// console.log("self-close length", a.length, "explicit empty length", b.length);
// console.log("equal", a === b);
if (a !== b) {
  const la = a.length;
  const lb = b.length;
  const n = Math.min(la, lb);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      // console.log("first diff at", i, JSON.stringify(a.slice(i, i + 80)), "vs", JSON.stringify(b.slice(i, i + 80)));
      break;
    }
  }
}
