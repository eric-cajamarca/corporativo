const FacturacionRepository = require('../repositories/facturacion.repository');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');
const guiaElectronicaRepository = require('../repositories/guiaElectronica.repository');
const facturadorSunatService = require('./facturadorSunat.service');
const firmaXmlSunat = require('./firmaXmlSunat.service');
const cifradoClaveCertificado = require('../utils/cifradoClaveCertificado.util');
const { nombreArchivoComprobante, leerXmlComprobante } = require('../utils/facturadorSunat.util');
const debugSunatLog = require('../utils/debugSunatLog.util');
const { ymdLima, minutosDesdeMedianocheLima, parseHoraEnvioSunat } = require('../utils/limaSunat.util');

exports.obtenerConfiguracionFacturacionService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const configuracion = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, user.empresa);
  if (configuracion) {
    delete configuracion.claveCertificado;
    delete configuracion.claveSunat;
    delete configuracion.claveApiGuias;
  }
  return configuracion;
};

exports.actualizarConfiguracionFacturacionService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertAlgunoPermiso(pool, user, 'EDITAR_CONFIGURACION');

  const result = await FacturacionRepository.actualizarConfiguracionFacturacionRepo(pool, user, datos);
  return result;
};

/** Sube y guarda el certificado digital (PFX) y su clave para firma de XML. Requiere configuración de facturación existente. */
exports.actualizarCertificadoFacturacionService = async (pool, user, certificadoBuffer, claveCertificado) => {
  if (!user) throw new Error("NO_ACCESS");
  await assertAlgunoPermiso(pool, user, 'EDITAR_CONFIGURACION');
  if (!certificadoBuffer || !Buffer.isBuffer(certificadoBuffer)) throw new Error("CERTIFICADO_REQUERIDO");
  const config = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, user.empresa);
  if (!config) throw new Error("CONFIGURACION_FACTURACION_REQUERIDA");
  await FacturacionRepository.actualizarCertificadoFacturacionRepo(
    pool,
    user.empresa,
    certificadoBuffer,
    claveCertificado || null
  );
  return { mensaje: "Certificado actualizado correctamente" };
};

exports.obtenerComprobantesElectronicosService = async (pool, user, filtros) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const comprobantes = await FacturacionRepository.obtenerComprobantesElectronicosRepo(pool, user.empresa, filtros);
  return comprobantes;
};

exports.generarComprobanteElectronicoService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertAlgunoPermiso(pool, user, 'CREAR_VENTAS', 'EDITAR_VENTAS', 'VER_VENTAS');

  // Validar que la venta existe
  const ventaValida = await FacturacionRepository.validarVentaEmpresaRepo(pool, datos.idVenta, user.empresa);
  if (!ventaValida) {
    throw new Error("VENTA_NO_ENCONTRADA");
  }

  // Validar configuración de facturación
  const configuracion = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, user.empresa);
  if (!configuracion || !configuracion.serieFactura) {
    throw new Error("CONFIGURACION_INCOMPLETA");
  }

  // Generar el comprobante electrónico
  const result = await FacturacionRepository.generarComprobanteElectronicoRepo(pool, user, datos, configuracion);
  return result;
};

