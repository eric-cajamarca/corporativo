const direccionClientesRepository = require('../repositories/direccionClientes.repository');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');

const E = { NO_AUTH: 'NO_AUTH', NO_ROL: 'NO_ROL' };

async function asegurarClienteDirecciones(pool, user) {
  if (!user) throw new Error(E.NO_AUTH);
  await assertAlgunoPermiso(pool, user, 'EDITAR_CLIENTES', 'VER_CLIENTES');
}

function normalizarPayloadCrear(body) {
  return {
    idCliente: body.idCliente,
    ubigeo: body.ubigeo,
    codPais: body.codpais ?? body.codPais,
    region: body.region,
    provincia: body.provincia,
    distrito: body.distrito,
    urbanizacion: body.urbanizacion,
    direccion: body.direccion,
    referencia: body.referencia,
    codLocal: body.codLocal,
    principal: body.principal
  };
}

async function crear(pool, user, body) {
  await assertAlgunoPermiso(pool, user, 'EDITAR_CLIENTES');
  const idEmpresa = user.empresa;
  const payload = normalizarPayloadCrear(body);
  if (payload.idCliente == null) throw new Error('idCliente requerido');
  return direccionClientesRepository.insertar(pool, idEmpresa, payload);
}

async function listar(pool, user) {
  asegurarAdmin(user);
  return direccionClientesRepository.listarPorEmpresa(pool, user.empresa);
}

async function listarPorCliente(pool, user, idCliente) {
  await asegurarClienteDirecciones(pool, user);
  const id = parseInt(idCliente, 10);
  if (Number.isNaN(id)) throw new Error('idCliente inválido');
  return direccionClientesRepository.listarPorCliente(pool, user.empresa, id);
}

async function actualizar(pool, user, idDireccion, body) {
  await assertAlgunoPermiso(pool, user, 'EDITAR_CLIENTES');
  const id = parseInt(idDireccion, 10);
  if (Number.isNaN(id)) throw new Error('id inválido');
  const {
    idCliente,
    ubigeo,
    codPais,
    region,
    provincia,
    distrito,
    urbanizacion,
    direccion,
    referencia,
    codLocal,
    principal
  } = body || {};
  return direccionClientesRepository.actualizar(pool, user.empresa, id, {
    idCliente,
    ubigeo,
    codPais,
    region,
    provincia,
    distrito,
    urbanizacion,
    direccion,
    referencia,
    codLocal,
    principal
  });
}

async function eliminar(pool, user, idDireccion) {
  await assertAlgunoPermiso(pool, user, 'EDITAR_CLIENTES');
  const id = parseInt(idDireccion, 10);
  if (Number.isNaN(id)) throw new Error('id inválido');
  return direccionClientesRepository.eliminar(pool, user.empresa, id);
}

module.exports = {
  crear,
  listar,
  listarPorCliente,
  actualizar,
  eliminar,
  errores: E
};
