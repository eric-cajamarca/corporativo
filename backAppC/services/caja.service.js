const sql = require('mssql');
const CajaRepository = require('../repositories/caja.repository');
const conceptoRepository = require('../repositories/concepto.repository');

exports.obtenerCajasService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const cajas = await CajaRepository.obtenerCajasRepo(pool, user.empresa);
  return cajas;
};

exports.crearCajaService = async (pool, user, datos) => {
  if (!user) throw new Error("NO_ACCESS");
  if (user.rol !== "Administrador" && user.rol !== "Vendedor") throw new Error("NO_PERMISSIONS");
  if (!datos.idSucursal || !datos.nombre || !datos.nombre.trim()) {
    throw new Error("DATOS_INVALIDOS");
  }
  return CajaRepository.crearCajaRepo(pool, user.empresa, {
    idSucursal: datos.idSucursal,
    nombre: datos.nombre.trim(),
    descripcion: datos.descripcion ? datos.descripcion.trim() : null
  });
};

exports.abrirCajaService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  // Validar que la caja pertenezca a la empresa del usuario
  const cajaValida = await CajaRepository.validarCajaEmpresaRepo(pool, datos.idCaja, user.empresa);
  if (!cajaValida) {
    throw new Error("CAJA_NO_VALIDA");
  }

  // Verificar que no haya una caja abierta para esta caja
  const cajaAbierta = await CajaRepository.verificarCajaAbiertaRepo(pool, datos.idCaja);
  if (cajaAbierta) {
    throw new Error("CAJA_YA_ABIERTA");
  }

  const result = await CajaRepository.abrirCajaRepo(pool, user, datos);
  return result;
};

exports.cerrarCajaService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  // Verificar que la apertura pertenezca a la empresa del usuario y esté abierta
  const aperturaValida = await CajaRepository.validarAperturaEmpresaRepo(pool, datos.idApertura, user.empresa);
  if (!aperturaValida) {
    throw new Error("APERTURA_NO_ENCONTRADA");
  }

  const result = await CajaRepository.cerrarCajaRepo(pool, user, datos);
  return result;
};

exports.registrarMovimientoService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  // Verificar que la apertura esté abierta y pertenezca a la empresa
  const aperturaAbierta = await CajaRepository.verificarAperturaAbiertaRepo(pool, datos.idApertura, user.empresa);
  if (!aperturaAbierta) {
    throw new Error("CAJA_NO_ABIERTA");
  }

  // Validar que el tipo de movimiento existe
  const tipoValido = await CajaRepository.validarTipoMovimientoRepo(pool, datos.idTipoMovimientoCaja);
  if (!tipoValido) {
    throw new Error("TIPO_MOVIMIENTO_INVALIDO");
  }

  // Si viene idConcepto: validar que exista, sea de la empresa y que el tipo coincida (I->INGRESO, E->EGRESO)
  if (datos.idConcepto) {
    const concepto = await conceptoRepository.obtenerPorId(pool, datos.idConcepto, user.empresa);
    if (!concepto) {
      throw new Error("CONCEPTO_NO_ENCONTRADO");
    }
    const tipoOperacion = await CajaRepository.obtenerTipoOperacionPorIdRepo(pool, datos.idTipoMovimientoCaja);
    const tipoEsperado = tipoOperacion === "I" ? "INGRESO" : tipoOperacion === "E" ? "EGRESO" : null;
    if (tipoEsperado && concepto.tipo !== tipoEsperado) {
      throw new Error("EL_CONCEPTO_NO_COINCIDE_CON_EL_TIPO_DE_MOVIMIENTO");
    }
    if (!(datos.concepto && String(datos.concepto).trim())) {
      datos.concepto = concepto.descripcion || "";
    }
  }

  const tipoOperacion = await CajaRepository.obtenerTipoOperacionPorIdRepo(pool, datos.idTipoMovimientoCaja);
  const generarNumeroRecibo = !(datos.documentoRelacionado && String(datos.documentoRelacionado).trim()) && (tipoOperacion === "I" || tipoOperacion === "E");

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    if (generarNumeroRecibo) {
      const codigo = tipoOperacion === "I" ? "RI" : "RE";
      const { documentoRelacionado } = await CajaRepository.obtenerSiguienteNumeroReciboRepo(transaction, user.empresa, codigo);
      datos.documentoRelacionado = documentoRelacionado;
    }
    const result = await CajaRepository.registrarMovimientoRepo(transaction, user, datos);
    await transaction.commit();
    return { ...result, documentoRelacionado: datos.documentoRelacionado || null };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

