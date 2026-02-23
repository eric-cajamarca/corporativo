const { v4: uuidv4 } = require('uuid');

/**
 * Obtiene datos de empresa/usuario para la respuesta de getEmpresa_login (verificación de token).
 * req.user viene del JWT decodificado (adminLogin).
 */
exports.getDatosEmpresaLogin = async (pool, user) => {
    if (!user) return null;
    return {
        razonSocial: user.razonSocial || '',
        nombres: user.nombres || '',
        apellidos: user.apellidos || '',
        email: user.email || '',
        rol: user.rol || 'Administrador',
        roles: user.rol || 'Administrador' // frontend usa response.data.roles
    };
};

/**
 * Crea los roles predeterminados para una nueva empresa
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @returns {Array} Array con los IDs de los roles creados
 */
exports.crearRolesPredeterminados = async (pool, idEmpresa) => {
    console.log('Creando roles predeterminados para empresa:', idEmpresa);
    
    const sql = require('mssql');
    
    const rolesPredeterminados = [
        { descripcion: 'Administrador', estado: 1 },
        { descripcion: 'Vendedor', estado: 1 },
        { descripcion: 'Almacenero', estado: 1 },
        { descripcion: 'Contador', estado: 1 }
    ];

    const rolesCreados = [];

    try {
        for (const rol of rolesPredeterminados) {
            const idRol = uuidv4();
            
            await pool.request()
                .input('idRol', sql.UniqueIdentifier, idRol)
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('descripcion', sql.VarChar(50), rol.descripcion)
                .input('estado', sql.Bit, rol.estado)
                .query(`
                    INSERT INTO Rol (idRol, idEmpresa, descripcion, estado, fCreacion)
                    VALUES (@idRol, @idEmpresa, @descripcion, @estado, GETDATE())
                `);

            rolesCreados.push({ idRol, descripcion: rol.descripcion });
            console.log(`Rol creado: ${rol.descripcion} (${idRol})`);
        }

        console.log(`✓ ${rolesCreados.length} roles predeterminados creados`);
        return rolesCreados;

    } catch (error) {
        console.error('Error creando roles predeterminados:', error);
        throw new Error('Error al crear roles predeterminados: ' + error.message);
    }
};

/**
 * Crea los comprobantes predeterminados para una nueva empresa
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @returns {Array} Array con los comprobantes creados
 */
exports.crearComprobantesPredeterminados = async (pool, idEmpresa) => {
    console.log('Creando comprobantes predeterminados para empresa:', idEmpresa);
    
    const sql = require('mssql');
    
    const comprobantesPredeterminados = [
        { codigo: '01', nombre: 'Factura Electronica', serie: 'F001', numero: 0, activo: 1 },
        { codigo: '03', nombre: 'Boleta Electrónica', serie: 'B001', numero: 0, activo: 1 },
        { codigo: '07', nombre: 'Nota de Crédito Electrónica', serie: 'FC01', numero: 0, activo: 1 },
        { codigo: '08', nombre: 'Nota de Débito Electrónica', serie: 'FD01', numero: 0, activo: 1 },
        { codigo: '09', nombre: 'Guía de Remisión Electrónica', serie: 'T001', numero: 0, activo: 1 },
        { codigo: 'RA', nombre: 'Comunicación de baja', serie: '-', numero: 0, activo: 1 },
        { codigo: 'RC', nombre: 'Resumen diario', serie: '-', numero: 0, activo: 1 },
        { codigo: 'NV', nombre: 'Nota de venta', serie: 'NV01', numero: 0, activo: 1 },
        { codigo: 'CT', nombre: 'Cotización', serie: 'CT01', numero: 0, activo: 1 },
        { codigo: 'RE', nombre: 'Recibo de Egreso', serie: 'RE01', numero: 0, activo: 1 },
        { codigo: 'RI', nombre: 'Recibo de Ingreso', serie: 'RI01', numero: 0, activo: 1 },
        { codigo: 'RP', nombre: 'Recibo de pago', serie: 'RP01', numero: 0, activo: 1 },
        { codigo: 'TK', nombre: 'Ticket de despacho', serie: 'TK01', numero: 0, activo: 1 },
        { codigo: 'NE', nombre: 'Nota de envío', serie: 'NE01', numero: 0, activo: 1 }

    ];

    const comprobantesCreados = [];

    try {
        for (const comp of comprobantesPredeterminados) {
            const result = await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('codigo', sql.VarChar(2), comp.codigo)
                .input('nombre', sql.VarChar(50), comp.nombre)
                .input('serie', sql.VarChar(4), comp.serie)
                .input('numero', sql.Int, comp.numero)
                .input('activo', sql.Bit, comp.activo)
                .query(`
                    INSERT INTO Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo)
                    OUTPUT INSERTED.idComprobante
                    VALUES (@idEmpresa, @codigo, @nombre, @serie, @numero, @activo)
                `);

            const idComprobante = result.recordset[0].idComprobante;
            comprobantesCreados.push({ idComprobante, ...comp });
            console.log(`Comprobante creado: ${comp.nombre} - ${comp.serie}`);
        }

        console.log(`✓ ${comprobantesCreados.length} comprobantes predeterminados creados`);
        return comprobantesCreados;

    } catch (error) {
        console.error('Error creando comprobantes predeterminados:', error);
        throw new Error('Error al crear comprobantes predeterminados: ' + error.message);
    }
};

