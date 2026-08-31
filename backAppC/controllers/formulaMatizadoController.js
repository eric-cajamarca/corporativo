const formulaMatizadoService = require('../services/formulaMatizado.service');
const { withPool } = require('../utils/dbPool.util');

async function listar(req, res) {
  try {
    if (!req.user?.empresa) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    const data = await withPool((pool) =>
      formulaMatizadoService.listar(pool, req.user.empresa, {
        q: req.query?.q,
        placa: req.query?.placa,
        idProductoBase: req.query?.idProductoBase,
        limite: req.query?.limit
      })
    );
    return res.status(200).send({ data });
  } catch (error) {
    console.error('formulaMatizado.listar:', error);
    return res.status(400).send({ message: error.message || 'Error al listar fórmulas', data: undefined });
  }
}

async function obtener(req, res) {
  try {
    if (!req.user?.empresa) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    const data = await withPool((pool) =>
      formulaMatizadoService.obtener(pool, req.user.empresa, req.params.idFormula)
    );
    return res.status(200).send({ data });
  } catch (error) {
    console.error('formulaMatizado.obtener:', error);
    const status = error.message === 'Fórmula no encontrada' ? 404 : 400;
    return res.status(status).send({ message: error.message || 'Error al obtener fórmula', data: undefined });
  }
}

async function guardar(req, res) {
  try {
    if (!req.user?.empresa || !req.user?.sub) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    const idFormula = await withPool((pool) =>
      formulaMatizadoService.guardarFormula(pool, req.user.empresa, req.user.sub, {
        ...(req.body || {}),
        idFormula: req.params.idFormula || req.body?.idFormula
      })
    );
    return res.status(200).send({ data: { idFormula }, message: 'Fórmula guardada' });
  } catch (error) {
    console.error('formulaMatizado.guardar:', error);
    return res.status(400).send({ message: error.message || 'Error al guardar fórmula', data: undefined });
  }
}

async function eliminar(req, res) {
  try {
    if (!req.user?.empresa) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    await withPool((pool) =>
      formulaMatizadoService.eliminar(pool, req.user.empresa, req.params.idFormula)
    );
    return res.status(200).send({ message: 'Fórmula eliminada', data: true });
  } catch (error) {
    console.error('formulaMatizado.eliminar:', error);
    const status = error.message === 'Fórmula no encontrada' ? 404 : 400;
    return res.status(status).send({ message: error.message || 'Error al eliminar fórmula', data: undefined });
  }
}

module.exports = {
  listar,
  obtener,
  guardar,
  eliminar
};
