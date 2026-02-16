/**
 * Firma XML UBL (Factura/Boleta) para SUNAT usando certificado digital PFX.
 * Inserta la firma XMLDSig dentro de ext:ExtensionContent (formato Perú).
 * Requiere: certificadoContenido (buffer PFX) y claveCertificado en configuración.
 */

const forge = require("node-forge");
const { SignedXml } = require("xml-crypto");
const crypto = require("crypto");

const ID_ELEMENTO_FIRMA = "SUNAT";
const ALGORITHM_SHA256 = "http://www.w3.org/2001/04/xmlenc#sha256";
const ALGORITHM_RSA_SHA256 = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
const TRANSFORM_ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
const TRANSFORM_EXC_C14N = "http://www.w3.org/2001/10/xml-exc-c14n#";
const CANONICALIZATION = "http://www.w3.org/2001/10/xml-exc-c14n#";
const XPATH_EXTENSION_CONTENT = "//*[local-name()='ExtensionContent']";

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
 * Firma un XML UBL (Invoice) y devuelve el XML con la firma insertada en ExtensionContent.
 * El elemento raíz debe tener Id="SUNAT" (ya lo añade el generador UBL).
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
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    signatureAlgorithm: ALGORITHM_RSA_SHA256,
    canonicalizationAlgorithm: CANONICALIZATION
  });
  sig.addReference({
    uri: `#${ID_ELEMENTO_FIRMA}`,
    xpath: "//*[@Id='SUNAT']",
    digestAlgorithm: ALGORITHM_SHA256,
    transforms: [TRANSFORM_ENVELOPED, TRANSFORM_EXC_C14N]
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
  return sig.getSignedXml();
}

module.exports = {
  extraerClavePrivadaDePfx,
  firmarXmlUbl,
  ID_ELEMENTO_FIRMA
};
