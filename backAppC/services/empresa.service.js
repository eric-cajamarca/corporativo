const { v4: uuidv4 } = require('uuid');
const sql = require('mssql');

/** Catálogo inicial de comprobantes por sucursal (alta empresa o al pasar a series propias). */
const COMPROBANTES_PREDETERMINADOS = [
  { codigo: '01', nombre: 'Factura Electronica', serie: 'F001', numero: 0, activo: 1 },
  { codigo: '03', nombre: 'Boleta Electrónica', serie: 'B001', numero: 0, activo: 1 },
  { codigo: 'F7', nombre: 'N.C. Electrónica (Factura)', serie: 'FC01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: true },
  { codigo: 'B7', nombre: 'N.C. Electrónica (Boleta)', serie: 'BC01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: true },
  { codigo: 'F8', nombre: 'N.D. Electrónica (Factura)', serie: 'FD01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: true },
  { codigo: 'B8', nombre: 'N.D. Electrónica (Boleta)', serie: 'BD01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: true },
  { codigo: '09', nombre: 'Guía de Remisión Electrónica - Remitente', serie: 'T001', numero: 0, activo: 1 },
  { codigo: '31', nombre: 'Guía de Remisión Electrónica - Transportista', serie: 'V001', numero: 0, activo: 1 },
  { codigo: 'RA', nombre: 'Comunicación de baja', serie: '-', numero: 0, activo: 1 },
  { codigo: 'RC', nombre: 'Resumen diario', serie: '-', numero: 0, activo: 1 },
  { codigo: 'NV', nombre: 'Nota de venta', serie: 'NV01', numero: 0, activo: 1 },
  { codigo: 'CT', nombre: 'Cotización', serie: 'CT01', numero: 0, activo: 1 },
  { codigo: 'RE', nombre: 'Recibo de Egreso', serie: 'RE01', numero: 0, activo: 1 },
  { codigo: 'RI', nombre: 'Recibo de Ingreso', serie: 'RI01', numero: 0, activo: 1 },
  { codigo: 'RP', nombre: 'Recibo de pago', serie: 'RP01', numero: 0, activo: 1 },
  { codigo: 'TK', nombre: 'Ticket de despacho', serie: 'TK01', numero: 0, activo: 1 },
  { codigo: 'NE', nombre: 'Nota de envío', serie: 'NE01', numero: 0, activo: 1 },
  { codigo: 'VD', nombre: 'Vale Despacho', serie: 'VD01', numero: 0, activo: 1 },
  { codigo: 'II', nombre: 'Inventario Inicial', serie: 'II01', numero: 0, activo: 1 },
  { codigo: 'IN', nombre: 'Ingreso', serie: 'IN01', numero: 0, activo: 1 },
  { codigo: 'IV', nombre: 'Inventario', serie: 'IV01', numero: 0, activo: 1 },
  { codigo: 'SA', nombre: 'Salida', serie: 'SA01', numero: 0, activo: 1 },
  { codigo: 'TF', nombre: 'Transferencia', serie: 'TF01', numero: 0, activo: 1 }
];

/**
 * Obtiene datos de empresa/usuario para la respuesta de getEmpresa_login (verificación de token).
 * req.user viene del JWT decodificado (adminLogin).
 */
exports.getDatosEmpresaLogin = async (pool, user) => {
    if (!user) return null;
    return {
        idEmpresa: user.empresa || null,
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
        
    // sql ya importado arriba
    
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
                    }

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
exports.crearComprobantesPredeterminados = async (pool, idEmpresa, idSucursal) => {
    const comprobantesCreados = [];

    if (!idSucursal) {
        throw new Error('idSucursal es requerido para crear comprobantes predeterminados');
    }
    try {
        for (const comp of COMPROBANTES_PREDETERMINADOS) {
            const usarEnVenta = comp.usarEnVenta !== undefined ? !!comp.usarEnVenta : true;
            const usarEnCompra = comp.usarEnCompra !== undefined ? !!comp.usarEnCompra : true;
            const result = await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                .input('codigo', sql.VarChar(2), comp.codigo)
                .input('nombre', sql.VarChar(50), comp.nombre)
                .input('serie', sql.VarChar(4), comp.serie)
                .input('numero', sql.Int, comp.numero)
                .input('activo', sql.Bit, comp.activo)
                .input('usarEnVenta', sql.Bit, usarEnVenta)
                .input('usarEnCompra', sql.Bit, usarEnCompra)
                .query(`
                    INSERT INTO Comprobantes (idEmpresa, idSucursal, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra)
                    OUTPUT INSERTED.idComprobante
                    VALUES (@idEmpresa, @idSucursal, @codigo, @nombre, @serie, @numero, @activo, @usarEnVenta, @usarEnCompra)
                `);

            const idComprobante = result.recordset[0].idComprobante;
            comprobantesCreados.push({ idComprobante, ...comp });
                    }

                return comprobantesCreados;

    } catch (error) {
        console.error('Error creando comprobantes predeterminados:', error);
        throw new Error('Error al crear comprobantes predeterminados: ' + error.message);
    }
};

/**
 * Inserta comprobantes predeterminados solo si faltan (empresa+sucursal+código).
 * Usar al pasar una sucursal a series propias (idSucursalSeriesPadre NULL) sin filas en Comprobantes.
 */
exports.asegurarComprobantesPredeterminadosPorSucursal = async (pool, idEmpresa, idSucursal) => {
  if (!idSucursal) {
    throw new Error('idSucursal es requerido para asegurar comprobantes predeterminados');
  }
  const insertados = [];
  try {
    for (const comp of COMPROBANTES_PREDETERMINADOS) {
      const usarEnVenta = comp.usarEnVenta !== undefined ? !!comp.usarEnVenta : true;
      const usarEnCompra = comp.usarEnCompra !== undefined ? !!comp.usarEnCompra : true;
      const result = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .input('codigo', sql.VarChar(2), comp.codigo)
        .input('nombre', sql.VarChar(50), comp.nombre)
        .input('serie', sql.VarChar(4), comp.serie)
        .input('numero', sql.Int, comp.numero)
        .input('activo', sql.Bit, comp.activo)
        .input('usarEnVenta', sql.Bit, usarEnVenta)
        .input('usarEnCompra', sql.Bit, usarEnCompra)
        .query(`
          INSERT INTO Comprobantes (idEmpresa, idSucursal, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra)
          OUTPUT INSERTED.idComprobante
          SELECT @idEmpresa, @idSucursal, @codigo, @nombre, @serie, @numero, @activo, @usarEnVenta, @usarEnCompra
          WHERE NOT EXISTS (
            SELECT 1 FROM Comprobantes c
            WHERE c.idEmpresa = @idEmpresa AND c.idSucursal = @idSucursal AND c.codigo = @codigo
          )
        `);
      if (result.recordset && result.recordset[0] && result.recordset[0].idComprobante != null) {
        insertados.push({ idComprobante: result.recordset[0].idComprobante, ...comp });
      }
    }
    return insertados;
  } catch (error) {
    console.error('Error asegurando comprobantes predeterminados por sucursal:', error);
    throw new Error('Error al asegurar comprobantes predeterminados: ' + error.message);
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
        const direccionSucursal = datosEmpresa.direccion || 'Sin dirección';
    const idSucursal = uuidv4();

    try {
        await pool.request()
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('nombre', sql.VarChar(50), 'Sucursal Principal')
            .input('direccion', sql.VarChar(200), direccionSucursal)
            .input('telefono', sql.VarChar(20), datosEmpresa.celular || '')
            .input('estado', sql.Bit, 1)
            .query(`
                INSERT INTO Sucursal (idSucursal, idEmpresa, nombre, direccion, telefono, estado, fRegistro, esPrincipal)
                VALUES (@idSucursal, @idEmpresa, @nombre, @direccion, @telefono, @estado, GETDATE(), 1)
            `);

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
        
    // sql ya importado arriba
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
                    }

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
        
    // sql ya importado arriba
    
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
                    }

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
        
    // sql ya importado arriba
    
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
                    }

                return listasCreadas;

    } catch (error) {
        console.error('Error creando listas de precios predeterminadas:', error);
        throw new Error('Error al crear listas de precios predeterminadas: ' + error.message);
    }
};

/**
 * Genera y almacena un código de verificación para una empresa recién creada.
 * Devuelve el registro creado (idVerificacion, codigo, telefono).
 */
exports.crearRegistroVerificacionEmpresa = async (pool, idEmpresa, telefono) => {
    const codigo = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('telefono', sql.VarChar(20), telefono || '')
        .input('codigo', sql.VarChar(10), codigo)
        .query(`
            INSERT INTO EmpresaVerificacion (idEmpresa, telefono, codigo, estado, intentos)
            OUTPUT INSERTED.idVerificacion, INSERTED.idEmpresa, INSERTED.telefono, INSERTED.codigo
            VALUES (@idEmpresa, @telefono, @codigo, 'PENDIENTE', 0)
        `);
    return { ...(result.recordset[0] || {}), codigo };
};

/**
 * Obtiene o actualiza el código de verificación para reenvío.
 * Si existe un registro PENDIENTE para la empresa: actualiza codigo e incrementa intentos.
 * Si no existe: crea uno nuevo (mismo flujo que crearRegistroVerificacionEmpresa).
 * @returns {{ codigo: string }}
 */
exports.obtenerOActualizarCodigoVerificacion = async (pool, idEmpresa, telefono) => {
    const codigo = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
    const sel = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT TOP 1 idVerificacion FROM EmpresaVerificacion
            WHERE idEmpresa = @idEmpresa AND estado = 'PENDIENTE'
            ORDER BY fCreacion DESC
        `);
    const pendiente = sel.recordset[0];
    if (pendiente) {
        await pool.request()
            .input('idVerificacion', sql.UniqueIdentifier, pendiente.idVerificacion)
            .input('codigo', sql.VarChar(10), codigo)
            .input('telefono', sql.VarChar(20), telefono || '')
            .query(`
                UPDATE EmpresaVerificacion
                SET codigo = @codigo, telefono = @telefono, intentos = intentos + 1
                WHERE idVerificacion = @idVerificacion
            `);
        return { codigo };
    }
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('telefono', sql.VarChar(20), telefono || '')
        .input('codigo', sql.VarChar(10), codigo)
        .query(`
            INSERT INTO EmpresaVerificacion (idEmpresa, telefono, codigo, estado, intentos)
            OUTPUT INSERTED.codigo
            VALUES (@idEmpresa, @telefono, @codigo, 'PENDIENTE', 0)
        `);
    return { codigo: (result.recordset[0] && result.recordset[0].codigo) || codigo };
};

/**
 * Verifica un código de verificación para una empresa. Si es correcto, habilita la empresa.
 */
exports.verificarEmpresaPorCodigo = async (pool, idEmpresa, codigo) => {
    const req = pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('codigo', sql.VarChar(10), codigo);

    const resSel = await req.query(`
        SELECT TOP 1 * FROM EmpresaVerificacion
        WHERE idEmpresa = @idEmpresa AND codigo = @codigo AND estado = 'PENDIENTE'
        ORDER BY fCreacion DESC
    `);
    const row = resSel.recordset[0];
    if (!row) {
        // Incrementar intentos en el registro más reciente
        await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                UPDATE TOP (1) EmpresaVerificacion
                SET intentos = intentos + 1
                WHERE idEmpresa = @idEmpresa
                ORDER BY fCreacion DESC
            `);
        return { ok: false, message: 'Código inválido o ya utilizado.' };
    }

    // Marcar verificación y habilitar empresa
    await pool.request()
        .input('idVerificacion', sql.UniqueIdentifier, row.idVerificacion)
        .query(`
            UPDATE EmpresaVerificacion
            SET estado = 'VERIFICADO', fVerificacion = GETDATE()
            WHERE idVerificacion = @idVerificacion
        `);

    await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            UPDATE Empresas SET estado = 1 WHERE idEmpresa = @idEmpresa
        `);

    return { ok: true };
};

/**
 * Crea el registro en EmpresaIntegraciones para una empresa nueva (todos los flags en 0).
 */
exports.insertarEmpresaIntegraciones = async (pool, idEmpresa) => {
    try {
        await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                INSERT INTO EmpresaIntegraciones (idEmpresa, twilioHabilitado, izipayHabilitado, culqiHabilitado, apisPeruHabilitado, factilizaHabilitado, fActualizacion)
                VALUES (@idEmpresa, 0, 0, 0, 0, 0, GETDATE())
            `);
    } catch (err) {
        console.error('Error insertando EmpresaIntegraciones:', err?.message || err);
    }
};

