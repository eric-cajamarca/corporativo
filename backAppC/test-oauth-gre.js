/**
 * Script de diagnóstico OAuth2 SUNAT GRE.
 * Ejecutar: node test-oauth-gre.js
 */

const axios = require("axios");

// ── EDITAR ESTOS VALORES ──────────────────────────────────────
// RUC con el que iniciaste sesión en api-seguridad.sunat.gob.pe
// al crear la app. DEBE coincidir con el RUC en la URL del token.
const RUC           = "10456333538";
const CLIENT_ID     = "3784cd55-bcf6-4ae1-a030-8327dcf812db";
const CLIENT_SECRET = "10jyJ/C5dUNvEwCwSBSLdQ==";
// ─────────────────────────────────────────────────────────────

const BASE  = "https://api-seguridad.sunat.gob.pe";
// SUNAT (swagger consulta / apps Web): path = clientesextranet/{client_id}, no el RUC.
const cid  = CLIENT_ID.trim();
const PATH_SEGMENTS = [
  { name: "client_id(UUID)", seg: cid },
  { name: "ruc", seg: RUC }
].filter((x, i, a) => x.seg && a.findIndex(y => y.seg === x.seg) === i);
const csc  = CLIENT_SECRET.trim();
const cscE = encodeURIComponent(csc);          // URL-encoded completo
const b64  = Buffer.from(`${cid}:${csc}`).toString("base64");
const SCOPES = [
  "scope=https://api-cpe.sunat.gob.pe",
  "scope=https%3A%2F%2Fapi-cpe.sunat.gob.pe",  // scope URL-encoded
  "scope=https://api-cpe.sunat.gob.pe/",
  "",   // sin scope
];

const CT  = "application/x-www-form-urlencoded";
const CTU = "application/x-www-form-urlencoded; charset=UTF-8";

async function probar(etiqueta, url, body, headers = {}) {
  try {
    const h = { "Content-Type": CT, Accept: "application/json", ...headers };
    const r = await axios.post(url, body, { headers: h, timeout: 12000, validateStatus: () => true });
    const ok = r.status === 200 && r.data?.access_token;
    console.log(`${ok ? "✅ ÉXITO" : "❌"} [${r.status}] ${etiqueta}`);
    if (!ok) console.log(`   → ${JSON.stringify(r.data).slice(0, 150)}`);
    if (ok)  console.log(`   token: ${r.data.access_token.slice(0, 30)}...`);
    return ok ? r.data.access_token : null;
  } catch (e) {
    console.log(`⛔ RED  ${etiqueta}: ${e.message}`);
    return null;
  }
}

(async () => {
  console.log("=".repeat(65));
  console.log("  DIAGNÓSTICO OAuth2 SUNAT GRE v2");
  console.log(`  RUC:    ${RUC}`);
  console.log(`  ID:     ${cid}`);
  console.log(`  SECRET: ${csc.slice(0,6)}...${csc.slice(-4)} (len=${csc.length})`);
  console.log(`  SECRET URL-encoded: ${cscE.slice(0,10)}...`);
  console.log("=".repeat(65));
  console.log("  Orden: primero path con client_id (estándar Web SUNAT), luego con RUC.");

  for (const { name, seg } of PATH_SEGMENTS) {
    const URL_C = `${BASE}/v1/clientesextranet/${seg}/oauth2/token/`;
    const URL_S = `${BASE}/v1/clientesextranet/${seg}/oauth2/token`;
    for (const url of [URL_C, URL_S]) {
      const u = `${name} | ${url.endsWith("/") ? "con /" : "sin /"}`;
      for (const scope of SCOPES) {
        const s = scope || "SIN_SCOPE";
        const bodyA = `grant_type=client_credentials&client_id=${cid}&client_secret=${csc}${scope ? "&" + scope : ""}`;
        const r = await probar(`body-raw    [${u}][${s}]`, url, bodyA);
        if (r) process.exit(0);
        const bodyB = `grant_type=client_credentials&client_id=${cid}&client_secret=${cscE}${scope ? "&" + scope : ""}`;
        const r2 = await probar(`body-enc    [${u}][${s}]`, url, bodyB);
        if (r2) process.exit(0);
        const bodyC = `grant_type=client_credentials${scope ? "&" + scope : ""}`;
        const r3 = await probar(`basic-auth  [${u}][${s}]`, url, bodyC, { Authorization: `Basic ${b64}` });
        if (r3) process.exit(0);
        const r4 = await probar(`charset-utf8[${u}][${s}]`, url, bodyA, { "Content-Type": CTU });
        if (r4) process.exit(0);
      }
    }
  }

  console.log("\n" + "=".repeat(65));
  console.log("  TODAS LAS VARIANTES FALLARON.");
  console.log("");
  console.log("  Revise: ID+CLAVE del mismo registro Web; servicio GRE en la app;");
  console.log("  path del token suele ser .../clientesextranet/{client_id}/ no {ruc}/.");
  console.log("=".repeat(65));
})();
