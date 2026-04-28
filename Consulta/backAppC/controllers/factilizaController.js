const xml2js = require('xml2js');
require('dotenv').config();
const JSZip = require('jszip');
const { withPool } = require('../utils/dbPool.util');
const factilizaRepository = require('../repositories/factiliza.repository');
const facturacionRepo = require('../repositories/facturacion.repository');
const cifradoClaveCertificado = require('../utils/cifradoClaveCertificado.util');
const { normalizeData } = require('../helpers/normalizeXmlComprobante');

/**
 * Completa RUC/usuario/clave SOL desde Configuración facturación si faltan en body o EmpresaFactiliza.
 */
async function completarCredencialesSolDesdeFacturacion(pool, idEmpresa, ruc, usuario, password) {
  let rucF = String(ruc || '')
    .replace(/\D/g, '')
    .slice(0, 11);
  let u = String(usuario || '').trim();
  let p = String(password || '').trim();
  if (rucF.length === 11 && u && p) {
    return { ruc: rucF, usuario: u, password: p };
  }
  const cfg = await facturacionRepo.obtenerConfiguracionFacturacionRepo(pool, idEmpresa);
  if (!cfg) {
    return { ruc: rucF, usuario: u, password: p };
  }
  const rucEmp = String(cfg.rucEmpresa || '')
    .replace(/\D/g, '')
    .slice(0, 11);
  if (rucF.length !== 11 && rucEmp.length === 11) {
    rucF = rucEmp;
  }
  if (!u && cfg.usuarioSunat) {
    u = String(cfg.usuarioSunat).trim();
  }
  if (!p && cfg.claveSunat) {
    try {
      p = (cifradoClaveCertificado.descifrar(cfg.claveSunat) || '').trim();
    } catch (err) {
      console.error('completarCredencialesSolDesdeFacturacion descifrar:', err.message);
    }
  }
  return { ruc: rucF, usuario: u, password: p };
}

const NOMBRE_SERVICIO_FACTILIZA_PDF = 'Factiliza SUNAT PDF';
const NOMBRE_SERVICIO_SUNAT = 'Factiliza SUNAT';
const NOMBRE_SERVICIO_TIPO_CAMBIO = 'Factiliza TIPO CAMBIO';
const NOMBRE_SERVICIO_PLACA = 'Factiliza PLACA';
const NOMBRE_SERVICIO_SOAT = 'Factiliza SOAT';
const NOMBRE_SERVICIO_LICENCIA = 'Factiliza LICENCIA';

async function gateFactilizaPlan(req, res, nombreServicio) {
  if (!req.user || !req.user.empresa) {
    res.status(401).json({ message: 'No autorizado' });
    return false;
  }
  const ok = await withPool((pool) => factilizaRepository.puedeUsarServicio(pool, req.user.empresa, nombreServicio));
  if (!ok) {
    res.status(403).json({
      message: 'Servicio Factiliza no incluido en su plan o no habilitado para la empresa.'
    });
    return false;
  }
  return true;
}

const getAnexo = async function(req, res) {
  try {
    if (!(await gateFactilizaPlan(req, res, NOMBRE_SERVICIO_SUNAT))) return;
    const ruc = req.params.ruc;
    const response = await fetch(`https://api.factiliza.com/v1/ruc/anexo/${ruc}`, {
      headers: { Authorization: `Bearer ${process.env.FACTILIZA_TOKEN}` }
    });
    // if (!response.ok) throw new Error(response.message);
    const dataRes = await response.json();
    const data = dataRes.data??{}; 

     if (!response.ok || dataRes.status === 404) {   // 404 de Factiliza
        return res.status(404).json({
          status: 404,
          message: dataRes.message || 'RUC no encontrado',
          data: null
        });
      }
    // const data = await response.json();
    
    
    res.status(200).send({ message: 'Consulta exitosa', data });
  } catch (e) {
    console.error(e.message);
    res.status(404).json(e.message);
    res.status(500).json({ message: 'Error al consultar el RUC' });
  }
}