exports.enviarComprobanteSunatService = async (pool, user, idComprobanteElectronico, opciones = {}) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertAlgunoPermiso(pool, user, 'EDITAR_CONFIGURACION');

  const comprobanteValido = await FacturacionRepository.validarComprobanteEmpresaRepo(pool, idComprobanteElectronico, user.empresa);
  if (!comprobanteValido) {
    throw new Error("COMPROBANTE_NO_ENCONTRADO");
  }

  const config = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, user.empresa);
  const usaDirecto = config?.envioDirectoSunat && config?.urlEnvio && config?.usuarioSunat && config?.claveSunat;
  // #region agent log
  const configData = { usaDirecto: !!usaDirecto, tieneRutaFacturador: !!config?.rutaCarpetaFacturadorSunat, urlFacturadorSunat: config?.urlFacturadorSunat || "(default)", urlEnvio: config?.urlEnvio ? "(definida)" : "(no)", idEmpresa: user.empresa };
  console.error("[SUNAT] enviarComprobanteSunatService: config", configData);
  debugSunatLog.write({ location: "facturacion.service.enviarComprobanteSunatService:config", message: "config", data: configData });
  // #endregion
  if (!usaDirecto && !config?.rutaCarpetaFacturadorSunat) {
    throw new Error("CONFIG_FACTURADOR_INCOMPLETA");
  }

  const result = await FacturacionRepository.enviarComprobanteSunatRepo(
    pool,
    user,
    idComprobanteElectronico,
    facturadorSunatService,
    {
      rutaCarpetaFacturadorSunat: config.rutaCarpetaFacturadorSunat,
      urlFacturadorSunat: config.urlFacturadorSunat,
      envioDirectoSunat: config.envioDirectoSunat,
      urlEnvio: config.urlEnvio,
      usuarioSunat: config.usuarioSunat,
      claveSunat: config.claveSunat
    },
    opciones
  );
  return result;
};

/** Envío unitario desde job o post-cobro (sin req HTTP); requiere rol admin en validación interna. */
exports.enviarComprobanteSunatPorEmpresaService = async (pool, idEmpresa, idComprobanteElectronico, opciones = {}) => {
  const user = { empresa: idEmpresa, rol: "Administrador" };
  return exports.enviarComprobanteSunatService(pool, user, idComprobanteElectronico, opciones);
};

exports.consultarEstadoSunatService = async (pool, user, idComprobanteElectronico) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  // Validar que el comprobante existe
  const comprobanteValido = await FacturacionRepository.validarComprobanteEmpresaRepo(pool, idComprobanteElectronico, user.empresa);
  if (!comprobanteValido) {
    throw new Error("COMPROBANTE_NO_ENCONTRADO");
  }

  const result = await FacturacionRepository.consultarEstadoSunatRepo(pool, user, idComprobanteElectronico);
  return result;
};

/**
 * Consulta en SUNAT la validez de un comprobante (billValidService getStatus).
 * Parámetros: ruc, tipoComprobante, serie, numero (o idComprobanteElectronico para tomarlos del comprobante).
 */
exports.consultarValidezComprobanteService = async (pool, user, params) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  const config = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, user.empresa);
  if (!config?.usuarioSunat || !config?.claveSunat) {
    throw new Error("Configure usuario y clave SOL en Configuración > Facturación");
  }
  let rucComprobante = params.ruc;
  let tipoComprobante = params.tipoComprobante;
  let serie = params.serie;
  let numero = params.numero;
  if (!rucComprobante && params.idComprobanteElectronico) {
    const comp = await FacturacionRepository.obtenerComprobanteParaEnvioRepo(pool, params.idComprobanteElectronico, user.empresa);
    if (!comp) throw new Error("COMPROBANTE_NO_ENCONTRADO");
    rucComprobante = comp.rucEmpresa;
    tipoComprobante = comp.tipoComprobante;
    serie = comp.serie;
    numero = comp.numero;
  }
  const tieneNumero = numero !== undefined && numero !== null && String(numero).trim() !== "";
  if (!rucComprobante || !tipoComprobante || !serie || !tieneNumero) {
    throw new Error("Indique ruc, tipoComprobante, serie y numero, o idComprobanteElectronico");
  }
  const cifradoClaveCertificado = require("../utils/cifradoClaveCertificado.util");
  const consultaSunat = require("./consultaSunat.service");
  const claveDec = cifradoClaveCertificado.descifrar(config.claveSunat);
  const rucStr = String(rucComprobante).trim().replace(/\D/g, "").padStart(11, "0");
  const usuarioSOAP = config.usuarioSunat.length >= 20 || /^\d+/.test(config.usuarioSunat)
    ? config.usuarioSunat
    : rucStr + String(config.usuarioSunat).trim();
  const modoPrueba = config.modoPrueba === true || config.modoPrueba === 1 || String(config.modoPrueba || "").trim() === "1";
  const urlValidez = modoPrueba ? consultaSunat.URL_VALIDEZ_BETA : consultaSunat.URL_VALIDEZ_PROD;
  return consultaSunat.consultarValidezSunat(
    rucStr,
    tipoComprobante,
    serie,
    numero,
    usuarioSOAP,
    claveDec,
    urlValidez
  );
};