/**
 * Si es la única empresa en el sistema, la marca como principal (esPrincipal = 1).
 */
exports.marcarEmpresaPrincipalSiEsPrimera = async (pool, idEmpresa) => {
    try {
        const count = await pool.request().query('SELECT COUNT(*) AS total FROM Empresas');
        const total = count.recordset[0]?.total ?? 0;
        if (total === 1) {
            await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .query(`UPDATE Empresas SET esPrincipal = 1 WHERE idEmpresa = @idEmpresa`);
        }
    } catch (err) {
        console.error('Error marcando empresa principal:', err?.message || err);
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
                return row;
    } catch (error) {
        console.error('Error creando correlativo inicial:', error);
        throw new Error('Error al crear correlativo inicial: ' + error.message);
    }
};

/**
 * Crea las clasificaciones de concepto predeterminadas para una nueva empresa.
 * Cada empresa tiene su propia copia; puede editarlas o agregar más.
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @returns {Object} Map descripcion -> idClasificacionConcepto (para enlazar conceptos)
 */
exports.crearClasificacionesConceptoPredeterminadas = async (pool, idEmpresa) => {
        const sql = require('mssql');
    const clasificaciones = [
        'Ventas',
        'Compras',
        'Cobranzas',
        'Pagos a proveedores',
        'Gastos operativos',
        'Otros ingresos',
        'Otros egresos'
    ];
    const mapDescripcionToId = {};
    try {
        for (const descripcion of clasificaciones) {
            const result = await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('descripcion', sql.VarChar(100), descripcion)
                .query(`
                    INSERT INTO ClasificacionConcepto (idEmpresa, descripcion)
                    OUTPUT INSERTED.idClasificacionConcepto
                    VALUES (@idEmpresa, @descripcion)
                `);
            const idClasificacionConcepto = result.recordset[0].idClasificacionConcepto;
            mapDescripcionToId[descripcion] = idClasificacionConcepto;
        }
                return mapDescripcionToId;
    } catch (error) {
        console.error('Error creando clasificaciones de concepto:', error);
        throw new Error('Error al crear clasificaciones de concepto: ' + error.message);
    }
};

