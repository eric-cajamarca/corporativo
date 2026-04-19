const productosImagenService = require('../services/productosImagen.service');
const { withPool } = require('../utils/dbPool.util');

const listar = async (req, res) => {
  try {
    const idEmpresa = req.user && req.user.empresa;
    const idProducto = req.params.idProducto;
    if (!idEmpresa || !idProducto) {
      return res.status(400).json({ message: 'Falta idEmpresa o idProducto', data: undefined });
    }
    const lista = await withPool((pool) => productosImagenService.listarPorProducto(pool, idEmpresa, idProducto));
    res.status(200).json({ data: lista });
  } catch (error) {
    if (error.message && error.message.includes('no encontrado')) {
      return res.status(404).json({ message: error.message, data: undefined });
    }
    console.error('productosImagen.listar:', error);
    res.status(500).json({ message: 'Error al listar imágenes', data: undefined });
  }
};

const subir = async (req, res) => {
  try {
    const idEmpresa = req.user && req.user.empresa;
    const idProducto = req.params.idProducto;
    const files = req.files || [];
    if (!idEmpresa || !idProducto) {
      return res.status(400).json({ message: 'Falta idEmpresa o idProducto', data: undefined });
    }
    if (files.length === 0) {
      return res.status(400).json({ message: 'No se enviaron imágenes', data: undefined });
    }
    const rutas = await withPool((pool) => productosImagenService.subir(pool, idEmpresa, idProducto, files));
    res.status(201).json({ message: 'Imágenes subidas', data: rutas });
  } catch (error) {
    if (error.message && error.message.includes('no encontrado')) {
      return res.status(404).json({ message: error.message, data: undefined });
    }
    if (error.message && error.message.includes('Máximo')) {
      return res.status(400).json({ message: error.message, data: undefined });
    }
    console.error('productosImagen.subir:', error);
    res.status(500).json({ message: 'Error al subir imágenes', data: undefined });
  }
};

const eliminar = async (req, res) => {
  try {
    const idEmpresa = req.user && req.user.empresa;
    const idImagen = req.params.idImagen;
    if (!idEmpresa || !idImagen) {
      return res.status(400).json({ message: 'Falta idEmpresa o idImagen', data: undefined });
    }
    const result = await withPool((pool) => productosImagenService.eliminar(pool, idImagen, idEmpresa));
    res.status(200).json({ message: 'Imagen eliminada', data: result });
  } catch (error) {
    if (error.message && error.message.includes('no encontrada')) {
      return res.status(404).json({ message: error.message, data: undefined });
    }
    console.error('productosImagen.eliminar:', error);
    res.status(500).json({ message: 'Error al eliminar imagen', data: undefined });
  }
};

const marcarPortada = async (req, res) => {
  try {
    const idEmpresa = req.user && req.user.empresa;
    const idProducto = req.params.idProducto;
    const idImagen = req.body && req.body.idImagen;
    if (!idEmpresa || !idProducto || !idImagen) {
      return res.status(400).json({ message: 'Falta idEmpresa, idProducto o idImagen', data: undefined });
    }
    await withPool((pool) => productosImagenService.marcarPortada(pool, idEmpresa, idProducto, idImagen));
    res.status(200).json({ message: 'Portada actualizada', data: { ok: true } });
  } catch (error) {
    if (error.message && (error.message.includes('no encontrado') || error.message.includes('no pertenece'))) {
      return res.status(404).json({ message: error.message, data: undefined });
    }
    console.error('productosImagen.marcarPortada:', error);
    res.status(500).json({ message: 'Error al marcar portada', data: undefined });
  }
};

module.exports = { listar, subir, eliminar, marcarPortada };
