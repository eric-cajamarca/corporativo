// services/kardex.service.js
const { withPool } = require('../utils/dbPool.util');
const kardexRepository = require('../repositories/kardex.repository');
const { getFechaHoyApp, partesAhoraApp } = require('../utils/fechaDisplay.util');

const BATCH_SIZE = 8;

/** Nombre del tipo de operación (Tabla 12 SUNAT) para el Excel Formato 13.1. */
function mapTipoOperacion(fila) {
  if (!fila) return 'Otros';
  if (fila.tipoRef === 'COMPRA') return 'Compra';
  if (fila.tipoRef === 'VENTA') return 'Venta';
  if (fila.tipoMov === 'EN' || fila.tipoMov === 'AJ') return 'Entrada por ajuste';
  if (fila.tipoMov === 'SA') return 'Salida por otros';
  return 'Otros';
}

function fmtFechaDdMmYyyy(iso) {
  if (!iso) return '';
  const s = String(iso).slice(0, 10);
  const p = s.split('-');
  if (p.length !== 3) return s;
  return `${p[2]}-${p[1]}-${p[0]}`;
}

function mapProductoFormato131(kardex, fechaDesde) {
  if (!kardex || !kardex.producto) return null;

  const saldoInicial = kardex.saldoInicial || { cantidad: 0, pUnitario: 0, importe: 0 };
  const filas = [];

  const incluirSaldoInicial =
    Math.abs(saldoInicial.cantidad || 0) > 0.0001 || Math.abs(saldoInicial.importe || 0) > 0.0001;

  if (incluirSaldoInicial) {
    filas.push({
      fecha: fmtFechaDdMmYyyy(fechaDesde),
      tipoDocumento: '00',
      serie: '',
      numero: '',
      tipoOperacion: 'Saldo inicial',
      cantidadEntrada: saldoInicial.cantidad || 0,
      costoUnitarioEntrada: saldoInicial.pUnitario || 0,
      importeEntrada: saldoInicial.importe || 0,
      cantidadSalida: 0,
      costoUnitarioSalida: 0,
      importeSalida: 0,
      saldoCantidad: saldoInicial.cantidad || 0,
      saldoCostoUnitario: saldoInicial.pUnitario || 0,
      saldoImporte: saldoInicial.importe || 0
    });
  }

  for (const f of kardex.filas || []) {
    if (f.excluidoDeTotales) continue;
    const esEntrada = (f.cantidadEntrada || 0) > 0;
    const esSalida = (f.cantidadSalida || 0) > 0;
    const costoSalida = f.pUnitarioSalidaValorizado != null
      ? f.pUnitarioSalidaValorizado
      : (f.costoUnitarioSalida || f.pUnitarioSalida || 0);
    const importeSalida = f.importeSalidaValorizado != null
      ? f.importeSalidaValorizado
      : (esSalida ? Math.round((f.cantidadSalida * costoSalida) * 100) / 100 : 0);

    filas.push({
      fecha: fmtFechaDdMmYyyy(f.fecha),
      tipoDocumento: f.tipoDocumento || '00',
      serie: f.serie || '',
      numero: f.numero || '',
      tipoOperacion: mapTipoOperacion(f),
      cantidadEntrada: esEntrada ? f.cantidadEntrada : 0,
      costoUnitarioEntrada: esEntrada ? f.pUnitarioEntrada : 0,
      importeEntrada: esEntrada ? f.importeEntrada : 0,
      cantidadSalida: esSalida ? f.cantidadSalida : 0,
      costoUnitarioSalida: esSalida ? costoSalida : 0,
      importeSalida: esSalida ? importeSalida : 0,
      saldoCantidad: f.saldoCantidad || 0,
      saldoCostoUnitario: f.saldoPUnitario || 0,
      saldoImporte: f.saldoImporte || 0
    });
  }

  const totales = kardex.totales || {};
  const totalEntradaCantidad =
    (incluirSaldoInicial ? (saldoInicial.cantidad || 0) : 0) + (totales.totalEntradaCantidad || 0);
  const totalEntradaImporte =
    (incluirSaldoInicial ? (saldoInicial.importe || 0) : 0) + (totales.totalEntradaImporte || 0);

  return {
    codigo: kardex.producto.codigo || '',
    descripcion: kardex.producto.descripcion || '',
    tipoExistencia: kardex.producto.tipoExistencia || '01',
    tipoExistenciaDescripcion: kardex.producto.tipoExistenciaDescripcion || 'MERCADERIAS',
    unidadMedida: kardex.producto.unidadMedida || 'NIU',
    filas,
    totales: {
      totalEntradaCantidad,
      totalEntradaImporte,
      totalSalidaCantidad: totales.totalSalidaCantidad || 0,
      totalSalidaImporte: totales.totalSalidaImporteValorizado != null
        ? totales.totalSalidaImporteValorizado
        : (totales.totalSalidaImporte || 0),
      saldoFinalCantidad: totales.saldoFinalCantidad || 0,
      saldoFinalCostoUnitario: totales.saldoFinalPUnitario || 0,
      saldoFinalImporte: totales.saldoFinalImporte || 0
    }
  };
}

