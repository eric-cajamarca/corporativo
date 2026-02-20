const FacturacionRepository = require('../repositories/facturacion.repository');
const facturadorSunatService = require('./facturadorSunat.service');
const { nombreArchivoComprobante, leerXmlComprobante } = require('../utils/facturadorSunat.util');
const debugSunatLog = require('../utils/debugSunatLog.util');

exports.obtenerConfiguracionFacturacionService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const configuracion = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, user.empresa);
  if (configuracion) {
    delete configuracion.claveCertificado;
    delete configuracion.claveSunat;
  }
  return configuracion;
};

exports.actualizarConfiguracionFacturacionService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador") {
    throw new Error("NO_PERMISSIONS");
  }

  const result = await FacturacionRepository.actualizarConfiguracionFacturacionRepo(pool, user, datos);
  return result;
};

/** Sube y guarda el certificado digital (PFX) y su clave para firma de XML. Requiere configuración de facturación existente. */
exports.actualizarCertificadoFacturacionService = async (pool, user, certificadoBuffer, claveCertificado) => {
  if (!user) throw new Error("NO_ACCESS");
  if (user.rol !== "Administrador") throw new Error("NO_PERMISSIONS");
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

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

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

  if (user.rol !== "Administrador") {
    throw new Error("NO_PERMISSIONS");
  }

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

exports.consultarEstadoSunatService = async (pool, user, idComprobanteElectronico) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  // Validar que el comprobante existe
  const comprobanteValido = await FacturacionRepository.validarComprobanteEmpresaRepo(pool, idComprobanteElectronico, user.empresa);
  if (!comprobanteValido) {
    throw new Error("COMPROBANTE_NO_ENCONTRADO");
  }

  // Simular consulta a SUNAT (en producción se haría la llamada real)
  const result = await FacturacionRepository.consultarEstadoSunatRepo(pool, user, idComprobanteElectronico);
  return result;
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

exports.obtenerCdrComprobanteService = async (pool, user, idComprobanteElectronico) => {
  if (!user) throw new Error("NO_ACCESS");
  const result = await FacturacionRepository.obtenerCdrComprobanteRepo(pool, idComprobanteElectronico, user.empresa);
  if (!result) throw new Error("CDR_NO_ENCONTRADO");
  return result.contenido;
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
 * Usado por envío automático y por envío por lotes manual.
 */
exports.enviarLotePendientesService = async (pool, idEmpresa) => {
  const config = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, idEmpresa);
  // #region agent log
  const entryData = { idEmpresa, tieneRutaFacturador: !!config?.rutaCarpetaFacturadorSunat, envioDirectoSunat: !!config?.envioDirectoSunat };
  console.error("[SUNAT] enviarLotePendientesService: entry", entryData);
  debugSunatLog.write({ location: "facturacion.service.enviarLotePendientesService:entry", message: "entry", data: entryData });
  // #endregion
  if (!config?.rutaCarpetaFacturadorSunat) {
    return { enviados: 0, errores: 0, mensaje: "Ruta del Facturador no configurada" };
  }

  const pendientes = await FacturacionRepository.listarPendientesEnvioRepo(pool, idEmpresa, 100);
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
      else errores++;
    } catch (err) {
      console.error("facturacion.service: error enviando comprobante", ce.idComprobanteElectronico, err.message);
      errores++;
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
 * Ejecuta el envío automático para todas las empresas con envioAutomatico = 1.
 * Llamado por el job en segundo plano.
 */
exports.ejecutarEnvioAutomaticoService = async (pool) => {
  const empresas = await FacturacionRepository.listarEmpresasConEnvioAutomaticoRepo(pool);
  // #region agent log
  const empData = { count: empresas.length, ids: empresas.map(e => e.idEmpresa) };
  console.error("[SUNAT] ejecutarEnvioAutomaticoService: empresas con envío automático", empData);
  debugSunatLog.write({ location: "facturacion.service.ejecutarEnvioAutomaticoService:empresas", message: "empresas", data: empData });
  // #endregion
  const resultados = [];
  for (const emp of empresas) {
    try {
      const res = await exports.enviarLotePendientesService(pool, emp.idEmpresa);
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