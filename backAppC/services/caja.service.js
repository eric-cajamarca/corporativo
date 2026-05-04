const sql = require('mssql');
const CajaRepository = require('../repositories/caja.repository');
const conceptoRepository = require('../repositories/concepto.repository');
const permisosService = require('./permisos.service');
const gestoresRepository = require('../repositories/gestores.repository');
const {
  obtenerEmpresasPermitidasOperacionCaja,
  resolverIdEmpresaOperacionCaja,
  CLAVE_CONFIG_DEFAULT,
  normalizeUuid
} = require("../utils/cajaOperacionEmpresa.util");


/** Empresa del JWT + empresas gestionadas (misma lista que usa la gestora en ventas) para ver movimientos consolidados. */
const idsEmpresaParaVistaCaja = async (pool, idEmpresaUsuario) => {
  const ids = new Set();
  if (idEmpresaUsuario) ids.add(String(idEmpresaUsuario));
  try {
    const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresaUsuario);
    for (const g of gestionadas || []) {
      if (g.idEmpresa) ids.add(String(g.idEmpresa));
    }
  } catch (_) {
    /* si falla gestores, solo empresa propia */
  }
  return Array.from(ids);
};

/**
 * Empresa gestionada: incluir movimientos en caja de la(s) gestora(s) activa(s) cuando el ingreso está ligado a una Venta de esta empresa (cobro VA).
 * No expone toda la caja de la gestora, solo filas con mc.idVenta -> Ventas.idEmpresa = JWT.
 */
const opcionesVistaCajaDelegacion = async (pool, idEmpresaUsuario) => {
  if (!idEmpresaUsuario) return null;
  try {
    const gestores = await gestoresRepository.obtenerGestoresDeEmpresa(pool, idEmpresaUsuario);
    const idsDelegada = (gestores || [])
      .filter((g) => Number(g.estadoGestor) === 1 && g.idEmpresa)
      .map((g) => g.idEmpresa);
    if (idsDelegada.length === 0) return null;
    return {
      idEmpresaVinculoVentas: idEmpresaUsuario,
      idsEmpresaCajaDelegada: idsDelegada,
    };
  } catch (_) {
    return null;
  }
};

/** Administrador tiene todo; si no, debe tener al menos uno de los permisos indicados. */
const tienePermisoCaja = async (pool, user, ...nombresPermiso) => {
  if (!user) return false;
  if (user.rol === 'Administrador') return true;
  for (const nombre of nombresPermiso) {
    if (await permisosService.verificarPermisoUsuario(pool, nombre, user)) return true;
  }
  return false;
};

exports.obtenerCajasService = async (pool, user) => {
  if (!user) throw new Error("NO_ACCESS");
  if (!(await tienePermisoCaja(pool, user, 'VER_CAJA'))) throw new Error("NO_PERMISSIONS");
  const cajas = await CajaRepository.obtenerCajasRepo(pool, user.empresa);
  return cajas;
};

exports.crearCajaService = async (pool, user, datos) => {
  if (!user) throw new Error("NO_ACCESS");
  if (!(await tienePermisoCaja(pool, user, 'VER_CAJA'))) throw new Error("NO_PERMISSIONS");
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
  if (!user) throw new Error("NO_ACCESS");
  if (!(await tienePermisoCaja(pool, user, 'ABRIR_CAJA', 'VER_CAJA'))) throw new Error("NO_PERMISSIONS");

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
  if (!user) throw new Error("NO_ACCESS");
  if (!(await tienePermisoCaja(pool, user, 'CERRAR_CAJA', 'VER_CAJA'))) throw new Error("NO_PERMISSIONS");

  // Verificar que la apertura pertenezca a la empresa del usuario y esté abierta
  const aperturaValida = await CajaRepository.validarAperturaEmpresaRepo(pool, datos.idApertura, user.empresa);
  if (!aperturaValida) {
    throw new Error("APERTURA_NO_ENCONTRADA");
  }

  const result = await CajaRepository.cerrarCajaRepo(pool, user, datos);
  return result;
};