/**
 * Obtiene el kardex de un producto en un rango de fechas.
 * @param {string} idEmpresa - UUID de la empresa (del token)
 * @param {string} idProducto - UUID del producto
 * @param {string} fechaDesde - ISO o YYYY-MM-DD
 * @param {string} fechaHasta - ISO o YYYY-MM-DD
 */
exports.obtenerKardex = async (idEmpresa, idProducto, fechaDesde, fechaHasta) => {
  if (!idEmpresa || !idProducto) {
    throw new Error('idEmpresa e idProducto son obligatorios');
  }
  const { y, m } = partesAhoraApp();
  const desde = fechaDesde || `${y}-${m}-01`;
  const hasta = fechaHasta || getFechaHoyApp();
  return withPool((pool) =>
    kardexRepository.obtenerKardex(pool, idEmpresa, idProducto, desde, hasta)
  );
};

/**
 * Kardex completo de todos los productos (Formato 13.1 SUNAT).
 */
exports.obtenerKardexCompleto = async (idEmpresa, fechaDesde, fechaHasta) => {
  if (!idEmpresa) {
    throw new Error('idEmpresa es obligatorio');
  }
  const { y, m } = partesAhoraApp();
  const desde = fechaDesde || `${y}-${m}-01`;
  const hasta = fechaHasta || getFechaHoyApp();

  return withPool(async (pool) => {
    const [cabecera, productos] = await Promise.all([
      kardexRepository.obtenerCabeceraEmpresaKardex(pool, idEmpresa),
      kardexRepository.listarProductosParaKardex(pool, idEmpresa)
    ]);

    if (!cabecera) {
      throw new Error('Empresa no encontrada');
    }

    const productosFormato = [];
    for (let i = 0; i < productos.length; i += BATCH_SIZE) {
      const lote = productos.slice(i, i + BATCH_SIZE);
      const resultados = await Promise.all(
        lote.map((p) => kardexRepository.obtenerKardex(pool, idEmpresa, p.idProducto, desde, hasta))
      );
      for (const kardex of resultados) {
        const mapped = mapProductoFormato131(kardex, desde);
        if (!mapped) continue;
        const tieneMovimiento = (mapped.filas || []).length > 0;
        const tieneSaldo = Math.abs(mapped.totales.saldoFinalCantidad || 0) > 0.0001
          || Math.abs(mapped.totales.saldoFinalImporte || 0) > 0.0001;
        if (tieneMovimiento || tieneSaldo) {
          productosFormato.push(mapped);
        }
      }
    }

    return {
      empresa: {
        razonSocial: cabecera.razonSocial || '',
        nombre: cabecera.nombre || cabecera.razonSocial || '',
        ruc: cabecera.ruc || '',
        direccion: cabecera.direccion || '',
        telefono: cabecera.telefono || '',
        correo: cabecera.correo || '',
        rubro: cabecera.rubro || '',
        establecimiento: cabecera.establecimiento || 'ALMACEN GENERAL'
      },
      periodo: {
        fechaDesde: desde,
        fechaHasta: hasta
      },
      productos: productosFormato
    };
  });
};