/**
 * Crea la sucursal principal para una nueva empresa
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @param {Object} datosEmpresa - Datos de la empresa (razon_Social, direccion, etc.)
 * @returns {Object} Sucursal creada
 */
exports.crearSucursalPrincipal = async (pool, idEmpresa, datosEmpresa) => {
    console.log('Creando sucursal principal para empresa:', idEmpresa);
    
    const sql = require('mssql');
    const idSucursal = uuidv4();

    try {
        await pool.request()
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('nombre', sql.VarChar(50), 'Sucursal Principal')
            .input('direccion', sql.VarChar(200), datosEmpresa.direccion || 'Sin dirección')
            .input('telefono', sql.VarChar(20), datosEmpresa.celular || '')
            .input('estado', sql.Bit, 1)
            .query(`
                INSERT INTO Sucursal (idSucursal, idEmpresa, nombre, direccion, telefono, estado, fRegistro)
                VALUES (@idSucursal, @idEmpresa, @nombre, @direccion, @telefono, @estado, GETDATE())
            `);

        console.log(`✓ Sucursal principal creada: ${idSucursal}`);
        return { idSucursal, nombre: 'Sucursal Principal' };

    } catch (error) {
        console.error('Error creando sucursal principal:', error);
        throw new Error('Error al crear sucursal principal: ' + error.message);
    }
};

/**
 * Crea las secuencias iniciales para los comprobantes de la sucursal principal
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @param {String} idSucursal - ID de la sucursal principal
 * @param {Array} comprobantes - Array de comprobantes creados
 * @returns {Array} Secuencias creadas
 */
exports.crearSecuenciasIniciales = async (pool, idEmpresa, idSucursal, comprobantes) => {
    console.log('Creando secuencias iniciales para sucursal:', idSucursal);
    
    const sql = require('mssql');
    const secuenciasCreadas = [];

    try {
        for (const comp of comprobantes) {
            await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                .input('idComprobante', sql.VarChar(2), comp.codigo)
                .input('serie', sql.VarChar(4), comp.serie)
                .input('ultimoNumero', sql.Int, 0)
                .query(`
                    INSERT INTO Secuencias (idEmpresa, idSucursal, idComprobante, serie, ultimoNumero, fActualizacion)
                    VALUES (@idEmpresa, @idSucursal, @idComprobante, @serie, @ultimoNumero, GETDATE())
                `);

            secuenciasCreadas.push({ codigo: comp.codigo, serie: comp.serie });
            console.log(`Secuencia creada: ${comp.codigo} - ${comp.serie}`);
        }

        console.log(`✓ ${secuenciasCreadas.length} secuencias creadas`);
        return secuenciasCreadas;

    } catch (error) {
        console.error('Error creando secuencias:', error);
        throw new Error('Error al crear secuencias: ' + error.message);
    }
};

/**
 * Crea las ubicaciones predeterminadas para una sucursal
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idSucursal - ID de la sucursal
 * @returns {Array} Ubicaciones creadas
 */
