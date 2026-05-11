const sql = require('mssql');
const cotizacionesService = require('../services/cotizaciones.service');
const cotizacionesRepository = require('../repositories/cotizaciones.repository');
const { withPool } = require('../utils/dbPool.util');

const crear = async (req, res) => {
  const idEmpresa = req.user?.empresa;
  const idUsuario = req.user?.sub;
  if (!req.user || !idEmpresa || !idUsuario) {
    return res.status(401).json({ message: 'No Access' });
  }
  try {
    await withPool(async (pool) => {
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      try {
        const idCotizacion = await cotizacionesService.crearCotizacion(transaction, req.body, idEmpresa, idUsuario);
        await transaction.commit();
        res.status(201).json({ success: true, idCotizacion });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    });
  } catch (error) {
    console.error('Error crear cotización:', error);
    if (!res.headersSent) {
      const msg = error && error.message ? String(error.message) : '';
      const esVal =
        /obligatorio|válido|no existe|no corresponde|empresa/i.test(msg);
      res.status(esVal ? 400 : 500).json({ error: msg || 'Error al crear cotización.' });
    }
  }
};

const listar = async (req, res) => {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  try {
    const filtros = {
      fechaDesde: req.query.fechaDesde || null,
      fechaHasta: req.query.fechaHasta || null,
      idCliente: req.query.idCliente !== undefined && req.query.idCliente !== '' ? req.query.idCliente : null,
      serie: req.query.serie || null,
      numero: req.query.numero || null
    };
    const lista = await withPool((pool) => cotizacionesRepository.listarConFiltros(pool, idEmpresa, filtros));
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
    const resultado = await withPool((pool) =>
      cotizacionesRepository.obtenerPorId(pool, idCotizacion, idEmpresa)
    );
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
  const idCliAct = Number(cotizacion.idCliente);
  if (!Number.isFinite(idCliAct) || idCliAct < 1) {
    return res.status(400).json({ error: 'El cliente es obligatorio y debe ser válido.' });
  }
  try {
    await withPool(async (pool) => {
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      try {
        const okCli = await cotizacionesRepository.clientePerteneceAEmpresa(transaction, idEmpresa, idCliAct);
        if (!okCli) {
          await transaction.rollback();
          if (!res.headersSent) {
            res.status(400).json({ error: 'El cliente no pertenece a esta empresa.' });
          }
          return;
        }
        const datosCabecera = {
          serie: cotizacion.serie,
          numero: cotizacion.numero,
          serieNumero: cotizacion.serieNumero || (cotizacion.serie + '-' + cotizacion.numero),
          fEmision: cotizacion.fEmision ? String(cotizacion.fEmision).substring(0, 10) : null,
          fVencimiento: cotizacion.fVencimiento ? String(cotizacion.fVencimiento).substring(0, 10) : null,
          idDocumento: cotizacion.idDocumento != null ? String(cotizacion.idDocumento).substring(0, 1) : '1',
          idCliente: idCliAct,
          moneda: cotizacion.moneda || null,
          idCondicionPago: cotizacion.idCondicionPago != null ? Number(cotizacion.idCondicionPago) : null,
          total: Number(cotizacion.total) || 0,
          esCotizacionAgrupada:
            cotizacion.esCotizacionAgrupada === true ||
            cotizacion.esCotizacionAgrupada === 1 ||
            cotizacion.esCotizacionAgrupada === '1' ||
            String(cotizacion.esCotizacionAgrupada || '').toLowerCase() === 'true'
        };
        await cotizacionesRepository.actualizar(transaction, idCotizacion, datosCabecera, idEmpresa);
        await cotizacionesRepository.eliminarDetalle(transaction, idCotizacion);
        if (detalles && Array.isArray(detalles) && detalles.length > 0) {
          let idSucursalDef = cotizacion.idSucursal != null ? String(cotizacion.idSucursal).trim() : null;
          const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
          if (!idSucursalDef || !uuidRe.test(idSucursalDef)) {
            idSucursalDef = await cotizacionesRepository.obtenerPrimeraSucursalPorEmpresa(transaction, idEmpresa);
          }
          const items = detalles.map((d) => ({
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
            idSucursal: d.idSucursal != null ? d.idSucursal : idSucursalDef,
            idProducto: d.idProducto != null ? d.idProducto : null,
            idEmpresaProducto: d.idEmpresaProducto != null ? d.idEmpresaProducto : null,
            aliasEmpresa: d.aliasEmpresa != null ? d.aliasEmpresa : null
          }));
          await cotizacionesRepository.insertarDetalle(transaction, idCotizacion, idEmpresa, items, idSucursalDef);
        }
        await transaction.commit();
        res.json({ success: true, idCotizacion });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    });
  } catch (error) {
    console.error('Error actualizar cotización:', error);
    if (!res.headersSent) {
      const msg = error && error.message ? String(error.message) : '';
      const esVal = /obligatorio|válido|no pertenece|empresa/i.test(msg);
      res.status(esVal ? 400 : 500).json({ error: msg || 'Error al actualizar cotización.' });
    }
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
  try {
    await withPool(async (pool) => {
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      try {
        await cotizacionesRepository.eliminar(transaction, idCotizacion, idEmpresa);
        await transaction.commit();
        res.json({ success: true });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    });
  } catch (error) {
    console.error('Error eliminar cotización:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
};

const obtenerParaVenta = async (req, res) => {
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
    const resultado = await withPool((pool) =>
      cotizacionesRepository.obtenerParaVenta(pool, idCotizacion, idEmpresa)
    );
    if (!resultado) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    res.json({ data: resultado });
  } catch (error) {
    console.error('Error obtener cotización para venta:', error);
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
    const data = await withPool((pool) =>
      cotizacionesRepository.obtenerParaPdf(pool, idCotizacion, idEmpresa, baseUrl)
    );
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
  obtenerParaVenta,
  actualizar,
  eliminar,
  obtenerParaPdf
};
