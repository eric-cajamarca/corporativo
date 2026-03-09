/**
 * Firma XML UBL (Factura/Boleta) para SUNAT usando certificado digital PFX.
 * Inserta la firma XMLDSig dentro de ext:ExtensionContent (formato Perú).
 * Requiere: certificadoContenido (buffer PFX) y claveCertificado en configuración.
 */

const forge = require("node-forge");
const { SignedXml } = require("xml-crypto");
const crypto = require("crypto");

const XPATH_EXTENSION_CONTENT = "//*[local-name()='ExtensionContent']";
// Facturador SUNAT: Reference URI="" (firma todo el documento), un solo Transform (enveloped-signature), SHA1/RSA-SHA1, c14n 20010315
const ALGORITHM_SHA1 = "http://www.w3.org/2000/09/xmldsig#sha1";
const ALGORITHM_RSA_SHA1 = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
const TRANSFORM_ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
const CANONICALIZATION_FACTURADOR = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";

/**
 * Extrae la clave privada en formato PEM desde un buffer PFX y contraseña.
 * @param {Buffer} pfxBuffer - Contenido binario del archivo .pfx
 * @param {string} password - Contraseña del certificado
 * @returns {string} PEM de la clave privada
 */
function extraerClavePrivadaDePfx(pfxBuffer, password) {
  if (!pfxBuffer || !password) {
    throw new Error("Certificado PFX y clave son requeridos para firmar");
  }
  const buf = Buffer.isBuffer(pfxBuffer) ? pfxBuffer : Buffer.from(pfxBuffer);
  const binary = buf.toString("binary");
  const asn1 = forge.asn1.fromDer(binary);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, true, password);
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  if (!keyBag || keyBag.length === 0) {
    throw new Error("No se encontró clave privada en el certificado PFX");
  }
  const privateKey = keyBag[0].key;
  return forge.pki.privateKeyToPem(privateKey);
}

/**
 * Extrae el certificado X.509 en formato PEM desde un buffer PFX (para incluir en KeyInfo).
 * SUNAT exige que la firma incluya ds:KeyInfo con ds:X509Certificate según manual del programador.
 * @param {Buffer} pfxBuffer - Contenido binario del archivo .pfx
 * @param {string} password - Contraseña del certificado
 * @returns {string} PEM del certificado (para publicCert en SignedXml)
 */
function extraerCertificadoDePfx(pfxBuffer, password) {
  if (!pfxBuffer || !password) return null;
  const buf = Buffer.isBuffer(pfxBuffer) ? pfxBuffer : Buffer.from(pfxBuffer);
  const binary = buf.toString("binary");
  const asn1 = forge.asn1.fromDer(binary);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, true, password);
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBagList = certBags[forge.pki.oids.certBag];
  if (!certBagList || certBagList.length === 0 || !certBagList[0].cert) {
    return null;
  }
  return forge.pki.certificateToPem(certBagList[0].cert);
}

/**
 * Firma un XML UBL (Invoice) y devuelve el XML con la firma insertada en ExtensionContent.
 * Estructura alineada con Facturador SUNAT: Reference URI="" (todo el documento), Id="SignSUNAT" en la firma,
 * un solo Transform (enveloped-signature), SHA1/RSA-SHA1, Canonicalization 20010315.
 * @param {string} xmlUbl - XML UBL completo (sin firma en ExtensionContent)
 * @param {Buffer} certificadoContenido - Buffer del archivo .pfx
 * @param {string} claveCertificado - Contraseña del PFX
 * @returns {string} XML firmado (firma dentro de ext:ExtensionContent)
 */
function firmarXmlUbl(xmlUbl, certificadoContenido, claveCertificado) {
  if (!xmlUbl || !certificadoContenido || !claveCertificado) {
    throw new Error("XML, certificado y clave son requeridos para firmar");
  }
  const privateKeyPem = extraerClavePrivadaDePfx(
    certificadoContenido,
    claveCertificado
  );
  const publicCertPem = extraerCertificadoDePfx(certificadoContenido, claveCertificado);
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: publicCertPem || undefined,
    signatureAlgorithm: ALGORITHM_RSA_SHA1,
    canonicalizationAlgorithm: CANONICALIZATION_FACTURADOR
  });
  // Facturador: Reference URI="" (firma todo el documento), un solo Transform.
  // xml-crypto requiere xpath explícito para createReferences; con uri vacío no asigna xpath y falla el parse.
  sig.addReference({
    xpath: "//*[local-name()='Invoice']",
    uri: "",
    isEmptyUri: true,
    digestAlgorithm: ALGORITHM_SHA1,
    transforms: [TRANSFORM_ENVELOPED]
  });
  sig.computeSignature(xmlUbl, {
    prefix: "ds",
    location: {
      reference: XPATH_EXTENSION_CONTENT,
      action: "append"
    },
    existingPrefixes: {
      ext: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
      cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
      cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
    }
  });
  let signed = sig.getSignedXml();
  // Facturador usa Id="SignSUNAT" en el elemento ds:Signature
  signed = signed.replace(/(<ds:Signature)(\s|>)/, "$1 Id=\"SignSUNAT\"$2");
  return signed;
}

module.exports = {
  extraerClavePrivadaDePfx,
  extraerCertificadoDePfx,
  firmarXmlUbl
};
