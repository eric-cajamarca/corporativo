const sql = require('mssql');
const dbConfig = require('../dbconfig');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const jwt = require('../helpers/jwt');
const { v4: uuidv4 } = require('uuid');
const { max } = require('moment/moment');
const path = require('path');
const fs = require('fs').promises; // Usamos la versión con promesas
// CREATE TABLE Empresas(
// 	idEmpresa UNIQUEIDENTIFIER primary key NOT NULL,
// 	idDocumento varchar(1) not null,
// 	ruc varchar(11) not NULL,
// 	razon_Social varchar(200) not NULL,
// 	nombreComercial varchar(200) null,
// 	rubro varchar(200) NULL,
// 	celular varchar(11) NULL,
// 	correo varchar(100) not NULL,
// 	password text not null,
// 	logo varbinary(max) NULL,
// 	alias varchar(10) NULL,
// 	condicion varchar(20) null,
// 	estSunat varchar(20) null,
// 	estado bit NOT NULL


// )


const getEmpresas = async function (req, res) {
    console.log('entro a getEmpresas', req.user);
    
    if (req.user) {
        if (req.user.rol == 'Administrador') {
            console.log('req.user.rol');
            try {
                const pool = await sql.connect(dbConfig);
                const result = await pool
                    .request()
                    .query('SELECT * FROM Empresas');
                // res.json(result.recordset);
                // console.log('result.recordset');
                // console.log(result.recordset);
                console.log('result:', result.recordset);
                res.status(200).send({ data: result.recordset });
            } catch (error) {
                console.error('Error al obtener las epresas:', error);
                res.status(200).send({ data: undefined });
            }
        } else {
            res.status(500).send({ message: 'No Access' });
        }



    }
    else {
        res.status(500).send({ message: 'No Access' });
    }
};



