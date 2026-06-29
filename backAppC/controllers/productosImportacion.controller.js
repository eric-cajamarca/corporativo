const { withPool } = require('../utils/dbPool.util');
const productosImportacionService = require('../services/productosImportacion.service');

function bufferFromReq(req) {
  if (req.file && req.file.buffer) return req.file.buffer;
  return null;
}

const descargarPlantilla = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
      productosImportacionService.asegurarPuedeImportar(req.user);
    } catch (e) {
      if (e.message === 'NO_PERMISO_IMPORTACION') {
        return res.status(403).json({ message: 'Solo administradores pueden descargar la plantilla.', data: undefined });
      }
      throw e;
    }
    const buf = await productosImportacionService.generarPlantillaBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_importacion_productos.xlsx"');
    return res.status(200).send(buf);
  } catch (error) {
    console.error('contexto: productosImportacion.descargarPlantilla', error);
    return res.status(500).json({ message: 'No se pudo generar la plantilla', data: undefined });
  }
};

const validar = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    const buffer = bufferFromReq(req);
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ message: 'Adjunte un archivo Excel (.xlsx)', data: undefined });
    }
    const filas = await productosImportacionService.parseBufferAObjetos(buffer);
    const data = await withPool((pool) =>
      productosImportacionService.validarArchivoConFilas(pool, req.user, filas)
    );
    return res.status(200).json({ message: 'Validación completada', data });
  } catch (error) {
    if (error.message === 'NO_PERMISO_IMPORTACION') {
      return res.status(403).json({ message: 'Solo administradores pueden importar productos.', data: undefined });
    }
    if (error.message === 'ARCHIVO_DEMASIADO_GRANDE') {
      return res.status(400).json({
        message: `El archivo supera el tamaño máximo (${Math.floor(productosImportacionService.MAX_BYTES / 1024 / 1024)} MB).`,
        data: undefined
      });
    }
    if (error.message === 'DEMASIADAS_FILAS') {
      return res.status(400).json({
        message: `Máximo ${productosImportacionService.MAX_FILAS} filas de datos.`,
        data: undefined
      });
    }
    if (
      error.message === 'EXCEL_SIN_DATOS' ||
      error.message === 'EXCEL_SIN_HOJAS' ||
      error.message === 'EXCEL_INVALIDO'
    ) {
      return res.status(400).json({ message: 'El Excel no contiene datos válidos.', data: undefined });
    }
    if (error.message === 'SIN_SUCURSAL_PRINCIPAL') {
      return res.status(400).json({
        message: 'No hay sucursal activa para registrar stock inicial.',
        data: undefined
      });
    }
    console.error('contexto: productosImportacion.validar', error);
    return res.status(500).json({ message: error.message || 'Error al validar el archivo', data: undefined });
  }
};

const ejecutar = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    const buffer = bufferFromReq(req);
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ message: 'Adjunte un archivo Excel (.xlsx)', data: undefined });
    }
    const filas = await productosImportacionService.parseBufferAObjetos(buffer);
    const data = await withPool((pool) =>
      productosImportacionService.ejecutarImportacionConFilas(pool, req.user, filas)
    );
    return res.status(200).json({ message: 'Importación finalizada', data });
  } catch (error) {
    if (error.message === 'NO_PERMISO_IMPORTACION') {
      return res.status(403).json({ message: 'Solo administradores pueden importar productos.', data: undefined });
    }
    if (error.message === 'SIN_USUARIO_PRODUCTO') {
      return res.status(400).json({
        message: 'No hay usuario asociado a la empresa para registrar productos.',
        data: undefined
      });
    }
    if (error.message === 'SIN_SUCURSAL_PRINCIPAL') {
      return res.status(400).json({
        message: 'No existe sucursal activa; no se puede registrar stock inicial.',
        data: undefined
      });
    }
    if (error.message === 'ARCHIVO_DEMASIADO_GRANDE' || error.message === 'DEMASIADAS_FILAS') {
      return res.status(400).json({ message: error.message, data: undefined });
    }
    console.error('contexto: productosImportacion.ejecutar', error);
    return res.status(500).json({ message: error.message || 'Error al importar', data: undefined });
  }
};

module.exports = {
  descargarPlantilla,
  validar,
  ejecutar
};
