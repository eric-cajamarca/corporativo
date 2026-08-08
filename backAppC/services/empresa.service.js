const { v4: uuidv4 } = require('uuid');
const sql = require('mssql');
const empresasAdministracionRepository = require('../repositories/empresasAdministracion.repository');
const permisosRepository = require('../repositories/permisos.repository');
const categoriaRepository = require('../repositories/categoria.repository');
const clientesRepository = require('../repositories/clientes.repository');
const marcaRepository = require('../repositories/marca.repository');
const cajaRepository = require('../repositories/caja.repository');
const rubrosRepository = require('../repositories/rubros.repository');
const authService = require('./auth.service');

/** Catálogo inicial de comprobantes por sucursal (alta empresa o al pasar a series propias). */
const COMPROBANTES_PREDETERMINADOS = [
  { codigo: '01', nombre: 'Factura Electronica', serie: 'F001', numero: 0, activo: 1, usarEnVenta: true, usarEnCompra: true },
  { codigo: '03', nombre: 'Boleta Electrónica', serie: 'B001', numero: 0, activo: 1, usarEnVenta: true, usarEnCompra: true },
  { codigo: 'F7', nombre: 'N.C. Electrónica (Factura)', serie: 'FC01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false },
  { codigo: 'B7', nombre: 'N.C. Electrónica (Boleta)', serie: 'BC01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false },
  { codigo: 'F8', nombre: 'N.D. Electrónica (Factura)', serie: 'FD01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false },
  { codigo: 'B8', nombre: 'N.D. Electrónica (Boleta)', serie: 'BD01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false },
  { codigo: '09', nombre: 'Guía de Remisión Electrónica - Remitente', serie: 'T001', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: true },
  { codigo: '31', nombre: 'Guía de Remisión Electrónica - Transportista', serie: 'V001', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false },
  { codigo: 'RA', nombre: 'Comunicación de baja', serie: '-', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false },
  { codigo: 'RC', nombre: 'Resumen diario', serie: '-', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false },
  { codigo: 'NV', nombre: 'Nota de venta', serie: 'NV01', numero: 0, activo: 1, usarEnVenta: true, usarEnCompra: true },
  { codigo: 'CT', nombre: 'Cotización', serie: 'CT01', numero: 0, activo: 1, usarEnVenta: true, usarEnCompra: false },
  { codigo: 'RE', nombre: 'Recibo de Egreso', serie: 'RE01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false },
  { codigo: 'RI', nombre: 'Recibo de Ingreso', serie: 'RI01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false },
  { codigo: 'RP', nombre: 'Recibo de pago', serie: 'RP01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false },
  { codigo: 'TK', nombre: 'Ticket de despacho', serie: 'TK01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false },
  { codigo: 'NE', nombre: 'Nota de envío', serie: 'NE01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false },
  { codigo: 'II', nombre: 'Inventario Inicial', serie: 'II01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false },
  { codigo: 'IN', nombre: 'Ingreso', serie: 'IN01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false },
  { codigo: 'IV', nombre: 'Inventario', serie: 'IV01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false },
  { codigo: 'SA', nombre: 'Salida', serie: 'SA01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false },
  { codigo: 'TF', nombre: 'Transferencia', serie: 'TF01', numero: 0, activo: 1, usarEnVenta: false, usarEnCompra: false }
];

const COMPROBANTE_VALE_DESPACHO = {
  codigo: 'VD',
  nombre: 'Vale Despacho',
  serie: 'VD01',
  numero: 0,
  activo: 1,
  usarEnVenta: false,
  usarEnCompra: false
};

async function incluirValeDespachoEnAlta(pool, idRubro) {
  if (!idRubro) return false;
  const result = await pool.request()
    .input('idRubro', sql.Int, idRubro)
    .query(`SELECT LTRIM(RTRIM(codigo)) AS codigo FROM Rubros WHERE idRubro = @idRubro`);
  const codigo = String(result.recordset?.[0]?.codigo || '').trim().toUpperCase();
  return codigo === 'GRF' || codigo === 'GRIFO';
}

async function listaComprobantesAlta(pool, idRubro) {
  const base = [...COMPROBANTES_PREDETERMINADOS];
  if (await incluirValeDespachoEnAlta(pool, idRubro)) {
    base.push(COMPROBANTE_VALE_DESPACHO);
  }
  return base;
}

/** Tributos mínimos para operar (Catálogo 05 SUNAT). */
const IMPUESTOS_PREDETERMINADOS = [
  { descripcion: 'Exonerado', codigoSunat: '9997', porcentaje: 0, pIncluyeIGV: false, estado: 1 },
  { descripcion: 'IGV', codigoSunat: '1000', porcentaje: 18, pIncluyeIGV: true, estado: 0 }
];

/** Permisos iniciales por rol operativo (Administrador recibe todos en runtime). */
const PERMISOS_PRESET_POR_ROL = {
  Vendedor: [
    'VER_VENTAS', 'CREAR_VENTAS', 'EDITAR_VENTAS',
    'VER_CLIENTES', 'CREAR_CLIENTES', 'EDITAR_CLIENTES',
    'VER_PRODUCTOS',
    'VER_CAJA', 'ABRIR_CAJA', 'CERRAR_CAJA', 'REGISTRAR_MOVIMIENTOS',
    'VER_CREDITOS', 'REGISTRAR_PAGOS',
    'VER_DESPACHOS', 'CREAR_DESPACHOS'
  ],
  Almacenero: [
    'VER_COMPRAS', 'CREAR_COMPRAS', 'EDITAR_COMPRAS', 'REPORTE_DETALLADO_COMPRAS',
    'VER_INVENTARIO', 'GESTIONAR_LOTES', 'TRANSFERIR_STOCK',
    'VER_PRODUCTOS', 'CREAR_PRODUCTOS', 'EDITAR_PRODUCTOS',
    'VER_PROVEEDORES', 'CREAR_PROVEEDORES', 'EDITAR_PROVEEDORES',
    'VER_DESPACHOS', 'CREAR_DESPACHOS', 'EDITAR_DESPACHOS',
    'VER_ENVIOS', 'VER_ENVIOS_CHOFER'
  ],
  Contador: [
    'VER_VENTAS', 'REPORTE_DETALLADO_VENTAS',
    'VER_COMPRAS', 'REPORTE_DETALLADO_COMPRAS',
    'VER_INVENTARIO',
    'VER_ANALISIS', 'EXPORTAR_REPORTES',
    'VER_REPORTES', 'GENERAR_REPORTES',
    'VER_CAJA', 'VER_ARQUEO',
    'VER_CREDITOS',
    'VER_CLIENTES',
    'VER_PROVEEDORES'
  ]
};

/** Categorías base para el primer alta de productos. */
const CATEGORIAS_PREDETERMINADAS = [
  { nombre: 'General', descripcion: 'Productos de uso general', estado: 1 },
  { nombre: 'Servicios', descripcion: 'Servicios prestados por la empresa', estado: 1 },
  { nombre: 'Varios', descripcion: 'Productos sin categoría específica', estado: 1 }
];

/** Marca genérica para productos sin marca (importación y altas rápidas). */
const MARCAS_PREDETERMINADAS = [
  { nombre: 'SM', descripcion: 'Sin marca', contacto: '', paginaWeb: '' }
];

/** Cliente genérico para boletas / ventas sin identificar al comprador (DNI 00000000). */
const CLIENTE_PUBLICO_GENERAL = {
  idDocumento: '1',
  ruc: '00000000',
  rSocial: 'PUBLICO EN GENERAL',
  correo: null,
  celular: null,
  condicion: null,
  sujetoCredito: false,
  lineaCredito: 0
};

/**
 * Obtiene datos de empresa/usuario para la respuesta de getEmpresa_login (verificación de token).
 * req.user viene del JWT decodificado (adminLogin).
 */
exports.getDatosEmpresaLogin = async (pool, user) => {
    if (!user) return null;
    const idEmpresa = user.empresa || user.idEmpresa || null;
    const idUsuario = user.sub || user.idUsuario || null;
    if (pool && idEmpresa && idUsuario) {
        const perfil = await authService.reconstruirDatosUsuarioParaToken(pool, idUsuario, idEmpresa);
        if (perfil) {
            return {
                idEmpresa: perfil.idEmpresa,
                razonSocial: perfil.razonSocial || '',
                nombres: perfil.nombres || '',
                apellidos: perfil.apellidos || '',
                email: perfil.email || '',
                rol: perfil.rol || 'Administrador',
                roles: perfil.rol || 'Administrador'
            };
        }
    }
    return {
        idEmpresa,
        razonSocial: user.razonSocial || '',
        nombres: user.nombres || '',
        apellidos: user.apellidos || '',
        email: user.email || '',
        rol: user.rol || 'Administrador',
        roles: user.rol || 'Administrador'
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
exports.crearComprobantesPredeterminados = async (pool, idEmpresa, idSucursal, idRubro = null) => {
    const comprobantesCreados = [];

    if (!idSucursal) {
        throw new Error('idSucursal es requerido para crear comprobantes predeterminados');
    }
    try {
        const catalogo = await listaComprobantesAlta(pool, idRubro);
        for (const comp of catalogo) {
            const usarEnVenta = comp.usarEnVenta !== undefined ? !!comp.usarEnVenta : false;
            const usarEnCompra = comp.usarEnCompra !== undefined ? !!comp.usarEnCompra : false;
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
exports.asegurarComprobantesPredeterminadosPorSucursal = async (pool, idEmpresa, idSucursal, idRubro = null) => {
  if (!idSucursal) {
    throw new Error('idSucursal es requerido para asegurar comprobantes predeterminados');
  }
  const insertados = [];
  try {
    const catalogo = await listaComprobantesAlta(pool, idRubro);
    for (const comp of catalogo) {
      const usarEnVenta = comp.usarEnVenta !== undefined ? !!comp.usarEnVenta : false;
      const usarEnCompra = comp.usarEnCompra !== undefined ? !!comp.usarEnCompra : false;
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
 * Ubigeo INEI 6 dígitos y códigos de catálogo (región 2, provincia 4, distrito 6) desde el alta de empresa.
 */
function normalizarUbicacionDireccionEmpresaNueva(datosEmpresa) {
  let ubigeo = datosEmpresa.ubigeo != null ? String(datosEmpresa.ubigeo).replace(/\D/g, '') : '';
  let region = datosEmpresa.region != null ? String(datosEmpresa.region).trim() : '';
  let provincia = datosEmpresa.provincia != null ? String(datosEmpresa.provincia).trim() : '';
  let distrito = datosEmpresa.distrito != null ? String(datosEmpresa.distrito).replace(/\D/g, '') : '';

  if (ubigeo.length !== 6 && distrito.length === 6) {
    ubigeo = distrito;
  }
  if (ubigeo.length === 6 && distrito.length !== 6) {
    distrito = ubigeo;
  }
  if (ubigeo.length >= 2 && !region) {
    region = ubigeo.slice(0, 2);
  }
  if (ubigeo.length >= 4 && !provincia) {
    provincia = ubigeo.slice(0, 4);
  }

  const codPaisRaw =
    datosEmpresa.codPais != null && String(datosEmpresa.codPais).trim() !== ''
      ? String(datosEmpresa.codPais).trim()
      : datosEmpresa.codpais != null && String(datosEmpresa.codpais).trim() !== ''
        ? String(datosEmpresa.codpais).trim()
        : 'PEN';

  return {
    ubigeo: ubigeo.length === 6 ? ubigeo : '',
    region,
    provincia,
    distrito: distrito.length === 6 ? distrito : ubigeo.length === 6 ? ubigeo : '',
    codPais: codPaisRaw || 'PEN',
    urbanizacion: datosEmpresa.urbanizacion != null ? String(datosEmpresa.urbanizacion).trim() : ''
  };
}

/**
 * Crea la sucursal principal para una nueva empresa
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @param {Object} datosEmpresa - Datos de la empresa (razon_Social, direccion, etc.)
 * @returns {Object} Sucursal creada
 */
exports.crearSucursalPrincipal = async (pool, idEmpresa, datosEmpresa) => {
  const direccionSucursal =
    datosEmpresa.direccion != null && String(datosEmpresa.direccion).trim() !== ''
      ? String(datosEmpresa.direccion).trim()
      : 'Sin dirección';
  const ubi = normalizarUbicacionDireccionEmpresaNueva(datosEmpresa);
  const idSucursal = uuidv4();

  try {
    await pool
      .request()
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

    const codLocalFiscal =
      datosEmpresa.codLocal != null && String(datosEmpresa.codLocal).trim() !== ''
        ? String(datosEmpresa.codLocal).trim().slice(0, 4)
        : '0000';
    const insDir = await empresasAdministracionRepository.insertarDireccionEmpresa(pool, {
      idEmpresa,
      ubigeo: ubi.ubigeo,
      codPais: ubi.codPais,
      region: ubi.region,
      provincia: ubi.provincia,
      distrito: ubi.distrito,
      urbanizacion: ubi.urbanizacion,
      direccion: direccionSucursal,
      codLocal: codLocalFiscal,
      principal: true
    });
    const idDireccionEmpresa = insDir.recordset && insDir.recordset[0] ? insDir.recordset[0].idDireccionEmpresa : null;
    if (idDireccionEmpresa != null) {
      try {
        await pool
          .request()
          .input('idSucursal', sql.UniqueIdentifier, idSucursal)
          .input('idDireccionEmpresa', sql.Int, idDireccionEmpresa)
          .query(
            'UPDATE Sucursal SET idDireccionEmpresa = @idDireccionEmpresa WHERE idSucursal = @idSucursal'
          );
      } catch (errVinc) {
        if (errVinc.message && String(errVinc.message).includes('idDireccionEmpresa')) {
          console.error('contexto: Sucursal sin columna idDireccionEmpresa o error al vincular dirección fiscal:', errVinc);
        } else {
          throw errVinc;
        }
      }
    }

    return { idSucursal, nombre: 'Sucursal Principal', idDireccionEmpresa };
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
        { nombre: 'Precio Cliente', principal: false, conIgv: true, idMoneda: 1 },
        { nombre: 'Precio Mayorista', principal: false, conIgv: true, idMoneda: 1 },
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

    try {
        await exports.asegurarDatosMaestrosEmpresa(pool, idEmpresa);
    } catch (errMaestros) {
        console.error('verificarEmpresaPorCodigo asegurarDatosMaestros:', errMaestros.message);
    }

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
        { descripcion: 'Retiro de socio', tipo: 'EGRESO', clasificacion: 'Otros egresos', tipoMovNombre: 'EGRESOS' },
        { descripcion: 'Cierre de caja', tipo: 'EGRESO', clasificacion: 'Otros egresos', tipoMovNombre: 'EGRESOS' },
        { descripcion: 'Entrega de dinero', tipo: 'EGRESO', clasificacion: 'Otros egresos', tipoMovNombre: 'EGRESOS' }
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
 * Crea los tributos predeterminados (Exonerado e IGV) para una nueva empresa.
 */
exports.crearImpuestosPredeterminados = async (pool, idEmpresa) => {
    const impuestosCreados = [];
    try {
        for (const imp of IMPUESTOS_PREDETERMINADOS) {
            const result = await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('descripcion', sql.VarChar(50), imp.descripcion)
                .input('codigoSunat', sql.VarChar(4), imp.codigoSunat)
                .input('estado', sql.Bit, imp.estado ? 1 : 0)
                .input('porcentaje', sql.Decimal(5, 2), imp.porcentaje)
                .input('pIncluyeIGV', sql.Bit, imp.pIncluyeIGV ? 1 : 0)
                .query(`
                    INSERT INTO Impuestos (idEmpresa, descripcion, codigoSunat, estado, porcentaje, pIncluyeIGV)
                    OUTPUT INSERTED.idImpuesto, INSERTED.descripcion
                    SELECT @idEmpresa, @descripcion, @codigoSunat, @estado, @porcentaje, @pIncluyeIGV
                    WHERE NOT EXISTS (
                        SELECT 1 FROM Impuestos i
                        WHERE i.idEmpresa = @idEmpresa AND i.codigoSunat = @codigoSunat
                    )
                `);
            if (result.recordset && result.recordset[0]) {
                impuestosCreados.push(result.recordset[0]);
            }
        }
        return impuestosCreados;
    } catch (error) {
        console.error('Error creando impuestos predeterminados:', error);
        throw new Error('Error al crear impuestos predeterminados: ' + error.message);
    }
};

/**
 * Inicializa permisos y los asigna a roles predeterminados (Admin: todos; demás: preset).
 */
exports.inicializarPermisosPredeterminados = async (pool, idEmpresa, rolesCreados) => {
    await permisosRepository.inicializarPermisosDefecto(pool, idEmpresa);
    const permisos = await permisosRepository.obtenerPermisosPorEmpresa(pool, idEmpresa);
    const resumen = {};

    const rolAdmin = (rolesCreados || []).find((r) => r.descripcion === 'Administrador');
    if (!rolAdmin || !rolAdmin.idRol) {
        throw new Error('No se encontró el rol Administrador para asignar permisos');
    }
    for (const permiso of permisos) {
        await permisosRepository.asignarPermisoARol(pool, rolAdmin.idRol, permiso.idPermiso);
    }
    resumen.Administrador = permisos.length;

    for (const [nombreRol, nombresPermisos] of Object.entries(PERMISOS_PRESET_POR_ROL)) {
        const rol = (rolesCreados || []).find((r) => r.descripcion === nombreRol);
        if (!rol || !rol.idRol) continue;
        const asignados = await permisosRepository.asignarPermisosPorNombresARol(
            pool,
            idEmpresa,
            rol.idRol,
            nombresPermisos
        );
        resumen[nombreRol] = asignados.count;
    }

    return resumen;
};

/** @deprecated Use inicializarPermisosPredeterminados */
exports.inicializarPermisosAdministrador = exports.inicializarPermisosPredeterminados;

/**
 * Crea categorías base (General, Servicios) si no existen.
 */
exports.crearCategoriasPredeterminadas = async (pool, idEmpresa) => {
    const categoriasCreadas = [];
    try {
        for (const cat of CATEGORIAS_PREDETERMINADAS) {
            const existente = await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('nombre', sql.VarChar(200), cat.nombre)
                .query(`
                    SELECT TOP 1 idCategoria, nombre
                    FROM Categorias
                    WHERE idEmpresa = @idEmpresa AND LTRIM(RTRIM(nombre)) = @nombre
                `);
            if (existente.recordset && existente.recordset[0]) {
                categoriasCreadas.push(existente.recordset[0]);
                continue;
            }
            const insertado = await categoriaRepository.insertar(pool, idEmpresa, cat);
            if (insertado) {
                categoriasCreadas.push({ idCategoria: insertado.idCategoria, nombre: cat.nombre });
            }
        }
        return categoriasCreadas;
    } catch (error) {
        console.error('Error creando categorías predeterminadas:', error);
        throw new Error('Error al crear categorías predeterminadas: ' + error.message);
    }
};

/** Palabras clave del giro SUNAT/texto libre → código de rubro en catálogo Rubros. */
const RUBRO_TEXTO_A_CODIGO = [
    { codigo: 'GRF', patrones: ['grifo', 'combustible', 'gasolina', 'petroleo', 'petróleo', 'estacion de servicio', 'estación de servicio'] },
    { codigo: 'FERR', patrones: ['ferreter', 'ferret'] },
    { codigo: 'HOTEL', patrones: ['hotel', 'hospedaje', 'hostal'] },
    { codigo: 'REST', patrones: ['restaur', 'comida', 'cafeteria', 'cafetería'] },
    { codigo: 'ROPA', patrones: ['ropa', 'vestimenta', 'moda', 'calzado'] },
    { codigo: 'RETAIL', patrones: ['retail', 'comercio', 'tienda', 'minimarket', 'bodega'] }
];

/**
 * Resuelve idRubro a partir de texto libre (giro SUNAT) o idRubro explícito del body.
 */
exports.resolverIdRubroDesdeTexto = async (pool, rubroTexto, idRubroExplicito = null) => {
    if (idRubroExplicito != null && idRubroExplicito !== '') {
        const idNum = typeof idRubroExplicito === 'string' ? parseInt(idRubroExplicito, 10) : idRubroExplicito;
        if (Number.isFinite(idNum) && idNum > 0) {
            const rub = await rubrosRepository.obtenerPorId(pool, idNum);
            if (rub) return idNum;
        }
    }
    const texto = String(rubroTexto || '').trim().toLowerCase();
    if (!texto) return null;
    for (const regla of RUBRO_TEXTO_A_CODIGO) {
        if (regla.patrones.some((p) => texto.includes(p))) {
            const rub = await rubrosRepository.obtenerPorCodigo(pool, regla.codigo);
            if (rub) return rub.idRubro;
        }
    }
    try {
        const rubros = await rubrosRepository.listar(pool, { activo: true });
        const coincidencia = (rubros || []).find((r) => {
            const nombre = String(r.nombre || '').trim().toLowerCase();
            const codigo = String(r.codigo || '').trim().toLowerCase();
            return texto === nombre || texto.includes(nombre) || nombre.includes(texto) || texto === codigo;
        });
        if (coincidencia) return coincidencia.idRubro;
    } catch (_) {
        /* ignore */
    }
    return null;
};

/**
 * Asegura catálogos mínimos (categorías, marca SM, cliente público) y idRubro si falta.
 * Idempotente: puede ejecutarse varias veces sin duplicar.
 */
exports.asegurarDatosMaestrosEmpresa = async (pool, idEmpresa) => {
    const resultado = {
        categorias: [],
        marcas: [],
        clientePublico: null,
        idRubro: null
    };
    resultado.categorias = await exports.crearCategoriasPredeterminadas(pool, idEmpresa);
    resultado.marcas = await exports.crearMarcasPredeterminadas(pool, idEmpresa);
    resultado.clientePublico = await exports.crearClientePublicoGeneral(pool, idEmpresa);

    const empRes = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query('SELECT rubro, idRubro FROM Empresas WHERE idEmpresa = @idEmpresa');
    const emp = empRes.recordset && empRes.recordset[0] ? empRes.recordset[0] : null;
    if (emp && (emp.idRubro == null || emp.idRubro === '')) {
        const idRubro = await exports.resolverIdRubroDesdeTexto(pool, emp.rubro, null);
        if (idRubro) {
            await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('idRubro', sql.Int, idRubro)
                .query('UPDATE Empresas SET idRubro = @idRubro WHERE idEmpresa = @idEmpresa');
            resultado.idRubro = idRubro;
        }
    }
    return resultado;
};

/**
 * Indica si faltan datos maestros mínimos creados al registrar la empresa.
 */
async function empresaNecesitaDatosMaestros(pool, idEmpresa) {
    const catsRes = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT LTRIM(RTRIM(nombre)) AS nombre
            FROM Categorias
            WHERE idEmpresa = @idEmpresa
        `);
    const nombresCat = new Set((catsRes.recordset || []).map((r) => String(r.nombre || '').trim()));
    const faltanCategorias = CATEGORIAS_PREDETERMINADAS.some((c) => !nombresCat.has(c.nombre));

    const marRes = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT COUNT(*) AS total
            FROM Marcas
            WHERE idEmpresa = @idEmpresa AND LTRIM(RTRIM(nombre)) = 'SM'
        `);
    const faltaMarca = (marRes.recordset[0]?.total || 0) < 1;

    const clientePg = await clientesRepository.obtenerPorRuc(pool, idEmpresa, CLIENTE_PUBLICO_GENERAL.ruc);
    const nombreClienteOk = clientePg
        && String(clientePg.rSocial || '').trim().toUpperCase() === CLIENTE_PUBLICO_GENERAL.rSocial;
    const faltaCliente = !clientePg || !nombreClienteOk;

    const empRes = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query('SELECT rubro, idRubro FROM Empresas WHERE idEmpresa = @idEmpresa');
    const emp = empRes.recordset && empRes.recordset[0] ? empRes.recordset[0] : null;
    const faltaIdRubro = !!(emp && emp.rubro && (emp.idRubro == null || emp.idRubro === ''));

    return faltanCategorias || faltaMarca || faltaCliente || faltaIdRubro;
}

/**
 * Crea el cliente público general (DNI 00000000) para ventas sin identificar comprador.
 */
exports.crearClientePublicoGeneral = async (pool, idEmpresa) => {
    try {
        const existente = await clientesRepository.obtenerPorRuc(pool, idEmpresa, CLIENTE_PUBLICO_GENERAL.ruc);
        if (existente) {
            const nombreOk = String(existente.rSocial || '').trim().toUpperCase() === CLIENTE_PUBLICO_GENERAL.rSocial;
            if (!nombreOk) {
                await pool.request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .input('idCliente', sql.Int, existente.idCliente)
                    .input('rSocial', sql.VarChar, CLIENTE_PUBLICO_GENERAL.rSocial)
                    .query(`
                        UPDATE Clientes
                        SET rSocial = @rSocial
                        WHERE idCliente = @idCliente AND idEmpresa = @idEmpresa
                    `);
                existente.rSocial = CLIENTE_PUBLICO_GENERAL.rSocial;
            }
            return { ...existente, existente: true, actualizado: !nombreOk };
        }
        await clientesRepository.insertar(pool, {
            idEmpresa,
            ...CLIENTE_PUBLICO_GENERAL
        });
        const creado = await clientesRepository.obtenerPorRuc(pool, idEmpresa, CLIENTE_PUBLICO_GENERAL.ruc);
        return creado ? { ...creado, existente: false } : null;
    } catch (error) {
        console.error('Error creando cliente público general:', error);
        throw new Error('Error al crear cliente público general: ' + error.message);
    }
};

/**
 * Crea marcas base (SM = sin marca) si no existen.
 */
exports.crearMarcasPredeterminadas = async (pool, idEmpresa) => {
    const marcasCreadas = [];
    try {
        for (const marca of MARCAS_PREDETERMINADAS) {
            const existente = await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('nombre', sql.VarChar(50), marca.nombre)
                .query(`
                    SELECT TOP 1 idMarca, nombre
                    FROM Marcas
                    WHERE idEmpresa = @idEmpresa AND LTRIM(RTRIM(nombre)) = @nombre
                `);
            if (existente.recordset && existente.recordset[0]) {
                marcasCreadas.push(existente.recordset[0]);
                continue;
            }
            const insertado = await marcaRepository.insertar(pool, idEmpresa, marca);
            if (insertado) {
                marcasCreadas.push({ idMarca: insertado.idMarca, nombre: marca.nombre });
            }
        }
        return marcasCreadas;
    } catch (error) {
        console.error('Error creando marcas predeterminadas:', error);
        throw new Error('Error al crear marcas predeterminadas: ' + error.message);
    }
};

/**
 * Crea la caja principal de la sucursal principal si no existe.
 */
exports.crearCajaPrincipalPredeterminada = async (pool, idEmpresa, idSucursal) => {
    if (!idSucursal) {
        throw new Error('idSucursal es requerido para crear caja principal');
    }
    try {
        const existente = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            .query(`
                SELECT TOP 1 idCaja, nombre
                FROM Cajas
                WHERE idEmpresa = @idEmpresa AND idSucursal = @idSucursal AND ISNULL(estado, 1) = 1
                ORDER BY CASE WHEN nombre = 'Caja Principal' THEN 0 ELSE 1 END
            `);
        if (existente.recordset && existente.recordset[0]) {
            return { ...existente.recordset[0], existente: true };
        }
        const creada = await cajaRepository.crearCajaRepo(pool, idEmpresa, {
            idSucursal,
            nombre: 'Caja Principal',
            descripcion: 'Caja predeterminada de la sucursal principal'
        });
        return creada ? { idCaja: creada.idCaja, nombre: 'Caja Principal', existente: false } : null;
    } catch (error) {
        console.error('Error creando caja principal predeterminada:', error);
        throw new Error('Error al crear caja principal predeterminada: ' + error.message);
    }
};

/**
 * Construye pasos del wizard de onboarding para el frontend.
 */
function construirPasosOnboarding(flags) {
    return [
        {
            id: 'empresa',
            orden: 1,
            titulo: 'Datos de empresa',
            descripcion: 'Sube el logo y completa rubro y celular',
            completo: !!flags.empresaCompleta,
            ruta: '/editar-empresa',
            icono: 'bi-building'
        },
        {
            id: 'colaborador',
            orden: 2,
            titulo: 'Primer usuario',
            descripcion: 'Crea un colaborador (recomendado: rol Administrador)',
            completo: !!flags.tieneColaboradores,
            ruta: '/colaborador/create',
            icono: 'bi-person-plus'
        },
        {
            id: 'producto',
            orden: 3,
            titulo: 'Primer producto',
            descripcion: 'Registra al menos un producto para vender',
            completo: !!flags.tieneProductos,
            ruta: '/productos/create',
            icono: 'bi-box'
        },
        {
            id: 'caja',
            orden: 4,
            titulo: 'Gestionar cajas',
            descripcion: 'Verifica la Caja Principal o crea la que usarás',
            completo: !!flags.tieneCajas,
            ruta: '/caja',
            icono: 'bi-cash-stack'
        },
        {
            id: 'apertura',
            orden: 5,
            titulo: 'Abrir caja',
            descripcion: 'Para abrir una caja, debes iniciar sesion con el colaborador administrador',
            completo: !!flags.tieneCajaAbierta,
            ruta: '/caja?onboarding=apertura',
            icono: 'bi-unlock'
        },
        {
            id: 'venta',
            orden: 6,
            titulo: 'Primera venta',
            descripcion: 'Registra una venta de prueba (cliente Público en general)',
            completo: !!flags.tieneVentas,
            ruta: '/ventas/rapida',
            icono: 'bi-lightning-charge'
        }
    ];
}








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
        impuestos: [],
        permisos: null,
        categorias: [],
        marcas: [],
        cajaPrincipal: null,
        clientePublico: null,
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

        // 2b. Caja principal en la sucursal
        if (resultado.sucursal && resultado.sucursal.idSucursal) {
            try {
                resultado.cajaPrincipal = await exports.crearCajaPrincipalPredeterminada(
                    pool,
                    idEmpresa,
                    resultado.sucursal.idSucursal
                );
            } catch (error) {
                console.error('⚠️ Error creando caja principal:', error.message);
                resultado.errores.push({ tipo: 'cajaPrincipal', mensaje: error.message });
            }
        }

        // 3. Crear comprobantes en la sucursal principal
        try {
            if (resultado.sucursal && resultado.sucursal.idSucursal) {
                resultado.comprobantes = await exports.crearComprobantesPredeterminados(
                    pool,
                    idEmpresa,
                    resultado.sucursal.idSucursal,
                    datosEmpresa.idRubro || null
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

        // 10. Tributos predeterminados (Exonerado e IGV)
        try {
            resultado.impuestos = await exports.crearImpuestosPredeterminados(pool, idEmpresa);
        } catch (error) {
            console.error('⚠️ Error creando impuestos predeterminados:', error.message);
            resultado.errores.push({ tipo: 'impuestos', mensaje: error.message });
        }

        // 11. Permisos del sistema asignados a roles predeterminados
        try {
            resultado.permisos = await exports.inicializarPermisosPredeterminados(pool, idEmpresa, resultado.roles);
        } catch (error) {
            console.error('⚠️ Error inicializando permisos:', error.message);
            resultado.errores.push({ tipo: 'permisos', mensaje: error.message });
        }

        // 12. Categorías base de productos
        try {
            resultado.categorias = await exports.crearCategoriasPredeterminadas(pool, idEmpresa);
        } catch (error) {
            console.error('⚠️ Error creando categorías predeterminadas:', error.message);
            resultado.errores.push({ tipo: 'categorias', mensaje: error.message });
        }

        // 13. Cliente público general (boletas / ventas sin DNI)
        try {
            resultado.clientePublico = await exports.crearClientePublicoGeneral(pool, idEmpresa);
        } catch (error) {
            console.error('⚠️ Error creando cliente público general:', error.message);
            resultado.errores.push({ tipo: 'clientePublico', mensaje: error.message });
        }

        // 14. Marcas base (SM = sin marca)
        try {
            resultado.marcas = await exports.crearMarcasPredeterminadas(pool, idEmpresa);
        } catch (error) {
            console.error('⚠️ Error creando marcas predeterminadas:', error.message);
            resultado.errores.push({ tipo: 'marcas', mensaje: error.message });
        }

        // 15. Reparación idempotente por si algún paso anterior falló parcialmente
        try {
            const reparacion = await exports.asegurarDatosMaestrosEmpresa(pool, idEmpresa);
            if (reparacion.idRubro) {
                resultado.idRubro = reparacion.idRubro;
            }
        } catch (error) {
            console.error('⚠️ Error asegurando datos maestros:', error.message);
            resultado.errores.push({ tipo: 'datosMaestros', mensaje: error.message });
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
        try {
            if (await empresaNecesitaDatosMaestros(pool, idEmpresa)) {
                await exports.asegurarDatosMaestrosEmpresa(pool, idEmpresa);
            }
        } catch (errMaestros) {
            console.error('obtenerEstadoConfiguracion asegurarDatosMaestros:', errMaestros.message);
        }

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

        // Empresa gestionada por otra (destino activo en Gestores_Empresas)
        const gestionadaPor = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query('SELECT COUNT(*) as total FROM Gestores_Empresas WHERE idEmpresaDestino = @idEmpresa AND estado = 1');

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

        // GRE transportista (31): solo si la empresa tiene al menos un vehículo registrado
        let puedeEmitirGuiaTransportista = false;
        try {
            const veh = await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .query('SELECT COUNT(*) AS total FROM Vehiculos WHERE idEmpresa = @idEmpresa');
            puedeEmitirGuiaTransportista = (veh.recordset?.[0]?.total || 0) > 0;
        } catch (_) {
            puedeEmitirGuiaTransportista = false;
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

        let tieneLogo = false;
        let empresaCompleta = false;
        try {
            const emp = await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .query(`
                    SELECT logo, rubro, celular
                    FROM Empresas
                    WHERE idEmpresa = @idEmpresa
                `);
            const row = emp.recordset && emp.recordset[0] ? emp.recordset[0] : null;
            if (row) {
                tieneLogo = row.logo != null && String(row.logo).trim() !== '';
                const rubroOk = row.rubro != null && String(row.rubro).trim() !== '';
                const celularOk = row.celular != null && String(row.celular).trim() !== '';
                empresaCompleta = tieneLogo && rubroOk && celularOk;
            }
        } catch (_) {}

        let cantidadCajas = 0;
        let tieneCajaAbierta = false;
        try {
            const cajasRes = await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .query(`
                    SELECT COUNT(*) AS total
                    FROM Cajas
                    WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1
                `);
            cantidadCajas = cajasRes.recordset[0]?.total || 0;
        } catch (_) {}

        try {
            const aperturaRes = await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .query(`
                    SELECT COUNT(*) AS total
                    FROM AperturasCaja ac
                    INNER JOIN Cajas c ON c.idCaja = ac.idCaja AND c.idEmpresa = @idEmpresa
                    WHERE ac.estado = 1
                `);
            tieneCajaAbierta = (aperturaRes.recordset[0]?.total || 0) > 0;
        } catch (_) {}

        let cantidadVentas = 0;
        try {
            const ventasRes = await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .query(`
                    SELECT COUNT(*) AS total
                    FROM Ventas
                    WHERE idEmpresa = @idEmpresa
                `);
            cantidadVentas = ventasRes.recordset[0]?.total || 0;
        } catch (_) {}

        const flagsOnboarding = {
            empresaCompleta,
            tieneColaboradores: colaboradores.recordset[0].total > 0,
            tieneProductos: productos.recordset[0].total > 0,
            tieneCajas: cantidadCajas > 0,
            tieneCajaAbierta,
            tieneVentas: cantidadVentas > 0
        };
        const pasosOnboarding = construirPasosOnboarding(flagsOnboarding);
        const pasosRequeridos = pasosOnboarding.length;
        const pasosCompletados = pasosOnboarding.filter((p) => p.completo).length;
        const onboardingCompleto = pasosCompletados >= pasosRequeridos;
        const esGestoraFlag = gestionadas.recordset[0].total > 0;

        return {
            tieneColaboradores: colaboradores.recordset[0].total > 0,
            cantidadColaboradores: colaboradores.recordset[0].total,
            esGestora: esGestoraFlag,
            cantidadEmpresasGestionadas: gestionadas.recordset[0].total,
            esEmpresaGestionada: gestionadaPor.recordset[0].total > 0,
            tieneProductos: productos.recordset[0].total > 0,
            cantidadProductos: productos.recordset[0].total,
            tieneProveedores: proveedores.recordset[0].total > 0,
            cantidadProveedores: proveedores.recordset[0].total,
            tieneClientes: clientes.recordset[0].total > 0,
            cantidadClientes: clientes.recordset[0].total,
            tieneCajas: cantidadCajas > 0,
            cantidadCajas,
            tieneCajaAbierta,
            tieneVentas: cantidadVentas > 0,
            cantidadVentas,
            tieneLogo,
            empresaCompleta,
            habilitarGuiasElectronicas,
            puedeEmitirGuiaTransportista: habilitarGuiasElectronicas && puedeEmitirGuiaTransportista,
            permitirVentaMultiSucursal,
            pasosOnboarding,
            onboardingProgreso: pasosRequeridos > 0 ? Math.round((pasosCompletados / pasosRequeridos) * 100) : 100,
            onboardingCompleto,
            mostrarOnboarding: !esGestoraFlag && !onboardingCompleto,
            configuracionCompleta: onboardingCompleto
        };

    } catch (error) {
        console.error('Error obteniendo estado de configuración:', error);
        throw new Error('Error al obtener estado de configuración: ' + error.message);
    }
};

module.exports = exports;
