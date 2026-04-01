// SIEMPRE valida reglas de negocio aquí (regla 1.3)
// NUNCA hagas cálculos de precios/impuestos en repositories
const permisosRepository = require('../repositories/permisos.repository');
const gestoresRepository = require('../repositories/gestores.repository');

/**
 * Navegación reducida para empresa gestora (tiene empresas gestionadas activas).
 * Consultas: Dashboard + Análisis. Ventas: nueva, historial, cotizaciones.
 * Caja: gestión, ventas pendientes, cobranza, pago proveedores, recibos, arqueo. Despachos: módulo completo. Empresa mínima.
 */
function construirNavegacionEmpresaGestora(esAdmin, permisos, tieneVerEnviosChofer) {
    const can = (p) => esAdmin || permisos.includes(p);
    const items = [];

    if (can('VER_DASHBOARD')) {
        items.push({
            modulo: 'DASHBOARD',
            nombre: 'Dashboard',
            icono: 'bi bi-speedometer2',
            ruta: '/home',
            permiso: 'VER_DASHBOARD',
            visible: true
        });
    }
    if (can('VER_ANALISIS')) {
        items.push({
            modulo: 'ANALISIS',
            nombre: 'Análisis',
            icono: 'bi bi-graph-up',
            ruta: '/analisis',
            permiso: 'VER_ANALISIS',
            visible: true
        });
    }

    items.push({ tipo: 'separador' });

    const subVentas = [];
    if (can('CREAR_VENTAS')) {
        subVentas.push({ nombre: 'Nueva Venta', ruta: '/ventas/create', permiso: 'CREAR_VENTAS', visible: true });
    }
    if (can('VER_VENTAS')) {
        subVentas.push({ nombre: 'Historial', ruta: '/ventas', permiso: 'VER_VENTAS', visible: true });
        subVentas.push({ nombre: 'Cotizaciones', ruta: '/cotizaciones', permiso: 'VER_VENTAS', visible: true });
    }
    if (subVentas.length > 0) {
        items.push({
            modulo: 'VENTAS',
            nombre: 'Ventas',
            icono: 'bi bi-cart',
            ruta: null,
            permiso: 'VER_VENTAS',
            visible: true,
            submenu: subVentas
        });
    }

    const subCaja = [];
    if (can('VER_CAJA')) {
        subCaja.push({ nombre: 'Gestión de Cajas', ruta: '/caja', permiso: 'VER_CAJA', visible: true });
        subCaja.push({ nombre: 'Ventas pendientes de pago', ruta: '/caja/ventas-pendientes-pago', permiso: 'VER_CAJA', visible: true });
    }
    if (can('VER_CREDITOS')) {
        subCaja.push({ nombre: 'Cobranza de Créditos', ruta: '/creditos', permiso: 'VER_CREDITOS', visible: true });
    }
    if (can('VER_COMPRAS')) {
        subCaja.push({ nombre: 'Pago a Proveedores', ruta: '/caja/pago-proveedores', permiso: 'VER_COMPRAS', visible: true });
    }
    if (can('REGISTRAR_MOVIMIENTOS')) {
        subCaja.push({ nombre: 'Recibo Ingreso', ruta: '/caja/recibo-ingreso', permiso: 'REGISTRAR_MOVIMIENTOS', visible: true });
        subCaja.push({ nombre: 'Recibo Egreso', ruta: '/caja/recibo-egreso', permiso: 'REGISTRAR_MOVIMIENTOS', visible: true });
    }
    if (can('VER_ARQUEO') || can('VER_CAJA')) {
        subCaja.push({ nombre: 'Arqueo de Caja', ruta: '/caja/arqueo', permiso: 'VER_ARQUEO', visible: true });
    }
    if (subCaja.length > 0) {
        items.push({
            modulo: 'CAJA',
            nombre: 'Caja',
            icono: 'bi bi-cash-coin',
            ruta: null,
            permiso: 'VER_CAJA',
            visible: true,
            submenu: subCaja
        });
    }

    items.push({ tipo: 'separador' });

    const subDespachos = [
        {
            nombre: 'Despachos',
            ruta: '/despachos',
            permiso: 'VER_DESPACHOS',
            visible: esAdmin || permisos.includes('VER_DESPACHOS')
        },
        {
            nombre: 'Envios programados',
            ruta: '/envios',
            permiso: 'VER_ENVIOS',
            visible: esAdmin || permisos.includes('VER_ENVIOS')
        },
        {
            nombre: 'Mis envíos (Chofer)',
            ruta: '/envios/mis-envios',
            permiso: 'VER_ENVIOS_CHOFER',
            visible: esAdmin || tieneVerEnviosChofer
        }
    ].filter((s) => s.visible);
    if (subDespachos.length > 0) {
        items.push({
            modulo: 'DESPACHOS',
            nombre: 'Despachos',
            icono: 'bi bi-truck',
            ruta: null,
            permiso: 'VER_DESPACHOS',
            visible: true,
            submenu: subDespachos
        });
    }

    if (can('VER_EMPRESA')) {
        items.push({
            modulo: 'EMPRESA',
            nombre: 'Empresa',
            icono: 'bi bi-building-check',
            ruta: '/editar-empresa',
            permiso: 'VER_EMPRESA',
            visible: true
        });
    }

    return items.filter((item) => {
        if (item.tipo === 'separador') return true;
        if (!item.visible) return false;
        if (item.submenu) {
            item.submenu = item.submenu.filter((sub) => sub.visible);
            if (item.submenu.length === 0) return false;
        }
        return true;
    });
}

