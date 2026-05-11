const sql = require('mssql');
const devolucionesDespachoRepository = require('../repositories/devolucionesDespacho.repository');
const despachosRepository = require('../repositories/despachos.repository');
const EnviosRepository = require('../repositories/envios.repository');
const gestoresRepository = require('../repositories/gestores.repository');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');

async function puedeUsuarioOperarEmpresaDespacho(pool, user, idEmpresaDestino) {
  if (!user?.empresa || !idEmpresaDestino) return false;
  if (String(user.empresa) === String(idEmpresaDestino)) return true;
  return gestoresRepository.verificarGestorGestionaEmpresa(pool, user.empresa, idEmpresaDestino);
}

exports.crearDevolucionDespachoService = async (pool, user, payload) => {
  if (!user || !user.empresa || !user.sub) throw new Error('NO_ACCESS');
  await assertAlgunoPermiso(pool, user, 'EDITAR_DESPACHOS', 'CREAR_DESPACHOS');

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

  const result = await devolucionesDespachoRepository.crearDevolucionDespachoRepo(
    pool,
    idEmp,
    user.sub,
    payload
  );
  if (result?.ok && idDespacho && user.sub) {
    try {
      const sumRes = await pool
        .request()
        .input('idDespacho', sql.UniqueIdentifier, idDespacho)
        .query(`
          SELECT ISNULL(SUM(cantidadDespachada), 0) AS totalDesp
          FROM DetalleDespachos
          WHERE idDespacho = @idDespacho
        `);
      const totalDesp = Number(sumRes.recordset?.[0]?.totalDesp ?? 0);
      if (totalDesp <= 0) {
        await EnviosRepository.marcarEnviosPorDespachoAEstadoNombreRepo(
          pool,
          idDespacho,
          idEmp,
          'AGENDADO',
          user.sub,
          'Tras devolución total en despacho (cancelación de envío)'
        );
      }
    } catch (err) {
      console.error('contexto: no se pudo marcar envío AGENDADO tras devolución:', err);
    }
  }
  return result;
};

exports.listarDevolucionesPorDespachoService = async (pool, user, idDespacho) => {
  if (!user || !user.empresa) throw new Error('NO_ACCESS');
  await assertAlgunoPermiso(pool, user, 'VER_DESPACHOS', 'CREAR_DESPACHOS', 'EDITAR_DESPACHOS');
  const idEmp = await despachosRepository.obtenerIdEmpresaDesdeDespachoRepo(pool, idDespacho);
  if (!idEmp || !(await puedeUsuarioOperarEmpresaDespacho(pool, user, idEmp))) {
    throw new Error('DESPACHO_NO_ENCONTRADO');
  }
  return await devolucionesDespachoRepository.listarDevolucionesPorDespachoRepo(pool, idEmp, idDespacho);
};

exports.obtenerDetalleDevolucionService = async (pool, user, idDevolucionDespacho) => {
  if (!user || !user.empresa) throw new Error('NO_ACCESS');
  await assertAlgunoPermiso(pool, user, 'VER_DESPACHOS', 'CREAR_DESPACHOS', 'EDITAR_DESPACHOS');
  const row = await pool.request()
    .input('id', sql.UniqueIdentifier, idDevolucionDespacho)
    .query(`SELECT idEmpresa FROM DevolucionesDespacho WHERE idDevolucionDespacho = @id`);
  const idEmp = row.recordset[0]?.idEmpresa;
  if (!idEmp || !(await puedeUsuarioOperarEmpresaDespacho(pool, user, idEmp))) {
    throw new Error('NO_ACCESS');
  }
  return await devolucionesDespachoRepository.obtenerDetalleDevolucionRepo(pool, idEmp, idDevolucionDespacho);
};
