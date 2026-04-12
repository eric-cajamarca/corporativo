/**
 * Servicio para registrar y enviar Guías de Remisión Electrónicas (GRE) a SUNAT.
 *
 * Flujo correcto según Manual URL – GRE:
 *   1. Obtiene configuración de la empresa (urlBaseApiGuias, idApiGuias, claveApiGuias, rucEmpresa).
 *   2. Auto-genera serie/número correlativo (T001-XXXXXXXX remitente, V001-XXXXXXXX transportista).
 *   3. Inserta la guía en GuiasElectronicasEmitidas con estado PENDIENTE.
 *   4. Si hay credenciales API configuradas:
 *      a. Obtiene token OAuth2 de SUNAT api-seguridad.
 *      b. Construye XML UBL 2.1 (DespatchAdvice) y lo firma con el certificado PFX (ExtensionContent + ds:Signature).
 *      c. Comprime el XML en ZIP usando JSZip.
 *      d. Calcula hash SHA-256 del ZIP.
 *      e. POST a {urlBase}/v1/contribuyente/gem/comprobantes/{ruc}-{tipo}-{serie}-{numero}
 *         con body { archivo: { nomArchivo, arcGreZip, hashZip } }.
 *      f. SUNAT responde { numTicket, fecRecepcion } → guarda ticket, estado EN_PROCESO (2).
 *   5. El job guiasTicket.job.js consulta periódicamente el ticket:
 *      GET {urlBase}/v1/contribuyente/gem/comprobantes/envios/{numTicket}
 *      Respuestas: "98" en proceso, "0" aceptado, "99" error.
 */

const crypto  = require("crypto");
const fs      = require("fs/promises");
const path    = require("path");
const JSZip   = require("jszip");
const axios   = require("axios");
const qs      = require("querystring");
const guiaRepo            = require("../repositories/guiaElectronica.repository");
const facturacionRepo     = require("../repositories/facturacion.repository");
const { descifrar }       = require("../utils/cifradoClaveCertificado.util");
const { normalizarRucSunatGre } = require("../utils/rucSunatGre.util");
const firmaXmlSunat       = require("./firmaXmlSunat.service");

const SUNAT_OAUTH_BASE    = "https://api-seguridad.sunat.gob.pe";
const SUNAT_OAUTH_TIMEOUT = 10000;
const SUNAT_GRE_TIMEOUT   = 20000;

// Código convencional de estado en GuiasElectronicasEmitidas.idEstadoSunat
const ESTADO_PENDIENTE  = null; // Nunca enviado (sin credenciales o fallo pre-envío)
const ESTADO_EN_PROCESO = 2;    // Ticket recibido, esperando resolución SUNAT
const ESTADO_ACEPTADO   = 1;    // Aceptado por SUNAT (codRespuesta "0")
const ESTADO_ERROR      = 98;   // Rechazado o error (codRespuesta "99")

/**
 * Ubigeo en cbc:ID (Address / Location). Solo atributos permitidos por XSD UBL 2.1 para Identifier:
 * listAgencyName/listName/listURI en cbc:ID rechazan validación GEM (error 0306 cvc-complex-type.3.2.2).
 */
const ATTRS_ID_UBIGEO_GRE = ' schemeName="Ubigeos" schemeAgencyName="PE:INEI"';

/** Misma convención que el ZIP GEM: `{ruc}-{tipo}-{serie}-{numero}.xml` */
const DIR_XML_FIRMADOS_SUNAT = path.join(__dirname, "..", "xml_firmados_sunat");

async function guardarXmlFirmadoGreEnDisco(ruc, tipoDoc, serie, numStr, xmlFirmado) {
  try {
    if (!xmlFirmado || String(xmlFirmado).trim() === "") return;
    await fs.mkdir(DIR_XML_FIRMADOS_SUNAT, { recursive: true });
    const nombreBase = `${ruc}-${String(tipoDoc)}-${serie}-${numStr}.xml`;
    const ruta       = path.join(DIR_XML_FIRMADOS_SUNAT, nombreBase);
    await fs.writeFile(ruta, xmlFirmado, "utf8");
  } catch (err) {
    console.error("guiaElectronica.service guardarXmlFirmadoGreEnDisco:", err.message || err);
  }
}