exports.obtenerMovimientosCajaService = async (pool, user, filtros) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const movimientos = await CajaRepository.obtenerMovimientosCajaRepo(pool, user.empresa, filtros);
  return movimientos;
};

exports.obtenerRecibosEgresoService = async (pool, user, filtros) => {
  if (!user) throw new Error("NO_ACCESS");
  if (user.rol !== "Administrador" && user.rol !== "Vendedor") throw new Error("NO_PERMISSIONS");
  const params = { ...filtros, tipoMovimiento: "E", soloRecibos: true };
  return CajaRepository.obtenerMovimientosCajaRepo(pool, user.empresa, params);
};

exports.eliminarMovimientoCajaService = async (pool, user, idMovimientoCaja) => {
  if (!user) throw new Error("NO_ACCESS");
  if (user.rol !== "Administrador" && user.rol !== "Vendedor") throw new Error("NO_PERMISSIONS");
  return CajaRepository.eliminarMovimientoCajaRepo(pool, idMovimientoCaja, user.empresa);
};

exports.actualizarMovimientoCajaService = async (pool, user, datos) => {
  if (!user) throw new Error("NO_ACCESS");
  if (user.rol !== "Administrador" && user.rol !== "Vendedor") throw new Error("NO_PERMISSIONS");
  return CajaRepository.actualizarMovimientoCajaRepo(pool, user.empresa, datos);
};

exports.obtenerTiposMovimientoCajaService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const tipos = await CajaRepository.obtenerTiposMovimientoCajaRepo(pool);
  return tipos;
};

exports.crearTipoMovimientoCajaService = async (pool, user, datos) => {
  if (!user) throw new Error("NO_ACCESS");
  if (user.rol !== "Administrador") throw new Error("NO_PERMISSIONS");
  if (!datos.nombre || !datos.tipo) throw new Error("Nombre y tipo son obligatorios.");
  const tipo = (datos.tipo === "I" || datos.tipo === "E") ? datos.tipo : null;
  if (!tipo) throw new Error("Tipo debe ser I (Ingreso) o E (Egreso).");
  return CajaRepository.crearTipoMovimientoCajaRepo(pool, { nombre: datos.nombre.trim(), descripcion: datos.descripcion || null, tipo });
};

exports.actualizarTipoMovimientoCajaService = async (pool, user, id, datos) => {
  if (!user) throw new Error("NO_ACCESS");
  if (user.rol !== "Administrador") throw new Error("NO_PERMISSIONS");
  if (!datos.nombre || !datos.tipo) throw new Error("Nombre y tipo son obligatorios.");
  const tipo = (datos.tipo === "I" || datos.tipo === "E") ? datos.tipo : null;
  if (!tipo) throw new Error("Tipo debe ser I (Ingreso) o E (Egreso).");
  await CajaRepository.actualizarTipoMovimientoCajaRepo(pool, id, { nombre: datos.nombre.trim(), descripcion: datos.descripcion || null, tipo });
};

exports.eliminarTipoMovimientoCajaService = async (pool, user, id) => {
  if (!user) throw new Error("NO_ACCESS");
  if (user.rol !== "Administrador") throw new Error("NO_PERMISSIONS");
  const deleted = await CajaRepository.eliminarTipoMovimientoCajaRepo(pool, id);
  if (deleted === 0) throw new Error("Tipo de movimiento no encontrado.");
};

exports.obtenerResumenCajaDiarioService = async (pool, user, fecha) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const resumen = await CajaRepository.obtenerResumenCajaDiarioRepo(pool, user.empresa, fecha);
  return resumen;
};

exports.obtenerArqueoDinamicoService = async (pool, user, filtros) => {
  if (!user) throw new Error("NO_ACCESS");
  if (user.rol !== "Administrador" && user.rol !== "Vendedor") throw new Error("NO_PERMISSIONS");
  return CajaRepository.obtenerArqueoDinamicoRepo(pool, user.empresa, filtros);
};