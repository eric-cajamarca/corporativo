const sql = require("mssql");
const DespachosRepository = require("../repositories/despachos.repository");
const gestoresRepository = require("../repositories/gestores.repository");

async function puedeUsuarioOperarEmpresaDespacho(pool, user, idEmpresaDestino) {
  if (!user?.empresa || !idEmpresaDestino) return false;
  if (String(user.empresa) === String(idEmpresaDestino)) return true;
  return gestoresRepository.verificarGestorGestionaEmpresa(pool, user.empresa, idEmpresaDestino);
}

exports.obtenerDespachosVentaService = async (pool, user, idVenta, query = {}) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const idEmp = query.idEmpresa ? String(query.idEmpresa).trim() : String(user.empresa);
  if (!(await puedeUsuarioOperarEmpresaDespacho(pool, user, idEmp))) {
    throw new Error("NO_PERMISSIONS");
  }

  const despachos = await DespachosRepository.obtenerDespachosVentaRepo(pool, idEmp, idVenta);
  return despachos;
};

exports.crearDespachoService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const idEmpresaOperativa = datos.idEmpresa ? String(datos.idEmpresa).trim() : String(user.empresa);
  if (!(await puedeUsuarioOperarEmpresaDespacho(pool, user, idEmpresaOperativa))) {
    throw new Error("NO_PERMISSIONS");
  }

  const ventaValida = await DespachosRepository.validarVentaEmpresaRepo(
    pool,
    datos.idVenta,
    idEmpresaOperativa
  );
  if (!ventaValida) {
    throw new Error("VENTA_NO_ENCONTRADA");
  }

  const tipoValido = await DespachosRepository.validarTipoDespachoRepo(pool, datos.idTipoDespacho);
  if (!tipoValido) {
    throw new Error("TIPO_DESPACHO_INVALIDO");
  }

  const vsuc = await pool
    .request()
    .input("idVenta", sql.Int, parseInt(datos.idVenta, 10))
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresaOperativa)
    .query(`SELECT idSucursal FROM Ventas WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa`);
  const idSucursalOperativa = vsuc.recordset[0]?.idSucursal;
  if (!idSucursalOperativa) {
    throw new Error("VENTA_NO_ENCONTRADA");
  }

  const result = await DespachosRepository.crearDespachoRepo(pool, user, {
    ...datos,
    idEmpresaOperativa,
    idSucursalOperativa
  });
  return result;
};

exports.actualizarCantidadDespachadaService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const idEmp = await DespachosRepository.obtenerIdEmpresaDesdeDetalleDespachoRepo(
    pool,
    datos.idDetalleDespacho
  );
  if (!idEmp || !(await puedeUsuarioOperarEmpresaDespacho(pool, user, idEmp))) {
    throw new Error("DETALLE_NO_ENCONTRADO");
  }

  const detalleValido = await DespachosRepository.validarDetalleDespachoRepo(
    pool,
    datos.idDetalleDespacho,
    idEmp
  );
  if (!detalleValido) {
    throw new Error("DETALLE_NO_ENCONTRADO");
  }

  const result = await DespachosRepository.actualizarCantidadDespachadaRepo(pool, user, datos);
  return result;
};

exports.finalizarDespachoService = async (pool, user, idDespacho) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const idEmp = await DespachosRepository.obtenerIdEmpresaDesdeDespachoRepo(pool, idDespacho);
  if (!idEmp || !(await puedeUsuarioOperarEmpresaDespacho(pool, user, idEmp))) {
    throw new Error("DESPACHO_NO_ENCONTRADO");
  }

  const despachoValido = await DespachosRepository.validarDespachoEmpresaRepo(pool, idDespacho, idEmp);
  if (!despachoValido) {
    throw new Error("DESPACHO_NO_ENCONTRADO");
  }

  const result = await DespachosRepository.finalizarDespachoRepo(pool, user, idDespacho);
  return result;
};

exports.obtenerTiposDespachoService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const tipos = await DespachosRepository.obtenerTiposDespachoRepo(pool);
  return tipos;
};

exports.obtenerEstadoDespachosService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const estado = await DespachosRepository.obtenerEstadoDespachosRepo(pool, user.empresa);
  return estado;
};