exports.crearUbicacionesPredeterminadas = async (pool, idSucursal) => {
    console.log('Creando ubicaciones predeterminadas para sucursal:', idSucursal);
    
    const sql = require('mssql');
    
    const ubicacionesPredeterminadas = [
        
        { codigoUbicacion: 'ANDAMIO-1', prioridad: 1},
        { codigoUbicacion: 'ANDAMIO-2', prioridad: 2 },
        { codigoUbicacion: 'MOSTRADOR', prioridad: 3 },
    ];

    const ubicacionesCreadas = [];

    try {
        for (const ubi of ubicacionesPredeterminadas) {
            await pool.request()
                .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                .input('codigoUbicacion', sql.VarChar(20), ubi.codigoUbicacion)
                .input('prioridad', sql.Int, ubi.prioridad)
                .query(`
                    INSERT INTO UbicacionesPrioridad (idSucursal, codigoUbicacion, prioridad)
                    VALUES (@idSucursal, @codigoUbicacion, @prioridad)
                `);

            ubicacionesCreadas.push(ubi);
            console.log(`Ubicación creada: ${ubi.codigoUbicacion}`);
        }

        console.log(`✓ ${ubicacionesCreadas.length} ubicaciones predeterminadas creadas`);
        return ubicacionesCreadas;

    } catch (error) {
        console.error('Error creando ubicaciones predeterminadas:', error);
        throw new Error('Error al crear ubicaciones predeterminadas: ' + error.message);
    }
};

/**
 * Crea las listas de precios predeterminadas para una empresa
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @param {String} idSucursal - ID de la sucursal principal
 * @returns {Array} Listas de precios creadas
 */
exports.crearListasPreciosPredeterminadas = async (pool, idEmpresa, idSucursal) => {
    console.log('Creando listas de precios predeterminadas para empresa:', idEmpresa);
    
    const sql = require('mssql');
    
    // Estructura: idLista, idEmpresa, idSucursal, nombre, idMoneda, principal, conIgv, fechaInicio, fechaFin, activo, fCreacion
    const listasPredeterminadas = [
        { nombre: 'Precio Normal', principal: true, conIgv: true, idMoneda: 1 },
        { nombre: 'Precio Cliente', principal: true, conIgv: true, idMoneda: 1 },
        { nombre: 'Precio Mayorista', principal: true, conIgv: true, idMoneda: 1 },
    ];

    const listasCreadas = [];

    try {
        for (const lista of listasPredeterminadas) {
            const result = await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                .input('nombre', sql.VarChar(100), lista.nombre)
                .input('idMoneda', sql.Int, lista.idMoneda)
                .input('principal', sql.Bit, lista.principal ? 1 : 0)
                .input('conIgv', sql.Bit, lista.conIgv ? 1 : 0)
                .input('activo', sql.Bit, 1)
                .query(`
                    INSERT INTO ListasPrecio (idEmpresa, idSucursal, nombre, idMoneda, principal, conIgv, fechaInicio, activo, fCreacion)
                    OUTPUT INSERTED.idLista
                    VALUES (@idEmpresa, @idSucursal, @nombre, @idMoneda, @principal, @conIgv, GETDATE(), @activo, GETDATE())
                `);

            const idLista = result.recordset[0]?.idLista;
            listasCreadas.push({ idLista, ...lista });
            console.log(`Lista de precios creada: ${lista.nombre}`);
        }

        console.log(`✓ ${listasCreadas.length} listas de precios predeterminadas creadas`);
        return listasCreadas;

    } catch (error) {
        console.error('Error creando listas de precios predeterminadas:', error);
        throw new Error('Error al crear listas de precios predeterminadas: ' + error.message);
    }
};

/** Número por defecto del correlativo al crear una nueva empresa */
const NUMERO_CORRELATIVO_INICIAL = 10000;

/**
 * Crea el registro de correlativo inicial para una nueva empresa (códigos de producto con correlativo automático).
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @param {Number} numeroInicial - Número con el que empieza el correlativo (default 10000)
 * @returns {Object} { idCorrelativo, idEmpresa, numero }
 */
exports.crearCorrelativoInicial = async (pool, idEmpresa, numeroInicial = NUMERO_CORRELATIVO_INICIAL) => {
    const sql = require('mssql');
    try {
        const result = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('numero', sql.Int, numeroInicial)
            .query(`
                INSERT INTO Correlativos (idEmpresa, numero)
                OUTPUT INSERTED.idCorrelativo, INSERTED.idEmpresa, INSERTED.numero
                VALUES (@idEmpresa, @numero)
            `);
        const row = result.recordset[0];
        console.log(`✓ Correlativo inicial creado para empresa: numero=${row?.numero}`);
        return row;
    } catch (error) {
        console.error('Error creando correlativo inicial:', error);
        throw new Error('Error al crear correlativo inicial: ' + error.message);
    }
};