exports.obtenerXmlComprobanteService = async (pool, user, idComprobanteElectronico) => {
  if (!user) throw new Error("NO_ACCESS");
  const comp = await FacturacionRepository.obtenerComprobanteParaEnvioRepo(pool, idComprobanteElectronico, user.empresa);
  if (!comp) throw new Error("COMPROBANTE_NO_ENCONTRADO");
  const config = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, user.empresa);
  if (!config?.rutaCarpetaFacturadorSunat) throw new Error("CONFIG_FACTURADOR_INCOMPLETA");
  const nombreArchivo = nombreArchivoComprobante({
    ruc: comp.rucEmpresa,
    tipoComprobante: comp.tipoComprobante,
    serie: comp.serie,
    numero: comp.numero
  });
  const base = nombreArchivo.replace(/\.json$/i, "");
  const result = leerXmlComprobante(config.rutaCarpetaFacturadorSunat, base);
  if (!result.ok) throw new Error(result.error || "XML no encontrado");
  return result.contenido;
};

/** Genera y firma el XML UBL del comprobante (envío directo) y devuelve { xml, nombreBase } para descarga. */
exports.obtenerXmlFirmadoParaDescargaService = async (pool, user, idComprobanteElectronico) => {
  if (!user) throw new Error("NO_ACCESS");
  const result = await FacturacionRepository.generarYFirmarXmlComprobanteRepo(pool, user, idComprobanteElectronico);
  if (result.ok === false) throw new Error(result.mensaje || "Error al generar XML firmado");
  return { xml: result.xml, nombreBase: result.nombreBase };
};

exports.obtenerCdrComprobanteService = async (pool, user, idComprobanteElectronico) => {
  if (!user) throw new Error("NO_ACCESS");
  const result = await FacturacionRepository.obtenerCdrComprobanteRepo(pool, idComprobanteElectronico, user.empresa);
  if (!result) throw new Error("CDR_NO_ENCONTRADO");
  return result.contenido;
};

/** XML firmado guardado al enviar la RA (requiere columna xmlEnviado). */
exports.obtenerXmlComunicacionBajaService = async (pool, user, idComunicacionBaja) => {
  if (!user?.empresa) throw new Error("NO_ACCESS");
  const row = await FacturacionRepository.obtenerComunicacionBajaPorIdRepo(pool, user.empresa, idComunicacionBaja);
  if (!row || !row.xmlEnviado) throw new Error("XML_COMUNICACION_BAJA_NO_DISPONIBLE");
  return row.xmlEnviado;
};

/** CDR / ApplicationResponse tras consultar getStatus (rechazo o aceptación). */
exports.obtenerCdrComunicacionBajaService = async (pool, user, idComunicacionBaja) => {
  if (!user?.empresa) throw new Error("NO_ACCESS");
  const row = await FacturacionRepository.obtenerComunicacionBajaPorIdRepo(pool, user.empresa, idComunicacionBaja);
  if (!row || !row.cdr) throw new Error("CDR_COMUNICACION_BAJA_NO_DISPONIBLE");
  return row.cdr;
};

exports.obtenerEstadisticasFacturacionService = async (pool, user, periodo) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const estadisticas = await FacturacionRepository.obtenerEstadisticasFacturacionRepo(pool, user.empresa, periodo);
  return estadisticas;
};

exports.obtenerEstadosSunatService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const estados = await FacturacionRepository.obtenerEstadosSunatRepo(pool);
  return estados;
};

/**
 * Envía un lote de comprobantes pendientes (idEstadoSunat = 7) de una empresa.
 * @param {object} [opts]
 * @param {boolean} [opts.manual] - true = sin filtro modo2/modo3 (envío manual / botón lote)
 * @param {null|'modo2'|'modo3'} [opts.filtroProgramacion] - si no es manual, filtra por programación en BD
 */