/**
 * Obtiene un map nombre -> idTipoMovimientoCaja desde la tabla universal TiposMovimientoCaja.
 * @param {Object} pool
 * @returns {Object} Map nombre (uppercase) -> idTipoMovimientoCaja
 */
async function obtenerMapTiposMovimientoCaja(pool) {
    const sql = require('mssql');
    const result = await pool.request().query(`
        SELECT idTipoMovimientoCaja, UPPER(LTRIM(RTRIM(nombre))) AS nombre
        FROM TiposMovimientoCaja
    `);
    const map = {};
    for (const row of result.recordset) {
        map[row.nombre] = row.idTipoMovimientoCaja;
    }
    return map;
}

/**
 * Crea los conceptos predeterminados para una nueva empresa.
 * Usa las clasificaciones creadas y opcionalmente TiposMovimientoCaja (por nombre).
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @param {Object} mapClasificacionDescripcionToId - Map descripcion -> idClasificacionConcepto (de crearClasificacionesConceptoPredeterminadas)
 * @returns {Array} Conceptos creados
 */
exports.crearConceptosPredeterminados = async (pool, idEmpresa, mapClasificacionDescripcionToId) => {
        const sql = require('mssql');
    const mapTipoMov = await obtenerMapTiposMovimientoCaja(pool);
    const getTipoId = (nombre) => (nombre && mapTipoMov[nombre.toUpperCase()]) || null;
    const getClasifId = (desc) => (desc && mapClasificacionDescripcionToId[desc]) || null;

    const conceptosPredeterminados = [
        { descripcion: 'Venta contado', tipo: 'INGRESO', clasificacion: 'Ventas', tipoMovNombre: 'VENTA_CONTADO' },
        { descripcion: 'Venta crédito', tipo: 'INGRESO', clasificacion: 'Ventas', tipoMovNombre: 'VENTA_CREDITO' },
        { descripcion: 'Devolución venta', tipo: 'EGRESO', clasificacion: 'Ventas', tipoMovNombre: 'EGRESOS' },
        { descripcion: 'Compra contado', tipo: 'EGRESO', clasificacion: 'Compras', tipoMovNombre: 'COMPRA_CONTADO' },
        { descripcion: 'Compra crédito', tipo: 'EGRESO', clasificacion: 'Compras', tipoMovNombre: 'COMPRA_CREDITO' },
        { descripcion: 'Devolución compra', tipo: 'INGRESO', clasificacion: 'Compras', tipoMovNombre: 'INGRESOS' },
        { descripcion: 'Cobro factura cliente', tipo: 'INGRESO', clasificacion: 'Cobranzas', tipoMovNombre: 'COBRANZA_CREDITO' },
        { descripcion: 'Cobro letra', tipo: 'INGRESO', clasificacion: 'Cobranzas', tipoMovNombre: 'COBRANZA_CREDITO' },
        { descripcion: 'Interés cobranza', tipo: 'INGRESO', clasificacion: 'Cobranzas', tipoMovNombre: 'INGRESOS' },
        { descripcion: 'Pago factura', tipo: 'EGRESO', clasificacion: 'Pagos a proveedores', tipoMovNombre: 'PAGO_CREDITO' },
        { descripcion: 'Pago letra', tipo: 'EGRESO', clasificacion: 'Pagos a proveedores', tipoMovNombre: 'PAGO_CREDITO' },
        { descripcion: 'Anticipo proveedor', tipo: 'EGRESO', clasificacion: 'Pagos a proveedores', tipoMovNombre: 'PAGO_CREDITO' },
        { descripcion: 'Alquiler', tipo: 'EGRESO', clasificacion: 'Gastos operativos', tipoMovNombre: 'EGRESOS' },
        { descripcion: 'Luz', tipo: 'EGRESO', clasificacion: 'Gastos operativos', tipoMovNombre: 'EGRESOS' },
        { descripcion: 'Sueldo', tipo: 'EGRESO', clasificacion: 'Gastos operativos', tipoMovNombre: 'EGRESOS' },
        { descripcion: 'Combustible', tipo: 'EGRESO', clasificacion: 'Gastos operativos', tipoMovNombre: 'EGRESOS' },
        { descripcion: 'Donación', tipo: 'INGRESO', clasificacion: 'Otros ingresos', tipoMovNombre: 'INGRESOS' },
        { descripcion: 'Interés ganado', tipo: 'INGRESO', clasificacion: 'Otros ingresos', tipoMovNombre: 'INGRESOS' },
        { descripcion: 'Venta de activo', tipo: 'INGRESO', clasificacion: 'Otros ingresos', tipoMovNombre: 'INGRESOS' },
        { descripcion: 'Multa', tipo: 'EGRESO', clasificacion: 'Otros egresos', tipoMovNombre: 'EGRESOS' },
        { descripcion: 'Pérdida', tipo: 'EGRESO', clasificacion: 'Otros egresos', tipoMovNombre: 'EGRESOS' },
        { descripcion: 'Retiro de socio', tipo: 'EGRESO', clasificacion: 'Otros egresos', tipoMovNombre: 'EGRESOS' }
    ];

    const conceptosCreados = [];
    try {
        for (const c of conceptosPredeterminados) {
            const idClasificacionConcepto = getClasifId(c.clasificacion);
            const idTipoMovimientoCaja = getTipoId(c.tipoMovNombre);
            const result = await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('descripcion', sql.VarChar(100), c.descripcion)
                .input('tipo', sql.VarChar(20), c.tipo)
                .input('idClasificacionConcepto', sql.UniqueIdentifier, idClasificacionConcepto || null)
                .input('idTipoMovimientoCaja', sql.Int, idTipoMovimientoCaja)
                .query(`
                    INSERT INTO Concepto (idEmpresa, descripcion, tipo, idClasificacionConcepto, idTipoMovimientoCaja)
                    OUTPUT INSERTED.idConcepto, INSERTED.descripcion
                    VALUES (@idEmpresa, @descripcion, @tipo, @idClasificacionConcepto, @idTipoMovimientoCaja)
                `);
            conceptosCreados.push(result.recordset[0]);
        }
                return conceptosCreados;
    } catch (error) {
        console.error('Error creando conceptos predeterminados:', error);
        throw new Error('Error al crear conceptos predeterminados: ' + error.message);
    }
};