/**
 * Crea los conceptos predeterminados para una empresa
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @returns {Array} Conceptos creados
 */

exports.crearConceptosPredeterminados = async (pool, idEmpresa) => {
    console.log('Creando conceptos predeterminados para empresa:', idEmpresa);
    const sql = require('mssql');
    const conceptosPredeterminados = [
        { descripcion: 'PAGO DE CLIENTES', tipo: 'INGRESO', idClasificacionConcepto: null, idTipoMovimientoCaja: 3 },
        { descripcion: 'PAGO DE PROVEEDORES', tipo: 'EGRESO', idClasificacionConcepto: null, idTipoMovimientoCaja: 5 },
        { descripcion: 'PAGO DE SERVICIOS', tipo: 'EGRESO', idClasificacionConcepto: null, idTipoMovimientoCaja: 8 },
        { descripcion: 'PAGO DE PERSONAL', tipo: 'EGRESO', idClasificacionConcepto: null, idTipoMovimientoCaja: 7 },
        { descripcion: 'OTROS PAGOS', tipo: 'EGRESO', idClasificacionConcepto: null, idTipoMovimientoCaja: 7 },
        { descripcion: 'RETIRO DE DINERO', tipo: 'EGRESO', idClasificacionConcepto: null, idTipoMovimientoCaja: 9 },
        { descripcion: 'SALDO ANTERIOR', tipo: 'INGRESO', idClasificacionConcepto: null, idTipoMovimientoCaja: 10 },
        { descripcion: 'OTROS INGRESOS', tipo: 'INGRESO', idClasificacionConcepto: null, idTipoMovimientoCaja: 4 },
       
    ];
    const conceptosCreados = [];
    try {
        for (const concepto of conceptosPredeterminados) {
    }
    } catch (error) {
        console.error('Error creando conceptos predeterminados:', error);
        throw new Error('Error al crear conceptos predeterminados: ' + error.message);
    }
    return conceptosCreados;
};








/**
 * Inicializa todos los datos maestros para una nueva empresa
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @param {Object} datosEmpresa - Datos de la empresa
 * @returns {Object} Resumen de datos creados
 */
exports.inicializarDatosEmpresa = async (pool, idEmpresa, datosEmpresa) => {
    console.log('🚀 Inicializando datos maestros para empresa:', idEmpresa);
    
    const resultado = {
        roles: [],
        comprobantes: [],
        secuencias: [],
        ubicaciones: [],
        listasPrecios: [],
        conceptos: [],
        correlativo: null,
        errores: []
    };

    try {
        // 1. Crear roles
        try {
            resultado.roles = await exports.crearRolesPredeterminados(pool, idEmpresa);
        } catch (error) {
            console.error('⚠️ Error creando roles:', error.message);
            resultado.errores.push({ tipo: 'roles', mensaje: error.message });
        }

        // 2. Crear comprobantes
        try {
            resultado.comprobantes = await exports.crearComprobantesPredeterminados(pool, idEmpresa);
        } catch (error) {
            console.error('⚠️ Error creando comprobantes:', error.message);
            resultado.errores.push({ tipo: 'comprobantes', mensaje: error.message });
        }

        // 3. Crear sucursal principal
        /**
        try {
            resultado.sucursal = await exports.crearSucursalPrincipal(pool, idEmpresa, datosEmpresa);
        } catch (error) {
            console.error('⚠️ Error creando sucursal:', error.message);
            resultado.errores.push({ tipo: 'sucursal', mensaje: error.message });
        }
        */

        // 4. Crear secuencias solo si tenemos comprobantes y sucursal
        if (resultado.comprobantes.length > 0 && resultado.sucursal) {
            try {
                resultado.secuencias = await exports.crearSecuenciasIniciales(
                    pool, 
                    idEmpresa, 
                    resultado.sucursal.idSucursal, 
                    resultado.comprobantes
                );
            } catch (error) {
                console.error('⚠️ Error creando secuencias:', error.message);
                resultado.errores.push({ tipo: 'secuencias', mensaje: error.message });
            }
        }

        // 5. Crear ubicaciones predeterminadas para la sucursal
        if (resultado.sucursal) {
            try {
                resultado.ubicaciones = await exports.crearUbicacionesPredeterminadas(
                    pool,
                    resultado.sucursal.idSucursal
                );
            } catch (error) {
                console.error('⚠️ Error creando ubicaciones:', error.message);
                resultado.errores.push({ tipo: 'ubicaciones', mensaje: error.message });
            }
        }

        // 6. Crear listas de precios predeterminadas
        if (resultado.sucursal) {
            try {
                resultado.listasPrecios = await exports.crearListasPreciosPredeterminadas(
                    pool,
                    idEmpresa,
                    resultado.sucursal.idSucursal
                );
            } catch (error) {
                console.error('⚠️ Error creando listas de precios:', error.message);
                resultado.errores.push({ tipo: 'listasPrecios', mensaje: error.message });
            }
        }

        // 7. Crear correlativo inicial (número por defecto 10000 para códigos de producto)
        try {
            resultado.correlativo = await exports.crearCorrelativoInicial(pool, idEmpresa, NUMERO_CORRELATIVO_INICIAL);
        } catch (error) {
            console.error('⚠️ Error creando correlativo inicial:', error.message);
            resultado.errores.push({ tipo: 'correlativo', mensaje: error.message });
        }

        // 8. Crear conceptos predeterminados
        try {
            resultado.conceptos = await exports.crearConceptosPredeterminados(pool, idEmpresa);
        } catch (error) {
            console.error('⚠️ Error creando conceptos predeterminados:', error.message);
            resultado.errores.push({ tipo: 'conceptos', mensaje: error.message });
        }


        console.log('✅ Inicialización completada:', {
            roles: resultado.roles.length,
            comprobantes: resultado.comprobantes.length,
            //sucursal: resultado.sucursal ? 'OK' : 'ERROR',
            secuencias: resultado.secuencias.length,
            ubicaciones: resultado.ubicaciones.length,
            listasPrecios: resultado.listasPrecios.length,
            correlativo: resultado.correlativo ? 'OK' : 'ERROR',
            conceptos: resultado.conceptos.length,
            errores: resultado.errores.length
        });

        return resultado;

    } catch (error) {
        console.error('❌ Error general en inicialización:', error);
        throw error;
    }
};

