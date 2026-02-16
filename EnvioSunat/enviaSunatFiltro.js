#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');

// Detectar ruta del ejecutable si es pkg
const basePath = process.pkg ? path.dirname(process.execPath) : __dirname;

// Carpetas del facturador
const DATA_DIR = path.join(basePath, 'sunat_archivos', 'sfs', 'DATA');
const RPTA_DIR = path.join(basePath, 'sunat_archivos', 'sfs', 'RPTA');

// const DATA_DIR   = 'D:\\BSC\\SFS_v1.4\\sunat_archivos\\sfs\\DATA\\';
// const RPTA_DIR   = 'D:\\BSC\\SFS_v1.4\\sunat_archivos\\sfs\\RPTA\\';

console.log("📂 DATA_DIR:", DATA_DIR);
console.log("📂 RPTA_DIR:", RPTA_DIR);

const FACTURADOR = 'http://localhost:9000';

/* ------------------- ENDPOINTS ------------------- */
const ENDPOINTS = {
  '00': { A: '/api/ActualizarPantalla.htm', IM: '/api/MostrarXml.htm', E: '/api/EliminarPantalla.htm' },
  '01': { S: '/api/GenerarComprobante.htm', M: '/api/GenerarComprobante.htm', M1: '/api/enviarXML.htm' },
  '03': { S: '/api/GenerarComprobante.htm', M: '/api/GenerarComprobante.htm', M1: '/api/enviarXML.htm' },
  '07': { S: '/api/GenerarComprobante.htm', M: '/api/GenerarComprobante.htm', M1: '/api/enviarXML.htm' },
  '08': { S: '/api/GenerarComprobante.htm', M: '/api/GenerarComprobante.htm', M1: '/api/enviarXML.htm' },
  RD:  { S: '/api/GenerarComprobante.htm', M: '/api/GenerarComprobante.htm', M1: '/api/enviarXML.htm' },
  CB:  { S: '/api/GenerarComprobante.htm', M: '/api/GenerarComprobante.htm', M1: '/api/enviarXML.htm' }
};

function url(tipo, modo) {
  const e = ENDPOINTS[tipo];
  if (!e) throw new Error(`Tipo ${tipo} no soportado`);
  const ep = e[modo];
  if (!ep) throw new Error(`Modo ${modo} no válido para ${tipo}`);
  return FACTURADOR + ep;
}

function bodyJSON(ruc, tipoDoc, serie, numero) {
  return {
    num_ruc: ruc,
    tip_docu: tipoDoc,
    num_docu: `${serie}-${numero}`
  };
}

/* ------------------- 1. Actualizar bandeja ------------------- */
async function actualizarBandeja() {
  console.log("🔄 Actualizando bandeja...");
  try {
    await axios.post(url('00', 'A'), {});
    console.log("✅ Bandeja actualizada");
  } catch (e) {
    console.log("⚠️ No se pudo actualizar:", e.message);
  }
}

/* ------------------- 2. Generar XML ------------------- */
async function generar(ruc, tipoDoc, serie, numero) {
  const body = bodyJSON(ruc, tipoDoc, serie, numero);
  const { data } = await axios.post(url(tipoDoc, 'M'), body);
  return data;
}

/* ------------------- 3. Enviar XML a SUNAT ------------------- */
async function enviar(ruc, tipoDoc, serie, numero) {
  const body = bodyJSON(ruc, tipoDoc, serie, numero);
  const { data } = await axios.post(url(tipoDoc, 'M1'), body);
  return data;
}

/* ------------------- 4. Leer CDR ------------------- */
function leerCDR(base) {
  const zipPath = path.join(RPTA_DIR, `R${base}.zip`);
  if (!fs.existsSync(zipPath)) return null;

  try {
    const zip = new AdmZip(zipPath);
    const xmlEntry = zip.getEntries().find(e => e.entryName.endsWith(".xml"));
    if (!xmlEntry) return null;

    const xmlContent = xmlEntry.getData().toString("utf8");

    // Extraer código y descripción de respuesta
    const codeMatch = xmlContent.match(/<cbc:ResponseCode>(.*?)<\/cbc:ResponseCode>/);
    const descMatch = xmlContent.match(/<cbc:Description>(.*?)<\/cbc:Description>/);

    return {
      estado: codeMatch ? codeMatch[1] : "???",
      descripcion: descMatch ? descMatch[1] : "Sin descripción"
    };
  } catch (err) {
    return null;
  }
}

/* ------------------- 5. Leer DATA pero filtrar pendientes ------------------- */
function listaPendientes() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".CAB"));

  return files
    .map(f => f.replace(".CAB", "")) // 10456333538-01-F001-00000017
    .filter(base => {
      const cdrZip = path.join(RPTA_DIR, `R${base}.zip`);
      return !fs.existsSync(cdrZip); // Solo los que NO tienen CDR
    });
}

/* ------------------- MAIN ------------------- */
(async () => {
  const pendientes = listaPendientes();

  if (!pendientes.length) {
    console.log("🎉 No hay comprobantes pendientes por enviar.");
    return;
  }

  console.log("📌 Comprobantes pendientes:", pendientes.length);

  await actualizarBandeja();

  console.log('aqui muestro el base de pendientes', pendientes);
  for (const base of pendientes) {
    const [ruc, tipoDoc, serie, numero] = base.split('-');

    try {
      console.log(`⚙️ Generando XML de: ${base}`);
      await generar(ruc, tipoDoc, serie, numero);

      console.log(`📤 Enviando a SUNAT: ${base}`);
      await enviar(ruc, tipoDoc, serie, numero);

      console.log("📥 Validando CDR...");
      const cdr = leerCDR(base);


      console.log("cdr",cdr);
      
      if (!cdr) {
        console.log(`⚠️ No se encontró CDR para ${base}`);
      } else {
        console.log(`📄 Resultado CDR (${base})`);
        console.log(`   ➤ Código: ${cdr.estado}`);
        console.log(`   ➤ Descripción: ${cdr.descripcion}`);
      }

    } catch (err) {
      console.log(`❌ Error procesando ${base}`);
      console.log(err.response?.data || err.message);
    }
  }

  console.log("🏁 Proceso completado.");
})();
