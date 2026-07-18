const catalogoProductoSunatRepository = require('../repositories/catalogoProductoSunat.repository');
const productoSunatMatchService = require('./productoSunatMatch.service');
const {
  validarCodigoProductoSunatOpcional,
  etiquetaAnexo
} = require('../utils/codigoProductoSunat.util');

async function listarCatalogoService(pool, query) {
  const rows = await catalogoProductoSunatRepository.listarAnexos(pool, {
    anexo: query.anexo,
    q: query.q,
    limite: query.limite
  });
  return rows.map((r) => ({
    codigo: String(r.codigo).trim(),
    anexo: String(r.anexo).trim(),
    descripcion: String(r.descripcion || '').trim(),
    partidaArancelaria: String(r.partidaArancelaria || '').trim(),
    etiquetaAnexo: etiquetaAnexo(r.anexo)
  }));
}

async function sugerirService(pool, body) {
  return productoSunatMatchService.sugerirCodigoProductoSunat(pool, {
    descripcion: body.descripcion,
    categoria: body.categoria,
    limite: body.limite
  });
}

/**
 * Valida código opcional/obligatorio contra formato y catálogo de anexos.
 */
async function assertCodigoProductoSunat(pool, { codigoProductoSunat, requiereCodigoSunat }) {
  const reqFlag =
    requiereCodigoSunat === true ||
    requiereCodigoSunat === 1 ||
    requiereCodigoSunat === '1' ||
    requiereCodigoSunat === 'true';

  const v = validarCodigoProductoSunatOpcional(codigoProductoSunat);
  if (!v.ok) throw new Error(v.message);

  if (reqFlag && !v.codigo) {
    throw new Error(
      'Este producto requiere Código producto SUNAT (anexo 25.1 / 25.2 / 25.3). Asígnalo antes de guardar.'
    );
  }

  if (v.codigo) {
    const existe = await catalogoProductoSunatRepository.existeCodigo(pool, v.codigo);
    if (!existe) {
      throw new Error(
        'El Código producto de SUNAT no se encuentra en el listado de anexos 25.1, 25.2 o 25.3.'
      );
    }
  }

  return v.codigo;
}

module.exports = {
  listarCatalogoService,
  sugerirService,
  assertCodigoProductoSunat
};