const getDni = async function (req, res){
  try {
    if (!(await gateFactilizaPlan(req, res, NOMBRE_SERVICIO_SUNAT))) return;
    const { dni } = req.params;
    const response = await fetch(`https://api.factiliza.com/v1/dni/info/${dni}`, {
      headers: { Authorization: `Bearer ${process.env.FACTILIZA_TOKEN}` }
    });
    // if (!response.ok) throw new Error(response.status);
    // const dataRes = await response.json();
    // const data = dataRes.data??{}; 
    const dataRes = await response.json();
    const data = dataRes.data??{}; 

     if (!response.ok || dataRes.status === 404) {   // 404 de Factiliza
        return res.status(404).json({
          status: 404,
          message: dataRes.message || 'DNI no encontrado',
          data: null
        });
      }
    
    res.status(200).send({ message: 'Consulta exitosa', data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al consultar el DNI' });
  }
};

const getCextranjeria = async function (req, res){
  try {
    if (!(await gateFactilizaPlan(req, res, NOMBRE_SERVICIO_SUNAT))) return;
    const { cee } = req.params;
    const response = await fetch(`https://api.factiliza.com/v1/cee/info/${cee}`, {
      headers: { Authorization: `Bearer ${process.env.FACTILIZA_TOKEN}` }
    });
    // if (!response.ok) throw new Error(response.status);
    // const dataRes = await response.json();
    // const data = dataRes.data??{}; 
    const dataRes = await response.json();
    const data = dataRes.data??{}; 

     if (!response.ok || dataRes.status === 404) {   // 404 de Factiliza
        return res.status(404).json({
          status: 404,
          message: dataRes.message || 'Carnet no encontrado',
          data: null
        });
      }
    
    res.status(200).send({ message: 'Consulta exitosa', data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al consultar el DNI' });
  }
};

const getRuc = async function (req, res){
  try {
    if (!(await gateFactilizaPlan(req, res, NOMBRE_SERVICIO_SUNAT))) return;
    const { ruc } = req.params;
    const response = await fetch(`https://api.factiliza.com/v1/ruc/info/${ruc}`, {
      headers: { Authorization: `Bearer ${process.env.FACTILIZA_TOKEN}` }
    });

    const dataRes = await response.json();
    const data = dataRes.data??{}; 

     if (!response.ok || dataRes.status === 404) {   // 404 de Factiliza
        return res.status(404).json({
          status: 404,
          message: dataRes.message || 'No hay anexos',
          data: null
        });
      }
    // if (!response.ok) throw new Error(response.status);
    //  const dataRes = await response.json();
    // const data = dataRes.data??{}; 
    res.status(200).send({ message: 'Consulta exitosa', data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al consultar el RUC'});
  }
};

const getTipoCambio = async function (req, res) {
  try {
    if (!(await gateFactilizaPlan(req, res, NOMBRE_SERVICIO_TIPO_CAMBIO))) return;
    const { fecha } = req.params;                      // yyyy-mm-dd
    const url = `https://api.factiliza.com/v1/tipocambio/info/dia?fecha=${fecha}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.FACTILIZA_TOKEN}` }
    });
     const dataRes = await response.json();
    const data = dataRes.data??{}; 

     if (!response.ok || dataRes.status === 404) {   // 404 de Factiliza
        return res.status(404).json({
          status: 404,
          message: dataRes.message || 'No hay datos para la fecha indicada',
          data: null
        });
      }
    
    res.status(200).send({ message: 'Consulta exitosa', data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al consultar tipo de cambio' });
  }
};

const getPlaca = async function (req, res){
  try {
    if (!(await gateFactilizaPlan(req, res, NOMBRE_SERVICIO_PLACA))) return;
    const { placa } = req.params;
    const response = await fetch(`https://api.factiliza.com/v1/placa/info/${placa}`, {
      headers: { Authorization: `Bearer ${process.env.FACTILIZA_TOKEN}` }
    });

    const dataRes = await response.json();
    const data = dataRes.data??{}; 

     if (!response.ok || dataRes.status === 404) {   // 404 de Factiliza
        return res.status(404).json({
          status: 404,
          message: dataRes.message || 'No hay Datos',
          data: null
        });
      }
    // if (!response.ok) throw new Error(response.status);
    //  const dataRes = await response.json();
    // const data = dataRes.data??{}; 
    res.status(200).send({ message: 'Consulta exitosa', data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al consultar el RUC'});
  }
};

const getSoat = async function (req, res){
  try {
    if (!(await gateFactilizaPlan(req, res, NOMBRE_SERVICIO_SOAT))) return;
    const { placa } = req.params;
    const response = await fetch(`https://api.factiliza.com/v1/placa/soat/${placa}`, {
      headers: { Authorization: `Bearer ${process.env.FACTILIZA_TOKEN}` }
    });

    const dataRes = await response.json();
    const data = dataRes.data??{}; 

     if (!response.ok || dataRes.status === 404) {   // 404 de Factiliza
        return res.status(404).json({
          status: 404,
          message: dataRes.message || 'No hay Datos',
          data: null
        });
      }
    // if (!response.ok) throw new Error(response.status);
    //  const dataRes = await response.json();
    // const data = dataRes.data??{}; 
    res.status(200).send({ message: 'Consulta exitosa', data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al consultar el RUC'});
  }
};

const getLicencia = async function (req, res){
  try {
    if (!(await gateFactilizaPlan(req, res, NOMBRE_SERVICIO_LICENCIA))) return;
    const { dni } = req.params;
    const response = await fetch(`https://api.factiliza.com/v1/licencia/info/${dni}`, {
      headers: { Authorization: `Bearer ${process.env.FACTILIZA_TOKEN}` }
    });
    // if (!response.ok) throw new Error(response.status);
    // const dataRes = await response.json();
    // const data = dataRes.data??{}; 
    const dataRes = await response.json();
    const data = dataRes.data??{}; 

     if (!response.ok || dataRes.status === 404) {   // 404 de Factiliza
        return res.status(404).json({
          status: 404,
          message: dataRes.message || 'Licencia no encontrado',
          data: null
        });
      }
    
    res.status(200).send({ message: 'Consulta exitosa', data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al consultar el DNI' });
  }
};

function base64ToUint8Array(base64) {
  const buffer = Buffer.from(base64, 'base64');
  return new Uint8Array(buffer);
}

const getXmlSunat = async function (req, res) {
  try {
    if (!(await gateFactilizaPlan(req, res, NOMBRE_SERVICIO_SUNAT))) return;
    const { ruc, usuario, password, proveedor, tipo_doc, serie, correlativo } = req.body;

    if (!ruc || !usuario || !password || !proveedor || !tipo_doc || !serie || !correlativo) {
      return res.status(400).json({ message: 'Faltan datos' });
    }

    const url = `https://api.factiliza.com/v1/sunat/xml`;
    const body = { ruc, usuario, password, proveedor, tipo_doc, serie, correlativo };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FACTILIZA_TOKEN}`
      },
      
      body: JSON.stringify(body)
    });

     // ← depura el body
    const raw = await response.text();
    let respuesta;
    try { respuesta = JSON.parse(raw); } catch {
      return res.status(500).json({ message: 'Respuesta no válida de Factiliza', raw });
    }

    if (!response.ok || respuesta.status !== 200) {
      return res.status(respuesta.status || 500).json(respuesta);
    }

    // Extraer XML del ZIP en base64
    const zipBase64 = respuesta.data;
    const zipBuffer = Buffer.from(zipBase64, 'base64');
    const zip = await JSZip.loadAsync(zipBuffer);
    const xmlFile = Object.values(zip.files).find(f => f.name.endsWith('.xml'));

    if (!xmlFile) return res.status(404).json({ message: 'No se encontró XML dentro del ZIP' });

    const xmlContent = await xmlFile.async('text');

    res.status(200).json({ message: 'Consulta exitosa', data: xmlContent });

  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al procesar comprobante' });
  }
};

/**
 * Consulta comprobante SUNAT vía Factiliza y devuelve datos ya normalizados.
 * Requiere auth. Token y credenciales SOL pueden venir de EmpresaFactiliza o del body.
 */
const consultarComprobanteSunat = async function (req, res) {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const idEmpresa = req.user.empresa;
    const { ruc, usuario, password, proveedor, tipo_doc, serie, correlativo } = req.body;

    if (!proveedor || !tipo_doc || !serie || !correlativo) {
      return res.status(400).json({ message: 'Faltan datos: proveedor, tipo_doc, serie, correlativo' });
    }

    const sunatOk = await withPool((pool) => factilizaRepository.puedeUsarServicio(pool, idEmpresa, NOMBRE_SERVICIO_SUNAT));
    if (!sunatOk) {
      return res.status(403).json({ message: 'Servicio Factiliza SUNAT no incluido en su plan o no habilitado para la empresa.' });
    }

    const { acceso, rucFinal, usuarioFinal, passwordFinal } = await withPool(async (pool) => {
      const accesoRow = await factilizaRepository.getTokenParaEmpresa(pool, idEmpresa);
      let rucFinal0 = ruc || accesoRow.rucEmpresa;
      let usuarioFinal0 = usuario || accesoRow.usuarioSol;
      let passwordFinal0 = password || accesoRow.passwordSol;
      const creds = await completarCredencialesSolDesdeFacturacion(
        pool,
        idEmpresa,
        rucFinal0,
        usuarioFinal0,
        passwordFinal0
      );
      return {
        acceso: accesoRow,
        rucFinal: creds.ruc,
        usuarioFinal: creds.usuario,
        passwordFinal: creds.password
      };
    });

    if (!rucFinal || String(rucFinal).replace(/\D/g, '').length !== 11 || !usuarioFinal || !passwordFinal) {
      return res.status(400).json({
        message:
          'Indique RUC de su empresa, usuario y contraseña SOL (o guárdelos en Configuración → Facturación y en Factiliza para la empresa). ' +
          'Para facturas de compra, el campo proveedor debe ser el RUC del emisor del comprobante.'
      });
    }

    const token = acceso.token || process.env.FACTILIZA_TOKEN;
    if (!token) {
      return res.status(403).json({ message: 'No hay token Factiliza configurado para su empresa' });
    }

    const urlApi = acceso.urlApi || 'https://api.factiliza.com/v1/sunat/xml';
    const ruc11 = String(rucFinal).replace(/\D/g, '').slice(0, 11);
    const apiBody = { ruc: ruc11, usuario: usuarioFinal, password: passwordFinal, proveedor, tipo_doc, serie, correlativo };

    const response = await fetch(urlApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(apiBody)
    });

    const raw = await response.text();
    let respuesta;
    try { respuesta = JSON.parse(raw); } catch {
      return res.status(500).json({ message: 'Respuesta no válida de Factiliza', raw: raw.substring(0, 200) });
    }

    if (!response.ok || (respuesta.status && respuesta.status !== 200)) {
      return res.status(respuesta.status || response.status || 500).json(respuesta);
    }

    const zipBase64 = respuesta.data;
    if (!zipBase64) return res.status(404).json({ message: 'No se recibió XML en la respuesta' });

    const zipBuffer = Buffer.from(zipBase64, 'base64');
    const zip = await JSZip.loadAsync(zipBuffer);
    const xmlFile = Object.values(zip.files).find(f => f.name && f.name.toLowerCase().endsWith('.xml'));
    if (!xmlFile) return res.status(404).json({ message: 'No se encontró XML dentro del ZIP' });

    const xmlContent = await xmlFile.async('text');

    const parsed = await xml2js.parseStringPromise(xmlContent, { explicitArray: false, ignoreAttrs: false }).catch(() => null);
    if (!parsed) return res.status(500).json({ message: 'Error al parsear el XML' });

    const normalized = normalizeData(parsed);
    return res.status(200).json({ message: 'Consulta exitosa', data: normalized });
  } catch (e) {
    console.error('consultarComprobanteSunat:', e);
    return res.status(500).json({ message: e.message || 'Error al procesar comprobante' });
  }
};

/**
 * Consulta el PDF del comprobante en SUNAT vía Factiliza.
 * Usa las mismas credenciales que la consulta de XML y respeta servicios habilitados por empresa.
 * Devuelve el ZIP en base64; el frontend se encarga de extraer y descargar el PDF.
 */
const consultarComprobantePdf = async function (req, res) {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const idEmpresa = req.user.empresa;
    const { ruc, usuario, password, proveedor, tipo_doc, serie, correlativo } = req.body;

    if (!proveedor || !tipo_doc || !serie || !correlativo) {
      return res.status(400).json({ message: 'Faltan datos: proveedor, tipo_doc, serie, correlativo' });
    }

    const pdfDb = await withPool(async (pool) => {
      const puedeUsar = await factilizaRepository.puedeUsarServicio(pool, idEmpresa, NOMBRE_SERVICIO_FACTILIZA_PDF);
      if (!puedeUsar) return { ok: false };
      const accesoRow = await factilizaRepository.getTokenParaEmpresa(pool, idEmpresa);
      let rucFinal0 = ruc || accesoRow.rucEmpresa;
      let usuarioFinal0 = usuario || accesoRow.usuarioSol;
      let passwordFinal0 = password || accesoRow.passwordSol;
      const credsPdf = await completarCredencialesSolDesdeFacturacion(
        pool,
        idEmpresa,
        rucFinal0,
        usuarioFinal0,
        passwordFinal0
      );
      return {
        ok: true,
        acceso: accesoRow,
        rucFinal: credsPdf.ruc,
        usuarioFinal: credsPdf.usuario,
        passwordFinal: credsPdf.password
      };
    });
    if (!pdfDb.ok) {
      return res.status(403).json({ message: 'Servicio Factiliza PDF no habilitado para su empresa' });
    }
    const { acceso, rucFinal, usuarioFinal, passwordFinal } = pdfDb;

    if (!rucFinal || String(rucFinal).replace(/\D/g, '').length !== 11 || !usuarioFinal || !passwordFinal) {
      return res.status(400).json({
        message:
          'Indique RUC de su empresa, usuario y contraseña SOL, o configúrelos en Facturación / Factiliza para su empresa.'
      });
    }

    const token = acceso.token || process.env.FACTILIZA_TOKEN;
    if (!token) {
      return res.status(403).json({ message: 'No hay token Factiliza configurado para su empresa' });
    }

    const ruc11Pdf = String(rucFinal).replace(/\D/g, '').slice(0, 11);
    const apiBody = {
      ruc: ruc11Pdf,
      usuario: usuarioFinal,
      password: passwordFinal,
      proveedor,
      tipo_doc,
      serie,
      correlativo
    };

    const response = await fetch('https://api.factiliza.com/v1/sunat/reporte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(apiBody)
    });

    const raw = await response.text();
    let respuesta;
    try {
      respuesta = JSON.parse(raw);
    } catch {
      return res.status(500).json({ message: 'Respuesta no válida de Factiliza', raw: raw.substring(0, 200) });
    }

    if (!response.ok || (respuesta.status && respuesta.status !== 200) || respuesta.success === false) {
      const status = respuesta.status || response.status || 500;
      const msg = respuesta.message || respuesta.msg || 'Error al obtener PDF';
      return res.status(status).json({
        success: false,
        status,
        message: status === 404 ? 'No se encontró PDF para este comprobante en SUNAT. Verifique tipo de documento, serie y número.' : msg,
        data: null
      });
    }

    const zipBase64 = respuesta.data;
    if (!zipBase64) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: 'No se encontró PDF para este comprobante. Verifique tipo, serie y número.',
        data: null
      });
    }

    return res.status(200).json({ message: 'Consulta exitosa', data: zipBase64 });
  } catch (e) {
    console.error('consultarComprobantePdf:', e);
    return res.status(500).json({ message: e.message || 'Error al obtener PDF del comprobante' });
  }
};

module.exports = { 
  getAnexo,
  getDni,
  getCextranjeria,
  getRuc,
  getTipoCambio,
  getPlaca,
  getSoat,
  getLicencia,
  getXmlSunat,
  consultarComprobanteSunat,
  consultarComprobantePdf
};