/**
 * Verifica si la empresa tiene colaboradores
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @returns {Object} { tieneColaboradores: boolean, cantidad: number }
 */
exports.verificarColaboradores = async (pool, idEmpresa) => {
    const sql = require('mssql');
    
    try {
        const result = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT COUNT(*) as cantidad 
                FROM UsuarioWeb 
                WHERE idEmpresa = @idEmpresa AND estado = 1
            `);

        const cantidad = result.recordset[0].cantidad;

        return {
            tieneColaboradores: cantidad > 0,
            cantidad: cantidad
        };

    } catch (error) {
        console.error('Error verificando colaboradores:', error);
        throw new Error('Error al verificar colaboradores: ' + error.message);
    }
};

/**
 * Obtiene el estado de configuración de la empresa
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @returns {Object} Estado de configuración
 */
exports.obtenerEstadoConfiguracion = async (pool, idEmpresa) => {
    const sql = require('mssql');
    
    try {
        // Verificar colaboradores
        const colaboradores = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query('SELECT COUNT(*) as total FROM UsuarioWeb WHERE idEmpresa = @idEmpresa');

        // Verificar productos
        const productos = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query('SELECT COUNT(*) as total FROM Productos WHERE idEmpresa = @idEmpresa');

        // Verificar proveedores
        const proveedores = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query('SELECT COUNT(*) as total FROM Proveedores WHERE idEmpresa = @idEmpresa');

        // Verificar clientes
        const clientes = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query('SELECT COUNT(*) as total FROM Clientes WHERE idEmpresa = @idEmpresa');

        return {
            tieneColaboradores: colaboradores.recordset[0].total > 0,
            cantidadColaboradores: colaboradores.recordset[0].total,
            tieneProductos: productos.recordset[0].total > 0,
            cantidadProductos: productos.recordset[0].total,
            tieneProveedores: proveedores.recordset[0].total > 0,
            cantidadProveedores: proveedores.recordset[0].total,
            tieneClientes: clientes.recordset[0].total > 0,
            cantidadClientes: clientes.recordset[0].total,
            configuracionCompleta: 
                colaboradores.recordset[0].total > 0 &&
                productos.recordset[0].total > 0 &&
                proveedores.recordset[0].total > 0
        };

    } catch (error) {
        console.error('Error obteniendo estado de configuración:', error);
        throw new Error('Error al obtener estado de configuración: ' + error.message);
    }
};

module.exports = exports;
