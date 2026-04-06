/**
 * E2E: genera par RSA, firma XML mínimo UBL con la misma config que producción,
 * y comprueba checkSignature antes/después de añadir C14N explícito en Reference.
 */
const forge = require("node-forge");
const xpath = require("xpath");
const { SignedXml } = require("xml-crypto");
const { DOMParser } = require("@xmldom/xmldom");

const NS = {
  UBL: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  CAC: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  CBC: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  EXT: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
};

const TRANSFORM_ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const SHA1 = "http://www.w3.org/2000/09/xmldsig#sha1";
const RSA_SHA1 = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";

const xmlUbl = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="${NS.UBL}" xmlns:cac="${NS.CAC}" xmlns:cbc="${NS.CBC}" xmlns:ext="${NS.EXT}">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
</Invoice>`;

function firmar(transforms) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "1";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);
  const attrs = [{ name: "commonName", value: "test" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const publicCertPem = forge.pki.certificateToPem(cert);

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: publicCertPem,
    signatureAlgorithm: RSA_SHA1,
    canonicalizationAlgorithm: C14N
  });
  sig.addReference({
    xpath: "//*[local-name()='Invoice']",
    uri: "",
    isEmptyUri: true,
    digestAlgorithm: SHA1,
    transforms
  });
  sig.computeSignature(xmlUbl, {
    prefix: "ds",
    location: {
      reference: "//*[local-name()='ExtensionContent']",
      action: "append"
    },
    existingPrefixes: {
      ext: NS.EXT,
      cac: NS.CAC,
      cbc: NS.CBC
    }
  });
  let signed = sig.getSignedXml();
  signed = signed.replace(/(<ds:Signature)(\s|>)/, "$1 Id=\"SignSUNAT\"$2");
  return { signed, publicCertPem };
}

function verify(signedXml, publicCertPem) {
  const doc = new DOMParser().parseFromString(signedXml);
  const nodes = xpath.select(
    "//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']",
    doc
  );
  const v = new SignedXml({
    canonicalizationAlgorithm: C14N,
    publicCert: publicCertPem
  });
  v.loadSignature(nodes[0]);
  return v.checkSignature(signedXml);
}

const bad = firmar([TRANSFORM_ENVELOPED]);
const good = firmar([TRANSFORM_ENVELOPED, C14N]);
console.log("solo enveloped -> checkSignature:", verify(bad.signed, bad.publicCertPem));
console.log("enveloped + c14n -> checkSignature:", verify(good.signed, good.publicCertPem));