const getEmpresasById = async function (req, res) {
    console.log('entro a getEmpresasById', req.user.empresa);
    const id = req.user.empresa;

    if (req.user) {
        if(req.user.rol=='Administrador'){
            console.log('req.user.rol:');
            try {
                const pool = await sql.connect(dbConfig);
                let result = await pool
                    .request()
                    .input('idEmpresa', sql.UniqueIdentifier, id)
                    .query('SELECT * FROM Empresas WHERE idEmpresa = @idEmpresa');

                console.log('result:', result.recordset);
                //res.json(result.recordset);
                res.status(200).send({ data: result.recordset });
            } catch (error) {
                console.error('Error al obtener los usuarios:', error);
                res.status(500).send({ data: undefined });
            }
        }else{
            res.status(500).send({ message: 'No Autorizado' });

        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }
};

const getEmpresa_id = async function (req, res) {
    const id = req.user.empresa;
    if (!req.user) {
        return res.status(401).send({ message: 'No autorizado' });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool
            .request()
            .input('idEmpresa', sql.UniqueIdentifier, id)
            .query(
                'SELECT e.logo, e.razon_Social AS nombre, e.ruc, e.rubro, e.correo, e.celular AS telefono, ' +
                'ISNULL(s.direccion, de.direccion) AS direccion, e.idRubro, r.codigo AS codigoRubro, s.idSucursal AS idSucursalPrincipal ' +
                'FROM Empresas e ' +
                'LEFT JOIN Sucursal s ON s.idEmpresa = e.idEmpresa AND s.esPrincipal = 1 ' +
                'LEFT JOIN DireccionEmpresa de ON e.idEmpresa = de.idEmpresa AND de.principal = 1 ' +
                'LEFT JOIN Rubros r ON e.idRubro = r.idRubro ' +
                'WHERE e.idEmpresa = @idEmpresa'
            );
        res.status(200).send({ data: result.recordset });
    } catch (error) {
        console.error('Error al obtener empresa (getEmpresa_id):', error);
        res.status(500).send({ data: undefined });
    }
};

const empresaService = require('../services/empresa.service');
const factilizaRepository = require('../repositories/factiliza.repository');
const whatsappFactilizaService = require('../services/whatsappFactiliza.service');

const NOMBRE_SERVICIO_WHATSAPP = 'Factiliza WHATSAPP';

/** Envía código de activación por WhatsApp vía Factiliza (FactilizaConfig 'Factiliza WHATSAPP'). Sin sesión. */
async function enviarCodigoActivacionFactiliza(pool, telefono, codigo) {
  const config = await factilizaRepository.getConfigByNombre(pool, NOMBRE_SERVICIO_WHATSAPP);
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/4cdb12f7-f0e0-45f1-8edf-c7587f720407',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e8165b'},body:JSON.stringify({sessionId:'e8165b',location:'enviarCodigoActivacionFactiliza:config',message:'config loaded',data:{hasConfig:!!config,hasToken:!!(config&&config.tokenDefault),hasParametroRuta:!!(config&&config.parametroRuta)},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
  // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4cdb12f7-f0e0-45f1-8edf-c7587f720407',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e8165b'},body:JSON.stringify({sessionId:'e8165b',location:'enviarCodigoActivacionFactiliza:result',message:'sendText result',data:{success:resultado.success,message:resultado.message},timestamp:Date.now(),hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    if (resultado.success) {
      return { sent: true };
    }
    return { sent: false, error: resultado.message || 'Error al enviar por WhatsApp.' };
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4cdb12f7-f0e0-45f1-8edf-c7587f720407',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e8165b'},body:JSON.stringify({sessionId:'e8165b',location:'enviarCodigoActivacionFactiliza:catch',message:'catch',data:{message:err?.message},timestamp:Date.now(),hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    console.error('Error enviando código activación Factiliza WHATSAPP:', err.message);
    return { sent: false, error: err.message || 'Error al enviar por WhatsApp.' };
  }
}

const createEmpresa = async function (req, res) {
    console.log('entro a createEmpresa', req.body);
    const { idDocumento, ruc, razon_Social, nombre_Comercial, rubro, celular, logo, correo, password, alias, condicion, estSunat } = req.body;

    const currentDate = moment().format('YYYY-MM-DD');
    const fregistro = currentDate;
    console.log(currentDate);

    const pool = await sql.connect(dbConfig);

    // Verificar si el correo electrónico ya existe
    const checkEmailQuery = await pool
        .request()
        .input('Ruc', sql.VarChar, ruc)
        .query('SELECT * FROM Empresas WHERE ruc = @ruc');

    console.log('checkEmailQuery.recordset:', checkEmailQuery.recordset);

    if (checkEmailQuery.recordset.length > 0) {

        return res.status(200).send({ message: 'La Empresa ya existe. Por favor registre una empresa diferente', data: undefined });
    } else {
        try {
            // Convertir buffer a cadena base64
            const hashedPassword = await bcrypt.hash(password, 8); // El número 10 es el factor de coste para el cifrado
            //crear el idUsuario con uuidv4
            const idEmpresa = uuidv4();

            const pool = await sql.connect(dbConfig);
            const result = await pool
                .request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('idDocumento', sql.VarChar(1), idDocumento)
                .input('ruc', sql.VarChar, ruc)
                .input('razon_Social', sql.VarChar, razon_Social)
                .input('nombreComercial', sql.VarChar, nombre_Comercial)
                .input('rubro', sql.VarChar, rubro)
                .input('idRubro', sql.Int, req.body.idRubro || null)
                .input('celular', sql.VarChar, celular)
                .input('correo', sql.VarChar, correo)
                .input('password', sql.Text, hashedPassword)
                .input('logo', sql.VarBinary(sql.MAX), null)
                .input('alias', sql.VarChar, alias)
                .input('condicion', sql.VarChar, condicion)
                .input('estSunat', sql.VarChar, estSunat)
                .input('estado', sql.Bit, 0) // Empresa deshabilitada hasta verificar código
                .input('fregistro', sql.DateTime, fregistro)
                .query('INSERT INTO Empresas (idEmpresa, idDocumento, ruc, razon_Social, nombreComercial, rubro, idRubro, celular, correo, password, logo, alias, condicion, estSunat, estado, fregistro) VALUES (@idEmpresa, @idDocumento, @ruc, @razon_Social, @nombreComercial, @rubro, @idRubro, @celular, @correo, @password, @logo, @alias, @condicion, @estSunat, @estado, @fregistro)');


            console.log('✓ Empresa creada con ID:', idEmpresa);

            // Inicializar datos maestros de la empresa (roles, comprobantes, sucursal, etc.)
            try {
                const datosEmpresa = {
                    razon_Social,
                    correo,
                    celular,
                    direccion: req.body.direccion || 'Sin dirección'
                };
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/4cdb12f7-f0e0-45f1-8edf-c7587f720407',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c0e71'},body:JSON.stringify({sessionId:'3c0e71',location:'empresasController.createEmpresa:datosEmpresa',message:'datosEmpresa before inicializar',data:{reqBodyDireccion:req.body.direccion,datosEmpresaDireccion:datosEmpresa.direccion},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
                // #endregion
                const resultadoInicializacion = await empresaService.inicializarDatosEmpresa(pool, idEmpresa, datosEmpresa);
                
                console.log('✅ Datos maestros inicializados:', {
                    roles: resultadoInicializacion.roles.length,
                    comprobantes: resultadoInicializacion.comprobantes.length,
                    sucursal: resultadoInicializacion.sucursal ? 'OK' : 'ERROR',
                    secuencias: resultadoInicializacion.secuencias.length,
                    errores: resultadoInicializacion.errores.length
                });

                await empresaService.insertarEmpresaIntegraciones(pool, idEmpresa);
                await empresaService.marcarEmpresaPrincipalSiEsPrimera(pool, idEmpresa);

                // Crear registro de verificación y enviar código por WhatsApp (Factiliza WHATSAPP desde FactilizaConfig)
                const verificacion = await empresaService.crearRegistroVerificacionEmpresa(pool, idEmpresa, celular);
                const resultadoWhatsApp = await enviarCodigoActivacionFactiliza(pool, celular, verificacion.codigo);

                const mensaje = resultadoWhatsApp.sent
                    ? 'Empresa creada. Se envió un código de verificación por WhatsApp para activar la cuenta.'
                    : 'Empresa creada. ' + (resultadoWhatsApp.error || 'No se pudo enviar el código por WhatsApp; puede usar "Reenviar código" más tarde.');

                res.status(200).send({
                    data: idEmpresa,
                    sucursalPrincipal: resultadoInicializacion.sucursal?.idSucursal,
                    mensaje,
                    codigoEnviado: resultadoWhatsApp.sent
                });
            } catch (errorInicializacion) {
                console.error('⚠️ Error inicializando datos maestros:', errorInicializacion);
                res.status(200).send({ 
                    data: idEmpresa,
                    warning: 'Empresa creada pero algunos datos maestros no se inicializaron correctamente. Se enviará el código de verificación igualmente.'
                });
            }
        }
        catch (error) {
            console.error('Error al crear la Empresa:', error);
            res.status(500).send({ data: undefined });
        }
    }
}

// Integraciones y APIs de pago (empresa del usuario logueado)
const getIntegraciones = async function (req, res) {
    try {
        const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
        if (!idEmpresa) {
            return res.status(401).send({ message: 'No autorizado', data: undefined });
        }
        const pool = await sql.connect(dbConfig);
        const [integracionesRes, credencialesRes] = await Promise.all([
            pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .query('SELECT * FROM EmpresaIntegraciones WHERE idEmpresa = @idEmpresa'),
            pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .query('SELECT proveedor, clave, valor, idCredencial FROM EmpresaApiCredenciales WHERE idEmpresa = @idEmpresa AND activo = 1')
        ]);
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
    } catch (error) {
        console.error('Error al obtener integraciones:', error);
        res.status(500).send({ message: 'Error al obtener integraciones', data: undefined });
    }
};

const putIntegraciones = async function (req, res) {
    try {
        const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
        if (!idEmpresa) {
            return res.status(401).send({ message: 'No autorizado', data: undefined });
        }
        const { twilioHabilitado, izipayHabilitado, culqiHabilitado, apisPeruHabilitado, factilizaHabilitado } = req.body || {};
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('twilio', sql.Bit, twilioHabilitado ? 1 : 0)
            .input('izipay', sql.Bit, izipayHabilitado ? 1 : 0)
            .input('culqi', sql.Bit, culqiHabilitado ? 1 : 0)
            .input('apisPeru', sql.Bit, apisPeruHabilitado ? 1 : 0)
            .input('factiliza', sql.Bit, factilizaHabilitado ? 1 : 0)
            .query(`
                MERGE EmpresaIntegraciones AS t
                USING (SELECT @idEmpresa AS idEmpresa) AS s ON t.idEmpresa = s.idEmpresa
                WHEN MATCHED THEN
                    UPDATE SET twilioHabilitado = @twilio, izipayHabilitado = @izipay, culqiHabilitado = @culqi,
                        apisPeruHabilitado = @apisPeru, factilizaHabilitado = @factiliza, fActualizacion = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (idEmpresa, twilioHabilitado, izipayHabilitado, culqiHabilitado, apisPeruHabilitado, factilizaHabilitado, fActualizacion)
                    VALUES (@idEmpresa, @twilio, @izipay, @culqi, @apisPeru, @factiliza, GETDATE());
            `);
        res.status(200).send({ data: { ok: true }, message: 'Integraciones actualizadas.' });
    } catch (error) {
        console.error('Error al actualizar integraciones:', error);
        res.status(500).send({ message: 'Error al actualizar integraciones', data: undefined });
    }
};

const putCredencialesProveedor = async function (req, res) {
    try {
        const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
        if (!idEmpresa) {
            return res.status(401).send({ message: 'No autorizado', data: undefined });
        }
        const { proveedor, credenciales } = req.body || {};
        if (!proveedor || !Array.isArray(credenciales)) {
            return res.status(400).send({ message: 'proveedor y credenciales (array) son requeridos', data: undefined });
        }
        const pool = await sql.connect(dbConfig);
        const proveedorNorm = String(proveedor).toLowerCase().trim();
        await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('proveedor', sql.VarChar(50), proveedorNorm)
            .query('DELETE FROM EmpresaApiCredenciales WHERE idEmpresa = @idEmpresa AND proveedor = @proveedor');
        for (const item of credenciales) {
            const clave = String(item.clave || '').trim();
            const valor = String(item.valor ?? '').trim();
            if (!clave) continue;
            await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('proveedor', sql.VarChar(50), proveedorNorm)
                .input('clave', sql.VarChar(100), clave)
                .input('valor', sql.NVarChar(500), valor)
                .query('INSERT INTO EmpresaApiCredenciales (idEmpresa, proveedor, clave, valor, activo) VALUES (@idEmpresa, @proveedor, @clave, @valor, 1)');
        }
        res.status(200).send({ data: { ok: true }, message: 'Credenciales guardadas.' });
    } catch (error) {
        console.error('Error al guardar credenciales:', error);
        res.status(500).send({ message: 'Error al guardar credenciales', data: undefined });
    }
};

// Ruta pública: enviar código de activación por WhatsApp (sin sesión). Usa Factiliza WHATSAPP desde FactilizaConfig.
const enviarCodigoActivacion = async function (req, res) {
    console.log('entro a enviarCodigoActivacion', req.body);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4cdb12f7-f0e0-45f1-8edf-c7587f720407',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e8165b'},body:JSON.stringify({sessionId:'e8165b',location:'empresasController.enviarCodigoActivacion:entry',message:'enviarCodigoActivacion entered',data:{hasBody:!!req.body,idEmpresa:req.body?.idEmpresa!=null},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    try {
        const { idEmpresa, celular } = req.body || {};
        const idEmpresaTrim = idEmpresa != null ? String(idEmpresa).trim() : '';
        if (!idEmpresaTrim) {
            return res.status(400).json({ message: 'idEmpresa es requerido' });
        }
        const pool = await sql.connect(dbConfig);
        const emp = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresaTrim)
            .query('SELECT idEmpresa, celular, estado FROM Empresas WHERE idEmpresa = @idEmpresa');
        const empresa = emp.recordset[0];
        if (!empresa) {
            return res.status(404).json({ message: 'Empresa no encontrada' });
        }
        // estado en BD es bit: puede llegar como 0/1 o false/true desde mssql
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
            return res.status(500).json({ message: 'Error al generar código de verificación' });
        }
        const resultado = await enviarCodigoActivacionFactiliza(pool, telefono, codigoEnviar);
        if (!resultado.sent) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/4cdb12f7-f0e0-45f1-8edf-c7587f720407',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e8165b'},body:JSON.stringify({sessionId:'e8165b',location:'empresasController.enviarCodigoActivacion:503',message:'returning 503',data:{error:resultado.error},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            return res.status(503).json({ message: resultado.error || 'No se pudo enviar el código por WhatsApp' });
        }
        res.status(200).json({ message: 'Código enviado por WhatsApp' });
    } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/4cdb12f7-f0e0-45f1-8edf-c7587f720407',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e8165b'},body:JSON.stringify({sessionId:'e8165b',location:'empresasController.enviarCodigoActivacion:catch',message:'catch',data:{message:error?.message},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        console.error('Error en enviarCodigoActivacion:', error);
        res.status(500).json({ message: error.message || 'Error al enviar código' });
    }
};

// Verificar empresa con código enviado por WhatsApp
const verificarEmpresaCodigo = async function (req, res) {
    try {
        const { idEmpresa, codigo } = req.body || {};
        if (!idEmpresa || !codigo) {
            return res.status(400).send({ message: 'idEmpresa y código son requeridos', data: undefined });
        }
        const pool = await sql.connect(dbConfig);
        const resultado = await empresaService.verificarEmpresaPorCodigo(pool, idEmpresa, String(codigo).trim());
        if (!resultado.ok) {
            return res.status(400).send({ message: resultado.message || 'Código inválido', data: undefined });
        }
        res.status(200).send({ data: { ok: true }, message: 'Empresa verificada y habilitada correctamente.' });
    } catch (error) {
        console.error('Error al verificar empresa por código:', error);
        res.status(500).send({ message: 'Error al verificar empresa', data: undefined });
    }
};



const updateEmpresa = async function (req, res) {
    try {
        console.log('Datos recibidos:', req.body);
        console.log('Archivo recibido:', req.file);

        const idEmpresa = req.user.empresa;
        const {
            ruc, correo, celular, nombreComercial, 
            alias, rubro, idRubro, logoAnterior
        } = req.body;

        // Validación básica
        if ( req.user.rol !== 'Administrador') {
            return res.status(401).send({ success: false, message: 'No autorizado' });
        }

        const pool = await sql.connect(dbConfig);
        let query = `
            UPDATE Empresas SET 
                Rubro = @Rubro,
                idRubro = @idRubro,
                Celular = @Celular,
                nombreComercial = @nombreComercial,
                Correo = @Correo,
                Alias = @Alias
        `;

        // Parámetros base
        const request = pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('Rubro', sql.VarChar, rubro || '')
            .input('idRubro', sql.Int, idRubro != null && idRubro !== '' ? (typeof idRubro === 'string' ? parseInt(idRubro, 10) : idRubro) : null)
            .input('Celular', sql.VarChar, celular || '')
            .input('nombreComercial', sql.VarChar, nombreComercial || '')
            .input('Correo', sql.VarChar, correo || '')
            .input('Alias', sql.VarChar, alias || '');

        // Si hay nueva imagen
        if (req.file) {
            query += ', Logo = @Logo';
            request.input('Logo', sql.VarChar, req.file.filename);

            // Eliminar imagen anterior si existe
            if (logoAnterior && logoAnterior !== 'undefined' && logoAnterior !== 'null') {
                try {
                    const oldPath = path.join(__dirname, '../uploads/configuraciones/', logoAnterior);
                    await fs.promises.unlink(oldPath);
                    console.log('Imagen anterior eliminada:', logoAnterior);
                } catch (err) {
                    console.warn('No se pudo eliminar la imagen anterior:', err.message);
                }
            }
        }

        query += ' WHERE idEmpresa = @idEmpresa';

        const result = await request.query(query);

        res.status(200).json({
            success: true,
            message: 'Empresa actualizada correctamente',
            data: {
                rowsAffected: result.rowsAffected,
                newLogo: req.file ? req.file.filename : null
            }
        });

    } catch (error) {
        console.error('Error en updateEmpresa:', error);
        
        // Eliminar archivo subido si hubo error después de la subida
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }

        res.status(500).json({
            success: false,
            message: 'Error al actualizar empresa',
            //error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
};

const cambiar_estado_empresa = async function (req, res) {
    console.log('entro a cambiar_estado_empresa', req.params);
    if (req.user) {
        let idEmpresa = req.params['id'];
        const { estado } = req.body;

        if (!estado) {
            nuevo_estado = true;
        } else {
            nuevo_estado = false;
        }

        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool
                .request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('estado', sql.Bit, nuevo_estado)
                .query('UPDATE Empresas SET estado = @estado WHERE idEmpresa = @idEmpresa');
            res.status(200).send({ data: result.rowsAffected });
        } catch (error) {
            console.error('Error al cambiar el estado de la empresa:', error);
            res.status(500).send({ data: undefined });

        }

    }
}

// const obtener_logo = async function (req, res) {
//     console.log('entro a obtener_logo', req.params);
//     //var img = req.params['img'];
//     var img = '01.jpg';


//     fs.stat('./uploads/configuraciones/' + img, function (err) {
//         if (!err) {
//             let path_img = './uploads/configuraciones/' + img;
//             res.status(200).sendFile(path.resolve(path_img));
//         } else {
//             let path_img = '../public/assets/img/01.jpg';
//             res.status(200).sendFile(path.resolve(path_img));
//         }

//         //console.log('path_img', path_img);
//     })
// }



const obtener_logo = async function (req, res) {
    try {
        console.log('Solicitud para obtener logo:', req.params.img);
        
        const img = req.params.img || 'default.jpg';
        const logoPath = path.join(__dirname, '../uploads/configuraciones/', img);
        
        console.log('Ruta del logo:', logoPath);
        // Verificar si existe el archivo
        try {
            await fs.access(logoPath);
            return res.sendFile(logoPath);
        } catch (err) {
            console.log('Logo no encontrado, usando default:', err.message);
            const defaultPath = path.join(__dirname, '../public/assets/img/01.jpg');
            return res.sendFile(defaultPath);
        }
    } catch (error) {
        console.error('Error al obtener logo:', error);
        res.status(500).send('Error al obtener la imagen');
    }
};


const obtener_datos_colaborador_admin = async (req, res) => {
    const { id } = req.params;
    let data;

    if (req.user) {

        try {

            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query('SELECT * FROM usuarioWeb where id =' + id);
            // const result = await pool
            //     .request()
            //     .input('id', sql.Int, id)
            //     .query('SELECT * FROM usuarioWeb WHERE email = @id');
            // res.json({ message: 'Usuario actualizado correctamente' });
            console.log(result.recordset);
            data = result.recordset;
            console.log('data: ', data);
            // res.status(200).send({data: data });
            res.json({ data });


        } catch (error) {
            console.error('Error al actualizar un usuario:', error);
            // res.status(500).send('Error al actualizar un usuario');
            res.status(200).send({ message: 'Error al actualizar un usuario', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }
};

const cambiar_estado_colaborador_admin = async function (req, res) {
    if (req.user) {
        let id = req.params['id'];
        let data = req.body;
        let estado = data.estado;

        let nuevo_estado;

        console.log('cambiar_estado_colaborador_admin: ', data);
        console.log('id: ', id);


        if (data.estado) {
            nuevo_estado = false;
        } else if (!data.estado) {
            nuevo_estado = true;
        }

        console.log('nuevo estado: ', nuevo_estado);

        const pool = await sql.connect(dbConfig);
        const result = await pool
            .request()
            .input('id', sql.Int, id)
            .input('estado', sql.Bit, nuevo_estado)
            .query('UPDATE usuarioWeb SET estado = @estado WHERE id = @id');
        console.log(result.recordset);
        res.status(200).send({ data: result.recordset });

    } else {
        res.status(403).send({ data: undefined, message: 'NoToken' });
    }
}




const deleteAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool
            .request()
            .input('id', sql.Int, id)
            .query('DELETE FROM usuarioWeb WHERE id = @id');
        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar un Usuario:', error);
        res.status(500).send('Error al eliminar un Usuario');
    }
};




const createDireccionEmpresa = async function (req, res) {
    try {
        const idEmpresa = (req.user && (req.user.empresa || req.user.idEmpresa)) ? (req.user.empresa || req.user.idEmpresa) : req.body.idEmpresa;
        if (!idEmpresa) {
            return res.status(400).send({ message: 'idEmpresa requerido', data: undefined });
        }
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

        let pool = await sql.connect(dbConfig);
        let insertDireccionEmpresa = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('ubigeo', sql.VarChar, ubigeo)
            .input('codPais', sql.VarChar, codPais)
            .input('region', sql.VarChar, region)
            .input('provincia', sql.VarChar, provincia)
            .input('distrito', sql.VarChar, distrito)
            .input('urbanizacion', sql.VarChar, urbanizacion)
            .input('direccion', sql.VarChar, direccion)
            .input('codLocal', sql.VarChar, codLocal)
            .input('principal', sql.Bit, principal)
            //.input('idUsuario', sql.UniqueIdentifier, idUsuario)
            //.input('nombre', sql.VarChar, nombre)
            .query('insert into DireccionEmpresa (idEmpresa,ubigeo,codPais,region,provincia,distrito,urbanizacion,direccion,codLocal, principal) values (@idEmpresa,@ubigeo,@codPais,@region,@provincia,@distrito,@urbanizacion,@direccion,@codLocal,@principal)');

        // Si es dirección principal, actualizar la sucursal principal para que tenga la misma dirección (gestión de ubicaciones usa sucursal principal)
        if (principal) {
            const dirTexto = (direccion != null && direccion !== undefined) ? String(direccion).trim() : '';
            await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('direccion', sql.VarChar(200), dirTexto || null)
                .query("UPDATE Sucursal SET direccion = @direccion WHERE idEmpresa = @idEmpresa AND nombre = 'Sucursal Principal'");
        }

        // Crear sucursal solo si el usuario indica crearSucursal y nombreSucursal (nueva dirección = nueva sucursal con nombre elegido)
        if (req.body.crearSucursal === true && req.body.nombreSucursal && String(req.body.nombreSucursal).trim()) {
            const idSucursal = uuidv4();
            await pool.request()
                .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('nombre', sql.VarChar, String(req.body.nombreSucursal).trim())
                .input('direccion', sql.VarChar, direccion || '')
                .input('fregistro', sql.DateTime, moment().format('YYYY-MM-DD'))
                .input('estado', sql.Bit, true)
                .query('INSERT INTO Sucursal (idSucursal, idEmpresa, nombre, direccion, fRegistro, estado) VALUES (@idSucursal, @idEmpresa, @nombre, @direccion, @fregistro, @estado)');
        }

        res.status(200).send({ data: insertDireccionEmpresa.rowsAffected });
    } catch (error) {
        console.log('error', error);
        res.status(500).send({ message: error.message, data: undefined });

    }

    //     }
    //     else {
    //         res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    //     }
    // }
    // else {
    //     res.status(500).send({ message: 'No Access' });
    // }

}

//crear sucursal de la empresa 


//crear el metodo const createSucursalEmpresa con los parametros del metodo const createDireccionEmpresa
/**
 * Crear sucursal (para nueva dirección con nombre elegido por el usuario).
 * Body: idEmpresa, nombre (obligatorio), direccion (opcional).
 */
const createSucursalEmpresa = async function (req, res) {
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
        const idSucursal = uuidv4();
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('nombre', sql.VarChar, nombre)
            .input('direccion', sql.VarChar, direccion)
            .input('fregistro', sql.DateTime, moment().format('YYYY-MM-DD'))
            .input('estado', sql.Bit, true)
            .query('INSERT INTO Sucursal (idSucursal, idEmpresa, nombre, direccion, fRegistro, estado) VALUES (@idSucursal, @idEmpresa, @nombre, @direccion, @fregistro, @estado)');

        res.status(200).send({ data: { idSucursal, nombre, direccion }, message: 'Sucursal creada' });
    } catch (error) {
        console.error('createSucursalEmpresa:', error);
        res.status(500).send({ message: error.message || 'Error al crear sucursal', data: undefined });
    }
};

const updateDireccionEmpresa = async function (req, res) {
    console.log('entro a updateDireccionEmpresa', req.body);
    const { idDireccionEmpresa, ubigeo, codPais, region, provincia, distrito, urbanizacion, direccion, codLocal, principal } = req.body;
    const id = idDireccionEmpresa;

    if (req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                const pool = await sql.connect(dbConfig);
                const result = await pool
                    .request()
                    .input('id', sql.Int, id)
                    .input('ubigeo', sql.VarChar, ubigeo)
                    .input('codPais', sql.VarChar, codPais)
                    .input('region', sql.VarChar, region)
                    .input('provincia', sql.VarChar, provincia)
                    .input('distrito', sql.VarChar, distrito)
                    .input('urbanizacion', sql.VarChar, urbanizacion)
                    .input('direccion', sql.VarChar, direccion)
                    .input('codLocal', sql.VarChar, codLocal)
                    .input('principal', sql.Bit, principal)
                    .query('UPDATE DireccionEmpresa SET ubigeo = @ubigeo, codPais = @codPais, region = @region, provincia = @provincia, distrito = @distrito, urbanizacion = @urbanizacion, direccion = @direccion, codLocal = @codLocal, principal = @principal WHERE idDireccionEmpresa = @id');
                if (principal) {
                    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
                    if (idEmpresa) {
                        const dirTexto = (direccion != null && direccion !== undefined) ? String(direccion).trim() : '';
                        await pool.request()
                            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                            .input('direccion', sql.VarChar(200), dirTexto || null)
                            .query("UPDATE Sucursal SET direccion = @direccion WHERE idEmpresa = @idEmpresa AND nombre = 'Sucursal Principal'");
                    }
                }
                res.status(200).send({ data: result.rowsAffected });
            } catch (error) {
                console.error('Error al actualizar un DireccionEmpresa:', error);
                res.status(500).send('Error al actualizar un DireccionEmpresa');
            }
        }
        else {
            res.status(401).send({ message: 'No Access' });
        }
    } else {
        res.status(401).send({ message: 'No Access' });
    }
}

