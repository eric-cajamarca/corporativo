const comprobantesCompraSunatService = require('../services/comprobantesCompraSunat.service');

const listar = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).send({ message: 'No autorizado', data: undefined });
  }
  try {
    const data = await comprobantesCompraSunatService.listarPorEmpresaParaUsuario(req.user, req.query || {});
    res.status(200).send({ data });
  } catch (error) {
    if (error.statusCode === 403 || error.statusCode === 401) {
      return res.status(error.statusCode).send({ message: error.message, data: undefined });
    }
    console.error('comprobantesCompraSunatController.listar:', error);
    return next(error);
  }
};

module.exports = {
  listar
};
