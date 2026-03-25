/**
 * Script de prueba: envía a SUNAT la boleta con serie y número indicados.
 * Uso (desde backAppC): node scripts/enviarBoletaPrueba.js [serie] [numero] [ubl]
 * Ejemplo: node scripts/enviarBoletaPrueba.js B001 8
 *          node scripts/enviarBoletaPrueba.js B001 9 ubl   → genera XML UBL, firma y envía
 * Por defecto: B001 00000008. Si el 3er argumento es "ubl", usa usarXmlUbl: true.
 */
require("dotenv").config();
const path = require("path");
const sql = require("mssql");
const dbConfig = require("../dbconfig");
const facturacionRepository = require("../repositories/facturacion.repository");
const facturadorSunatService = require("../services/facturadorSunat.service");

const SERIE = process.argv[2] || "B001";
const NUMERO_RAW = process.argv[3] || "8";
const USAR_UBL = (process.argv[4] || "").toLowerCase() === "ubl";
const NUMERO = NUMERO_RAW.replace(/\D/g, "").padStart(8, "0");
const TIPO_BOLETA = "03";

async function main() {
    let pool;
  try {
    pool = await sql.connect(dbConfig);
    let comp = await facturacionRepository.obtenerComprobantePorSerieNumeroRepo(
      pool,
      SERIE,
      NUMERO,
      TIPO_BOLETA
    );
    if (!comp) {
      comp = await facturacionRepository.obtenerComprobantePorSerieNumeroRepo(
        pool,
        SERIE,
        NUMERO_RAW,
        TIPO_BOLETA
      );
    }
    if (!comp) {
      console.error("No se encontró comprobante electrónico para", SERIE, NUMERO_RAW, "(tipo 03).");
      process.exit(1);
    }
    const idComprobanteElectronico = comp.idComprobanteElectronico;
    const idEmpresa = comp.idEmpresa;
    
    const config = await facturacionRepository.obtenerConfiguracionFacturacionRepo(pool, idEmpresa);
    if (!config || !config.rutaCarpetaFacturadorSunat) {
      console.error("Configure la carpeta del Facturador SUNAT en Configuración > Facturación.");
      process.exit(1);
    }
    const user = { empresa: idEmpresa };
    const opciones = USAR_UBL ? { usarXmlUbl: true } : {};
    const result = await facturacionRepository.enviarComprobanteSunatRepo(
      pool,
      user,
      idComprobanteElectronico,
      facturadorSunatService,
      {
        rutaCarpetaFacturadorSunat: config.rutaCarpetaFacturadorSunat,
        urlFacturadorSunat: config.urlFacturadorSunat
      },
      opciones
    );
    if (result && result.ok) {
      process.exit(0);
    } else {
      console.error("Error:", result ? result.mensaje : "Sin resultado");
      process.exit(1);
    }
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

main();