exports.enviarLotePendientesService = async (pool, idEmpresa, opts = {}) => {
  const manual = opts.manual === true;
  const filtroProgramacion = manual ? null : opts.filtroProgramacion || null;
  const config = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, idEmpresa);
  // #region agent log
  const entryData = {
    idEmpresa,
    manual,
    filtroProgramacion,
    tieneRutaFacturador: !!config?.rutaCarpetaFacturadorSunat,
    envioDirectoSunat: !!config?.envioDirectoSunat
  };
  console.error("[SUNAT] enviarLotePendientesService: entry", entryData);
  debugSunatLog.write({ location: "facturacion.service.enviarLotePendientesService:entry", message: "entry", data: entryData });
  // #endregion
  const usaDirecto = config?.envioDirectoSunat && config?.urlEnvio && config?.usuarioSunat && config?.claveSunat;
  if (!usaDirecto && !config?.rutaCarpetaFacturadorSunat) {
    return { enviados: 0, errores: 0, mensaje: "Configure envío directo SUNAT o ruta del Facturador" };
  }

  const excluirBoletas = config?.useResumenDiarioBoletas === true;
  const pendientes = await FacturacionRepository.listarPendientesEnvioRepo(pool, idEmpresa, 100, {
    excluirBoletas,
    filtroProgramacion
  });
  // #region agent log
  const pendData = { count: pendientes.length, idEmpresa };
  console.error("[SUNAT] enviarLotePendientesService: pendientes", pendData);
  debugSunatLog.write({ location: "facturacion.service.enviarLotePendientesService:pendientes", message: "pendientes", data: pendData });
  // #endregion
  let enviados = 0;
  let errores = 0;

  for (const ce of pendientes) {
    try {
      const result = await FacturacionRepository.enviarComprobanteSunatRepo(
        pool,
        { empresa: idEmpresa },
        ce.idComprobanteElectronico,
        facturadorSunatService,
        {
          rutaCarpetaFacturadorSunat: config.rutaCarpetaFacturadorSunat,
          urlFacturadorSunat: config.urlFacturadorSunat,
          envioDirectoSunat: config.envioDirectoSunat,
          urlEnvio: config.urlEnvio,
          usuarioSunat: config.usuarioSunat,
          claveSunat: config.claveSunat
        }
      );
      if (result?.ok) enviados++;
      else {
        errores++;
        await FacturacionRepository.registrarFalloIntentoEnvioRepo(pool, ce.idComprobanteElectronico, idEmpresa);
      }
    } catch (err) {
      console.error("facturacion.service: error enviando comprobante", ce.idComprobanteElectronico, err.message);
      errores++;
      try {
        await FacturacionRepository.registrarFalloIntentoEnvioRepo(pool, ce.idComprobanteElectronico, idEmpresa);
      } catch (_) {
        /* ignore */
      }
    }
  }

  // #region agent log
  const resData = { enviados, errores, total: pendientes.length, idEmpresa };
  console.error("[SUNAT] enviarLotePendientesService: result", resData);
  debugSunatLog.write({ location: "facturacion.service.enviarLotePendientesService:result", message: "result", data: resData });
  // #endregion
  return { enviados, errores, total: pendientes.length };
};

/**
 * Ejecuta el envío automático para empresas con envioAutomatico = 1 y modo 2 o 3.
 * Modo 2: pendientes con fechaElegibleEnvio vencida. Modo 3: una ola diaria desde hora configurada (Lima).
 */
