/* Script temporal: verificar digest de XML firmado con xml-crypto (mismo stack que firma). */
const fs = require("fs");
const path = require("path");
const xpath = require("xpath");
const { SignedXml } = require("xml-crypto");
const { DOMParser } = require("@xmldom/xmldom");

const xmlPath = process.argv[2] || path.join(__dirname, "../xml_firmados_sunat/10456333538-03-B001-00000012.xml");
const xml = fs.readFileSync(xmlPath, "utf8");
const doc = new DOMParser().parseFromString(xml);
const nodes = xpath.select(
  "//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']",
  doc
);
if (!nodes || !nodes.length) {
  console.error("No Signature");
  process.exit(1);
}
const sig = new SignedXml({
  canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
});
sig.loadSignature(nodes[0]);
let ok;
try {
  ok = sig.checkSignature(xml);
} catch (e) {
  console.error("checkSignature threw:", e.message);
  process.exit(1);
}
// console.log("checkSignature:", ok);
sig.getReferences().forEach((r, i) => {
  if (r.validationError) {
    // console.log("ref", i, r.validationError.message);
  }
});