const getDireccionEmpresa_id = async function (req, res) {
    
    const idEmpresa = req.user.empresa;
    console.log('entro a getDireccionEmpresa_id', idEmpresa);
    if (req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                const pool = await sql.connect(dbConfig);
                const result = await pool
                    .request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .query('SELECT * FROM DireccionEmpresa WHERE idEmpresa = @idEmpresa');
                res.status(200).send({ data: result.recordset });
            } catch (error) {
                console.error('Error al obtener las direcciones de la empresa:', error);
                res.status(500).send('Error al obtener las direcciones de la empresa');
            }
        }
        else {
            res.status(401).send({ message: 'No Access' });
        }

    } else {
        res.status(401).send({ message: 'No Access' });
    }
}

// const eliminarDirecion_id
const deleteDireccion_id = async function (req,res) {
    const idDireccionEmpresa = req.params['id'];
    

    if( req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                const pool = await sql.connect(dbConfig);
                const result = await pool
                    .request()
                    .input('idDireccionEmpresa', sql.Int, idDireccionEmpresa)
                    .query('DELETE FROM DireccionEmpresa WHERE idDireccionEmpresa = @idDireccionEmpresa');
                res.status(200).send({ data: result.rowsAffected });
            } catch (error) {
                console.error('Error al eliminar la direccion de la empresa:', error);
                res.status(500).send('Error al eliminar la direccion de la empresa');
            }
        }
        else {
            res.status(401).send({ message: 'No Access' });
        }

    } else {
        res.status(401).send({ message: 'No Access' });
    }
}