/**
 * Obtiene los permisos de un usuario
 */
const obtenerPermisosUsuario = async (pool, user) => {
    // SIEMPRE filtra por idEmpresa en TODAS las consultas (regla 1.6)
    if (!user || !user.empresa || !user.sub) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    const permisos = await permisosRepository.obtenerPermisosPorUsuario(
        pool, 
        user.sub, 
        user.empresa
    );

    // Agrupar permisos por módulo para el frontend
    const permisosPorModulo = {};
    permisos.forEach(permiso => {
        if (!permisosPorModulo[permiso.modulo]) {
            permisosPorModulo[permiso.modulo] = [];
        }
        permisosPorModulo[permiso.modulo].push(permiso.nombre);
    });

    return {
        permisos: permisos,
        permisosPorModulo: permisosPorModulo,
        listaPermisos: permisos.map(p => p.nombre)
    };
};

/**
 * Obtiene todos los permisos de la empresa
 */
const obtenerPermisosEmpresa = async (pool, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    // Solo administradores pueden ver todos los permisos
    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
    }

    return await permisosRepository.obtenerPermisosPorEmpresa(pool, user.empresa);
};

/**
 * Obtiene los permisos de un rol específico
 */
const obtenerPermisosRol = async (pool, idRol, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
    }

    return await permisosRepository.obtenerPermisosPorRol(pool, idRol, user.empresa);
};

/**
 * Crea un nuevo permiso
 */
const crearPermiso = async (pool, nombre, descripcion, modulo, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
    }

    // Validaciones de negocio
    if (!nombre || nombre.trim().length === 0) {
        throw new Error('NOMBRE_REQUERIDO');
    }

    if (!modulo || modulo.trim().length === 0) {
        throw new Error('MODULO_REQUERIDO');
    }

    // Normalizar nombre a mayúsculas
    const nombreNormalizado = nombre.toUpperCase().replace(/\s+/g, '_');

    return await permisosRepository.crearPermiso(
        pool, 
        user.empresa, 
        nombreNormalizado, 
        descripcion, 
        modulo.toUpperCase()
    );
};

/**
 * Actualiza los permisos de un rol
 */
const actualizarPermisosRol = async (pool, idRol, permisosIds, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
    }

    if (!Array.isArray(permisosIds)) {
        throw new Error('PERMISOS_INVALIDOS');
    }

    return await permisosRepository.actualizarPermisosDeRol(pool, idRol, permisosIds);
};

/**
 * Verifica si el usuario tiene un permiso específico
 */
const verificarPermisoUsuario = async (pool, nombrePermiso, user) => {
    if (!user || !user.empresa || !user.sub) {
        return false;
    }

    // El administrador tiene todos los permisos
    if (user.rol === 'Administrador') {
        return true;
    }

    return await permisosRepository.verificarPermiso(
        pool, 
        user.sub, 
        user.empresa, 
        nombrePermiso
    );
};

