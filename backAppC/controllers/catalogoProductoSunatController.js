const { withPool } = require('../utils/dbPool.util');
const catalogoProductoSunatService = require('../services/catalogoProductoSunat.service');

async function listar(req, res) {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).send({ message: 'Empresa no identificada', data: undefined });
    }
    const data = await withPool((pool) =>
      catalogoProductoSunatService.listarCatalogoService(pool, {
        anexo: req.query.anexo,
        q: req.query.q,
        limite: req.query.limite
      })
    );
    return res.status(200).send({ message: 'OK', data });
  } catch (error) {
    console.error('listar catalogo producto sunat:', error);
    return res.status(500).send({ message: error.message || 'Error al listar catálogo', data: undefined });
  }
}

async function sugerir(req, res) {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).send({ message: 'Empresa no identificada', data: undefined });
    }
    const data = await withPool((pool) =>
      catalogoProductoSunatService.sugerirService(pool, {
        descripcion: req.body?.descripcion || req.query.descripcion,
        categoria: req.body?.categoria || req.query.categoria,
        limite: req.body?.limite || req.query.limite
      })
    );
    return res.status(200).send({ message: 'OK', data });
  } catch (error) {
    console.error('sugerir codigo producto sunat:', error);
    return res.status(500).send({ message: error.message || 'Error al sugerir código', data: undefined });
  }
}

module.exports = {
  listar,
  sugerir
};