//convertir en principal la direccion de la empresa por su idDireccionEmpresa y el resro de direcciones en false
const cambiar_principal_direccion = async function (req, res) {
    console.log('entro a cambiar_principal_direccion', req.body, req.params);
    const idDireccionEmpresa = req.params.id;
    const idEmpresa = req.user.empresa;

    if (req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                const pool = await sql.connect(dbConfig);
                const result = await pool
                    .request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .query('UPDATE DireccionEmpresa SET principal = 0 WHERE idEmpresa = @idEmpresa');
                //res.status(200).send({ data: result.rowsAffected });
                if (result.rowsAffected > 0) {
                    //console.log('result.rowsAffected:', result.rowsAffected);
                    try {
                        const pool = await sql.connect(dbConfig);
                        const result = await pool
                            .request()
                            .input('idDireccionEmpresa', sql.Int, idDireccionEmpresa)
                            .query('UPDATE DireccionEmpresa SET principal = 1 WHERE idDireccionEmpresa = @idDireccionEmpresa');
                        res.status(200).send({ data: result.rowsAffected });
                    } catch (error) {
                        console.error('Error al cambiar la direccion principal1:', error);
                        res.status(500).send('Error al cambiar la direccion principal');
                    }
                }


            } catch (error) {
                console.error('Error al cambiar la direccion principal0:', error);
                res.status(500).send('Error al cambiar la direccion principal');
            }


        }
        else {
            res.status(401).send({ message: 'No Access' });
        }
    } else {
        res.status(401).send({ message: 'No Access' });
    }
}

const getEstadoConfiguracion = async function (req, res) {
    console.log('getEstadoConfiguracion - Usuario:', req.user);
    
    if (!req.user || !req.user.empresa) {
        return res.status(401).send({ message: 'No autorizado', data: undefined });
    }

    try {
        const pool = await sql.connect(dbConfig);
        const estado = await empresaService.obtenerEstadoConfiguracion(pool, req.user.empresa);
        
        console.log('Estado de configuración:', estado);
        res.status(200).send({ data: estado });
    } catch (error) {
        console.error('Error obteniendo estado de configuración:', error);
        res.status(500).send({ message: 'Error al obtener estado de configuración', data: undefined });
    }
};

module.exports = {
    // getEmpresas,
    getEmpresas,
    createEmpresa,
    updateEmpresa,
    cambiar_estado_empresa,
    deleteAdmin,
    // admin_login,
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

    //logo,
    obtener_logo,
    getEmpresa_id,

    // sucursales
    createSucursalEmpresa,

    // Estado de configuración
    getEstadoConfiguracion,

    //direcciones de la empresa




};