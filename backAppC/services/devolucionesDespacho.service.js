const sql = require('mssql');
const devolucionesDespachoRepository = require('../repositories/devolucionesDespacho.repository');
const despachosRepository = require('../repositories/despachos.repository');
const gestoresRepository = require('../repositories/gestores.repository');

async function puedeUsuarioOperarEmpresaDespacho(pool, user, idEmpresaDestino) {
  if (!user?.empresa || !idEmpresaDestino) return false;
  if (String(user.empresa) === String(idEmpresaDestino)) return true;
  return gestoresRepository.verificarGestorGestionaEmpresa(pool, user.empresa, idEmpresaDestino);
}

exports.crearDevolucionDespachoService = async (pool, user, payload) => {
  if (!user || !user.empresa || !user.sub) throw new Error('NO_ACCESS');
  if (user.rol !== 'Administrador' && user.rol !== 'Vendedor') throw new Error('NO_PERMISSIONS');

  const { idDespacho, items } = payload;
  if (!idDespacho || !Array.isArray(items) || items.length === 0) {
    throw new Error('DATOS_INVALIDOS');
  }

  const idEmp = await despachosRepository.obtenerIdEmpresaDesdeDespachoRepo(pool, idDespacho);
  if (!idEmp || !(await puedeUsuarioOperarEmpresaDespacho(pool, user, idEmp))) {
    throw new Error('DESPACHO_NO_ENCONTRADO');
  }

  const despachoValido = await despachosRepository.validarDespachoEmpresaRepo(pool, idDespacho, idEmp);
  if (!despachoValido) throw new Error('DESPACHO_NO_ENCONTRADO');

  return await devolucionesDespachoRepository.crearDevolucionDespachoRepo(
    pool,
    idEmp,
    user.sub,
    payload
  );
};

exports.listarDevolucionesPorDespachoService = async (pool, user, idDespacho) => {
  if (!user || !user.empresa) throw new Error('NO_ACCESS');
  const idEmp = await despachosRepository.obtenerIdEmpresaDesdeDespachoRepo(pool, idDespacho);
  if (!idEmp || !(await puedeUsuarioOperarEmpresaDespacho(pool, user, idEmp))) {
    throw new Error('DESPACHO_NO_ENCONTRADO');
  }
  return await devolucionesDespachoRepository.listarDevolucionesPorDespachoRepo(pool, idEmp, idDespacho);
};

exports.obtenerDetalleDevolucionService = async (pool, user, idDevolucionDespacho) => {
  if (!user || !user.empresa) throw new Error('NO_ACCESS');
  const row = await pool.request()
    .input('id', sql.UniqueIdentifier, idDevolucionDespacho)
    .query(`SELECT idEmpresa FROM DevolucionesDespacho WHERE idDevolucionDespacho = @id`);
  const idEmp = row.recordset[0]?.idEmpresa;
  if (!idEmp || !(await puedeUsuarioOperarEmpresaDespacho(pool, user, idEmp))) {
    throw new Error('NO_ACCESS');
  }
  return await devolucionesDespachoRepository.obtenerDetalleDevolucionRepo(pool, idEmp, idDevolucionDespacho);
};