exports.ejecutarEnvioAutomaticoService = async (pool) => {
  const empresas = await FacturacionRepository.listarEmpresasConEnvioAutomaticoRepo(pool);
  // #region agent log
  const empData = { count: empresas.length, ids: empresas.map((e) => e.idEmpresa) };
  console.error("[SUNAT] ejecutarEnvioAutomaticoService: empresas con envío automático", empData);
  debugSunatLog.write({ location: "facturacion.service.ejecutarEnvioAutomaticoService:empresas", message: "empresas", data: empData });
  // #endregion
  const resultados = [];
  const hoyLima = ymdLima(new Date());
  const ahoraMin = minutosDesdeMedianocheLima(new Date());
  for (const emp of empresas) {
    try {
      const modo = Number(emp.modoEnvioSunat) || 2;
      let filtroProgramacion = null;
      let actualizarOla = false;

      if (modo === 2) {
        filtroProgramacion = "modo2";
      } else if (modo === 3) {
        const { horas, minutos } = parseHoraEnvioSunat(emp.horaEnvioSunat);
        const configMin = horas * 60 + minutos;
        const ultima = emp.fechaUltimaOlaEnvioProgramado;
        const ultimaYmd = ultima != null ? ymdLima(ultima) : null;
        if (ultimaYmd === hoyLima) {
          resultados.push({ idEmpresa: emp.idEmpresa, enviados: 0, errores: 0, total: 0, omitido: "ola_diaria_ya_ejecutada" });
          continue;
        }
        if (ahoraMin < configMin) {
          resultados.push({ idEmpresa: emp.idEmpresa, enviados: 0, errores: 0, total: 0, omitido: "antes_hora_programada" });
          continue;
        }
        filtroProgramacion = "modo3";
        actualizarOla = true;
      }

      const res = await exports.enviarLotePendientesService(pool, emp.idEmpresa, {
        manual: false,
        filtroProgramacion
      });
      if (actualizarOla) {
        await FacturacionRepository.actualizarFechaUltimaOlaEnvioProgramadoRepo(pool, emp.idEmpresa, hoyLima);
      }
      resultados.push({ idEmpresa: emp.idEmpresa, ...res });
    } catch (err) {
      console.error("facturacion.service: envío automático empresa", emp.idEmpresa, err.message);
      resultados.push({ idEmpresa: emp.idEmpresa, enviados: 0, errores: 0, mensaje: err.message });
    }
  }
  // #region agent log
  console.error("[SUNAT] ejecutarEnvioAutomaticoService: resultados", resultados);
  debugSunatLog.write({ location: "facturacion.service.ejecutarEnvioAutomaticoService:resultados", message: "resultados", data: resultados });
  // #endregion
  return resultados;
};

/** Lista resúmenes diarios con filtros (fechaDesde, fechaHasta, idEstadoSunat, pagina, porPagina). */
exports.listarResumenesDiariosService = async (pool, user, filtros) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  return FacturacionRepository.listarResumenesDiariosRepo(pool, user.empresa, filtros || {});
};

/** Lista cantidad de boletas pendientes por fecha en un rango (para aviso en resúmenes diarios). */
exports.listarBoletasPendientesPorFechaService = async (pool, user, fechaDesde, fechaHasta) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  return FacturacionRepository.listarBoletasPendientesPorFechaRepo(pool, user.empresa, fechaDesde, fechaHasta);
};

/** Obtiene comprobante por serie/numero para usar como origen de guía. Incluye cliente e items. No exige estado SUNAT aceptado. */
exports.obtenerComprobanteOrigenParaGuiaService = async (pool, user, serie, numero) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  return FacturacionRepository.obtenerComprobanteOrigenParaGuiaRepo(pool, user.empresa, serie, numero);
};

/** Lista guías electrónicas emitidas (paginado). Requiere tabla GuiasElectronicasEmitidas (migración). */
exports.listarGuiasEmitidasService = async (pool, user, opts) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  return guiaElectronicaRepository.listarGuiasEmitidasPaginadoRepo(pool, user.empresa, opts || {});
};

/** Obtiene comprobante origen (Factura/Boleta aceptada) para emitir NC/ND. Por id o por serie/numero/tipo. */
exports.obtenerComprobanteOrigenParaNotaService = async (pool, user, idComprobanteElectronico, opts = {}) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  let id = idComprobanteElectronico;
  if (!id && opts.serie != null && opts.numero != null) {
    id = await FacturacionRepository.obtenerComprobanteOrigenPorSerieNumeroRepo(
      pool, user.empresa, opts.serie, opts.numero, opts.tipoComprobante || "01"
    );
    if (!id) return null;
  }
  return FacturacionRepository.obtenerComprobanteOrigenParaNotaRepo(pool, id, user.empresa);
};