/**
 * Inicializa todos los datos maestros para una nueva empresa
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @param {Object} datosEmpresa - Datos de la empresa
 * @returns {Object} Resumen de datos creados
 */
exports.inicializarDatosEmpresa = async (pool, idEmpresa, datosEmpresa) => {
        
    const resultado = {
        roles: [],
        comprobantes: [],
        secuencias: [],
        ubicaciones: [],
        listasPrecios: [],
        clasificacionesConcepto: null,
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

        // 2. Crear sucursal principal (antes de comprobantes: catálogo exige idSucursal)
        try {
            resultado.sucursal = await exports.crearSucursalPrincipal(pool, idEmpresa, datosEmpresa);
        } catch (error) {
            console.error('⚠️ Error creando sucursal:', error.message);
            resultado.errores.push({ tipo: 'sucursal', mensaje: error.message });
        }

        // 3. Crear comprobantes en la sucursal principal
        try {
            if (resultado.sucursal && resultado.sucursal.idSucursal) {
                resultado.comprobantes = await exports.crearComprobantesPredeterminados(
                    pool,
                    idEmpresa,
                    resultado.sucursal.idSucursal
                );
            } else {
                throw new Error('No hay sucursal principal; no se pueden crear comprobantes');
            }
        } catch (error) {
            console.error('⚠️ Error creando comprobantes:', error.message);
            resultado.errores.push({ tipo: 'comprobantes', mensaje: error.message });
        }

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

        // 8. Clasificaciones de concepto (Ventas, Compras, Cobranzas, etc.)
        try {
            resultado.clasificacionesConcepto = await exports.crearClasificacionesConceptoPredeterminadas(pool, idEmpresa);
        } catch (error) {
            console.error('⚠️ Error creando clasificaciones de concepto:', error.message);
            resultado.errores.push({ tipo: 'clasificacionesConcepto', mensaje: error.message });
        }

        // 9. Conceptos predeterminados (vinculados a clasificaciones y TiposMovimientoCaja)
        try {
            const mapClasif = resultado.clasificacionesConcepto || {};
            resultado.conceptos = await exports.crearConceptosPredeterminados(pool, idEmpresa, mapClasif);
        } catch (error) {
            console.error('⚠️ Error creando conceptos predeterminados:', error.message);
            resultado.errores.push({ tipo: 'conceptos', mensaje: error.message });
        }


        
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

        // Verificar si la empresa es gestora de otras
        const gestionadas = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query('SELECT COUNT(*) as total FROM Gestores_Empresas WHERE idEmpresaOrigen = @idEmpresa AND estado = 1');

        // Guías electrónicas: habilitado si la empresa tiene usaGuiasElectronicas = 1
        let habilitarGuiasElectronicas = false;
        try {
            const guias = await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .query('SELECT ISNULL(usaGuiasElectronicas, 0) AS usaGuiasElectronicas FROM ConfiguracionFacturacionElectronica WHERE idEmpresa = @idEmpresa');
            if (guias.recordset && guias.recordset[0]) {
                habilitarGuiasElectronicas = guias.recordset[0].usaGuiasElectronicas === true || guias.recordset[0].usaGuiasElectronicas === 1;
            }
        } catch (_) {
            // Columna puede no existir aún si no se ejecutó la migración
        }

        let permitirVentaMultiSucursal = false;
        try {
            const pe = await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .query('SELECT ISNULL(permitirVentaMultiSucursal, 0) AS v FROM Empresas WHERE idEmpresa = @idEmpresa');
            if (pe.recordset && pe.recordset[0]) {
                permitirVentaMultiSucursal = pe.recordset[0].v === true || pe.recordset[0].v === 1;
            }
        } catch (_) {
            // Columna puede no existir si no se aplicó la migración
        }

        return {
            tieneColaboradores: colaboradores.recordset[0].total > 0,
            cantidadColaboradores: colaboradores.recordset[0].total,
            esGestora: gestionadas.recordset[0].total > 0,
            cantidadEmpresasGestionadas: gestionadas.recordset[0].total,
            tieneProductos: productos.recordset[0].total > 0,
            cantidadProductos: productos.recordset[0].total,
            tieneProveedores: proveedores.recordset[0].total > 0,
            cantidadProveedores: proveedores.recordset[0].total,
            tieneClientes: clientes.recordset[0].total > 0,
            cantidadClientes: clientes.recordset[0].total,
            habilitarGuiasElectronicas,
            permitirVentaMultiSucursal,
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
