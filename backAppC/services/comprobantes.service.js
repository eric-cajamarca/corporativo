const comprobantesRepository = require('../repositories/comprobantes.repository');

const E = {
  NO_AUTH: 'NO_AUTH',
  BAD_ID: 'BAD_ID',
  BAD_SERIE: 'BAD_SERIE',
  BAD_NUMERO: 'BAD_NUMERO',
  BAD_BODY: 'BAD_BODY',
  NOT_FOUND: 'NOT_FOUND',
  BAD_CODIGO: 'BAD_CODIGO',
  BAD_NOMBRE: 'BAD_NOMBRE',
  BAD_RC_RA_SERIE: 'BAD_RC_RA_SERIE',
  ALIAS_INVALIDO: 'ALIAS_INVALIDO'
};

async function obtenerComprobantes(pool, user, uso) {
  const idEmpresa = user?.empresa;
  if (!user || !idEmpresa) throw new Error(E.NO_AUTH);
  const u = (uso || '').toLowerCase();
  return comprobantesRepository.listarPorEmpresaYuso(pool, idEmpresa, u);
}

async function obtenerComprobantesAlias(pool, user, alias) {
  if (!user) throw new Error(E.NO_AUTH);
  try {
    return await comprobantesRepository.listarPorTablaAlias(pool, alias);
  } catch (e) {
    if (e.message === 'ALIAS_INVALIDO') throw new Error(E.ALIAS_INVALIDO);
    throw e;
  }
}

async function actualizarComprobante(pool, user, idParam, body) {
  const idEmpresa = user?.empresa;
  if (!user || !idEmpresa) throw new Error(E.NO_AUTH);
  const id = parseInt(idParam, 10);
  if (Number.isNaN(id)) throw new Error(E.BAD_ID);
  const { serie, numero, usarEnVenta, usarEnCompra } = body || {};
  const updates = {};
  if (serie !== undefined) {
    const s = typeof serie === 'string' ? serie.trim() : '';
    if (s !== '-' && (s.length < 1 || s.length > 4)) {
      throw new Error(E.BAD_SERIE);
    }
    updates.serie = s;
  }
  if (numero !== undefined) {
    const num = parseInt(numero, 10);
    if (Number.isNaN(num) || num < 0) throw new Error(E.BAD_NUMERO);
    updates.numero = num;
  }
  if (usarEnVenta !== undefined) updates.usarEnVenta = Boolean(usarEnVenta);
  if (usarEnCompra !== undefined) updates.usarEnCompra = Boolean(usarEnCompra);
  if (Object.keys(updates).length === 0) throw new Error(E.BAD_BODY);
  const affected = await comprobantesRepository.actualizar(pool, idEmpresa, id, updates);
  if (affected === 0) throw new Error(E.NOT_FOUND);
  return affected;
}

async function crearComprobante(pool, user, body) {
  const idEmpresa = user?.empresa;
  if (!user || !idEmpresa) throw new Error(E.NO_AUTH);
  let { codigo, nombre, serie, usarEnVenta, usarEnCompra } = body || {};
  let numero = body?.numero;
  if (numero === undefined || numero === null) numero = 1;
  const venta = usarEnVenta !== undefined ? Boolean(usarEnVenta) : true;
  const compra = usarEnCompra !== undefined ? Boolean(usarEnCompra) : true;
  const cod = codigo != null && typeof codigo === 'string' ? codigo.trim() : '';
  const nom = nombre != null && typeof nombre === 'string' ? nombre.trim() : '';
  let ser = serie != null && typeof serie === 'string' ? serie.trim() : '';
  if (!cod || cod.length > 2) throw new Error(E.BAD_CODIGO);
  if (!nom || nom.length > 50) throw new Error(E.BAD_NOMBRE);
  if (cod === 'RC' || cod === 'RA') {
    if (ser === '') ser = '-';
    if (ser !== '-' && (ser.length < 1 || ser.length > 4)) {
      throw new Error(E.BAD_RC_RA_SERIE);
    }
  } else if (!ser || ser.length > 4) {
    throw new Error(E.BAD_SERIE);
  }
  const num = parseInt(numero, 10);
  if (Number.isNaN(num) || num < 0) throw new Error(E.BAD_NUMERO);
  return comprobantesRepository.insertar(pool, {
    idEmpresa,
    codigo: cod,
    nombre: nom,
    serie: ser,
    numero: num,
    usarEnVenta: venta,
    usarEnCompra: compra
  });
}

module.exports = {
  obtenerComprobantes,
  obtenerComprobantesAlias,
  actualizarComprobante,
  crearComprobante,
  errores: E
};