exports.registrarMovimientoService = async (pool, user, datos) => {
  if (!user) throw new Error("NO_ACCESS");
  if (!(await tienePermisoCaja(pool, user, 'REGISTRAR_MOVIMIENTOS', 'VER_CAJA'))) throw new Error("NO_PERMISSIONS");

  const idEmpresaOp = await resolverIdEmpresaOperacionCaja(pool, user, datos.idEmpresaOperacion);
  const userOp = { ...user, empresa: idEmpresaOp };

  // Verificar que la apertura esté abierta y pertenezca a la empresa
  const aperturaAbierta = await CajaRepository.verificarAperturaAbiertaRepo(pool, datos.idApertura, idEmpresaOp);
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
    const concepto = await conceptoRepository.obtenerPorId(pool, datos.idConcepto, idEmpresaOp);
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
      const { documentoRelacionado } = await CajaRepository.obtenerSiguienteNumeroReciboRepo(
        transaction,
        idEmpresaOp,
        codigo,
        datos.idApertura
      );
      datos.documentoRelacionado = documentoRelacionado;
    }
    const result = await CajaRepository.registrarMovimientoRepo(transaction, userOp, datos);
    await transaction.commit();
    return { ...result, documentoRelacionado: datos.documentoRelacionado || null };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

exports.obtenerMovimientosCajaService = async (pool, user, filtros) => {
  if (!user) throw new Error("NO_ACCESS");
  if (!(await tienePermisoCaja(pool, user, 'VER_CAJA'))) throw new Error("NO_PERMISSIONS");
  let idsEmpresa;
  let delegacion = null;
  if (filtros && filtros.idEmpresaOperacion) {
    idsEmpresa = [filtros.idEmpresaOperacion];
  } else {
    idsEmpresa = await idsEmpresaParaVistaCaja(pool, user.empresa);
    delegacion = await opcionesVistaCajaDelegacion(pool, user.empresa);
  }
  const movimientos = await CajaRepository.obtenerMovimientosCajaRepo(pool, idsEmpresa, filtros, delegacion);
  return movimientos;
};

exports.obtenerRecibosEgresoService = async (pool, user, filtros) => {
  if (!user) throw new Error("NO_ACCESS");
  if (!(await tienePermisoCaja(pool, user, 'VER_CAJA'))) throw new Error("NO_PERMISSIONS");
  const params = { ...filtros, tipoMovimiento: "E", soloRecibos: true };
  let idsEmpresa;
  let delegacion = null;
  if (filtros && filtros.idEmpresaOperacion) {
    idsEmpresa = [filtros.idEmpresaOperacion];
  } else {
    idsEmpresa = await idsEmpresaParaVistaCaja(pool, user.empresa);
    delegacion = await opcionesVistaCajaDelegacion(pool, user.empresa);
  }
  return CajaRepository.obtenerMovimientosCajaRepo(pool, idsEmpresa, params, delegacion);
};

exports.eliminarMovimientoCajaService = async (pool, user, idMovimientoCaja) => {
  if (!user) throw new Error("NO_ACCESS");
  if (!(await tienePermisoCaja(pool, user, 'REGISTRAR_MOVIMIENTOS', 'VER_CAJA'))) throw new Error("NO_PERMISSIONS");
  const idMcEmpresa = await CajaRepository.obtenerIdEmpresaPorMovimientoRepo(pool, idMovimientoCaja);
  if (!idMcEmpresa) return 0;
  const permitidas = await obtenerEmpresasPermitidasOperacionCaja(pool, user.empresa);
  const ok = permitidas.some((p) => String(p.idEmpresa).toLowerCase() === String(idMcEmpresa).toLowerCase());
  if (!ok) throw new Error("EMPRESA_OPERACION_NO_PERMITIDA");
  return CajaRepository.eliminarMovimientoCajaRepo(pool, idMovimientoCaja, idMcEmpresa);
};

exports.actualizarMovimientoCajaService = async (pool, user, datos) => {
  if (!user) throw new Error("NO_ACCESS");
  if (!(await tienePermisoCaja(pool, user, 'REGISTRAR_MOVIMIENTOS', 'VER_CAJA'))) throw new Error("NO_PERMISSIONS");
  const idMcEmpresa = await CajaRepository.obtenerIdEmpresaPorMovimientoRepo(pool, datos.idMovimientoCaja);
  if (!idMcEmpresa) return 0;
  const permitidas = await obtenerEmpresasPermitidasOperacionCaja(pool, user.empresa);
  const ok = permitidas.some((p) => String(p.idEmpresa).toLowerCase() === String(idMcEmpresa).toLowerCase());
  if (!ok) throw new Error("EMPRESA_OPERACION_NO_PERMITIDA");
  return CajaRepository.actualizarMovimientoCajaRepo(pool, idMcEmpresa, datos);
};

