const sql = require('mssql');
const dbConfig = require('../dbconfig');
const comprobantesService = require('../services/comprobantes.service');
const { errores: CE } = comprobantesService;

async function obtener_comprobantes(req, res) {
  try {
    const pool = await sql.connect(dbConfig);
    const uso = (req.query?.uso || '').toLowerCase();
    const data = await comprobantesService.obtenerComprobantes(pool, req.user, uso);
    return res.status(200).send({ data });
  } catch (error) {
    if (error.message === CE.NO_AUTH) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    console.error('Error al obtener comprobantes:', error);
    return res.status(500).send({ message: 'Error al obtener los comprobantes', data: undefined });
  }
}

async function obtenerComprobantes_alias(req, res) {
  const alias = req.params.id;
  try {
    const pool = await sql.connect(dbConfig);
    const data = await comprobantesService.obtenerComprobantesAlias(pool, req.user, alias);
    return res.json(data);
  } catch (error) {
    if (error.message === CE.NO_AUTH) {
      return res.status(500).send({ message: 'No Access', data: undefined });
    }
    if (error.message === CE.ALIAS_INVALIDO) {
      return res.status(400).send('Alias inválido');
    }
    console.error('Error al obtener los comprobantes:', error);
    return res.status(500).send('Error al obtener los comprobantes');
  }
}

async function actualizar_comprobante(req, res) {
  try {
    const pool = await sql.connect(dbConfig);
    const affected = await comprobantesService.actualizarComprobante(
      pool,
      req.user,
      req.params.id,
      req.body || {}
    );
    return res.status(200).send({ data: { rowsAffected: affected } });
  } catch (error) {
    if (error.message === CE.NO_AUTH) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    if (error.message === CE.BAD_ID) {
      return res.status(400).send({ message: 'id inválido', data: undefined });
    }
    if (error.message === CE.BAD_SERIE) {
      return res
        .status(400)
        .send({ message: 'Serie debe ser "-" (para RC/RA) o texto de 1 a 4 caracteres', data: undefined });
    }
    if (error.message === CE.BAD_NUMERO) {
      return res.status(400).send({ message: 'Número correlativo debe ser entero >= 0', data: undefined });
    }
    if (error.message === CE.BAD_BODY) {
      return res
        .status(400)
        .send({ message: 'Envíe serie, numero y/o usarEnVenta/usarEnCompra a actualizar', data: undefined });
    }
    if (error.message === CE.NOT_FOUND) {
      return res.status(404).send({ message: 'Comprobante no encontrado', data: undefined });
    }
    console.error('Error al actualizar comprobante:', error);
    return res.status(500).send({ message: 'Error al actualizar comprobante', data: undefined });
  }
}

async function crear_comprobante(req, res) {
  try {
    const pool = await sql.connect(dbConfig);
    const idNew = await comprobantesService.crearComprobante(pool, req.user, req.body || {});
    return res.status(200).send({ data: { idComprobante: idNew } });
  } catch (error) {
    if (error.message === CE.NO_AUTH) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    if (error.message === CE.BAD_CODIGO) {
      return res
        .status(400)
        .send({ message: 'Código es obligatorio (máx. 2 caracteres, SUNAT)', data: undefined });
    }
    if (error.message === CE.BAD_NOMBRE) {
      return res
        .status(400)
        .send({ message: 'Nombre es obligatorio (máx. 50 caracteres)', data: undefined });
    }
    if (error.message === CE.BAD_RC_RA_SERIE) {
      return res.status(400).send({ message: 'Para RC y RA la serie debe ser "-"', data: undefined });
    }
    if (error.message === CE.BAD_SERIE) {
      return res.status(400).send({ message: 'Serie es obligatoria (máx. 4 caracteres)', data: undefined });
    }
    if (error.message === CE.BAD_NUMERO) {
      return res.status(400).send({ message: 'Número correlativo debe ser entero >= 0', data: undefined });
    }
    const sqlNumber = error?.number ?? error?.originalError?.number;
    if (sqlNumber === 2627) {
      return res
        .status(400)
        .send({ message: 'Ya existe un comprobante con ese código (SUNAT) para esta empresa', data: undefined });
    }
    console.error('Error al crear comprobante:', error);
    return res.status(500).send({ message: 'Error al crear comprobante', data: undefined });
  }
}

module.exports = {
  obtener_comprobantes,
  obtenerComprobantes_alias,
  actualizar_comprobante,
  crear_comprobante
};
