const { withPool } = require('../utils/dbPool.util');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

const getEmpresas = async function (req, res, next) {
    if (!req.user) {
        return res.status(401).send({ message: 'No autorizado' });
    }
    if (!puedeAccesoListadoPlataformaEmpresas(req)) {
        return res.status(403).send({ message: 'No tiene permisos para listar empresas de la plataforma' });
    }
    try {
        await withPool(async (pool) => {
            const result = await empresasAdministracionService.listarTodas(pool);
            res.status(200).send({ data: result });
        });
    } catch (error) {
        console.error('Error al obtener las empresas:', error);
        return next(error);
    }
};



const getEmpresasById = async function (req, res, next) {
        const id = req.user.empresa;

    if (req.user) {
        if (req.user.rol == 'Administrador' || req.user.rol == 'superAdmin') {
                        try {
                await withPool(async (pool) => {
                    const result = await empresasAdministracionService.obtenerPorId(pool, id);
                    res.status(200).send({ data: result });
                });
            } catch (error) {
                console.error('Error al obtener los usuarios:', error);
                return next(error);
            }
        }else{
            return res.status(403).send({ message: 'No autorizado' });

        }
    }
    else {
        return res.status(401).send({ message: 'No autorizado' });
    }
};

const getEmpresa_id = async function (req, res, next) {
    const id = req.user.empresa;
    if (!req.user) {
        return res.status(401).send({ message: 'No autorizado' });
    }
    try {
        await withPool(async (pool) => {
            const result = await empresasAdministracionService.obtenerCabecera(pool, id);
            res.status(200).send({ data: result });
        });
    } catch (error) {
        console.error('Error al obtener empresa (getEmpresa_id):', error);
        return next(error);
    }
};

const empresaService = require('../services/empresa.service');
const factilizaRepository = require('../repositories/factiliza.repository');
const whatsappFactilizaService = require('../services/whatsappFactiliza.service');
const seguridadAuditoriaService = require('../services/seguridadAuditoria.service');
const twoFactorAdminService = require('../services/twoFactorAdmin.service');
const { obtenerIpCliente } = require('../utils/clientIp.util');
const { puedeAccesoListadoPlataformaEmpresas } = require('../utils/plataformaEmpresa.util');
const empresaRepository = require('../repositories/empresa.repository');
const usuarioRepository = require('../repositories/usuario.repository');
const emailService = require('../services/email.service');
const empresasAdministracionService = require('../services/empresasAdministracion.service');
const usuarioAdminService = require('../services/usuarioAdmin.service');
const empresaSuscripcionBootstrap = require('../services/empresaSuscripcionBootstrap.service');
const whatsappBotLeadComercial = require('../services/whatsappBotLeadComercial.service');
const { isSaas } = require('../config/deployment.config');

const NOMBRE_SERVICIO_WHATSAPP = 'Factiliza WHATSAPP';

/** Envía código de activación por WhatsApp vía Factiliza (FactilizaConfig 'Factiliza WHATSAPP'). Sin sesión. */
async function enviarCodigoActivacionFactiliza(pool, telefono, codigo) {
  const config = await factilizaRepository.getConfigByNombre(pool, NOMBRE_SERVICIO_WHATSAPP);
  if (!config || !config.tokenDefault) {
    console.error('Factiliza WHATSAPP no configurado en FactilizaConfig (tokenDefault).');
    return { sent: false, error: 'Servicio WhatsApp no configurado. Configure Factiliza WHATSAPP en la base de datos.' };
  }
  if (!config.parametroRuta || String(config.parametroRuta).trim() === '') {
    console.error('Factiliza WHATSAPP requiere parametroRuta (nombre-instancia).');
    return { sent: false, error: 'Servicio WhatsApp: falta parametroRuta (nombre de instancia).' };
  }
  if (!telefono || String(telefono).trim() === '') {
    return { sent: false, error: 'Número de WhatsApp destino vacío.' };
  }
  // Normalizar: quitar prefijo whatsapp: y + para enviar solo dígitos (ej. 51999999999)
  const numeroNormalizado = String(telefono).trim().replace(/^whatsapp:/i, '').replace(/^\+/, '');
  const text = `Tu código de verificación para activar tu empresa es: ${codigo}`;
  try {
    const resultado = await whatsappFactilizaService.sendText(config, numeroNormalizado, text);
    if (resultado.success) {
      return { sent: true };
    }
    return { sent: false, error: resultado.message || 'Error al enviar por WhatsApp.' };
  } catch (err) {
    console.error('Error enviando código activación Factiliza WHATSAPP:', err.message);
    return { sent: false, error: err.message || 'Error al enviar por WhatsApp.' };
  }
}