exports.obtenerContextoOperacionCajaService = async (pool, user) => {
  if (!user) throw new Error("NO_ACCESS");
  if (!(await tienePermisoCaja(pool, user, 'VER_CAJA'))) throw new Error("NO_PERMISSIONS");
  const empresas = await obtenerEmpresasPermitidasOperacionCaja(pool, user.empresa);
  const idEmpresaOperacionPorDefecto = await resolverIdEmpresaOperacionCaja(pool, user, null);
  return { empresas, idEmpresaOperacionPorDefecto };
};

exports.guardarEmpresaOperacionCajaDefaultService = async (pool, user, idEmpresaDestinoRaw) => {
  if (!user) throw new Error("NO_ACCESS");
  if (!(await tienePermisoCaja(pool, user, 'VER_CAJA'))) throw new Error("NO_PERMISSIONS");
  const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
  if (!esGestora) throw new Error("NO_PERMISSIONS");
  const permitidas = await obtenerEmpresasPermitidasOperacionCaja(pool, user.empresa);
  const permitSet = new Set(permitidas.map((p) => String(p.idEmpresa).toLowerCase()));
  const v = normalizeUuid(idEmpresaDestinoRaw);
  if (idEmpresaDestinoRaw != null && String(idEmpresaDestinoRaw).trim() !== '' && !v) {
    throw new Error('ID_EMPRESA_DEFAULT_INVALIDO');
  }
  if (v && !permitSet.has(v.toLowerCase())) {
    throw new Error('EMPRESA_OPERACION_NO_PERMITIDA');
  }
  await gestoresRepository.guardarConfiguracion(
    pool,
    user.empresa,
    CLAVE_CONFIG_DEFAULT,
    v || '',
    'Empresa por defecto para recibos de caja (gestora)',
    'STRING'
  );
  return { ok: true, idEmpresaOperacionPorDefecto: v || null };
};

exports.obtenerTiposMovimientoCajaService = async (pool, user) => {
  if (!user) throw new Error("NO_ACCESS");
  if (!(await tienePermisoCaja(pool, user, 'VER_CAJA'))) throw new Error("NO_PERMISSIONS");
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
  if (!user) throw new Error("NO_ACCESS");
  if (!(await tienePermisoCaja(pool, user, 'VER_ARQUEO', 'VER_CAJA'))) throw new Error("NO_PERMISSIONS");
  const resumen = await CajaRepository.obtenerResumenCajaDiarioRepo(pool, user.empresa, fecha);
  return resumen;
};

exports.obtenerArqueoDinamicoService = async (pool, user, filtros) => {
  if (!user) throw new Error("NO_ACCESS");
  if (!(await tienePermisoCaja(pool, user, 'VER_ARQUEO', 'VER_CAJA'))) throw new Error("NO_PERMISSIONS");
  const idsEmpresa = await idsEmpresaParaVistaCaja(pool, user.empresa);
  const delegacion = await opcionesVistaCajaDelegacion(pool, user.empresa);
  const result = await CajaRepository.obtenerArqueoDinamicoRepo(pool, idsEmpresa, filtros, delegacion);

  let totalesPorEmpresa;
  const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
  if (esGestora && Array.isArray(idsEmpresa) && idsEmpresa.length > 1) {
    totalesPorEmpresa = [];
    for (const idEm of idsEmpresa) {
      const part = await CajaRepository.obtenerArqueoDinamicoRepo(pool, [idEm], filtros, null);
      const nm = await pool
        .request()
        .input("id", sql.UniqueIdentifier, idEm)
        .query(`SELECT razon_Social FROM Empresas WHERE idEmpresa = @id`);
      totalesPorEmpresa.push({
        idEmpresa: idEm,
        razonSocial: nm.recordset[0]?.razon_Social || "",
        movimientos: part.movimientos || [],
        ventasCredito: part.ventasCredito || { concepto: "VENTA_CREDITO", importe: 0 },
        cobroCreditos: part.cobroCreditos || { concepto: "COBRO CREDITOS", importe: 0 }
      });
    }
  }

  return { ...result, totalesPorEmpresa };
};