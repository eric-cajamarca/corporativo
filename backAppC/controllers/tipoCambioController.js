const sql = require('mssql');
const dbConfig = require('../dbconfig');
const factilizaRepository = require('../repositories/factiliza.repository');

const NOMBRE_SERVICIO_TIPO_CAMBIO = 'Factiliza TIPO CAMBIO';
const API_TIPO_CAMBIO_BASE = 'https://api.factiliza.com/v1/tipocambio/info/dia';
const MAX_DIAS_ATRAS = 15;

function formatFechaYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Genera fechas desde hoy hacia atrás (máx. MAX_DIAS_ATRAS).
 */
function fechasParaConsultar() {
  const out = [];
  const hoy = new Date();
  for (let i = 0; i < MAX_DIAS_ATRAS; i++) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    out.push(formatFechaYMD(d));
  }
  return out;
}

/**
 * GET /api/factiliza/tipo-cambio
 * Devuelve el tipo de cambio del día o el de la última fecha con datos. Solo si la empresa está autorizada (empresaFaciliza).
 */
async function getTipoCambioDia(req, res) {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    return res.status(401).json({ status: 401, success: false, message: 'No autorizado' });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig);

    const puedeUsar = await factilizaRepository.puedeUsarServicio(pool, idEmpresa, NOMBRE_SERVICIO_TIPO_CAMBIO);
    if (!puedeUsar) {
      return res.status(403).json({ status: 403, success: false, message: 'Su empresa no tiene autorización para usar el servicio de tipo de cambio' });
    }

    const config = await factilizaRepository.getConfigByNombre(pool, NOMBRE_SERVICIO_TIPO_CAMBIO);
    const token = (config && config.tokenDefault) || process.env.FACTILIZA_TOKEN || null;
    if (!token) {
      return res.status(503).json({ status: 503, success: false, message: 'Servicio de tipo de cambio no configurado' });
    }

    const fechas = fechasParaConsultar();
    let data = null;
    let lastMessage = 'No hay datos para la fecha indicada';

    for (const fecha of fechas) {
      const url = `${API_TIPO_CAMBIO_BASE}?fecha=${fecha}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataRes = await response.json();
      const dataItem = dataRes.data ?? null;

      if (response.ok && dataRes.status !== 404 && dataItem && (dataItem.compra != null || dataItem.venta != null)) {
        data = dataItem;
        break;
      }
      if (dataRes.message) lastMessage = dataRes.message;
    }

    if (!data) {
      return res.status(404).json({
        status: 404,
        message: lastMessage,
        data: null
      });
    }

    res.status(200).json({ message: 'Consulta exitosa', data });
  } catch (err) {
    console.error('tipoCambioController getTipoCambioDia:', err.message);
    res.status(500).json({ status: 500, success: false, message: 'Error al consultar tipo de cambio' });
  } finally {
    if (pool) try { pool.close(); } catch (_) {}
  }
}

/**
 * Genera las fechas YYYY-MM-DD de un mes.
 */
function fechasDelMes(anio, mes) {
  const out = [];
  const ultimoDia = new Date(Number(anio), Number(mes), 0).getDate();
  for (let d = 1; d <= ultimoDia; d++) {
    const fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    out.push(fecha);
  }
  return out;
}

/**
 * GET /api/factiliza/tipo-cambio/mes?anio=2025&mes=2
 * Devuelve tipo de cambio SUNAT de cada día del mes con datos. Solo si la empresa está autorizada.
 */
async function getTipoCambioMes(req, res) {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    return res.status(401).json({ status: 401, success: false, message: 'No autorizado' });
  }

  const ahora = new Date();
  const anio = req.query.anio ? parseInt(req.query.anio, 10) : ahora.getFullYear();
  const mes = req.query.mes ? parseInt(req.query.mes, 10) : ahora.getMonth() + 1;
  if (isNaN(anio) || isNaN(mes) || mes < 1 || mes > 12) {
    return res.status(400).json({ status: 400, success: false, message: 'Parámetros anio y mes inválidos' });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig);

    const puedeUsar = await factilizaRepository.puedeUsarServicio(pool, idEmpresa, NOMBRE_SERVICIO_TIPO_CAMBIO);
    if (!puedeUsar) {
      return res.status(403).json({ status: 403, success: false, message: 'Su empresa no tiene autorización para usar el servicio de tipo de cambio' });
    }

    const config = await factilizaRepository.getConfigByNombre(pool, NOMBRE_SERVICIO_TIPO_CAMBIO);
    const token = (config && config.tokenDefault) || process.env.FACTILIZA_TOKEN || null;
    if (!token) {
      return res.status(503).json({ status: 503, success: false, message: 'Servicio de tipo de cambio no configurado' });
    }

    const fechas = fechasDelMes(anio, mes);
    const resultados = [];

    for (const fecha of fechas) {
      const url = `${API_TIPO_CAMBIO_BASE}?fecha=${fecha}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataRes = await response.json();
      const dataItem = dataRes.data ?? null;

      if (response.ok && dataRes.status !== 404 && dataItem && (dataItem.compra != null || dataItem.venta != null)) {
        resultados.push({
          fecha: dataItem.fecha || fecha,
          compra: dataItem.compra,
          venta: dataItem.venta
        });
      }
    }

    resultados.sort((a, b) => (b.fecha < a.fecha ? -1 : 1));
    res.status(200).json({ message: 'Consulta exitosa', data: resultados });
  } catch (err) {
    console.error('tipoCambioController getTipoCambioMes:', err.message);
    res.status(500).json({ status: 500, success: false, message: 'Error al consultar tipo de cambio del mes' });
  } finally {
    if (pool) try { pool.close(); } catch (_) {}
  }
}

module.exports = {
  getTipoCambioDia,
  getTipoCambioMes
};