async function enviarCodigoActivacionCorreo(correo, codigo) {
  const destino = String(correo || '').trim();
  if (!destino) {
    return { sent: false, error: 'Correo destino vacío.' };
  }
  const subject = 'Código de activación de cuenta';
  const text = `Tu código de verificación para activar tu empresa es: ${codigo}\n\nSi no solicitaste este código, ignora este mensaje.`;
  const html = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #333;">Código de activación</h2>
      <p>Tu código de verificación para activar tu empresa es:</p>
      <p style="font-size: 24px; font-weight: 700; letter-spacing: 2px; margin: 16px 0;">${codigo}</p>
      <p style="color: #666; font-size: 14px;">Si no solicitaste este código, ignora este mensaje.</p>
    </div>
  `;
  try {
    await emailService.enviarNotificacionOperativa({
      to: destino,
      subject,
      text,
      html
    });
    return { sent: true };
  } catch (err) {
    console.error('Error enviando código por correo:', err?.message || err);
    return { sent: false, error: err?.message || 'Error al enviar correo.' };
  }
}

function construirMensajeActivacion(resultadoWhatsApp, resultadoEmail) {
  if (resultadoWhatsApp.sent && resultadoEmail.sent) {
    return 'Empresa creada. Se envió un código de verificación por WhatsApp y correo.';
  }
  if (resultadoWhatsApp.sent) {
    return 'Empresa creada. Se envió un código de verificación por WhatsApp. No se pudo enviar por correo.';
  }
  if (resultadoEmail.sent) {
    return 'Empresa creada. Se envió un código de verificación por correo. No se pudo enviar por WhatsApp.';
  }
  return 'Empresa creada. No se pudo enviar el código por WhatsApp ni correo; use "Reenviar código" más tarde.';
}

const createEmpresa = async function (req, res, next) {
        const { idDocumento, ruc, razon_Social, nombre_Comercial, rubro, celular, logo, correo, password, alias, condicion, estSunat } = req.body;

    const currentDate = moment().format('YYYY-MM-DD');
    const fregistro = currentDate;

    try {
        if (isSaas()) {
            const checkout = String(req.body.checkoutOrderNumber || '').trim();
            const demo = !!req.body.solicitudDemo;
            if (!checkout && !demo) {
                return res.status(400).send({
                    message: 'Elige un plan o la demo de 14 días antes de registrar la empresa.',
                    data: undefined
                });
            }
        }
        await withPool(async (pool) => {
            const existentes = await empresasAdministracionService.buscarPorRuc(pool, ruc);
            if (existentes.length > 0) {
                throw Object.assign(new Error('__EMPRESA_YA_EXISTE__'), { __empresaDuplicada: true });
            }
            const hashedPassword = await bcrypt.hash(password, 8);
            const idEmpresa = uuidv4();

            const idRubroResuelto = await empresaService.resolverIdRubroDesdeTexto(
                pool,
                rubro,
                req.body.idRubro || null
            );

            await empresasAdministracionService.insertarEmpresa(pool, {
                idEmpresa,
                idDocumento,
                ruc,
                razon_Social,
                nombreComercial: nombre_Comercial,
                rubro,
                idRubro: idRubroResuelto,
                celular,
                correo,
                password: hashedPassword,
                logo: null,
                alias,
                condicion,
                estSunat,
                estado: 0,
                fregistro
            });

            whatsappBotLeadComercial.marcarRegistroEmpresa(celular, idEmpresa).catch((err) => {
                console.error('lead comercial registro empresa:', err.message);
            });

            try {
                const datosEmpresa = {
                    razon_Social,
                    correo,
                    celular,
                    idRubro: req.body.idRubro || null,
                    direccion: req.body.direccion || 'Sin dirección',
                    ubigeo: req.body.ubigeo,
                    codPais: req.body.codPais,
                    codpais: req.body.codpais,
                    region: req.body.region,
                    provincia: req.body.provincia,
                    distrito: req.body.distrito,
                    urbanizacion: req.body.urbanizacion,
                    codLocal: req.body.codLocal
                };
                const resultadoInicializacion = await empresaService.inicializarDatosEmpresa(pool, idEmpresa, datosEmpresa);

                await empresaService.insertarEmpresaIntegraciones(pool, idEmpresa);
                await empresaService.marcarEmpresaPrincipalSiEsPrimera(pool, idEmpresa);

                try {
                  await empresaSuscripcionBootstrap.aplicarSuscripcionNuevaEmpresa(pool, idEmpresa, {
                    solicitudDemo: !!req.body.solicitudDemo,
                    checkoutOrderNumber: (req.body.checkoutOrderNumber || '').trim() || null
                  });
                } catch (errSub) {
                  console.error('Suscripción inicial no aplicada:', errSub);
                }

                const verificacion = await empresaService.crearRegistroVerificacionEmpresa(pool, idEmpresa, celular);
                const resultadoWhatsApp = await enviarCodigoActivacionFactiliza(pool, celular, verificacion.codigo);
                const resultadoEmail = await enviarCodigoActivacionCorreo(correo, verificacion.codigo);

                const mensaje = construirMensajeActivacion(resultadoWhatsApp, resultadoEmail);

                res.status(200).send({
                    data: idEmpresa,
                    sucursalPrincipal: resultadoInicializacion.sucursal?.idSucursal,
                    mensaje,
                    codigoEnviado: resultadoWhatsApp.sent || resultadoEmail.sent,
                    codigoEnviadoWhatsApp: resultadoWhatsApp.sent,
                    codigoEnviadoEmail: resultadoEmail.sent
                });
            } catch (errorInicializacion) {
                console.error('⚠️ Error inicializando datos maestros:', errorInicializacion);
                res.status(200).send({
                    data: idEmpresa,
                    warning: 'Empresa creada pero algunos datos maestros no se inicializaron correctamente. Se enviará el código de verificación igualmente.'
                });
            }
        });
    } catch (error) {
        if (error && error.__empresaDuplicada && error.message === '__EMPRESA_YA_EXISTE__') {
            return res.status(200).send({ message: 'La Empresa ya existe. Por favor registre una empresa diferente', data: undefined });
        }
        console.error('Error al crear la Empresa:', error);
        return next(error);
    }
}

const getIntegraciones = async function (req, res, next) {
    try {
        const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
        if (!idEmpresa) {
            return res.status(401).send({ message: 'No autorizado', data: undefined });
        }
        await withPool(async (pool) => {
            const { integracionesRes, credencialesRes } = await empresasAdministracionService.obtenerIntegracionesYCredenciales(
                pool,
                idEmpresa
            );
            const integraciones = integracionesRes.recordset[0] || null;
            const credencialesList = credencialesRes.recordset || [];
            const credencialesPorProveedor = {};
            for (const row of credencialesList) {
                if (!credencialesPorProveedor[row.proveedor]) credencialesPorProveedor[row.proveedor] = [];
                credencialesPorProveedor[row.proveedor].push({ idCredencial: row.idCredencial, clave: row.clave, valor: row.valor });
            }
            res.status(200).send({
                data: {
                    integraciones,
                    credenciales: credencialesPorProveedor
                }
            });
        });
    } catch (error) {
        console.error('Error al obtener integraciones:', error);
        return next(error);
    }
};

const putIntegraciones = async function (req, res, next) {
    try {
        const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
        if (!idEmpresa) {
            return res.status(401).send({ message: 'No autorizado', data: undefined });
        }
        const { twilioHabilitado, izipayHabilitado, culqiHabilitado, apisPeruHabilitado, factilizaHabilitado } = req.body || {};
        await withPool(async (pool) => {
            await empresasAdministracionService.guardarIntegracionesFlags(pool, idEmpresa, {
                twilioHabilitado,
                izipayHabilitado,
                culqiHabilitado,
                apisPeruHabilitado,
                factilizaHabilitado
            });
            res.status(200).send({ data: { ok: true }, message: 'Integraciones actualizadas.' });
        });
    } catch (error) {
        console.error('Error al actualizar integraciones:', error);
        return next(error);
    }
};

const putCredencialesProveedor = async function (req, res, next) {
    try {
        const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
        if (!idEmpresa) {
            return res.status(401).send({ message: 'No autorizado', data: undefined });
        }
        const { proveedor, credenciales } = req.body || {};
        if (!proveedor || !Array.isArray(credenciales)) {
            return res.status(400).send({ message: 'proveedor y credenciales (array) son requeridos', data: undefined });
        }
        await withPool(async (pool) => {
            await empresasAdministracionService.reemplazarCredencialesProveedor(pool, idEmpresa, proveedor, credenciales);
            res.status(200).send({ data: { ok: true }, message: 'Credenciales guardadas.' });
        });
    } catch (error) {
        console.error('Error al guardar credenciales:', error);
        return next(error);
    }
};

const enviarCodigoActivacion = async function (req, res, next) {
    try {
        const { idEmpresa, celular } = req.body || {};
        const idEmpresaTrim = idEmpresa != null ? String(idEmpresa).trim() : '';
        if (!idEmpresaTrim) {
            return res.status(400).json({ message: 'idEmpresa es requerido' });
        }
        await withPool(async (pool) => {
            const empresa = await empresasAdministracionService.obtenerEmpresaCelularEstado(pool, idEmpresaTrim);
            if (!empresa) {
                return res.status(404).json({ message: 'Empresa no encontrada' });
            }
            if (empresa.estado === 1 || empresa.estado === true) {
                return res.status(400).json({ message: 'La cuenta ya está activada' });
            }
            const telefono = (celular && String(celular).trim()) || (empresa.celular && String(empresa.celular).trim());
            if (!telefono) {
                return res.status(400).json({ message: 'Celular es requerido para enviar el código' });
            }
            const verificacion = await empresaService.obtenerOActualizarCodigoVerificacion(pool, idEmpresaTrim, telefono);
            const codigoEnviar = verificacion && (verificacion.codigo != null) ? String(verificacion.codigo) : null;
            if (!codigoEnviar) {
                console.error('enviarCodigoActivacion: no se generó código de verificación');
                throw new Error('Error al generar código de verificación');
            }
            const resultadoWhatsApp = await enviarCodigoActivacionFactiliza(pool, telefono, codigoEnviar);
            const resultadoEmail = await enviarCodigoActivacionCorreo(empresa.correo, codigoEnviar);
            if (!resultadoWhatsApp.sent && !resultadoEmail.sent) {
                return res.status(503).json({
                  message: resultadoWhatsApp.error || resultadoEmail.error || 'No se pudo enviar el código por WhatsApp ni correo'
                });
            }
            res.status(200).json({ message: construirMensajeActivacion(resultadoWhatsApp, resultadoEmail) });
        });
    } catch (error) {
        console.error('Error en enviarCodigoActivacion:', error);
        return next(error);
    }
};

const verificarEmpresaCodigo = async function (req, res, next) {
    try {
        const { idEmpresa, codigo } = req.body || {};
        if (!idEmpresa || !codigo) {
            return res.status(400).send({ message: 'idEmpresa y código son requeridos', data: undefined });
        }
        await withPool(async (pool) => {
            const resultado = await empresaService.verificarEmpresaPorCodigo(pool, idEmpresa, String(codigo).trim());
            if (!resultado.ok) {
                return res.status(400).send({ message: resultado.message || 'Código inválido', data: undefined });
            }
            res.status(200).send({ data: { ok: true }, message: 'Empresa verificada y habilitada correctamente.' });
        });
    } catch (error) {
        console.error('Error al verificar empresa por código:', error);
        return next(error);
    }
};



const updateEmpresa = async function (req, res, next) {
    try {
        if (!req.user) {
            return res.status(401).send({ success: false, message: 'No autorizado' });
        }
        if (req.user.rol !== 'Administrador') {
            return res.status(401).send({ success: false, message: 'No autorizado' });
        }

        const idEmpresa = req.user.empresa;
        const idEmpresaPath = req.params && req.params.id;
        if (idEmpresaPath && String(idEmpresaPath).toLowerCase() !== String(idEmpresa).toLowerCase()) {
            return res.status(403).send({ success: false, message: 'Solo puede actualizar su propia empresa' });
        }

        const { logoAnterior } = req.body || {};

        await withPool(async (pool) => {
            if (req.file && logoAnterior && logoAnterior !== 'undefined' && logoAnterior !== 'null') {
                try {
                    const oldPath = path.join(__dirname, '../uploads/configuraciones/', logoAnterior);
                    await fs.unlink(oldPath);
                } catch (err) {
                    console.warn('No se pudo eliminar la imagen anterior:', err.message);
                }
            }
            const result = await empresasAdministracionService.actualizarEmpresaDatosContacto(
                pool,
                idEmpresa,
                req.body || {},
                req.file ? req.file.filename : null
            );

            res.status(200).json({
                success: true,
                message: 'Empresa actualizada correctamente',
                data: {
                    rowsAffected: result.rowsAffected,
                    newLogo: req.file ? req.file.filename : null
                }
            });
        });

    } catch (error) {
        console.error('Error en updateEmpresa:', error);

        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }

        if (error && error.message === 'EMPRESA_NO_ENCONTRADA') {
            return res.status(404).send({ success: false, message: 'Empresa no encontrada' });
        }
        return next(error);
    }
};

const cambiar_estado_empresa = async function (req, res, next) {
  if (!req.user) {
    return res.status(401).send({ message: 'No autorizado' });
  }
  if (!puedeAccesoListadoPlataformaEmpresas(req)) {
    return res.status(403).send({ message: 'No tiene permisos para cambiar el estado de empresas de la plataforma' });
  }
  const idEmpresa = req.params['id'];
  if (!idEmpresa) {
    return res.status(400).send({ message: 'idEmpresa requerido' });
  }
  const { nuevoEstado, estado } = req.body || {};
  let estadoFinal;
  if (typeof nuevoEstado === 'boolean') {
    estadoFinal = nuevoEstado;
  } else if (typeof estado === 'boolean') {
    estadoFinal = !estado;
  } else {
    return res.status(400).send({ message: 'Se requiere nuevoEstado (boolean) o estado (boolean legacy)' });
  }
  try {
    await withPool(async (pool) => {
      const result = await empresasAdministracionService.cambiarEstadoEmpresa(pool, idEmpresa, estadoFinal);
      res.status(200).send({ data: result.rowsAffected });
    });
  } catch (error) {
    console.error('Error al cambiar el estado de la empresa:', error);
    return next(error);
  }
};

const obtener_logo = async function (req, res, next) {
    try {
        const baseDir = path.resolve(__dirname, '../uploads/configuraciones');
        const defaultPath = path.resolve(__dirname, '../public/assets/img/01.jpg');

        async function enviarOFallar(filePath) {
            try {
                await fs.access(filePath);
            } catch (e) {
                return res.status(404).end();
            }
            return res.sendFile(filePath, (err) => {
                if (err && !res.headersSent) {
                    res.status(404).end();
                }
            });
        }

        const raw = req.params.img;
        const img = raw && typeof raw === 'string' ? raw.trim() : 'default.jpg';

        // Whitelist estricta: solo nombres de archivo con extension de imagen.
        // Bloquea ".." en cualquier forma, separadores y rutas absolutas.
        const safeName = /^[A-Za-z0-9._-]+\.(jpg|jpeg|png|gif|webp|svg)$/i;
        if (!safeName.test(img) || img.includes('..')) {
            return enviarOFallar(defaultPath);
        }

        const candidate = path.resolve(baseDir, img);
        if (!candidate.startsWith(baseDir + path.sep) && candidate !== baseDir) {
            return enviarOFallar(defaultPath);
        }

        try {
            await fs.access(candidate);
            return enviarOFallar(candidate);
        } catch (err) {
            return enviarOFallar(defaultPath);
        }
    } catch (error) {
        console.error('Error al obtener logo:', error.message);
        return res.status(404).end();
    }
};


const obtener_datos_colaborador_admin = async (req, res, next) => {
    const { id } = req.params;
    let data;

    if (req.user) {

        try {

            await withPool(async (pool) => {
                const recordset = await usuarioAdminService.obtenerUsuarioWebLegacyPorId(pool, id);
                data = recordset;
                res.json({ data });
            });


        } catch (error) {
            console.error('Error al obtener datos colaborador (empresasController):', error);
            return next(error);
        }
    }
    else {
        return res.status(401).send({ message: 'No autorizado' });
    }
};

const cambiar_estado_colaborador_admin = async function (req, res, next) {
    if (!req.user) {
        return res.status(403).send({ data: undefined, message: 'NoToken' });
    }
    try {
        const id = req.params['id'];
        const data = req.body;
        let nuevo_estado;
        if (data.estado) {
            nuevo_estado = false;
        } else if (!data.estado) {
            nuevo_estado = true;
        }
        await withPool(async (pool) => {
            const result = await usuarioAdminService.cambiarEstadoUsuarioWebLegacy(pool, id, data);
            res.status(200).send({ data: result.recordset });
        });
    } catch (error) {
        console.error('cambiar_estado_colaborador_admin:', error);
        return next(error);
    }
};




const deleteAdmin = async (req, res, next) => {
    const { id } = req.params;
    try {
        await withPool(async (pool) => {
            await usuarioAdminService.eliminarUsuarioWebLegacySinEmpresa(pool, id);
            res.json({ message: 'Usuario eliminado correctamente' });
        });
    } catch (error) {
        console.error('Error al eliminar un Usuario:', error);
        return next(error);
    }
};




const createDireccionEmpresa = async function (req, res, next) {
    try {
        if (!req.user || !(req.user.empresa || req.user.idEmpresa)) {
            return res.status(401).send({ message: 'No autorizado', data: undefined });
        }
        const idEmpresa = req.user.empresa || req.user.idEmpresa;
        let ubigeo = req.body.ubigeo;
        let codPais = req.body.codpais;
        let region = req.body.region;
        let provincia = req.body.provincia;
        let distrito = req.body.distrito;
        let urbanizacion = req.body.urbanizacion;
        let direccion = req.body.direccion;
        let principal = req.body.principal !== false && req.body.principal !== 'false';
        let codLocal = principal ? '0000' : (req.body.codLocal || '0');


        //let idUsuario = 'C654A619-B725-4C2E-9175-A3F4AC3B7845';

        //let nombre = 'Mi empresa';

        await withPool(async (pool) => {
            const insertDireccionEmpresa = await empresasAdministracionService.crearDireccionEmpresa(pool, {
                idEmpresa,
                ubigeo,
                codPais,
                region,
                provincia,
                distrito,
                urbanizacion,
                direccion,
                principal,
                codLocal,
                crearSucursal: req.body.crearSucursal === true,
                nombreSucursal: req.body.nombreSucursal
            });

            res.status(200).send({ data: insertDireccionEmpresa.rowsAffected });
        });
    } catch (error) {
        if (
            error.message === 'PLAN_LIMITE_DIRECCIONES_EMPRESA' ||
            error.message === 'PLAN_LIMITE_SUCURSALES'
        ) {
            const msg =
                error.message === 'PLAN_LIMITE_SUCURSALES'
                    ? 'Ha alcanzado el máximo de sucursales de su plan. Actualice el plan para agregar más.'
                    : 'Ha alcanzado el máximo de direcciones de establecimiento permitidas por su plan.';
            return res.status(403).send({ message: msg, data: undefined });
        }
        res.status(500).send({ message: error.message, data: undefined });
    }

}

/**
 * Crear sucursal (para nueva dirección con nombre elegido por el usuario).
 * Body: idEmpresa, nombre (obligatorio), direccion (opcional).
 */
const createSucursalEmpresa = async function (req, res, next) {
    try {
        const idEmpresa = (req.user && (req.user.empresa || req.user.idEmpresa)) ? (req.user.empresa || req.user.idEmpresa) : req.body.idEmpresa;
        if (!idEmpresa) {
            return res.status(400).send({ message: 'idEmpresa requerido', data: undefined });
        }
        const nombre = req.body.nombre ? String(req.body.nombre).trim() : '';
        if (!nombre) {
            return res.status(400).send({ message: 'nombre de la sucursal es requerido', data: undefined });
        }
        const direccion = req.body.direccion != null ? String(req.body.direccion) : '';
        await withPool(async (pool) => {
            const out = await empresasAdministracionService.crearSucursalEmpresa(pool, {
                idEmpresa,
                nombre,
                direccion
            });

            res.status(200).send({ data: out, message: 'Sucursal creada' });
        });
    } catch (error) {
        if (error.message === 'PLAN_LIMITE_SUCURSALES') {
            return res.status(403).send({
                message:
                    'Ha alcanzado el máximo de sucursales de su plan. Actualice el plan para agregar más.',
                data: undefined
            });
        }
        console.error('createSucursalEmpresa:', error);
        return next(error);
    }
};

const updateDireccionEmpresa = async function (req, res, next) {
        const { idDireccionEmpresa, ubigeo, codPais, region, provincia, distrito, urbanizacion, direccion, codLocal, principal } = req.body;
    const id = idDireccionEmpresa;

    if (req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                await withPool(async (pool) => {
                    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
                    const result = await empresasAdministracionService.actualizarDireccionEmpresaCompleto(pool, idEmpresa, {
                        idDireccionEmpresa,
                        ubigeo,
                        codPais,
                        region,
                        provincia,
                        distrito,
                        urbanizacion,
                        direccion,
                        codLocal,
                        principal
                    });
                    res.status(200).send({ data: result.rowsAffected });
                });
            } catch (error) {
                console.error('Error al actualizar un DireccionEmpresa:', error);
                return next(error);
            }
        }
        else {
            res.status(401).send({ message: 'No Access' });
        }
    } else {
        res.status(401).send({ message: 'No Access' });
    }
}

const getDireccionEmpresa_id = async function (req, res, next) {
    
    const idEmpresa = req.user.empresa;
        if (req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                await withPool(async (pool) => {
                    const result = await empresasAdministracionService.listarDireccionesEmpresa(pool, idEmpresa);
                    res.status(200).send({ data: result });
                });
            } catch (error) {
                console.error('Error al obtener las direcciones de la empresa:', error);
                return next(error);
            }
        }
        else {
            res.status(401).send({ message: 'No Access' });
        }

    } else {
        res.status(401).send({ message: 'No Access' });
    }
}

const deleteDireccion_id = async function (req, res, next) {
    const idDireccionEmpresa = req.params['id'];
    

    if( req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                await withPool(async (pool) => {
                    const result = await empresasAdministracionService.eliminarDireccionEmpresa(pool, idDireccionEmpresa);
                    res.status(200).send({ data: result.rowsAffected });
                });
            } catch (error) {
                console.error('Error al eliminar la direccion de la empresa:', error);
                return next(error);
            }
        }
        else {
            res.status(401).send({ message: 'No Access' });
        }

    } else {
        res.status(401).send({ message: 'No Access' });
    }
}

const cambiar_principal_direccion = async function (req, res, next) {
        const idDireccionEmpresa = req.params.id;
    const idEmpresa = req.user.empresa;

    if (req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                await withPool(async (pool) => {
                    const result = await empresasAdministracionService.cambiarPrincipalDireccion(
                        pool,
                        idEmpresa,
                        idDireccionEmpresa
                    );
                    res.status(200).send({ data: result.rowsAffected });
                });
            } catch (error) {
                console.error('Error al cambiar la direccion principal0:', error);
                return next(error);
            }


        }
        else {
            res.status(401).send({ message: 'No Access' });
        }
    } else {
        res.status(401).send({ message: 'No Access' });
    }
}

const getEstadoConfiguracion = async function (req, res, next) {
        
    if (!req.user || !req.user.empresa) {
        return res.status(401).send({ message: 'No autorizado', data: undefined });
    }

    try {
        await withPool(async (pool) => {
            const estado = await empresaService.obtenerEstadoConfiguracion(pool, req.user.empresa);

            res.status(200).send({ data: estado });
        });
    } catch (error) {
        console.error('Error obteniendo estado de configuración:', error);
        return next(error);
    }
};

const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

/**
 * POST /empresa/:idEmpresa/reset-2fa-admin
 * Misma regla que getEmpresas: superAdmin + empresa principal (EMPRESA_PRINCIPAL_ID).
 */
const reset2faEmpresa = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).send({ message: 'No autorizado', data: undefined });
  }
  if (!puedeAccesoListadoPlataformaEmpresas(req)) {
    return res.status(403).send({
      message: 'No tiene permisos para restablecer el 2FA de la plataforma.',
      data: undefined
    });
  }
  const idEmpresaTarget = req.params.idEmpresa;
  if (!idEmpresaTarget || !GUID_RE.test(String(idEmpresaTarget))) {
    return res.status(400).send({ message: 'Identificador de empresa inválido', data: undefined });
  }
  const ipCliente = obtenerIpCliente(req);
  try {
    await withPool(async (pool) => {
      await twoFactorAdminService.resetearTotpEmpresa(pool, idEmpresaTarget);
      let emailEjecutor = '';
      try {
        const u = await usuarioRepository.buscarPorIdYEmpresa(pool, req.user.sub, req.user.empresa);
        if (u && u.email) emailEjecutor = String(u.email);
      } catch (e) {
        /* auditoria best-effort */
      }
      await seguridadAuditoriaService.registrar(pool, req, {
        idEmpresa: idEmpresaTarget,
        idUsuario: req.user.sub,
        tipo: 'RESET_2FA_EMPRESA',
        detalle: emailEjecutor.slice(0, 500),
        ipCliente
      });
      return res.status(200).send({
        message:
          '2FA restablecido para la empresa. Los administradores deberán configurar de nuevo el autenticador al iniciar sesión.',
        data: undefined
      });
    });
  } catch (error) {
    if (error.message === 'EMPRESA_NO_ENCONTRADA') {
      return res.status(404).send({ message: 'Empresa no encontrada', data: undefined });
    }
    console.error('reset2faEmpresa:', error.message);
    return next(error);
  }
};

/**
 * PUT /empresa/:idEmpresa/politica-2fa-admin
 * Body: { "adminRequiere2FA": true | false }
 * Mismo acceso que listado plataforma (superAdmin + empresa principal).
 */
const putPolitica2faAdmin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).send({ message: 'No autorizado', data: undefined });
  }
  if (!puedeAccesoListadoPlataformaEmpresas(req)) {
    return res.status(403).send({
      message: 'No tiene permisos para esta operación.',
      data: undefined
    });
  }
  const idEmpresa = req.params.idEmpresa;
  if (!idEmpresa || !GUID_RE.test(String(idEmpresa))) {
    return res.status(400).send({ message: 'Identificador de empresa inválido', data: undefined });
  }
  const { adminRequiere2FA } = req.body || {};
  if (typeof adminRequiere2FA !== 'boolean') {
    return res.status(400).send({
      message: 'Envíe adminRequiere2FA como booleano (true o false).',
      data: undefined
    });
  }
  const ipCliente = obtenerIpCliente(req);
  try {
    await withPool(async (pool) => {
      const n = await empresaRepository.actualizarAdminRequiere2FA(pool, idEmpresa, adminRequiere2FA);
      if (!n) {
        return res.status(404).send({ message: 'Empresa no encontrada', data: undefined });
      }
      await seguridadAuditoriaService.registrar(pool, req, {
        idEmpresa,
        idUsuario: req.user.sub,
        tipo: 'POLITICA_2FA_ADMIN',
        detalle: `adminRequiere2FA=${adminRequiere2FA}`,
        ipCliente
      });
      return res.status(200).send({
        message: 'Política de 2FA para administradores actualizada.',
        data: { adminRequiere2FA }
      });
    });
  } catch (error) {
    console.error('putPolitica2faAdmin:', error.message);
    return next(error);
  }
};

module.exports = {
    getEmpresas,
    createEmpresa,
    updateEmpresa,
    cambiar_estado_empresa,
    deleteAdmin,
    cambiar_estado_colaborador_admin,
    obtener_datos_colaborador_admin,
    getEmpresasById,
    getDireccionEmpresa_id,
    createDireccionEmpresa,
    updateDireccionEmpresa,
    deleteDireccion_id,
    cambiar_principal_direccion,
    verificarEmpresaCodigo,
    enviarCodigoActivacion,
    getIntegraciones,
    putIntegraciones,
    putCredencialesProveedor,

    obtener_logo,
    getEmpresa_id,

    createSucursalEmpresa,

    getEstadoConfiguracion,

    reset2faEmpresa,
    putPolitica2faAdmin
};