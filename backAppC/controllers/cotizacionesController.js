// controllers/cotizacionesController.js
const sql = require('mssql');
const dbConfig = require('../dbconfig');
const cotizacionesService = require('../services/cotizaciones.service');
const cotizacionesRepository = require('../repositories/cotizaciones.repository');

const crear = async (req, res) => {
  const idEmpresa = req.user?.empresa;
  const idUsuario = req.user?.sub;
  if (!req.user || !idEmpresa || !idUsuario) {
    return res.status(401).json({ message: 'No Access' });
  }
  const pool = await sql.connect(dbConfig);
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const idCotizacion = await cotizacionesService.crearCotizacion(transaction, req.body, idEmpresa, idUsuario);
    await transaction.commit();
    res.status(201).json({ success: true, idCotizacion });
  } catch (error) {
    await transaction.rollback();
    console.error('Error crear cotización:', error);
    res.status(500).json({ error: error.message });
  }
};

const listar = async (req, res) => {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const filtros = {
      fechaDesde: req.query.fechaDesde || null,
      fechaHasta: req.query.fechaHasta || null,
      idCliente: req.query.idCliente !== undefined && req.query.idCliente !== '' ? req.query.idCliente : null,
      serie: req.query.serie || null,
      numero: req.query.numero || null
    };
    const lista = await cotizacionesRepository.listarConFiltros(pool, idEmpresa, filtros);
    res.json({ data: lista });
  } catch (error) {
    console.error('Error listar cotizaciones:', error);
    res.status(500).json({ error: error.message });
  }
};

const obtenerPorId = async (req, res) => {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  const idRaw = req.params.id;
  const idCotizacion = parseInt(idRaw, 10);
  if (Number.isNaN(idCotizacion) || idCotizacion < 1) {
    return res.status(400).json({ error: 'idCotizacion inválido' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const resultado = await cotizacionesRepository.obtenerPorId(pool, idCotizacion, idEmpresa);
    if (!resultado.cabecera) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    res.json({ data: resultado });
  } catch (error) {
    console.error('Error obtener cotización:', error);
    res.status(500).json({ error: error.message });
  }
};

const actualizar = async (req, res) => {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  const idRaw = req.params.id;
  const idCotizacion = parseInt(idRaw, 10);
  if (Number.isNaN(idCotizacion) || idCotizacion < 1) {
    return res.status(400).json({ error: 'idCotizacion inválido' });
  }
  const { cotizacion, detalles } = req.body || {};
  if (!cotizacion) {
    return res.status(400).json({ error: 'Falta cabecera de cotización' });
  }
  const pool = await sql.connect(dbConfig);
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const datosCabecera = {
      serie: cotizacion.serie,
      numero: cotizacion.numero,
      serieNumero: cotizacion.serieNumero || (cotizacion.serie + '-' + cotizacion.numero),
      fEmision: cotizacion.fEmision ? String(cotizacion.fEmision).substring(0, 10) : null,
      fVencimiento: cotizacion.fVencimiento ? String(cotizacion.fVencimiento).substring(0, 10) : null,
      idDocumento: cotizacion.idDocumento != null ? String(cotizacion.idDocumento).substring(0, 1) : '1',
      idCliente: Number(cotizacion.idCliente),
      moneda: cotizacion.moneda || null,
      idCondicionPago: cotizacion.idCondicionPago != null ? Number(cotizacion.idCondicionPago) : null,
      total: Number(cotizacion.total) || 0
    };
    await cotizacionesRepository.actualizar(transaction, idCotizacion, datosCabecera, idEmpresa);
    await cotizacionesRepository.eliminarDetalle(transaction, idCotizacion);
    if (detalles && Array.isArray(detalles) && detalles.length > 0) {
      const items = detalles.map(d => ({
        cantidad: d.cantidad,
        pVenta: d.pVenta,
        subtotal: d.subtotal,
        total: d.total,
        descuento: d.descuento != null ? d.descuento : 0,
        igv: d.igv != null ? d.igv : 0,
        isc: d.isc != null ? d.isc : 0,
        codigo: d.codigo != null ? d.codigo : '',
        descripcion: d.descripcion != null ? d.descripcion : '',
        idPresentacion: d.idPresentacion != null ? d.idPresentacion : 1,
        idSucursal: d.idSucursal != null ? d.idSucursal : cotizacion.idSucursal
      }));
      await cotizacionesRepository.insertarDetalle(transaction, idCotizacion, idEmpresa, items);
    }
    await transaction.commit();
    res.json({ success: true, idCotizacion });
  } catch (error) {
    await transaction.rollback();
    console.error('Error actualizar cotización:', error);
    res.status(500).json({ error: error.message });
  }
};

const eliminar = async (req, res) => {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  const idRaw = req.params.id;
  const idCotizacion = parseInt(idRaw, 10);
  if (Number.isNaN(idCotizacion) || idCotizacion < 1) {
    return res.status(400).json({ error: 'idCotizacion inválido' });
  }
  const pool = await sql.connect(dbConfig);
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    await cotizacionesRepository.eliminar(transaction, idCotizacion, idEmpresa);
    await transaction.commit();
    res.json({ success: true });
  } catch (error) {
    await transaction.rollback();
    console.error('Error eliminar cotización:', error);
    res.status(500).json({ error: error.message });
  }
};

const obtenerParaPdf = async (req, res) => {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  const idRaw = req.params.id;
  const idCotizacion = parseInt(idRaw, 10);
  if (Number.isNaN(idCotizacion) || idCotizacion < 1) {
    return res.status(400).json({ error: 'idCotizacion inválido' });
  }
  try {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const pool = await sql.connect(dbConfig);
    const data = await cotizacionesRepository.obtenerParaPdf(pool, idCotizacion, idEmpresa, baseUrl);
    if (!data) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    res.json({ data });
  } catch (error) {
    console.error('Error obtener cotización para PDF:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  crear,
  listar,
  obtenerPorId,
  actualizar,
  eliminar,
  obtenerParaPdf
};