/** Lista comprobantes Factura/Boleta aceptados por RUC o razón social del cliente (para elegir uno). */
exports.listarComprobantesOrigenPorClienteService = async (pool, user, filtro) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  return FacturacionRepository.listarComprobantesOrigenPorClienteRepo(pool, user.empresa, filtro);
};

/** Crea Nota de Crédito (07) o Débito (08) a partir de un comprobante origen aceptado. */
exports.crearNotaCreditoDebitoService = async (pool, user, datos) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  const idUsuario = user.idUsuario || user.sub || user.id;
  return FacturacionRepository.crearNotaCreditoDebitoRepo(pool, user.empresa, idUsuario, datos);
};

/** Lista comprobantes Factura/NC/ND aceptados para comunicación de baja. */
exports.listarComprobantesAceptadosParaBajaService = async (pool, user) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  return FacturacionRepository.listarComprobantesAceptadosParaBajaRepo(pool, user.empresa);
};

/** Lista motivos de baja (catálogo global). */
exports.listarMotivosBajaService = async (pool) => {
  return FacturacionRepository.listarMotivosBajaRepo(pool);
};

/**
 * Valida que las credenciales SOL (certificado + clave y opcionalmente usuario/clave SUNAT) se descifren
 * correctamente y que el PFX se pueda abrir con la clave descifrada.
 * Útil para detectar CERT_ENCRYPTION_KEY distinto al usado al guardar o clave incorrecta.
 * @returns { Promise<{ ok: boolean, certificadoOk?: boolean, claveSolOk?: boolean, mensaje: string }> }
 */
exports.validarCredencialesSolService = async (pool, user) => {
  if (!user || !user.empresa) {
    return { ok: false, mensaje: "No autorizado" };
  }
  const config = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, user.empresa);
  if (!config) {
    return { ok: false, mensaje: "No existe configuración de facturación para esta empresa" };
  }
  let claveCert = null;
  try {
    claveCert = config.claveCertificado
      ? cifradoClaveCertificado.descifrar(config.claveCertificado)
      : null;
  } catch (err) {
    console.error("validarCredencialesSol: descifrar clave certificado", err.message);
    return {
      ok: false,
      certificadoOk: false,
      mensaje: "Error al descifrar la clave del certificado. Verifique que CERT_ENCRYPTION_KEY sea la misma que cuando se guardó la configuración."
    };
  }
  if (!config.certificadoDigital || !claveCert) {
    return {
      ok: false,
      certificadoOk: false,
      mensaje: "Configure el certificado digital y su clave en Configuración > Facturación"
    };
  }
  try {
    const certBuffer = Buffer.from(config.certificadoDigital, "base64");
    firmaXmlSunat.extraerClavePrivadaDePfx(certBuffer, claveCert);
  } catch (err) {
    console.error("validarCredencialesSol: abrir PFX", err.message);
    return {
      ok: false,
      certificadoOk: false,
      mensaje: "Clave del certificado incorrecta o certificado inválido. Verifique el archivo .pfx y la contraseña."
    };
  }
  let claveSolOk = false;
  if (config.claveSunat != null && String(config.claveSunat).trim() !== "") {
    try {
      cifradoClaveCertificado.descifrar(config.claveSunat);
      claveSolOk = true;
    } catch (err) {
      console.error("validarCredencialesSol: descifrar clave SOL", err.message);
      return {
        ok: false,
        certificadoOk: true,
        claveSolOk: false,
        mensaje: "Error al descifrar la clave SOL. Verifique que CERT_ENCRYPTION_KEY sea la misma que cuando se guardó."
      };
    }
  }
  return {
    ok: true,
    certificadoOk: true,
    claveSolOk: config.claveSunat != null && String(config.claveSunat).trim() !== "" ? claveSolOk : undefined,
    mensaje: "Credenciales válidas. El certificado se abre correctamente y las claves se descifran."
  };
};

/** Lista comunicaciones de baja con filtros. */
exports.listarComunicacionesBajaService = async (pool, user, filtros) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  return FacturacionRepository.listarComunicacionesBajaRepo(pool, user.empresa, filtros);
};