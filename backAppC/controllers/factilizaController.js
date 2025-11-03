const xml2js = require('xml2js');
require('dotenv').config();
const JSZip = require('jszip');

const getAnexo = async function(req, res) {
  try {
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
    // res.json({ message: 'OK', innerData});
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al consultar el DNI' });
  }
};

const getCextranjeria = async function (req, res){
  try {
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
    // res.json({ message: 'OK', innerData});
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al consultar el DNI' });
  }
};

const getRuc = async function (req, res){
  try {
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

//tipo de cambio

const getTipoCambio = async function (req, res) {
  try {
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
    // res.json({ message: 'OK', innerData});
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al consultar el DNI' });
  }
};

//////////////////////////////////////////////////////////////////////////
// Exportar las funciones para usarlas en las rutas
///////////////////////////////////////////////////////////////////////////

// controllers/factilizaController.js

// const getXmlSunat = async function (req, res) {
//   try {
//     const { ruc, usuario, password, proveedor, tipo_doc, serie, correlativo } = req.body;
//     const url = `https://api.factiliza.com/v1/sunat/xml/${ruc}-${usuario}-${password}-${proveedor}-${tipo_doc}-${serie}-${correlativo}`;

//     const response = await fetch(url, {
//       method: 'POST',
//       headers: { Authorization: `Bearer ${process.env.FACTILIZA_TOKEN}` }
//     });

//     console.log('Status Factiliza:', response); // ← depura el status
//     const raw = await response.text(); // ← leer como texto
//     console.log('Raw Factiliza:', raw); // ← depura qué llega

//     let body;
//     try {
//       body = JSON.parse(raw); // intenta parsear JSON
//     } catch {
//       return res.status(500).json({ message: 'Respuesta no válida de Factiliza', raw });
//     }

//     if (!response.ok || body.status !== 200) {
//       return res.status(body.status || 500).json(body);
//     }

//     const xmlBase64 = body.data;
//     const xmlText = Buffer.from(xmlBase64, 'base64').toString('utf-8');
//     // const body = await fact.json();

//     // if (!fact.ok) return res.status(fact.status).json(body);

//     // const xmlText = Buffer.from(body.data, 'base64').toString('utf-8');

//     // xml2js.parseString(xmlText, { explicitArray: false }, (err, result) => {
//     //   if (err) return res.status(500).json({ message: 'Error al convertir XML' });
//     //   res.json({ xmlJson: result });
//     // });
//     // const body = await response.json();

//     // if (!response.ok || body.status !== 200) {
//     //   return res.status(body.status || 500).json(body);
//     // }

//     // const xmlBase64 = body.data;
//     // const xmlText = Buffer.from(xmlBase64, 'base64').toString('utf-8');

//     // xml2js.parseString(xmlText, { explicitArray: false }, (err, result) => {
//     //   if (err) return res.status(500).json({ message: 'Error al convertir XML' });
//     //   res.json({ xmlJson: result });
//     // });


//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ message: 'Error al obtener XML' });
//   }
// };

function base64ToUint8Array(base64) {
  const buffer = Buffer.from(base64, 'base64');
  return new Uint8Array(buffer);
}

const getXmlSunat = async function (req, res) {
  try {
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

    console.log('Request response:', response); // ← depura el body
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

    // Convertir XML a JSON
    // xml2js.parseString(xmlContent, { explicitArray: false }, (err, jsonData) => {
    //   if (err) return res.status(500).json({ message: 'Error al convertir XML a JSON' });
    //   res.json({ xmlJson: jsonData });
    // });

    res.status(200).json({ message: 'Consulta exitosa', data: xmlContent });

  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al procesar comprobante' });
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
  getXmlSunat
};