/**
 * Obtiene los módulos disponibles
 */
const obtenerModulos = async (pool, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    return await permisosRepository.obtenerModulosConPermisos(pool, user.empresa);
};

/**
 * Inicializa los permisos por defecto para la empresa
 */
const inicializarPermisos = async (pool, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
    }

    return await permisosRepository.inicializarPermisosDefecto(pool, user.empresa);
};

/**
 * Obtiene la estructura de navegación del sidebar basada en permisos
 */
const obtenerNavegacionSidebar = async (pool, user) => {
    if (!user || !user.empresa || !user.sub) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    // Obtener permisos del usuario
    const permisosData = await obtenerPermisosUsuario(pool, user);
    const permisos = permisosData.listaPermisos;

    // Si es administrador, tiene acceso a todo
    const esAdmin = user.rol === 'Administrador';
    // Chofer/Conductor: fallback para VER_ENVIOS_CHOFER si no está en permisos (p. ej. rol con otro nombre)
    const rolNorm = (user.rol || '').toString().trim().toUpperCase();
    const esChofer = (rolNorm === 'CHOFER' || rolNorm === 'CONDUCTOR');
    const tieneVerEnviosChofer = permisos.includes('VER_ENVIOS_CHOFER') || esChofer;

    // Definir estructura de navegación
    const navegacion = [
        {
            modulo: 'DASHBOARD',
            nombre: 'Dashboard',
            icono: 'bi bi-speedometer2',
            ruta: '/home',
            permiso: 'VER_DASHBOARD',
            visible: esAdmin || permisos.includes('VER_DASHBOARD')
        },
        {
            modulo: 'CAJA',
            nombre: 'Caja',
            icono: 'bi bi-cash-coin',
            ruta: null,
            permiso: 'VER_CAJA',
            visible: esAdmin || permisos.includes('VER_CAJA'),
            submenu: [
                {
                    nombre: 'Gestión de Cajas',
                    ruta: '/caja',
                    permiso: 'VER_CAJA',
                    visible: esAdmin || permisos.includes('VER_CAJA')
                },
                {
                    nombre: 'Ventas pendientes de pago',
                    ruta: '/caja/ventas-pendientes-pago',
                    permiso: 'VER_CAJA',
                    visible: esAdmin || permisos.includes('VER_CAJA')
                },
                {
                    nombre: 'Cobranza de Créditos',
                    ruta: '/creditos',
                    permiso: 'VER_CREDITOS',
                    visible: esAdmin || permisos.includes('VER_CREDITOS')
                },
                {
                    nombre: 'Pago a Proveedores',
                    ruta: '/caja/pago-proveedores',
                    permiso: 'VER_COMPRAS',
                    visible: esAdmin || permisos.includes('VER_COMPRAS')
                },
                {
                    nombre: 'Recibo Ingreso',
                    ruta: '/caja/recibo-ingreso',
                    permiso: 'REGISTRAR_MOVIMIENTOS',
                    visible: esAdmin || permisos.includes('REGISTRAR_MOVIMIENTOS')
                },
                {
                    nombre: 'Recibo Egreso',
                    ruta: '/caja/recibo-egreso',
                    permiso: 'REGISTRAR_MOVIMIENTOS',
                    visible: esAdmin || permisos.includes('REGISTRAR_MOVIMIENTOS')
                },
                {
                    nombre: 'Arqueo de Caja',
                    ruta: '/caja/arqueo',
                    permiso: 'VER_ARQUEO',
                    visible: esAdmin || permisos.includes('VER_ARQUEO')
                },
                {
                    nombre: 'Conteo de Dinero',
                    ruta: '/caja/conteo-dinero',
                    permiso: 'VER_CAJA',
                    visible: esAdmin || permisos.includes('VER_CAJA')
                }
            ]
        },
        {
            modulo: 'ANALISIS',
            nombre: 'Análisis',
            icono: 'bi bi-graph-up',
            ruta: '/analisis',
            permiso: 'VER_ANALISIS',
            visible: esAdmin || permisos.includes('VER_ANALISIS')
        },
        {
            tipo: 'separador'
        },
        {
            modulo: 'VENTAS',
            nombre: 'Ventas',
            icono: 'bi bi-cart',
            ruta: null,
            permiso: 'VER_VENTAS',
            visible: esAdmin || permisos.includes('VER_VENTAS'),
            submenu: [
                { nombre: 'Nueva Venta', ruta: '/ventas/create', permiso: 'CREAR_VENTAS', visible: esAdmin || permisos.includes('CREAR_VENTAS') },
                { nombre: 'Historial', ruta: '/ventas', permiso: 'VER_VENTAS', visible: esAdmin || permisos.includes('VER_VENTAS') },
                { nombre: 'Cotizaciones', ruta: '/cotizaciones', permiso: 'VER_VENTAS', visible: esAdmin || permisos.includes('VER_VENTAS') },
                { nombre: 'Clientes', ruta: '/clientes', permiso: 'VER_CLIENTES', visible: esAdmin || permisos.includes('VER_CLIENTES') }
            ]
        },
        {
            modulo: 'COMPRAS',
            nombre: 'Compras',
            icono: 'bi bi-bag',
            ruta: null,
            permiso: 'VER_COMPRAS',
            visible: esAdmin || permisos.includes('VER_COMPRAS'),
            submenu: [
                { nombre: 'Registrar Compras', ruta: '/compras/create', permiso: 'CREAR_COMPRAS', visible: esAdmin || permisos.includes('CREAR_COMPRAS') },
                { nombre: 'Consultar Compras', ruta: '/compras', permiso: 'VER_COMPRAS', visible: esAdmin || permisos.includes('VER_COMPRAS') },
                { nombre: 'Proveedores', ruta: '/proveedores', permiso: 'VER_PROVEEDORES', visible: esAdmin || permisos.includes('VER_PROVEEDORES') }
            ]
        },
        {
            modulo: 'INVENTARIO',
            nombre: 'Inventario',
            icono: 'bi bi-boxes',
            ruta: null,
            permiso: 'VER_INVENTARIO',
            visible: esAdmin || permisos.includes('VER_INVENTARIO'),
            submenu: [
                { nombre: 'Stock General', ruta: '/inventario', permiso: 'VER_INVENTARIO', visible: esAdmin || permisos.includes('VER_INVENTARIO') },
                { nombre: 'Stock Actual', ruta: '/inventario/stock-actual', permiso: 'VER_INVENTARIO', visible: esAdmin || permisos.includes('VER_INVENTARIO') },
                { nombre: 'Productos vendidos', ruta: '/inventario/productos-vendidos', permiso: 'VER_INVENTARIO', visible: esAdmin || permisos.includes('VER_INVENTARIO') },
                { nombre: 'Productos comprados', ruta: '/inventario/productos-comprados', permiso: 'VER_INVENTARIO', visible: esAdmin || permisos.includes('VER_INVENTARIO') },
                { nombre: 'Ingresos y salidas', ruta: '/inventario/ingreso-salida', permiso: 'VER_INVENTARIO', visible: esAdmin || permisos.includes('VER_INVENTARIO') },
                { nombre: 'Lotes', ruta: '/inventario/lotes', permiso: 'GESTIONAR_LOTES', visible: esAdmin || permisos.includes('GESTIONAR_LOTES') },
                { nombre: 'Ubicaciones', ruta: '/inventario/ubicaciones', permiso: 'GESTIONAR_LOTES', visible: esAdmin || permisos.includes('GESTIONAR_LOTES') },
                { nombre: 'Movimientos', ruta: '/inventario/movimientos', permiso: 'VER_INVENTARIO', visible: esAdmin || permisos.includes('VER_INVENTARIO') },
                { nombre: 'Movimiento entre ubicaciones', ruta: '/inventario/movimiento-entre-ubicaciones', permiso: 'TRANSFERIR_STOCK', visible: esAdmin || permisos.includes('TRANSFERIR_STOCK') },
                { nombre: 'Kardex', ruta: '/inventario/kardex', permiso: 'VER_INVENTARIO', visible: esAdmin || permisos.includes('VER_INVENTARIO') }
            ]
        },
        {
            modulo: 'PRODUCTOS',
            nombre: 'Productos',
            icono: 'bi bi-box',
            ruta: null,
            permiso: 'VER_PRODUCTOS',
            visible: esAdmin || permisos.includes('VER_PRODUCTOS'),
            submenu: [
                { nombre: 'Lista de Productos', ruta: '/productos', permiso: 'VER_PRODUCTOS', visible: esAdmin || permisos.includes('VER_PRODUCTOS') },
                { nombre: 'Categorías', ruta: '/categorias', permiso: 'VER_PRODUCTOS', visible: esAdmin || permisos.includes('VER_PRODUCTOS') },
                { nombre: 'Marcas', ruta: '/marcas', permiso: 'VER_PRODUCTOS', visible: esAdmin || permisos.includes('VER_PRODUCTOS') },
                { nombre: 'Precios', ruta: '/precios', permiso: 'GESTIONAR_PRECIOS', visible: esAdmin || permisos.includes('GESTIONAR_PRECIOS') }
            ]
        },
        {
            modulo: 'CLIENTES',
            nombre: 'Clientes',
            icono: 'bi bi-people',
            ruta: null,
            permiso: 'VER_CLIENTES',
            visible: esAdmin || permisos.includes('VER_CLIENTES'),
            submenu: [
                { nombre: 'Lista de Clientes', ruta: '/clientes', permiso: 'VER_CLIENTES', visible: esAdmin || permisos.includes('VER_CLIENTES') },
                { nombre: 'Nuevo Cliente', ruta: '/cliente/create', permiso: 'CREAR_CLIENTES', visible: esAdmin || permisos.includes('CREAR_CLIENTES') }
            ]
        },
        {
            tipo: 'separador'
        },
        {
            modulo: 'CATALOGOS',
            nombre: 'Catálogos',
            icono: 'bi bi-journal-bookmark',
            ruta: null,
            permiso: 'VER_CONFIGURACION',
            visible: esAdmin || permisos.includes('VER_CONFIGURACION'),
            submenu: [
                { nombre: 'Forma Pago', ruta: '/catalogos/forma-pago', permiso: 'VER_CONFIGURACION', visible: esAdmin || permisos.includes('VER_CONFIGURACION') },
                { nombre: 'Tipo Movimientos', ruta: '/catalogos/tipo-movimientos', permiso: 'VER_CONFIGURACION', visible: esAdmin || permisos.includes('VER_CONFIGURACION') },
                { nombre: 'Conceptos', ruta: '/catalogos/conceptos', permiso: 'VER_CONFIGURACION', visible: esAdmin || permisos.includes('VER_CONFIGURACION') },
                { nombre: 'Clasificación Conceptos', ruta: '/catalogos/clasificacion-conceptos', permiso: 'VER_CONFIGURACION', visible: esAdmin || permisos.includes('VER_CONFIGURACION') },
                { nombre: 'Motivo Traslado', ruta: '/catalogos/motivo-traslado', permiso: 'VER_CONFIGURACION', visible: esAdmin || permisos.includes('VER_CONFIGURACION') },
                { nombre: 'Motivo Nota Credito', ruta: '/catalogos/motivo-nota-credito', permiso: 'VER_CONFIGURACION', visible: esAdmin || permisos.includes('VER_CONFIGURACION') }
            ]
        },
        {
            modulo: 'DESPACHOS',
            nombre: 'Despachos',
            icono: 'bi bi-truck',
            ruta: null,
            permiso: 'VER_DESPACHOS',
            // El módulo se muestra si el usuario puede ver despachos o al menos alguno de los envíos.
            visible:
                esAdmin ||
                permisos.includes('VER_DESPACHOS') ||
                permisos.includes('VER_ENVIOS') ||
                tieneVerEnviosChofer,
            submenu: [
                {
                    nombre: 'Despachos',
                    ruta: '/despachos',
                    permiso: 'VER_DESPACHOS',
                    visible: esAdmin || permisos.includes('VER_DESPACHOS')
                },
                {
                    nombre: 'Envios programados',
                    ruta: '/envios',
                    permiso: 'VER_ENVIOS',
                    visible: esAdmin || permisos.includes('VER_ENVIOS')
                },
                {
                    nombre: 'Mis envíos (Chofer)',
                    ruta: '/envios/mis-envios',
                    permiso: 'VER_ENVIOS_CHOFER',
                    visible: esAdmin || tieneVerEnviosChofer
                }
            ]
        },
        {
            modulo: 'FACTURACION',
            nombre: 'Facturación',
            icono: 'bi bi-file-earmark-text',
            ruta: null,
            permiso: 'VER_CONFIGURACION',
            visible: esAdmin || permisos.includes('VER_CONFIGURACION'),
            submenu: [
                { nombre: 'Resumen diario', ruta: '/facturacion/resumenes-diarios', permiso: 'VER_CONFIGURACION', visible: esAdmin || permisos.includes('VER_CONFIGURACION') },
                { nombre: 'Emisión de notas', ruta: '/facturacion/notas-credito-debito', permiso: 'VER_CONFIGURACION', visible: esAdmin || permisos.includes('VER_CONFIGURACION') },
                { nombre: 'Comunicación de baja', ruta: '/facturacion/comunicacion-baja', permiso: 'VER_CONFIGURACION', visible: esAdmin || permisos.includes('VER_CONFIGURACION') }
            ]
        },
        {
            modulo: 'CONFIGURACION',
            nombre: 'Configuración',
            icono: 'bi bi-gear',
            ruta: null,
            permiso: 'VER_CONFIGURACION',
            visible: esAdmin || permisos.includes('VER_CONFIGURACION'),
            submenu: [
                { nombre: 'General', ruta: '/configuracion', permiso: 'VER_CONFIGURACION', visible: esAdmin || permisos.includes('VER_CONFIGURACION') },
                { nombre: 'Sucursales', ruta: '/sucursal', permiso: 'GESTIONAR_SUCURSALES', visible: esAdmin || permisos.includes('GESTIONAR_SUCURSALES') },
                { nombre: 'Colaboradores', ruta: '/colaborador', permiso: 'VER_USUARIOS', visible: esAdmin || permisos.includes('VER_USUARIOS') },
                { nombre: 'Roles', ruta: '/rol', permiso: 'GESTIONAR_ROLES', visible: esAdmin || permisos.includes('GESTIONAR_ROLES') },
                { nombre: 'Log de auditoría', ruta: '/auditoria', permiso: 'VER_CONFIGURACION', visible: esAdmin || permisos.includes('VER_CONFIGURACION') }
            ]
        },
        {
            modulo: 'REPORTES',
            nombre: 'Reportes',
            icono: 'bi bi-bar-chart',
            ruta: '/reportes',
            permiso: 'VER_REPORTES',
            visible: esAdmin || permisos.includes('VER_REPORTES')
        },
        {
            modulo: 'UTILIDADES',
            nombre: 'Utilidades',
            icono: 'bi bi-graph-up-arrow',
            ruta: '/utilidades',
            permiso: 'VER_UTILIDADES',
            visible: esAdmin
        },
        {
            modulo: 'EMPRESA',
            nombre: 'Empresa',
            icono: 'bi bi-building-check',
            ruta: '/editar-empresa',
            permiso: 'VER_EMPRESA',
            visible: esAdmin || permisos.includes('VER_EMPRESA')
        }
    ];

    // Filtrar solo los elementos visibles
    let resultado = navegacion.filter(item => {
        if (item.tipo === 'separador') return true;
        if (!item.visible) return false;
        
        // Filtrar submenu si existe
        if (item.submenu) {
            item.submenu = item.submenu.filter(sub => sub.visible);
            // Ocultar el menú si no tiene submenús visibles
            if (item.submenu.length === 0) return false;
        }
        
        return true;
    });

    const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
    if (esGestora) {
        resultado = construirNavegacionEmpresaGestora(esAdmin, permisos, tieneVerEnviosChofer);
    }

    return resultado;
};

module.exports = {
    obtenerPermisosUsuario,
    obtenerPermisosEmpresa,
    obtenerPermisosRol,
    crearPermiso,
    actualizarPermisosRol,
    verificarPermisoUsuario,
    obtenerModulos,
    inicializarPermisos,
    obtenerNavegacionSidebar
};