/** Buscar venta por compVenta o idVenta; devuelve venta + despachos + entregadoMismoDia. */
exports.buscarVentaDespachosService = async (pool, user, query) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  const compVenta = query.compVenta ? String(query.compVenta).trim() : null;
  const idVenta = query.idVenta != null && query.idVenta !== "" ? query.idVenta : null;
  if (!compVenta && !idVenta) return null;
  const idEmp = query.idEmpresa ? String(query.idEmpresa).trim() : String(user.empresa);
  if (!(await puedeUsuarioOperarEmpresaDespacho(pool, user, idEmp))) {
    throw new Error("NO_PERMISSIONS");
  }
  return await DespachosRepository.buscarVentaDespachosRepo(pool, idEmp, { compVenta, idVenta });
};

/** Obtener detalle de un despacho (DetalleDespachos). */
exports.obtenerDetalleDespachoService = async (pool, user, idDespacho) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  const idEmp = await DespachosRepository.obtenerIdEmpresaDesdeDespachoRepo(pool, idDespacho);
  if (!idEmp || !(await puedeUsuarioOperarEmpresaDespacho(pool, user, idEmp))) {
    throw new Error("NO_ACCESS");
  }
  return await DespachosRepository.obtenerDetalleDespachoRepo(pool, idDespacho, idEmp);
};

/** Detalle de venta por idVenta para despacho (cantidad, cantEntregada, cantPendiente, ubicaciones). */
exports.obtenerDetalleVentaParaDespachoService = async (pool, user, idVenta, query = {}) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  const idEmp = query.idEmpresa ? String(query.idEmpresa).trim() : String(user.empresa);
  if (!(await puedeUsuarioOperarEmpresaDespacho(pool, user, idEmp))) {
    throw new Error("NO_PERMISSIONS");
  }
  return await DespachosRepository.obtenerDetalleVentaParaDespachoRepo(pool, idEmp, idVenta);
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Búsqueda venta agrupada para despachos (empresa gestora): id VA, número VA, RUC o nombre cliente. */
exports.buscarVentaAgrupadaDespachoGestoraService = async (pool, user, query) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }
  const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
  if (!esGestora) throw new Error("NO_ES_GESTORA");

  const rawId = query.idVentaAgrupada != null ? String(query.idVentaAgrupada).trim() : "";
  const compVenta = query.compVenta != null ? String(query.compVenta).trim() : "";
  const ruc = query.ruc != null ? String(query.ruc).trim() : "";
  const nombreCliente = query.nombreCliente != null ? String(query.nombreCliente).trim() : "";

  let idVentaAgrupadaParsed = null;
  if (rawId && UUID_REGEX.test(rawId)) {
    idVentaAgrupadaParsed = rawId;
  }

  const filtrosLista = {
    idVentaAgrupada: idVentaAgrupadaParsed,
    compVenta: compVenta || (!idVentaAgrupadaParsed && rawId ? rawId : ""),
    ruc,
    nombreCliente
  };

  if (
    !filtrosLista.idVentaAgrupada &&
    !filtrosLista.compVenta &&
    !filtrosLista.ruc &&
    !filtrosLista.nombreCliente
  ) {
    throw new Error("FILTROS_REQUERIDOS");
  }

  if (idVentaAgrupadaParsed) {
    const detalle = await DespachosRepository.construirDetalleVentaAgrupadaDespachoRepo(
      pool,
      user.empresa,
      idVentaAgrupadaParsed
    );
    if (!detalle) return null;
    return { modo: "detalle", ...detalle };
  }

  const coincidencias = await DespachosRepository.listarVentaAgrupadaCoincidenciasDespachoRepo(
    pool,
    user.empresa,
    filtrosLista
  );
  if (!coincidencias.length) return null;
  if (coincidencias.length > 1) {
    return { modo: "lista", coincidencias };
  }
  const detalle = await DespachosRepository.construirDetalleVentaAgrupadaDespachoRepo(
    pool,
    user.empresa,
    coincidencias[0].idVentaAgrupada
  );
  if (!detalle) return null;
  return { modo: "detalle", ...detalle };
};