/** Persiste XML firmado en BD (columna xmlFirmado). Ignora error si la migración no está aplicada. */
async function persistirXmlFirmadoGuia(pool, idGuiaElectronica, idEmpresa, xmlFirmado) {
  try {
    await guiaRepo.guardarXmlFirmadoGuiaRepo(pool, idGuiaElectronica, idEmpresa, xmlFirmado);
  } catch (err) {
    const msg = err.message || String(err);
    if (/Invalid column name ['"]xmlFirmado['"]|column.*xmlFirmado/i.test(msg)) {
      console.error(
        "guiaElectronica.service: columna xmlFirmado ausente. Ejecute migración add_guias_emitidas_xml_firmado.sql"
      );
      return;
    }
    console.error("guiaElectronica.service persistirXmlFirmadoGuia:", msg);
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────

/**
 * Extrae y descifra las credenciales GRE de la configuración.
 * claveApiGuias se almacena cifrada con AES-256-GCM (prefijo "enc:").
 * rucApiGuias es el RUC usado al registrar la app en SUNAT portal (puede diferir
 * del RUC de la empresa). Si está vacío se usa el ruc del emisor.
 * @returns {{ urlBase, clientId, clientSecret, rucApiGuias }}
 */
function extraerCredencialesGre(config, rucEmisorFallback) {
  const urlBase      = (config.urlBaseApiGuias || "").trim();
  const clientId     = (config.idApiGuias      || "").trim();
  const clientSecret = descifrar(config.claveApiGuias || "")?.trim() || "";
  const cfgRucRaw    = (config.rucApiGuias || "").trim();
  const fallbackRaw  = String(rucEmisorFallback || "").trim();
  const mergedRaw    = cfgRucRaw || fallbackRaw;
  const rucApiGuias  = normalizarRucSunatGre(mergedRaw) || mergedRaw.replace(/\D/g, "");
  const fuenteOAuth  = cfgRucRaw ? "rucApiGuias (ConfiguracionFacturacionElectronica)" : "Empresas.ruc (idEmpresa del JWT)";
  console.error("[GRE] RUC en URL de token OAuth2:", rucApiGuias || "(vacío)", "| origen:", fuenteOAuth);
  if (cfgRucRaw) {
    console.error("[GRE] rucApiGuias en BD (raw):", cfgRucRaw);
  } else {
    console.error("[GRE] Empresas.ruc (raw desde consulta):", fallbackRaw || "(vacío)");
  }
  return { urlBase, clientId, clientSecret, rucApiGuias };
}

/** Obtiene token OAuth2 de SUNAT GRE (api-seguridad). */
/**
 * Prueba una variante de OAuth2 y retorna la respuesta.
 * Loguea exactamente qué se envía y qué responde SUNAT.
 */
async function probarVariante(url, cid, csc, tag, body, extraHeaders = {}) {
  const headers = { "Content-Type": "application/x-www-form-urlencoded", ...extraHeaders };
  console.error(`[GRE OAuth2][${tag}] → ${url}`);
  let bodyLog = body.replace(csc, "***");
  if (body.includes("password=")) {
    bodyLog = bodyLog.replace(/password=[^&]*/i, "password=***");
  }
  console.error(`[GRE OAuth2][${tag}] body: ${bodyLog}`);
  if (extraHeaders.Authorization) {
    console.error(`[GRE OAuth2][${tag}] Authorization: ${extraHeaders.Authorization.slice(0, 20)}...`);
  }
  const resp = await axios.post(url, body, { headers, timeout: SUNAT_OAUTH_TIMEOUT, validateStatus: () => true });
  console.error(`[GRE OAuth2][${tag}] HTTP ${resp.status} →`, JSON.stringify(resp.data));
  return resp;
}

/**
 * Usuario SOL para OAuth GRE (Desktop): RUC+usuario o usuario ya completo (misma regla que envío SOAP).
 */
function usernameSolParaGre(ruc11, usuarioSunat) {
  const u = (usuarioSunat || "").trim();
  if (!u) return "";
  if (u.length >= 20 || /^\d+/.test(u)) return u;
  return ruc11 + u;
}

/** Decodifica payload JWT (sin verificar firma) para inspeccionar `aud`. */
function jwtPayloadSinVerificar(accessToken) {
  try {
    const parts = String(accessToken).split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    return JSON.parse(Buffer.from(b64 + pad, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

/** El token debe permitir api-cpe / GEM; no aceptar p. ej. solo consulta contribuyentes. */
function tokenIncluyeAlcanceGemGre(accessToken) {
  const p = jwtPayloadSinVerificar(accessToken);
  if (!p || p.aud == null) return true;
  const s = typeof p.aud === "string" ? p.aud : JSON.stringify(p.aud);
  return s.includes("gem") || s.includes("api-cpe");
}

/**
 * OAuth2 GRE SUNAT:
 * - Desktop + SOL primero (suele dar token con GEM en `aud`).
 * - Web client_credentials solo con scopes api-cpe/gem (no consulta contribuyentes).
 * - Web: POST .../clientesextranet/{client_id}/oauth2/token/ ; Desktop: clientessol + password.
 *
 * @param {object|null} config — fila ConfiguracionFacturacionElectronica (usuarioSunat, claveSunat cifrada).
 */
async function obtenerTokenOauth2(ruc, clientId, clientSecret, config = null) {
  const rucPath = normalizarRucSunatGre(ruc) || String(ruc || "").replace(/\D/g, "");
  const cid = (clientId     || "").trim();
  const csc = (clientSecret || "").trim();

  console.error("=== [GRE OAuth2] INICIO ===");
  console.error("[GRE OAuth2] client_id (UUID app):", cid);
  console.error("[GRE OAuth2] client_secret_len:", csc.length, "| primeros 6:", csc.slice(0, 6));
  console.error("[GRE OAuth2] RUC emisor (11 dígitos, XML/envío):", rucPath);

  // Solo scopes válidos para GRE; NO usar consulta integrada contribuyentes (token inútil para GEM).
  const SCOPES = [
    "https://api-cpe.sunat.gob.pe",
    "https://api-cpe.sunat.gob.pe/v1/contribuyente/gem",
    ""   // sin scope
  ];

  let solUnauthorizedClient = false;
  let webInvalidScopeApiCpe = false;

  // ── 1) Desktop / SOL primero (token con GEM en aud). Solo aplica a apps «Desktop» en SUNAT.
  if (config && cid && csc && rucPath.length === 11) {
    const usuarioRaw = (config.usuarioSunat || "").trim();
    let claveSol = "";
    if (config.claveSunat) {
      claveSol = (descifrar(config.claveSunat) || "").trim();
      if (!claveSol) {
        const raw = String(config.claveSunat).trim();
        if (raw && !raw.startsWith("enc:")) claveSol = raw;
      }
    }
    if (usuarioRaw && claveSol) {
      const usernameGre = usernameSolParaGre(rucPath, usuarioRaw);
      const urlsSol = [
        `${SUNAT_OAUTH_BASE}/v1/clientessol/${cid}/oauth2/token/`,
        `${SUNAT_OAUTH_BASE}/v1/clientessol/${cid}/oauth2/token`
      ];
      console.error("=== [GRE OAuth2] Flujo DESKTOP/SOL: clientessol/{client_id} + password ===");
      console.error("[GRE OAuth2][sol] usuario OAuth (RUC+nombre SOL):", usernameGre.slice(0, 18) + (usernameGre.length > 18 ? "…" : ""));
      const params = new URLSearchParams();
      params.set("grant_type", "password");
      params.set("scope", "https://api-cpe.sunat.gob.pe");
      params.set("client_id", cid);
      params.set("client_secret", csc);
      params.set("username", usernameGre);
      params.set("password", claveSol);
      const bodySol = params.toString();
      for (const url of urlsSol) {
        const rSol = await probarVariante(url, cid, csc, "sol-password", bodySol);
        if (rSol.status === 401 && String(rSol.data?.error || "") === "unauthorized_client") {
          solUnauthorizedClient = true;
        }
        if (rSol.status === 200 && rSol.data?.access_token) {
          const tok = rSol.data.access_token;
          if (!tokenIncluyeAlcanceGemGre(tok)) {
            console.error("[GRE OAuth2] Token SOL sin alcance GEM/api-cpe en JWT; probando otra URL o flujo Web.");
            continue;
          }
          console.error("[GRE OAuth2] ÉXITO (SOL/Desktop).");
          return tok;
        }
      }
      if (solUnauthorizedClient) {
        console.error(
          "[GRE OAuth2] Nota: «cliente no autorizado» en clientessol+password suele indicar que este client_id " +
            "es de una aplicación WEB en SUNAT; ese flujo solo admite apps con alcance «Desktop»."
        );
      }
    } else {
      console.error("[GRE OAuth2] Sin usuarioSunat/claveSunat → no se prueba flujo SOL.");
    }
  }

  const extranetSegments = [];
  if (cid) extranetSegments.push({ label: "client_id(UUID)", value: cid });
  if (rucPath && rucPath !== cid) extranetSegments.push({ label: "ruc", value: rucPath });

  console.error("=== [GRE OAuth2] Flujo WEB: clientesextranet/{segment} + client_credentials ===");

  for (const { label, value } of extranetSegments) {
    const URLS = [
      `${SUNAT_OAUTH_BASE}/v1/clientesextranet/${value}/oauth2/token/`,
      `${SUNAT_OAUTH_BASE}/v1/clientesextranet/${value}/oauth2/token`
    ];
    console.error(`[GRE OAuth2] Probando segmento path (${label}):`, value);
    for (const url of URLS) {
      for (const scope of SCOPES) {
        const scopePart = scope ? `&scope=${scope}` : "";
        const bodyVariant = `grant_type=client_credentials&client_id=${cid}&client_secret=${csc}${scopePart}`;
        const r1 = await probarVariante(url, cid, csc, `web|${label}|body|${scope || "sin-scope"}`, bodyVariant);
        if (r1.status === 400 && r1.data?.error === "invalid_scope" && scope && String(scope).includes("api-cpe")) {
          webInvalidScopeApiCpe = true;
        }
        if (r1.status === 200 && r1.data?.access_token) {
          const tok = r1.data.access_token;
          if (!tokenIncluyeAlcanceGemGre(tok)) {
            console.error("[GRE OAuth2] Token client_credentials ignorado: aud sin GEM/api-cpe (no sirve para guías).");
            continue;
          }
          console.error("[GRE OAuth2] ÉXITO client_credentials (body). segmento:", label, "scope:", scope || "(ninguno)");
          return tok;
        }
        const b64 = Buffer.from(`${cid}:${csc}`).toString("base64");
        const bodyBasic = `grant_type=client_credentials${scopePart}`;
        const r2 = await probarVariante(url, cid, csc, `web|${label}|basic|${scope || "sin-scope"}`, bodyBasic, { Authorization: `Basic ${b64}` });
        if (r2.status === 200 && r2.data?.access_token) {
          const tok = r2.data.access_token;
          if (!tokenIncluyeAlcanceGemGre(tok)) {
            console.error("[GRE OAuth2] Token Basic ignorado: aud sin GEM/api-cpe.");
            continue;
          }
          console.error("[GRE OAuth2] ÉXITO client_credentials (Basic). segmento:", label, "scope:", scope || "(ninguno)");
          return tok;
        }
      }
    }
  }

  console.error("=== [GRE OAuth2] TODAS LAS VARIANTES FALLARON ===");

  const partes = ["No se obtuvo token válido para GRE."];
  if (solUnauthorizedClient) {
    partes.push(
      "SUNAT rechazó el flujo con usuario/clave SOL («cliente no autorizado»): el ID de aplicación guardado " +
        "corresponde casi seguro a una app tipo «Web»; el endpoint clientessol+password solo acepta credenciales " +
        "de app «Desktop» registrada con servicio GRE. Cree en el portal otra aplicación con alcance Desktop y GRE, " +
        "y use su ID+clave junto al usuario SOL (principal o secundario) y contraseña en Configuración de facturación."
    );
  }
  if (webInvalidScopeApiCpe) {
    partes.push(
      "Además SUNAT indicó «scope no valido» para https://api-cpe…: esa misma app Web no tiene asignado el servicio " +
        "de emisión GRE en «Credenciales de API». Debe editarla o crear credenciales que incluyan GRE/api-cpe, " +
        "o usar solo la pareja Desktop+SOL anterior."
    );
  }
  if (!solUnauthorizedClient && !webInvalidScopeApiCpe) {
    partes.push(
      "Revise ID+clave de la app, usuario SUNAT (solo el nombre corto; el sistema antepone el RUC) y clave SOL."
    );
  }
  throw new Error(partes.join(" "));
}

/**
 * Usado por el job de tickets: misma lógica OAuth (SOL + client_credentials).
 */
exports.obtenerTokenGreConConfig = async (pool, ruc, clientId, clientSecret, idEmpresa) => {
  const config = await facturacionRepo.obtenerConfiguracionFacturacionRepo(pool, idEmpresa);
  return obtenerTokenOauth2(ruc, clientId, clientSecret, config);
};

/** Escapa caracteres especiales XML. */
function x(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * cbc:IssueDate en GRE es xs:date (solo YYYY-MM-DD). No usar fecha-hora completa en el XML.
 * @returns {string|null}
 */
function normalizarFechaEmisionGreYmd(val) {
  if (val == null) return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const da = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  }
  const s = String(val).trim();
  if (!s) return null;
  const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
  const mSlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (mSlash) {
    const da = mSlash[1].padStart(2, "0");
    const mo = mSlash[2].padStart(2, "0");
    const y = mSlash[3];
    return `${y}-${mo}-${da}`;
  }
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const da = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  }
  return null;
}

/**
 * Catálogo SUNAT 18: 01 público, 02 privado.
 * Si modalidad llega como número 2 o texto "2" (JSON), sin esto esPrivado queda en false,
 * no se emite LicensePlateID y SUNAT devuelve 2566.
 */
function normalizarModalidadTransporteGre(val) {
  if (val == null || val === "") return "02";
  const n = parseInt(String(val).trim(), 10);
  if (n === 1) return "01";
  if (n === 2) return "02";
  return "02";
}

/** Placa del vehículo principal (alias en otros módulos; secundaria solo si principal vacía). */
function placaPrincipalVehiculoGre(d) {
  if (!d || typeof d !== "object") return "";
  const a = String(d.placaVehiculo || "").trim();
  if (a) return a;
  const b = String(d.placaPrincipal || d.placa || "").trim();
  if (b) return b;
  return String(d.placaSecundaria || "").trim();
}

/** Ubigeo INEI: 6 dígitos (se ignoran separadores). Acepta un 0 inicial de más p. ej. "0220901". */
function ubigeoValidoGre(val) {
  let s = String(val == null ? "" : val).replace(/\D/g, "");
  if (s.length === 7 && s.startsWith("0")) s = s.slice(1);
  // JSON numérico suele perder ceros a la izquierda (060801 → 60801): rellenar a 6 dígitos.
  if (s.length > 0 && s.length < 6) s = s.padStart(6, "0");
  return s.length === 6 ? s : "";
}

/** Busca secuencias de 6 dígitos (límite de palabra) en texto; devuelve la última válida (útil en direcciones). */
function extraerUbigeoSeisDigitosEnTexto(texto) {
  const s = String(texto || "");
  const re = /\b(\d{6})\b/g;
  let m;
  let last = "";
  while ((m = re.exec(s)) !== null) {
    const u = ubigeoValidoGre(m[1]);
    if (u) last = u;
  }
  return last;
}

/**
 * Completa ubigeo origen/destino en datosGuia antiguos o con nombres de campo alternativos.
 * Mutación in-place para reenvío / validación / XML.
 */
function completarUbigeosGreLegacy(d) {
  if (!d || typeof d !== "object") return;
  const pickUb = (...vals) => {
    for (const v of vals) {
      const u = ubigeoValidoGre(v);
      if (u) return u;
    }
    return "";
  };
  if (!ubigeoValidoGre(d.ubigeoDestino)) {
    const fromAlt = pickUb(
      d.ubigeo_destino,
      d.ubigeoDest,
      d.codUbigeoDestino,
      d.ubigeo_destinatario,
      d.ubigeoDestinoCliente,
      d.ubigeoCliente,
      d.destinatarioUbigeo
    );
    if (fromAlt) d.ubigeoDestino = fromAlt;
  }
  if (!ubigeoValidoGre(d.ubigeoDestino) && d.dirDestino) {
    const fromDir = extraerUbigeoSeisDigitosEnTexto(d.dirDestino);
    if (fromDir) d.ubigeoDestino = fromDir;
  }
  if (!ubigeoValidoGre(d.ubigeoOrigen)) {
    const fromAlt = pickUb(
      d.ubigeo_origen,
      d.ubigeoOrig,
      d.codUbigeoOrigen,
      d.ubigeoPartida
    );
    if (fromAlt) d.ubigeoOrigen = fromAlt;
  }
  if (!ubigeoValidoGre(d.ubigeoOrigen) && d.dirOrigen) {
    const fromDir = extraerUbigeoSeisDigitosEnTexto(d.dirOrigen);
    if (fromDir) d.ubigeoOrigen = fromDir;
  }
  if (!String(d.codLocalOrigen || "").trim() && d.cod_local_origen) {
    d.codLocalOrigen = String(d.cod_local_origen).trim();
  }
  if (!String(d.codLocalDestino || "").trim() && d.cod_local_destino) {
    d.codLocalDestino = String(d.cod_local_destino).trim();
  }
}

/** Divide nombre completo en cbc:FirstName y cbc:FamilyName (orden UBL PersonType). */
function partirNombrePersonaGre(nombreCompleto) {
  const s = String(nombreCompleto || "").trim().replace(/\s+/g, " ");
  if (!s) return { firstName: "", familyName: "" };
  const parts = s.split(" ");
  if (parts.length === 1) return { firstName: parts[0], familyName: "" };
  return { firstName: parts[0], familyName: parts.slice(1).join(" ") };
}

/**
 * Fragmento cac:DeliveryAddress / cac:DespatchAddress (estructura simplificada GRE válida).
 * Solo ubigeo + AddressLine. Elimina campos extendidos no requeridos.
 */
function xmlDireccionShipmentGre({ ubigeo, street }) {
  const u = ubigeoValidoGre(ubigeo);
  if (!u) return "";
  const line = String(street || "").trim();
  return `
          <cbc:ID${ATTRS_ID_UBIGEO_GRE}>${x(u)}</cbc:ID>
          <cac:AddressLine>
            <cbc:Line>${x(line)}</cbc:Line>
          </cac:AddressLine>`;
}

/**
 * SUNAT GRE: IssueTime en formato HH:mm:ss.
 * Acepta HH:mm, HH:mm:ss o HH:mm:ss con zona y siempre normaliza sin zona.
 */
function normalizarIssueTimeGre(val) {
  const raw = String(val == null ? "" : val).trim();
  if (!raw) return "00:00:00";
  const m = raw.match(/^(\d{2}):(\d{2})(?::(\d{2}))?(?:([zZ]|[+\-]\d{2}:\d{2}))?$/);
  if (!m) return "00:00:00";
  const hh = m[1];
  const mm = m[2];
  const ss = m[3] || "00";
  return `${hh}:${mm}:${ss}`;
}

/**
 * Normaliza licencia del conductor para GRE.
 * Evita enviar DNI u otros valores inválidos en IdentityDocumentReference (SUNAT 2573).
 */
function normalizarLicenciaConductorGre(licenciaRaw, numeroDocConductorRaw) {
  const lic = String(licenciaRaw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
  if (!lic) return "";
  const docNum = String(numeroDocConductorRaw || "").replace(/\D/g, "").trim();
  if (/^\d{8}$/.test(lic)) return "";
  if (docNum && lic === docNum) return "";
  if (lic.length < 9 || lic.length > 15) return "";
  return lic;
}

/**
 * Une datosGuia (JSON) con columnas de GuiasElectronicasEmitidas y Empresas.
 * Evita PDF/detalle vacíos cuando datosGuia es null o incompleto (migraciones antiguas).
 */
function fusionarDatosGuiaParaDetalle(row, empresa) {
  let base = {};
  if (row.datosGuia != null && typeof row.datosGuia === "object" && !Array.isArray(row.datosGuia)) {
    base = { ...row.datosGuia };
  }
  const rucEm =
    normalizarRucSunatGre(empresa?.ruc) ||
    String(empresa?.ruc || "")
      .replace(/\D/g, "")
      .slice(0, 11);
  if (empresa?.razonSocial && !String(base.emisorNombre || "").trim()) {
    base.emisorNombre = String(empresa.razonSocial).trim();
  }
  if (rucEm && rucEm.length === 11 && !String(base.emisorRuc || "").trim()) {
    base.emisorRuc = rucEm;
  }
  if (row.motivoTraslado && !String(base.motivoTraslado || "").trim()) {
    base.motivoTraslado = String(row.motivoTraslado).trim();
  }
  if (row.comprobanteOrigenSerie && !base.comprobanteOrigenSerie) {
    base.comprobanteOrigenSerie = String(row.comprobanteOrigenSerie).trim();
  }
  if (row.comprobanteOrigenNumero && !base.comprobanteOrigenNumero) {
    base.comprobanteOrigenNumero = String(row.comprobanteOrigenNumero).trim();
  }
  if (row.tipoDocumento && !base.tipoDocumento) {
    base.tipoDocumento = String(row.tipoDocumento);
  }
  if (row.serie && !base.serie) base.serie = row.serie;
  if (row.numero && !base.numero) base.numero = row.numero;
  const nd = String(base.numDocDestinatario || "").trim();
  if (!nd && String(base.numeroDocDestinatario || "").trim()) {
    base.numDocDestinatario = String(base.numeroDocDestinatario).trim();
  }
  const td = String(base.tipoDocDestinatario || "").trim();
  if (!td && String(base.destinatarioTipoDoc || "").trim()) {
    base.tipoDocDestinatario = String(base.destinatarioTipoDoc).trim();
  }
  completarUbigeosGreLegacy(base);
  if (!String(base.codLocalOrigen || "").trim() && empresa?.emisorCodLocal != null) {
    base.codLocalOrigen = String(empresa.emisorCodLocal).trim();
  }
  // Reenvío / preview: si datosGuia perdió ceros (número JSON) o viene vacío, usar ubigeo del domicilio fiscal.
  if (!ubigeoValidoGre(base.ubigeoOrigen) && empresa?.emisorUbigeo != null) {
    const uEm = ubigeoValidoGre(empresa.emisorUbigeo);
    if (uEm) base.ubigeoOrigen = uEm;
  }
  return base;
}

/**
 * Si falta ubigeo destino en una guía ya guardada, intenta recuperarlo
 * del comprobante origen (cliente/dirección cliente) para reenvío GRE.
 */
async function completarUbigeoDestinoDesdeComprobanteOrigen(pool, idEmpresa, d) {
  if (!d || typeof d !== "object") return;
  if (ubigeoValidoGre(d.ubigeoDestino)) return;
  const serie = String(d.comprobanteOrigenSerie || "").trim();
  const numero = String(d.comprobanteOrigenNumero || "").trim();
  if (!serie || !numero) return;
  try {
    const origen = await facturacionRepo.obtenerComprobanteOrigenParaGuiaRepo(pool, idEmpresa, serie, numero);
    if (!origen || typeof origen !== "object") return;
    const ubigeo = ubigeoValidoGre(origen.ubigeoCliente);
    if (ubigeo) {
      d.ubigeoDestino = ubigeo;
    }
  } catch (error) {
    console.error("guiaElectronica.service completarUbigeoDestinoDesdeComprobanteOrigen:", error);
  }
}

/**
 * Campos mínimos para armar XML GRE y coherencia con SUNAT.
 */
function validarDatosGuiaMinimosEnvio(d) {
  if (!d || typeof d !== "object") {
    throw new Error(
      "La guía no tiene datos completos (datosGuia). Aplique la migración de columna datosGuia o registre de nuevo la guía."
    );
  }
  completarUbigeosGreLegacy(d);
  if (!normalizarFechaEmisionGreYmd(d.fechaEmision)) {
    throw new Error("Falta fecha de emisión válida en los datos de la guía.");
  }
  if (!String(d.dirOrigen || "").trim()) {
    throw new Error("Falta dirección de origen en los datos de la guía.");
  }
  if (!String(d.dirDestino || "").trim()) {
    throw new Error("Falta dirección de destino en los datos de la guía.");
  }
  if (!String(d.nomDestinatario || "").trim()) {
    throw new Error("Falta nombre del destinatario en los datos de la guía.");
  }
  if (!String(d.numDocDestinatario || "").trim()) {
    throw new Error("Falta documento del destinatario en los datos de la guía.");
  }
  const tipoDocGuia = String(d.tipoDocumento || "09").trim();
  if (tipoDocGuia === "09" || tipoDocGuia === "31") {
    if (!ubigeoValidoGre(d.ubigeoDestino)) {
      throw new Error(
        "El ubigeo de destino es obligatorio (6 dígitos INEI). SUNAT rechaza la GRE si DeliveryAddress/cbc:ID está vacío. " +
          "Edite la guía desde Emisión de guías (ícono lápiz), elija establecimientos con ubigeo en origen y destino, y guarde."
      );
    }
    if (!ubigeoValidoGre(d.ubigeoOrigen)) {
      throw new Error(
        "El ubigeo de origen es obligatorio (6 dígitos INEI). Edite la guía y seleccione la dirección de origen con ubigeo válido."
      );
    }
  }
  const modalidad = normalizarModalidadTransporteGre(d.modalidadTransporte);
  const esVehiculoM1L = Boolean(d.vehiculoM1L);

  // GRE transportista (31): remitente de la carga en DespatchParty (SUNAT 3383)
  if (tipoDocGuia === "31") {
    if (!String(d.nomRemitente || "").trim()) {
      throw new Error("Guía transportista: ingrese el nombre o razón social del remitente de la mercadería.");
    }
    if (!String(d.numDocRemitente || "").trim()) {
      throw new Error("Guía transportista: ingrese el documento del remitente de la mercadería.");
    }
    if (!String(d.tipoDocRemitente || "").trim()) {
      throw new Error("Guía transportista: seleccione el tipo de documento del remitente.");
    }
  }

  // Transporte privado (09): requiere conductor y placa EXCEPTO si es vehículo M1/L
  if (tipoDocGuia === "09" && modalidad === "02" && !esVehiculoM1L) {
    if (!String(d.numeroDocConductor || "").trim()) {
      throw new Error("Transporte privado: ingrese el documento del conductor. (Si es vehículo M1/L, marque la opción correspondiente)");
    }
    if (!String(d.nombreConductor || "").trim()) {
      throw new Error(
        "Transporte privado: ingrese el nombre completo del conductor. (Si es vehículo M1/L, marque la opción correspondiente)"
      );
    }
    if (!placaPrincipalVehiculoGre(d)) {
      throw new Error(
        "SUNAT exige la placa del vehículo principal (código 2566). (Si es vehículo M1/L, marque la opción correspondiente)"
      );
    }
  }

  // GRE transportista (31): conductor y placa obligatorios salvo M1/L (misma lógica que remitente privado)
  if (tipoDocGuia === "31" && !esVehiculoM1L) {
    if (!String(d.numeroDocConductor || "").trim()) {
      throw new Error("Guía transportista: ingrese el documento del conductor principal.");
    }
    if (!String(d.nombreConductor || "").trim()) {
      throw new Error("Guía transportista: ingrese el nombre completo del conductor.");
    }
    if (!placaPrincipalVehiculoGre(d)) {
      throw new Error("Guía transportista: ingrese la placa del vehículo principal (SUNAT 2566).");
    }
  }

  if (tipoDocGuia === "09" && modalidad === "01") {
    if (!String(d.rucTransportista || "").trim()) {
      throw new Error("Transporte público (modalidad 01): ingrese el RUC del transportista.");
    }
  }
}

/**
 * Firma el XML GRE con el mismo PFX que facturación electrónica (SUNAT exige contenido en ExtensionContent).
 */
function firmarXmlGre(xml, config) {
  const certB64 = config?.certificadoDigital;
  if (!certB64 || String(certB64).trim() === "") {
    throw new Error(
      "Configure el certificado digital (.pfx) en Configuración de facturación. SUNAT valida el XML GRE con firma en ext:ExtensionContent."
    );
  }
  let claveCert = (descifrar(config.claveCertificado || "") || "").trim();
  if (!claveCert && config.claveCertificado) {
    const raw = String(config.claveCertificado).trim();
    if (raw && !raw.startsWith("enc:")) claveCert = raw;
  }
  if (!claveCert) {
    throw new Error("Configure la clave del certificado digital para firmar la guía GRE.");
  }
  const pfxBuf = Buffer.from(String(certB64).trim(), "base64");
  return firmaXmlSunat.firmarXmlUbl(xml, pfxBuf, claveCert, { useSha256: true });
}

/** Ubigeo + ubicación del emisor desde fila Empresas + DireccionEmpresa (repo obtenerDatosEmpresaParaGuiaRepo). */
function emisorFiscalDesdeEmpresaGre(empresa) {
  if (!empresa || typeof empresa !== "object") return {};
  return {
    ubigeo: empresa.emisorUbigeo,
    codLocal: empresa.emisorCodLocal,
    departamento: empresa.emisorDepartamento,
    provincia: empresa.emisorProvincia,
    distrito: empresa.emisorDistrito,
    direccion: empresa.emisorDireccion,
    urbanizacion: empresa.emisorUrbanizacion
  };
}

/**
 * Construye el XML UBL 2.1 (DespatchAdvice) para GRE.
 * @param {object} d           - datosGuiaJson (campos normalizados)
 * @param {string} rucEmisor
 * @param {string} razonSocialEmisor
 * @param {string} serie
 * @param {string|number} numero
 * @param {object} [emisorFiscal] - ubigeo, departamento, provincia, distrito, direccion, urbanizacion (empresa)
 * @returns {string} XML completo
 */
function construirXmlGre(d, rucEmisor, razonSocialEmisor, serie, numero, emisorFiscal) {
  const issueYmd = normalizarFechaEmisionGreYmd(d.fechaEmision);
  if (!issueYmd) {
    throw new Error(
      "IssueDate (fecha emisión GRE): vacía o inválida. Debe ser YYYY-MM-DD. Si reenvía la guía, falta fecha en datosGuia: use la fecha del registro o vuelva a crear la guía."
    );
  }
  const tipoDoc = d.tipoDocumento || "09";   // "09" remitente, "31" transportista
  const esGreTransportista = String(tipoDoc).trim() === "31";
  const numStr  = String(numero).padStart(8, "0");
  const idDoc   = `${serie}-${numStr}`;
  const hora    = normalizarIssueTimeGre(d.horaInicioTraslado);
  const modalidadGre = normalizarModalidadTransporteGre(d.modalidadTransporte);
  const esPrivado = modalidadGre === "02";
  const startTrasladoYmd =
    normalizarFechaEmisionGreYmd(d.fechaInicioTraslado) || issueYmd;
  const tipoDocDest = String(d.tipoDocDestinatario || "6").trim() || "6";
  const numDocDestRaw = String(d.numDocDestinatario || "").trim();
  const numDocDestGre =
    tipoDocDest === "6"
      ? (normalizarRucSunatGre(numDocDestRaw) || numDocDestRaw.replace(/\D/g, "").slice(0, 11))
      : numDocDestRaw;
  const ubigeoDestNorm = ubigeoValidoGre(d.ubigeoDestino);
  const ubigeoOriNorm =
    ubigeoValidoGre(d.ubigeoOrigen) ||
    ubigeoValidoGre(emisorFiscal?.ubigeo) ||
    "";
  const deliveryAddrInner = xmlDireccionShipmentGre({
    ubigeo: ubigeoDestNorm,
    street: d.dirDestino
  });
  const despatchAddrInner = xmlDireccionShipmentGre({
    ubigeo: ubigeoOriNorm,
    street: d.dirOrigen
  });

  // GRE transportista (31): remitente de la carga en cac:Despatch/cac:DespatchParty (plantilla Greenter / SUNAT)
  const tipoDocRemit = String(d.tipoDocRemitente || "6").trim() || "6";
  const numDocRemitRaw = String(d.numDocRemitente || "").trim();
  const numDocRemitGre =
    tipoDocRemit === "6"
      ? (normalizarRucSunatGre(numDocRemitRaw) || numDocRemitRaw.replace(/\D/g, "").slice(0, 11))
      : numDocRemitRaw;
  const despatchPartyXml = esGreTransportista && numDocRemitGre
    ? `
        <cac:DespatchParty>
          <cac:PartyIdentification>
            <cbc:ID schemeID="${x(tipoDocRemit)}" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${x(numDocRemitGre)}</cbc:ID>
          </cac:PartyIdentification>
          <cac:PartyLegalEntity>
            <cbc:RegistrationName><![CDATA[${d.nomRemitente || ""}]]></cbc:RegistrationName>
          </cac:PartyLegalEntity>
        </cac:DespatchParty>`
    : "";

  // ── Comprobante origen (SUNAT 3380: RUC emisor del documento relacionado en IssuerParty, UBL DocumentReference) ──
  // Usar catálogo 61 (Documento relacionado al transporte) y agregar DocumentType
  const rucEmisorDocRelacionado =
    normalizarRucSunatGre(d.rucEmisorDocumentoRelacionado || d.emisorRuc || "") || rucEmisor;
  const tipoCompOrigen = String(d.tipoComprobanteOrigen || "01").trim();
  const nombreDocRelacionado =
    {
      "01": "FACTURA",
      "03": "BOLETA DE VENTA",
      "12": "TICKET",
      "50": "DAM",
      "09": "GUIA DE REMISION",
      "31": "GUÍA DE REMISION TRANSPORTISTA"
    }[tipoCompOrigen] || "FACTURA";
  const docRefXml = (d.comprobanteOrigenSerie && d.comprobanteOrigenNumero)
    ? `
  <cac:AdditionalDocumentReference>
    <cbc:ID>${x(d.comprobanteOrigenSerie)}-${String(d.comprobanteOrigenNumero).padStart(8, "0")}</cbc:ID>
    <cbc:DocumentTypeCode listAgencyName="PE:SUNAT" listName="Documento relacionado al transporte" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo61">${x(tipoCompOrigen)}</cbc:DocumentTypeCode>
    <cbc:DocumentType>${x(nombreDocRelacionado)}</cbc:DocumentType>
    <cac:IssuerParty>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${x(rucEmisorDocRelacionado)}</cbc:ID>
      </cac:PartyIdentification>
    </cac:IssuerParty>
  </cac:AdditionalDocumentReference>`
    : "";

  // ── Nota (descripción motivo "Otros") ──────────────────────
  const noteXml = (d.motivoTraslado === "13" && d.descripcionMotivo)
    ? `\n  <cbc:Note languageLocaleID="1000">${x(d.descripcionMotivo)}</cbc:Note>`
    : "";

  // ── Datos de transporte ──
  const esVehiculoM1L = Boolean(d.vehiculoM1L);
  const placaPrincipal = placaPrincipalVehiculoGre(d);
  
  if ((esPrivado || esGreTransportista) && !esVehiculoM1L && !placaPrincipal) {
    throw new Error(
      "La placa del vehículo es obligatoria (Error SUNAT 2566). Use vehículo M1/L si aplica."
    );
  }
  
  // Datos del conductor para transporte privado
  const schemeConductor = { "4": "4", "7": "7" }[d.tipoDocConductor] || "1";
  const docNumConductor = String(d.numeroDocConductor || "").replace(/\D/g, "").trim();
  const { firstName: conductorFirstName, familyName: conductorFamilyName } = partirNombrePersonaGre(d.nombreConductor);
  const licenciaConductor = normalizarLicenciaConductorGre(d.licenciaConductor, docNumConductor) || d.licenciaConductor || "";
  const licenciaConductorXml = String(licenciaConductor || "").trim()
    ? `
        <cac:IdentityDocumentReference>
          <cbc:ID>${x(licenciaConductor)}</cbc:ID>
        </cac:IdentityDocumentReference>`
    : "";
  
  // Transportista para transporte público
  const rucCarrier = String(d.rucTransportista || "").trim();
  const mtcCarrier = String(d.nroMtcTransportista || d.inscripcionMtc || "").trim();
  const companyIdXml = mtcCarrier ? `\n          <cbc:CompanyID>${x(mtcCarrier)}</cbc:CompanyID>` : "";

  /** GRE transportista (31): inscripción MTC del transportista (solo CompanyID, sin RUC en PartyIdentification). */
  const carrierPartyTransportista31Xml =
    esGreTransportista && mtcCarrier
      ? `
      <cac:CarrierParty>
        <cac:PartyLegalEntity>
          <cbc:CompanyID>${x(mtcCarrier)}</cbc:CompanyID>
        </cac:PartyLegalEntity>
      </cac:CarrierParty>`
      : "";

  // XML de transporte público (CarrierParty)
  const carrierPartyXml =
    !esGreTransportista && !esPrivado && rucCarrier
      ? `
      <cac:CarrierParty>
        <cac:PartyIdentification>
          <cbc:ID schemeID="6">${x(rucCarrier)}</cbc:ID>
        </cac:PartyIdentification>
        <cac:PartyLegalEntity>
          <cbc:RegistrationName><![CDATA[${d.razonSocialTransportista || razonSocialEmisor || ""}]]></cbc:RegistrationName>${companyIdXml}
        </cac:PartyLegalEntity>
      </cac:CarrierParty>`
      : "";

  // ── Líneas de detalle ──────────────────────────────────────
  const items = Array.isArray(d.items) && d.items.length > 0
    ? d.items
    : [{ codigo: "00", descripcion: "Bienes trasladados", unidad: "NIU", cantidad: 1 }];

  // ── HandlingInstructions (descripción del motivo de traslado) ──
  const descMotivos = {
    "01": "VENTA", "02": "COMPRA", "03": "VENTA CON ENTREGA A TERCEROS",
    "04": "TRASLADO ENTRE ESTABLECIMIENTOS", "05": "CONSIGNACION",
    "06": "DEVOLUCION", "07": "RECOJO DE BIENES", "08": "IMPORTACION",
    "09": "EXPORTACION", "13": "OTROS", "14": "VENTA SUJETA A CONFIRMACION",
    "17": "TRASLADO DE ZONA PRIMARIA", "18": "TRASLADO A ZONA PRIMARIA",
    "19": "TRASLADO DE MERC. EXTRANJERA"
  };
  const motivoTrasladoCodNorm = String(d.motivoTraslado || "01").trim();
  const handlingInstructionsTxt = descMotivos[motivoTrasladoCodNorm] || "VENTA";

  // ── TotalTransportHandlingUnitQuantity (número de bultos) ──
  const numBultos = Number(d.numeroBultos || d.totalBultos || items.length || 1);

  // ── Indicadores especiales (SpecialInstructions) ──
  // Indicador M1/L: exime datos de conductor y placa para vehículos categoría M1 o L
  const indicadores = [];
  if ((esPrivado || esGreTransportista) && esVehiculoM1L) {
    indicadores.push("SUNAT_Envio_IndicadorTrasladoVehiculoM1L");
  }
  const pagadorFleteSunat = {
    REMITENTE: "SUNAT_Envio_IndicadorPagadorFlete_Remitente",
    DESTINATARIO: "SUNAT_Envio_IndicadorPagadorFlete_Destinatario",
    TRANSPORTISTA: "SUNAT_Envio_IndicadorPagadorFlete_Transportista"
  };
  const pagClave = String(d.indicadorPagadorFlete || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (pagadorFleteSunat[pagClave]) {
    indicadores.push(pagadorFleteSunat[pagClave]);
  }
  const indicadoresXml = indicadores.map(ind => `
    <cbc:SpecialInstructions>${x(ind)}</cbc:SpecialInstructions>`).join("");

  const registroMtcVehStr = String(d.registroMtcVehiculo || d.inscripcionMtcVehiculo || "").trim();
  const applicableTransportMeansXml = registroMtcVehStr
    ? `
        <cac:ApplicableTransportMeans>
          <cbc:RegistrationNationalityID>${x(registroMtcVehStr)}</cbc:RegistrationNationalityID>
        </cac:ApplicableTransportMeans>`
    : "";

  const lineasXml = items.map((it, i) => {
    const n = String(i + 1);
    return `
  <cac:DespatchLine>
    <cbc:ID>${n}</cbc:ID>
    <cbc:DeliveredQuantity unitCode="${x(it.unidad || "NIU")}">${Number(it.cantidad || 1).toFixed(2)}</cbc:DeliveredQuantity>
    <cac:OrderLineReference>
      <cbc:LineID>${n}</cbc:LineID>
    </cac:OrderLineReference>
    <cac:Item>
      <cbc:Description><![CDATA[${it.descripcion || "Bien"}]]></cbc:Description>
      <cac:SellersItemIdentification>
        <cbc:ID>${x(it.codigo || n)}</cbc:ID>
      </cac:SellersItemIdentification>
    </cac:Item>
  </cac:DespatchLine>`;
  }).join("");

  // ── cac:Signature (bloque de firma para el servicio de firmado) ──
  const signatureXml = `
  <cac:Signature>
    <cbc:ID>${x(rucEmisor)}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${x(rucEmisor)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name><![CDATA[${razonSocialEmisor}]]></cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#GREENTER-SIGN</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<DespatchAdvice
  xmlns="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${idDoc}</cbc:ID>
  <cbc:IssueDate>${x(issueYmd)}</cbc:IssueDate>
  <cbc:IssueTime>${hora}</cbc:IssueTime>
  <cbc:DespatchAdviceTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">${tipoDoc}</cbc:DespatchAdviceTypeCode>${noteXml}${docRefXml}${signatureXml}
  <cac:DespatchSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${x(rucEmisor)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${razonSocialEmisor}]]></cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:DespatchSupplierParty>
  <cac:DeliveryCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${x(tipoDocDest)}" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${x(numDocDestGre)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${d.nomDestinatario || ""}]]></cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:DeliveryCustomerParty>
  <cac:Shipment>
    <cbc:ID>SUNAT_Envio</cbc:ID>${!esGreTransportista ? `
    <cbc:HandlingCode listAgencyName="PE:SUNAT" listName="Motivo de traslado" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo20">${x(motivoTrasladoCodNorm || "01")}</cbc:HandlingCode>
    <cbc:HandlingInstructions>${x(handlingInstructionsTxt)}</cbc:HandlingInstructions>` : ""}
    <cbc:GrossWeightMeasure unitCode="${x(d.unidadMedidaPeso || "KGM")}">${Number(d.cantidadPeso || 0).toFixed(3)}</cbc:GrossWeightMeasure>
    <cbc:TotalTransportHandlingUnitQuantity>${numBultos}</cbc:TotalTransportHandlingUnitQuantity>${indicadoresXml}
    <cac:ShipmentStage>${!esGreTransportista ? `
      <cbc:TransportModeCode listName="Modalidad de traslado" listAgencyName="PE:SUNAT" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo18">${x(modalidadGre)}</cbc:TransportModeCode>` : ""}
      <cac:TransitPeriod>
        <cbc:StartDate>${x(startTrasladoYmd)}</cbc:StartDate>
      </cac:TransitPeriod>${(esPrivado || esGreTransportista) && docNumConductor ? `
      <cac:DriverPerson>
        <cbc:ID schemeID="${schemeConductor}" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${x(docNumConductor)}</cbc:ID>
        <cbc:FirstName>${x(conductorFirstName)}</cbc:FirstName>
        <cbc:FamilyName>${x(conductorFamilyName || "-")}</cbc:FamilyName>
        <cbc:JobTitle>Principal</cbc:JobTitle>${licenciaConductorXml}
      </cac:DriverPerson>` : ""}${!esPrivado ? carrierPartyXml : ""}${carrierPartyTransportista31Xml}
    </cac:ShipmentStage>
    <cac:Delivery>
      <cac:DeliveryAddress>${deliveryAddrInner}
      </cac:DeliveryAddress>
      <cac:Despatch>
        <cac:DespatchAddress>${despatchAddrInner}
        </cac:DespatchAddress>${despatchPartyXml}
      </cac:Despatch>
    </cac:Delivery>${(esPrivado || esGreTransportista) && placaPrincipal ? `
    <cac:TransportHandlingUnit>
      <cac:TransportEquipment>
        <cbc:ID>${x(placaPrincipal)}</cbc:ID>${applicableTransportMeansXml}
      </cac:TransportEquipment>
    </cac:TransportHandlingUnit>` : ""}
  </cac:Shipment>${lineasXml}
</DespatchAdvice>`;
}

/**
 * Comprime xmlContent en un ZIP en memoria y retorna nomArchivo, base64 y hash SHA-256.
 * @returns {{ nomArchivo: string, arcGreZip: string, hashZip: string }}
 */
async function construirZipConHash(xmlContent, ruc, tipoDoc, serie, numStr) {
  const nomXml = `${ruc}-${tipoDoc}-${serie}-${numStr}.xml`;
  const nomZip = `${ruc}-${tipoDoc}-${serie}-${numStr}.zip`;

  const zip = new JSZip();
  zip.file(nomXml, xmlContent);
  const buf = await zip.generateAsync({
    type            : "nodebuffer",
    compression     : "DEFLATE",
    compressionOptions: { level: 9 }
  });

  const hashZip  = crypto.createHash("sha256").update(buf).digest("hex");
  const arcGreZip = buf.toString("base64");

  return { nomArchivo: nomZip, arcGreZip, hashZip };
}

/**
 * Llamadas GEM: SUNAT devuelve a veces token_type "JWT"; ante 401 se reintenta con prefijo JWT.
 */
async function gemPostJson(url, token, jsonBody) {
  const t = String(token || "").trim();
  const base = {
    timeout: SUNAT_GRE_TIMEOUT,
    validateStatus: () => true
  };
  let resp = await axios.post(url, jsonBody, {
    ...base,
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    }
  });
  if (resp.status === 401) {
    console.error("[GRE GEM] POST 401 con Bearer → reintento Authorization: JWT …");
    resp = await axios.post(url, jsonBody, {
      ...base,
      headers: {
        Authorization: `JWT ${t}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      }
    });
  }
  return resp;
}

async function gemGet(url, token) {
  const t = String(token || "").trim();
  const base = { timeout: SUNAT_GRE_TIMEOUT, validateStatus: () => true };
  let resp = await axios.get(url, {
    ...base,
    headers: { Authorization: `Bearer ${t}`, Accept: "application/json" }
  });
  if (resp.status === 401) {
    console.error("[GRE GEM] GET 401 con Bearer → reintento JWT …");
    resp = await axios.get(url, {
      ...base,
      headers: { Authorization: `JWT ${t}`, Accept: "application/json" }
    });
  }
  return resp;
}

/**
 * Envía el ZIP a SUNAT GRE y retorna el numTicket.
 * URL: POST {urlBase}/v1/contribuyente/gem/comprobantes/{ruc}-{tipo}-{serie}-{num}
 * Body: { archivo: { nomArchivo, arcGreZip, hashZip } }
 * Response: { numTicket: string, fecRecepcion: string }
 */
async function enviarZipSunat(urlBase, token, ruc, tipoDoc, serie, numStr, zipInfo) {
  const greUrl = `${urlBase.replace(/\/$/, "")}/v1/contribuyente/gem/comprobantes/${ruc}-${tipoDoc}-${serie}-${numStr}`;
  console.error("[GRE GEM] POST envío:", greUrl);
  return gemPostJson(greUrl, token, { archivo: zipInfo });
}

// ─────────────────────────────────────────────────────────────
// Exports públicos
// ─────────────────────────────────────────────────────────────

/**
 * Actualiza una guía pendiente o con error SUNAT (98). Conserva serie y número correlativo.
 * Limpia ticket y XML firmado para generar un envío nuevo tras la edición.
 */
exports.actualizarGuiaService = async (pool, user, idGuiaElectronica, datos) => {
  if (!user?.empresa) throw new Error("NO_ACCESS");
  const idEmpresa = user.empresa;

  const guia = await guiaRepo.obtenerGuiaPorIdRepo(pool, idGuiaElectronica, idEmpresa);
  if (!guia) throw new Error("GUIA_NOT_FOUND");
  if (guia.idEstadoSunat === ESTADO_ACEPTADO) {
    throw new Error("No se puede editar una guía ya aceptada por SUNAT.");
  }
  if (guia.idEstadoSunat === ESTADO_EN_PROCESO) {
    throw new Error(
      "No se puede editar una guía con envío en proceso. Consulte el ticket o espere la respuesta de SUNAT."
    );
  }

  const empresa = await guiaRepo.obtenerDatosEmpresaParaGuiaRepo(pool, idEmpresa);
  if (!empresa) throw new Error("No se encontraron datos de la empresa.");

  const rucEmisor = normalizarRucSunatGre(empresa.ruc);
  if (!rucEmisor || rucEmisor.length !== 11) {
    throw new Error("RUC de empresa inválido para GRE: revise el campo ruc en Empresas (11 dígitos).");
  }

  if (!datos.motivoTraslado) throw new Error("El motivo de traslado es requerido.");
  const fechaYmd = normalizarFechaEmisionGreYmd(datos.fechaEmision);
  if (!fechaYmd) throw new Error("La fecha de inicio de traslado es requerida (formato YYYY-MM-DD).");
  if (!datos.dirOrigen) throw new Error("La dirección de origen es requerida.");
  if (!datos.dirDestino) throw new Error("La dirección de destino es requerida.");
  if (!datos.nomDestinatario) throw new Error("Los datos del destinatario son requeridos.");

  const tipoGuia = guia.tipoRol === "TRANSPORTISTA" ? "TRANSPORTISTA" : "REMITENTE";
  const tipoDoc = String(guia.tipoDocumento || "09").trim();
  const serie = String(guia.serie || "").trim();
  const numStr = String(guia.numero || "").trim();

  const datosGuiaJson = {
    tipoGuia,
    tipoDocumento: tipoDoc,
    serie,
    numero: numStr,
    fechaEmision: fechaYmd,
    horaInicioTraslado: datos.horaInicioTraslado || "",
    motivoTraslado: datos.motivoTraslado,
    descripcionMotivo: datos.descripcionMotivo || "",
    modalidadTransporte: datos.modalidadTransporte,
    cantidadPeso: datos.cantidadPeso,
    unidadMedidaPeso: datos.unidadMedidaPeso || "KGM",
    emisorRuc: rucEmisor,
    emisorNombre: empresa.razonSocial,
    dirOrigen: datos.dirOrigen || "",
    ubigeoOrigen:
      tipoDoc === "09" || tipoDoc === "31"
        ? ubigeoValidoGre(datos.ubigeoOrigen)
        : String(datos.ubigeoOrigen || "").trim(),
    codLocalOrigen: String(datos.codLocalOrigen || "").trim(),
    departamentoOrigen: String(datos.departamentoOrigen || datos.regionOrigen || "").trim(),
    provinciaOrigen: String(datos.provinciaOrigen || "").trim(),
    distritoOrigen: String(datos.distritoOrigen || "").trim(),
    dirDestino: datos.dirDestino || "",
    ubigeoDestino:
      tipoDoc === "09" || tipoDoc === "31"
        ? ubigeoValidoGre(datos.ubigeoDestino)
        : String(datos.ubigeoDestino || "").trim(),
    codLocalDestino: String(datos.codLocalDestino || "").trim(),
    departamentoDestino: String(datos.departamentoDestino || datos.regionDestino || "").trim(),
    provinciaDestino: String(datos.provinciaDestino || "").trim(),
    distritoDestino: String(datos.distritoDestino || "").trim(),
    tipoDocDestinatario: datos.tipoDocDestinatario || "",
    numDocDestinatario: datos.numDocDestinatario || "",
    nomDestinatario: datos.nomDestinatario || "",
    telefonoDestinatario: datos.telefonoDestinatario || "",
    placaVehiculo: datos.placaVehiculo || "",
    placaSecundaria: datos.placaSecundaria || "",
    vehiculoM1L: Boolean(datos.vehiculoM1L),
    tipoDocRemitente: String(datos.tipoDocRemitente || "").trim(),
    numDocRemitente: String(datos.numDocRemitente || "").trim(),
    nomRemitente: String(datos.nomRemitente || "").trim(),
    idVehiculoEmpresa: String(datos.idVehiculoEmpresa || "").trim() || null,
    tipoDocConductor: datos.tipoDocConductor || "",
    numeroDocConductor: datos.numeroDocConductor || "",
    nombreConductor: datos.nombreConductor || "",
    licenciaConductor: datos.licenciaConductor || "",
    rucTransportista: datos.rucTransportista || "",
    razonSocialTransportista: datos.razonSocialTransportista || "",
    nroMtcTransportista: datos.nroMtcTransportista || datos.inscripcionMtc || "",
    registroMtcVehiculo: String(datos.registroMtcVehiculo || datos.inscripcionMtcVehiculo || "").trim(),
    indicadorPagadorFlete: String(datos.indicadorPagadorFlete || "").trim(),
    items: Array.isArray(datos.items) ? datos.items : [],
    observaciones: datos.observaciones || "",
    comprobanteOrigenSerie: datos.comprobanteOrigenSerie || "",
    comprobanteOrigenNumero: datos.comprobanteOrigenNumero || "",
    tipoComprobanteOrigen: datos.tipoComprobanteOrigen || "01",
    rucEmisorDocumentoRelacionado:
      normalizarRucSunatGre(String(datos.rucEmisorDocumentoRelacionado || "").trim()) || rucEmisor
  };

  validarDatosGuiaMinimosEnvio(datosGuiaJson);

  const ok = await guiaRepo.actualizarGuiaDatosRepo(pool, idGuiaElectronica, idEmpresa, {
    fechaEmision: new Date(`${fechaYmd}T12:00:00`),
    motivoTraslado: datos.motivoTraslado || null,
    comprobanteOrigenSerie: datos.comprobanteOrigenSerie || null,
    comprobanteOrigenNumero: datos.comprobanteOrigenNumero || null,
    datosGuia: datosGuiaJson
  });

  if (!ok) {
    throw new Error(
      "La guía no pudo actualizarse. Solo se permiten guías pendientes o con error SUNAT (no aceptadas ni en proceso)."
    );
  }

  return {
    ok: true,
    mensaje: `Guía ${serie}-${numStr} actualizada. Vuelva a enviarla a SUNAT desde el listado.`,
    guia: {
      idGuiaElectronica,
      serie,
      numero: numStr,
      tipoDocumento: tipoDoc,
      tipoRol: tipoGuia,
      idEstadoSunat: null,
      descripcionEstado: null
    }
  };
};

/**
 * Registra y (si hay credenciales) envía la GRE a SUNAT.
 */
exports.registrarGuiaService = async (pool, user, datos) => {
  if (!user?.empresa) throw new Error("NO_ACCESS");
  const idEmpresa = user.empresa;

  const [config, empresa] = await Promise.all([
    facturacionRepo.obtenerConfiguracionFacturacionRepo(pool, idEmpresa),
    guiaRepo.obtenerDatosEmpresaParaGuiaRepo(pool, idEmpresa)
  ]);

  if (!config)  throw new Error("Configuración de facturación no encontrada para esta empresa.");
  if (!empresa) throw new Error("No se encontraron datos de la empresa.");

  const rucEmisor = normalizarRucSunatGre(empresa.ruc);
  if (!rucEmisor || rucEmisor.length !== 11) {
    throw new Error("RUC de empresa inválido para GRE: revise el campo ruc en Empresas (11 dígitos).");
  }

  if (!datos.motivoTraslado) throw new Error("El motivo de traslado es requerido.");
  const fechaYmd = normalizarFechaEmisionGreYmd(datos.fechaEmision);
  if (!fechaYmd) throw new Error("La fecha de inicio de traslado es requerida (formato YYYY-MM-DD).");
  if (!datos.dirOrigen)       throw new Error("La dirección de origen es requerida.");
  if (!datos.dirDestino)      throw new Error("La dirección de destino es requerida.");
  if (!datos.nomDestinatario) throw new Error("Los datos del destinatario son requeridos.");

  const tipoGuia    = datos.tipoGuia === "TRANSPORTISTA" ? "TRANSPORTISTA" : "REMITENTE";
  const tipoDoc     = tipoGuia === "TRANSPORTISTA" ? "31" : "09";
  const serie       = tipoGuia === "TRANSPORTISTA" ? "V001" : "T001";
  const numero      = await guiaRepo.siguienteNumeroGuiaRepo(pool, idEmpresa, serie);
  const numStr      = String(numero).padStart(8, "0");

  // Datos completos a guardar en datosGuia JSON
  const datosGuiaJson = {
    tipoGuia, tipoDocumento: tipoDoc, serie, numero: numStr,
    fechaEmision      : fechaYmd,
    horaInicioTraslado: datos.horaInicioTraslado || "",
    motivoTraslado    : datos.motivoTraslado,
    descripcionMotivo : datos.descripcionMotivo || "",
    modalidadTransporte: datos.modalidadTransporte,
    cantidadPeso      : datos.cantidadPeso,
    unidadMedidaPeso  : datos.unidadMedidaPeso || "KGM",
    emisorRuc         : rucEmisor,
    emisorNombre      : empresa.razonSocial,
    dirOrigen         : datos.dirOrigen || "",
    ubigeoOrigen:
      tipoDoc === "09" || tipoDoc === "31"
        ? ubigeoValidoGre(datos.ubigeoOrigen)
        : String(datos.ubigeoOrigen || "").trim(),
    codLocalOrigen    : String(datos.codLocalOrigen || "").trim(),
    departamentoOrigen: String(datos.departamentoOrigen || datos.regionOrigen || "").trim(),
    provinciaOrigen   : String(datos.provinciaOrigen || "").trim(),
    distritoOrigen    : String(datos.distritoOrigen || "").trim(),
    dirDestino        : datos.dirDestino || "",
    ubigeoDestino:
      tipoDoc === "09" || tipoDoc === "31"
        ? ubigeoValidoGre(datos.ubigeoDestino)
        : String(datos.ubigeoDestino || "").trim(),
    codLocalDestino   : String(datos.codLocalDestino || "").trim(),
    departamentoDestino: String(datos.departamentoDestino || datos.regionDestino || "").trim(),
    provinciaDestino  : String(datos.provinciaDestino || "").trim(),
    distritoDestino   : String(datos.distritoDestino || "").trim(),
    tipoDocDestinatario: datos.tipoDocDestinatario || "",
    numDocDestinatario : datos.numDocDestinatario || "",
    nomDestinatario    : datos.nomDestinatario || "",
    telefonoDestinatario: datos.telefonoDestinatario || "",
    tipoDocRemitente: String(datos.tipoDocRemitente || "").trim(),
    numDocRemitente: String(datos.numDocRemitente || "").trim(),
    nomRemitente: String(datos.nomRemitente || "").trim(),
    idVehiculoEmpresa: String(datos.idVehiculoEmpresa || "").trim() || null,
    placaVehiculo      : datos.placaVehiculo || "",
    placaSecundaria    : datos.placaSecundaria || "",
    vehiculoM1L        : Boolean(datos.vehiculoM1L), // Vehículo categoría M1 o L (exime conductor y placa)
    tipoDocConductor   : datos.tipoDocConductor || "",
    numeroDocConductor : datos.numeroDocConductor || "",
    nombreConductor    : datos.nombreConductor || "",
    licenciaConductor  : datos.licenciaConductor || "",
    rucTransportista   : datos.rucTransportista || "",
    razonSocialTransportista: datos.razonSocialTransportista || "",
    nroMtcTransportista: datos.nroMtcTransportista || datos.inscripcionMtc || "",
    registroMtcVehiculo: String(datos.registroMtcVehiculo || datos.inscripcionMtcVehiculo || "").trim(),
    indicadorPagadorFlete: String(datos.indicadorPagadorFlete || "").trim(),
    items              : Array.isArray(datos.items) ? datos.items : [],
    observaciones      : datos.observaciones || "",
    comprobanteOrigenSerie  : datos.comprobanteOrigenSerie || "",
    comprobanteOrigenNumero : datos.comprobanteOrigenNumero || "",
    tipoComprobanteOrigen   : datos.tipoComprobanteOrigen || "01",
    rucEmisorDocumentoRelacionado:
      normalizarRucSunatGre(String(datos.rucEmisorDocumentoRelacionado || "").trim()) || rucEmisor
  };

  validarDatosGuiaMinimosEnvio(datosGuiaJson);

  const idGuia = await guiaRepo.insertarGuiaRepo(pool, {
    idEmpresa,
    tipoDocumento   : tipoDoc,
    tipoRol         : tipoGuia,
    serie, numero,
    fechaEmision    : new Date(`${fechaYmd}T12:00:00`),
    idEstadoSunat   : ESTADO_PENDIENTE,
    descripcionEstado: "PENDIENTE",
    ticketSunat     : null,
    comprobanteOrigenSerie  : datos.comprobanteOrigenSerie || null,
    comprobanteOrigenNumero : datos.comprobanteOrigenNumero
      ? String(datos.comprobanteOrigenNumero).padStart(8, "0") : null,
    motivoTraslado  : datos.motivoTraslado || null,
    datosGuia       : datosGuiaJson
  });

  const guiaRegistrada = { idGuiaElectronica: idGuia, serie, numero: numStr, tipoDoc, tipoRol: tipoGuia };

  // ── Intentar envío si hay credenciales ─────────────────────
  const { urlBase, clientId, clientSecret, rucApiGuias } = extraerCredencialesGre(config, rucEmisor);

  if (!urlBase || !clientId || !clientSecret) {
    return {
      ok: true, enviado: false,
      mensaje: `Guía ${serie}-${numStr} registrada localmente. Configure las credenciales API GRE en Configuración para enviar a SUNAT.`,
      guia: guiaRegistrada
    };
  }

  let token;
  try {
    token = await obtenerTokenOauth2(rucApiGuias || rucEmisor, clientId, clientSecret, config);
  } catch (err) {
    console.error("guiaElectronica.service registrarGuia OAuth2:", err.message);
    return {
      ok: true, enviado: false,
      advertencia: `Guía registrada, pero no se pudo obtener token SUNAT: ${err.message}`,
      guia: guiaRegistrada
    };
  }

  let zipInfo;
  try {
    let xml = construirXmlGre(
      datosGuiaJson,
      rucEmisor,
      empresa.razonSocial,
      serie,
      numero,
      emisorFiscalDesdeEmpresaGre(empresa)
    );
    xml = firmarXmlGre(xml, config);
    await persistirXmlFirmadoGuia(pool, idGuia, idEmpresa, xml);
    await guardarXmlFirmadoGreEnDisco(rucEmisor, tipoDoc, serie, numStr, xml);
    zipInfo = await construirZipConHash(xml, rucEmisor, tipoDoc, serie, numStr);
  } catch (err) {
    console.error("guiaElectronica.service registrarGuia buildZip/firma:", err.message);
    return {
      ok: true, enviado: false,
      advertencia: `Guía registrada, pero falló firma o ZIP: ${err.message}`,
      guia: guiaRegistrada
    };
  }

  let resp;
  try {
    resp = await enviarZipSunat(urlBase, token, rucEmisor, tipoDoc, serie, numStr, zipInfo);
  } catch (err) {
    console.error("guiaElectronica.service registrarGuia envío:", err.message);
    await guiaRepo.actualizarEstadoGuiaRepo(pool, idGuia, idEmpresa, {
      idEstadoSunat    : ESTADO_ERROR,
      descripcionEstado: `Error de red: ${err.message}`.slice(0, 200),
      ticketSunat      : null
    });
    return {
      ok: true, enviado: false,
      advertencia: `Guía registrada, pero falló el envío a SUNAT: ${err.message}`,
      guia: guiaRegistrada
    };
  }

  // SUNAT responde con numTicket (no es resultado inmediato)
  if (resp.status === 200 && resp.data?.numTicket) {
    const ticket = resp.data.numTicket;
    await guiaRepo.actualizarEstadoGuiaRepo(pool, idGuia, idEmpresa, {
      idEstadoSunat    : ESTADO_EN_PROCESO,
      descripcionEstado: "EN_PROCESO - esperando resolución SUNAT",
      ticketSunat      : ticket
    });
    guiaRegistrada.idEstadoSunat = ESTADO_EN_PROCESO;
    guiaRegistrada.ticketSunat   = ticket;
    return {
      ok: true, enviado: true, enProceso: true,
      mensaje: `Guía ${serie}-${numStr} enviada a SUNAT. Ticket: ${ticket}. Se resolverá en breve.`,
      guia: guiaRegistrada, numTicket: ticket
    };
  }

  // Error de validación u otro error SUNAT
  const errMsg = resp.data?.msg || resp.data?.errors?.map(e => `${e.cod}: ${e.msg}`).join(", ") || JSON.stringify(resp.data).slice(0, 200);
  await guiaRepo.actualizarEstadoGuiaRepo(pool, idGuia, idEmpresa, {
    idEstadoSunat    : ESTADO_ERROR,
    descripcionEstado: `HTTP ${resp.status}: ${errMsg}`.slice(0, 200),
    ticketSunat      : null
  });
  return {
    ok: true, enviado: true, aceptado: false,
    mensaje: `Guía registrada pero SUNAT respondió HTTP ${resp.status}: ${errMsg}`,
    guia: guiaRegistrada
  };
};

/**
 * GET GEM .../comprobantes/envios/{ticket} — misma consulta que al emitir la guía y que guiasTicket.job.
 * @returns {Promise<object>} tuvoTicket, sinCredencialesGre, enProceso, aceptado, errorSunat, actualizado, mensaje, arcCdr, httpError, inesperado
 */
async function consultarGemEnvioPorTicketYActualizarBd(pool, idGuiaElectronica, idEmpresa, guia, config, empresa) {
  const ticketRaw = guia.ticketSunat != null ? String(guia.ticketSunat).trim() : "";
  if (!ticketRaw) {
    return { tuvoTicket: false, mensaje: "Sin ticket SUNAT almacenado." };
  }

  if (!empresa?.ruc) {
    return { tuvoTicket: true, sinCredencialesGre: true, mensaje: "No se encontró el RUC de la empresa." };
  }
  const rucEmisor = normalizarRucSunatGre(empresa.ruc);
  if (!rucEmisor || rucEmisor.length !== 11) {
    return { tuvoTicket: true, sinCredencialesGre: true, mensaje: "RUC de empresa inválido para GRE." };
  }

  const { urlBase, clientId, clientSecret, rucApiGuias } = extraerCredencialesGre(config || {}, rucEmisor);
  if (!urlBase || !clientId || !clientSecret) {
    return {
      tuvoTicket: true,
      sinCredencialesGre: true,
      mensaje: "Faltan credenciales API GRE (URL, ID o clave)."
    };
  }

  const token = await obtenerTokenOauth2(rucApiGuias || rucEmisor, clientId, clientSecret, config || {});
  const consultaUrl = `${urlBase.replace(/\/$/, "")}/v1/contribuyente/gem/comprobantes/envios/${ticketRaw}`;
  const resp = await gemGet(consultaUrl, token);

  if (resp.status !== 200) {
    return {
      tuvoTicket: true,
      httpError: true,
      mensaje: `SUNAT GEM respondió HTTP ${resp.status}: ${JSON.stringify(resp.data || {}).slice(0, 200)}`
    };
  }

  const { codRespuesta, error, arcCdr } = resp.data || {};

  if (String(codRespuesta) === "98") {
    return {
      tuvoTicket: true,
      enProceso: true,
      mensaje: "SUNAT aún está procesando el envío. Intente en unos segundos."
    };
  }

  if (String(codRespuesta) === "0") {
    await guiaRepo.actualizarEstadoGuiaRepo(pool, idGuiaElectronica, idEmpresa, {
      idEstadoSunat: ESTADO_ACEPTADO,
      descripcionEstado: "ACEPTADO por SUNAT",
      ticketSunat: ticketRaw
    });
    return {
      tuvoTicket: true,
      actualizado: true,
      aceptado: true,
      mensaje: `Guía ${guia.serie}-${guia.numero} ACEPTADA por SUNAT.`,
      arcCdr: arcCdr || null
    };
  }

  if (String(codRespuesta) === "99") {
    const numError = error?.numError || "";
    const desError = error?.desError || "";
    await guiaRepo.actualizarEstadoGuiaRepo(pool, idGuiaElectronica, idEmpresa, {
      idEstadoSunat: ESTADO_ERROR,
      descripcionEstado: `${numError}: ${desError}`.slice(0, 200),
      ticketSunat: ticketRaw
    });
    return {
      tuvoTicket: true,
      actualizado: true,
      errorSunat: true,
      mensaje: `Error SUNAT ${numError}: ${desError}`
    };
  }

  return {
    tuvoTicket: true,
    inesperado: true,
    mensaje: `Respuesta inesperada de SUNAT: ${JSON.stringify(resp.data).slice(0, 200)}`
  };
}

/**
 * Consulta el ticket de una guía EN_PROCESO y actualiza el estado.
 * Llamado manualmente (endpoint) o por el job guiasTicket.job.js.
 */
exports.consultarTicketGuiaService = async (pool, user, idGuiaElectronica) => {
  if (!user?.empresa) throw new Error("NO_ACCESS");
  const idEmpresa = user.empresa;

  const guia = await guiaRepo.obtenerGuiaPorIdRepo(pool, idGuiaElectronica, idEmpresa);
  if (!guia) throw new Error("GUIA_NOT_FOUND");
  if (!guia.ticketSunat) throw new Error("Esta guía no tiene ticket pendiente de consultar.");

  const [config, empresa] = await Promise.all([
    facturacionRepo.obtenerConfiguracionFacturacionRepo(pool, idEmpresa),
    guiaRepo.obtenerDatosEmpresaParaGuiaRepo(pool, idEmpresa)
  ]);
  if (!empresa) throw new Error("No se encontraron datos de la empresa.");

  const r = await consultarGemEnvioPorTicketYActualizarBd(pool, idGuiaElectronica, idEmpresa, guia, config, empresa);
  if (r.sinCredencialesGre) {
    throw new Error("Configure las credenciales API GRE para consultar el ticket.");
  }
  if (r.httpError || r.inesperado) {
    throw new Error(r.mensaje);
  }

  if (r.enProceso) {
    return { ok: true, enProceso: true, mensaje: r.mensaje };
  }
  if (r.aceptado) {
    return { ok: true, aceptado: true, mensaje: r.mensaje, arcCdr: r.arcCdr };
  }
  if (r.errorSunat) {
    return { ok: false, error: true, mensaje: r.mensaje };
  }
  throw new Error(r.mensaje || "Respuesta no reconocida al consultar el ticket.");
};

/**
 * Consulta estado de la GRE vía API REST GEM (mismo path que el envío, con GET + OAuth).
 * Los servicios SOAP billConsult/billValid no aplican a guías 09/31 y suelen responder HTTP 404.
 * @returns {Promise<{ aceptado: boolean, mensaje: string }|{ skip: true, razon?: string }|{ aceptado: null, mensaje: string }|{ error: string }>}
 */
async function consultarGreEstadoPorGemApi(pool, idEmpresa, rucEmisor, tipoDoc, serie, numStr) {
  const config = await facturacionRepo.obtenerConfiguracionFacturacionRepo(pool, idEmpresa);
  if (!config) return { skip: true, razon: "Sin configuración de facturación" };
  const { urlBase, clientId, clientSecret, rucApiGuias } = extraerCredencialesGre(config, rucEmisor);
  if (!urlBase || !clientId || !clientSecret) {
    return { skip: true, razon: "Configure URL, ID y clave API GRE (mismo que para enviar la guía)." };
  }
  let token;
  try {
    token = await obtenerTokenOauth2(rucApiGuias || rucEmisor, clientId, clientSecret, config);
  } catch (e) {
    return { error: `Token GEM: ${e.message || String(e)}` };
  }
  const url = `${urlBase.replace(/\/$/, "")}/v1/contribuyente/gem/comprobantes/${rucEmisor}-${tipoDoc}-${serie}-${numStr}`;
  let resp;
  try {
    resp = await gemGet(url, token);
  } catch (e) {
    return { error: `Red GEM: ${e.message || String(e)}` };
  }

  if (resp.status === 404) {
    return {
      aceptado: false,
      mensaje:
        "SUNAT GEM no devolvió el comprobante (HTTP 404). Suele indicar que no está registrado, fue dado de baja o los datos no coinciden."
    };
  }

  if (resp.status !== 200) {
    const hint = resp.data && typeof resp.data === "object" ? JSON.stringify(resp.data).slice(0, 280) : String(resp.data || "").slice(0, 200);
    return { error: `GEM HTTP ${resp.status}: ${hint}` };
  }

  const d = resp.data && typeof resp.data === "object" ? resp.data : {};
  const texto = JSON.stringify(d).toLowerCase();

  if (d.codRespuesta === "0" || d.codRespuesta === 0) {
    return { aceptado: true, mensaje: d.msg || d.mensaje || d.descripcion || "GEM: código 0 (aceptado)." };
  }
  if (d.codRespuesta === "99" || d.codRespuesta === 99) {
    const err = d.error || d.errors;
    const des = Array.isArray(err) ? err.map((x) => x.msg || x.desError).filter(Boolean).join("; ") : (err?.desError || err?.msg || "");
    return { aceptado: false, mensaje: (des || "GEM: rechazo o estado no aceptado.").slice(0, 200) };
  }
  if (d.arcCdr || d.arcXml) {
    return { aceptado: true, mensaje: "GEM devolvió datos del comprobante (XML/CDR presente)." };
  }
  if (/baja|anul|inactiv|cancel|revoc/i.test(texto)) {
    return { aceptado: false, mensaje: "GEM: la respuesta sugiere baja o anulación." };
  }

  console.error("[GRE GEM] GET estado comprobante — cuerpo (recorte):", JSON.stringify(d).slice(0, 500));
  return {
    aceptado: null,
    mensaje:
      "GEM respondió 200 pero el formato no es el esperado. Revise logs del servidor o documentación SUNAT. Recorte: " +
      JSON.stringify(d).slice(0, 350)
  };
}

/**
 * Sincroniza estado con SUNAT usando la misma consulta GEM que al emitir la guía:
 * GET .../comprobantes/envios/{ticket}. Si no hay ticket o la respuesta no es útil, intenta GET por RUC-tipo-serie-número.
 * Requiere credenciales API GRE (no usa billValid/billConsult SOL).
 */
exports.consultarEstadoGuiaSolService = async (pool, user, idGuiaElectronica) => {
  if (!user?.empresa) throw new Error("NO_ACCESS");
  const idEmpresa = user.empresa;

  const guia = await guiaRepo.obtenerGuiaPorIdRepo(pool, idGuiaElectronica, idEmpresa);
  if (!guia) throw new Error("GUIA_NOT_FOUND");

  const [config, empresa] = await Promise.all([
    facturacionRepo.obtenerConfiguracionFacturacionRepo(pool, idEmpresa),
    guiaRepo.obtenerDatosEmpresaParaGuiaRepo(pool, idEmpresa)
  ]);
  if (!empresa) throw new Error("No se encontraron datos de la empresa.");

  const rucStr = normalizarRucSunatGre(empresa.ruc);
  if (!rucStr || rucStr.length !== 11) throw new Error("RUC de empresa inválido.");

  const tipoDoc = String(guia.tipoDocumento || "09").trim();
  const serie = String(guia.serie || "").trim();
  const numStr = String(guia.numero || "").replace(/\D/g, "").padStart(8, "0");
  if (!serie || !numStr) throw new Error("La guía no tiene serie o número válido.");

  const ticketPreservar =
    guia.ticketSunat != null && String(guia.ticketSunat).trim() !== "" ? String(guia.ticketSunat).trim() : null;
  const localAceptada = guia.idEstadoSunat === ESTADO_ACEPTADO;
  const localError = guia.idEstadoSunat === ESTADO_ERROR;

  const aplicarAceptado = async (descripcionEstado) => {
    await guiaRepo.actualizarEstadoGuiaRepo(pool, idGuiaElectronica, idEmpresa, {
      idEstadoSunat: ESTADO_ACEPTADO,
      descripcionEstado: String(descripcionEstado || "ACEPTADO por SUNAT").slice(0, 200),
      ticketSunat: ticketPreservar
    });
  };

  const aplicarError = async (descripcionEstado) => {
    await guiaRepo.actualizarEstadoGuiaRepo(pool, idGuiaElectronica, idEmpresa, {
      idEstadoSunat: ESTADO_ERROR,
      descripcionEstado: String(descripcionEstado || "Error / no válido en SUNAT").slice(0, 200),
      ticketSunat: ticketPreservar
    });
  };

  const tr = await consultarGemEnvioPorTicketYActualizarBd(pool, idGuiaElectronica, idEmpresa, guia, config, empresa);
  if (tr.sinCredencialesGre) {
    throw new Error(
      "Configure las credenciales API GRE (URL, ID y clave) en Configuración > Facturación, las mismas que usa el envío de la guía."
    );
  }

  if (tr.tuvoTicket && !tr.httpError && !tr.inesperado) {
    if (tr.enProceso) {
      return {
        ok: true,
        actualizado: false,
        idEstadoSunat: guia.idEstadoSunat,
        mensaje: tr.mensaje,
        fuente: "gem_envios_ticket"
      };
    }
    if (tr.aceptado) {
      return {
        ok: true,
        actualizado: !!tr.actualizado,
        idEstadoSunat: ESTADO_ACEPTADO,
        mensaje: tr.mensaje,
        fuente: "gem_envios_ticket"
      };
    }
    if (tr.errorSunat) {
      return {
        ok: true,
        actualizado: !!tr.actualizado,
        idEstadoSunat: ESTADO_ERROR,
        mensaje: tr.mensaje,
        fuente: "gem_envios_ticket"
      };
    }
  }

  const intentarGemClave = tipoDoc === "09" || tipoDoc === "31";
  let gemConsultaClave = null;
  if (intentarGemClave) {
    if (tr.httpError || tr.inesperado) {
      console.error("consultarEstadoGuiaSolService: ticket GEM no concluyente, se intenta GET por clave:", tr.mensaje);
    }
    gemConsultaClave = await consultarGreEstadoPorGemApi(pool, idEmpresa, rucStr, tipoDoc, serie, numStr);
    const gem = gemConsultaClave;
    if (gem.error) {
      console.error("consultarEstadoGuiaSolService: GET GEM por clave:", gem.error);
    }
    if (!gem.skip && !gem.error) {
      if (gem.aceptado === true) {
        await aplicarAceptado(`ACEPTADO (API GEM)${gem.mensaje ? ": " + gem.mensaje : ""}`);
        return {
          ok: true,
          actualizado: true,
          idEstadoSunat: ESTADO_ACEPTADO,
          mensaje: gem.mensaje || "La guía consta aceptada/registrada en SUNAT (API GEM).",
          fuente: "gem_comprobante_clave"
        };
      }
      if (gem.aceptado === false) {
        if (localAceptada || localError) {
          await aplicarError(gem.mensaje);
          return {
            ok: true,
            actualizado: true,
            idEstadoSunat: ESTADO_ERROR,
            mensaje: gem.mensaje,
            fuente: "gem_comprobante_clave"
          };
        }
        return {
          ok: true,
          actualizado: false,
          idEstadoSunat: guia.idEstadoSunat,
          mensaje:
            gem.mensaje +
            " No se modificó el estado local (la guía no estaba como aceptada o error).",
          fuente: "gem_comprobante_clave"
        };
      }
      return {
        ok: true,
        actualizado: false,
        idEstadoSunat: guia.idEstadoSunat,
        mensaje: gem.mensaje || "GEM respondió sin un código de estado claro para esta guía.",
        fuente: "gem_comprobante_clave"
      };
    }
  }

  if (!tr.tuvoTicket && intentarGemClave && gemConsultaClave?.skip) {
    return {
      ok: true,
      actualizado: false,
      idEstadoSunat: guia.idEstadoSunat,
      mensaje:
        "Sin ticket GEM en BD. " +
        (gemConsultaClave.razon ||
          "Configure credenciales GRE para consultar por RUC-tipo-serie-número."),
      fuente: "gem_comprobante_clave"
    };
  }

  if (!tr.tuvoTicket && intentarGemClave && gemConsultaClave?.error) {
    return {
      ok: true,
      actualizado: false,
      idEstadoSunat: guia.idEstadoSunat,
      mensaje: "Sin ticket GEM en BD. Error al consultar por clave: " + gemConsultaClave.error,
      fuente: "gem_comprobante_clave"
    };
  }

  if (tr.tuvoTicket && (tr.httpError || tr.inesperado)) {
    return {
      ok: true,
      actualizado: false,
      idEstadoSunat: guia.idEstadoSunat,
      mensaje:
        tr.mensaje +
        (intentarGemClave
          ? " No se pudo completar la consulta alternativa por RUC-tipo-serie-número."
          : ""),
      fuente: "gem_envios_ticket"
    };
  }

  return {
    ok: true,
    actualizado: false,
    idEstadoSunat: guia.idEstadoSunat,
    mensaje:
      "No hay ticket de envío guardado para consultar en GEM (mismo flujo que al emitir). " +
      "Si la guía se envió desde este sistema, debería existir ticketSunat en BD; si no, use envío o revise el registro.",
    fuente: "gem_envios_ticket"
  };
};

/**
 * Obtiene el detalle de una guía (incluyendo datosGuia JSON).
 */
exports.obtenerGuiaService = async (pool, user, idGuiaElectronica) => {
  if (!user?.empresa) throw new Error("NO_ACCESS");
  const row = await guiaRepo.obtenerGuiaPorIdRepo(pool, idGuiaElectronica, user.empresa);
  if (!row) throw new Error("GUIA_NOT_FOUND");
  const empresa = await guiaRepo.obtenerDatosEmpresaParaGuiaRepo(pool, user.empresa);
  row.datosGuia = fusionarDatosGuiaParaDetalle(row, empresa || {});
  return row;
};

/**
 * Genera el XML UBL de la guía (mismo que se usaría en envío) para revisión.
 * No llama a SUNAT. Opcionalmente incluye XML firmado si hay certificado y ?firmado=1.
 * @param {{ incluirFirmado?: boolean }} options
 * @returns {{ nomArchivo: string, resumenTipoDocEmisor: object, xmlSinFirmar: string, xmlFirmado: string|null, errorFirma: string|null }}
 */
exports.previewXmlGuiaService = async (pool, user, idGuiaElectronica, options = {}) => {
  if (!user?.empresa) throw new Error("NO_ACCESS");
  const idEmpresa = user.empresa;
  const incluirFirmado = Boolean(options.incluirFirmado);

  const guia = await guiaRepo.obtenerGuiaPorIdRepo(pool, idGuiaElectronica, idEmpresa);
  if (!guia) throw new Error("GUIA_NOT_FOUND");

  const [config, empresa] = await Promise.all([
    facturacionRepo.obtenerConfiguracionFacturacionRepo(pool, idEmpresa),
    guiaRepo.obtenerDatosEmpresaParaGuiaRepo(pool, idEmpresa)
  ]);
  if (!empresa) throw new Error("No se encontraron datos de la empresa.");

  const rucEmisor = normalizarRucSunatGre(empresa.ruc);
  if (!rucEmisor || rucEmisor.length !== 11) {
    throw new Error("RUC de empresa inválido para GRE (revise Empresas).");
  }

  const d = fusionarDatosGuiaParaDetalle(guia, empresa);
  await completarUbigeoDestinoDesdeComprobanteOrigen(pool, idEmpresa, d);
  if (!normalizarFechaEmisionGreYmd(d.fechaEmision) && guia.fechaEmision) {
    d.fechaEmision = guia.fechaEmision;
  }
  validarDatosGuiaMinimosEnvio(d);

  const serie   = guia.serie;
  const numStr  = guia.numero;
  const tipoDoc = guia.tipoDocumento;
  const xmlSinFirmar = construirXmlGre(
    d,
    rucEmisor,
    empresa.razonSocial,
    serie,
    numStr,
    emisorFiscalDesdeEmpresaGre(empresa)
  );
  const nomArchivo   = `${rucEmisor}-${tipoDoc}-${serie}-${numStr}.xml`;

  let xmlFirmado = null;
  let errorFirma = null;
  if (incluirFirmado) {
    try {
      xmlFirmado = firmarXmlGre(xmlSinFirmar, config || {});
    } catch (err) {
      errorFirma = err.message || String(err);
    }
  }

  const resumenTipoDocEmisor = {
    catalogoSunat06: "6",
    descripcion     : "RUC (emisor de la GRE)",
    segunPdfSunat   :
      "Guía GRE remitente (RS 097-2012 / manual UBL): ítems 13–14 exigen CustomerAssignedAccountID + @schemeID catálogo 06",
    ubicacionesUbl  : [
      "cac:DespatchSupplierParty/cbc:CustomerAssignedAccountID@schemeID=\"6\" (obligatorio según PDF)",
      "cac:DespatchSupplierParty/cbc:AdditionalAccountID = 6 (SupplierParty UBL)",
      "cac:DespatchSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID@schemeID=\"6\""
    ]
  };

  return {
    nomArchivo,
    resumenTipoDocEmisor,
    xmlSinFirmar,
    xmlFirmado,
    errorFirma
  };
};

/**
 * Reenvía una guía PENDIENTE o ERROR a SUNAT (mismo flujo XML+ZIP+ticket).
 */
exports.reenviarGuiaService = async (pool, user, idGuiaElectronica) => {
  if (!user?.empresa) throw new Error("NO_ACCESS");
  const idEmpresa = user.empresa;

  const guia = await guiaRepo.obtenerGuiaPorIdRepo(pool, idGuiaElectronica, idEmpresa);
  if (!guia)                              throw new Error("GUIA_NOT_FOUND");
  if (guia.idEstadoSunat === ESTADO_ACEPTADO)   throw new Error("La guía ya fue aceptada por SUNAT.");
  if (guia.idEstadoSunat === ESTADO_EN_PROCESO) throw new Error("La guía ya tiene un ticket pendiente. Use 'Consultar ticket'.");

  const [config, empresa] = await Promise.all([
    facturacionRepo.obtenerConfiguracionFacturacionRepo(pool, idEmpresa),
    guiaRepo.obtenerDatosEmpresaParaGuiaRepo(pool, idEmpresa)
  ]);
  if (!empresa) throw new Error("No se encontraron datos de la empresa.");
  const rucEmisor = normalizarRucSunatGre(empresa.ruc);
  if (!rucEmisor || rucEmisor.length !== 11) {
    throw new Error("RUC de empresa inválido para GRE (revise Empresas).");
  }
  const { urlBase, clientId, clientSecret, rucApiGuias } = extraerCredencialesGre(config || {}, rucEmisor);

  if (!urlBase || !clientId || !clientSecret) {
    throw new Error("Configure las credenciales API GRE en Configuración → Facturación para enviar a SUNAT.");
  }

  const d = fusionarDatosGuiaParaDetalle(guia, empresa);
  await completarUbigeoDestinoDesdeComprobanteOrigen(pool, idEmpresa, d);
  if (!normalizarFechaEmisionGreYmd(d.fechaEmision) && guia.fechaEmision) {
    d.fechaEmision = guia.fechaEmision;
  }
  validarDatosGuiaMinimosEnvio(d);
  const serie  = guia.serie;
  const numStr = guia.numero;
  const tipoDoc = guia.tipoDocumento;

  const token = await obtenerTokenOauth2(rucApiGuias || rucEmisor, clientId, clientSecret, config || {});
  let xml     = construirXmlGre(
    d,
    rucEmisor,
    empresa.razonSocial,
    serie,
    numStr,
    emisorFiscalDesdeEmpresaGre(empresa)
  );
  xml         = firmarXmlGre(xml, config || {});
  await persistirXmlFirmadoGuia(pool, idGuiaElectronica, idEmpresa, xml);
  await guardarXmlFirmadoGreEnDisco(rucEmisor, tipoDoc, serie, numStr, xml);
  const zip   = await construirZipConHash(xml, rucEmisor, tipoDoc, serie, numStr);

  const resp = await enviarZipSunat(urlBase, token, rucEmisor, tipoDoc, serie, numStr, zip)
    .catch(err => { throw new Error(`Error de red al enviar a SUNAT: ${err.message}`); });

  if (resp.status === 200 && resp.data?.numTicket) {
    const ticket = resp.data.numTicket;
    await guiaRepo.actualizarEstadoGuiaRepo(pool, idGuiaElectronica, idEmpresa, {
      idEstadoSunat    : ESTADO_EN_PROCESO,
      descripcionEstado: "EN_PROCESO - esperando resolución SUNAT",
      ticketSunat      : ticket
    });
    return {
      ok: true, enviado: true, enProceso: true,
      mensaje: `Guía ${serie}-${numStr} re-enviada. Ticket: ${ticket}`,
      numTicket: ticket
    };
  }

  const errMsg = resp.data?.msg || JSON.stringify(resp.data).slice(0, 200);
  await guiaRepo.actualizarEstadoGuiaRepo(pool, idGuiaElectronica, idEmpresa, {
    idEstadoSunat    : ESTADO_ERROR,
    descripcionEstado: `HTTP ${resp.status}: ${errMsg}`.slice(0, 200),
    ticketSunat      : null
  });
  throw new Error(`SUNAT respondió HTTP ${resp.status}: ${errMsg}`);
};

/**
 * Elimina una guía que no esté aceptada.
 */
exports.eliminarGuiaService = async (pool, user, idGuiaElectronica) => {
  if (!user?.empresa) throw new Error("NO_ACCESS");
  const guia = await guiaRepo.obtenerGuiaPorIdRepo(pool, idGuiaElectronica, user.empresa);
  if (!guia) throw new Error("GUIA_NOT_FOUND");
  if (guia.idEstadoSunat === ESTADO_ACEPTADO) {
    throw new Error("No se puede eliminar una guía ya aceptada por SUNAT.");
  }
  await guiaRepo.eliminarGuiaRepo(pool, idGuiaElectronica, user.empresa);
  return { ok: true, mensaje: "Guía eliminada." };
};
