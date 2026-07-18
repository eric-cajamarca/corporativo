/**
 * Navegación del sidebar por dominios desplegables (Fase 1).
 * Cada dominio es un menú colapsable; dentro, módulos con enlaces (acordeón en el SPA).
 */

const DOMINIO_MODULO_KEY = {
  Comercial: 'DOMINIO_COMERCIAL',
  Abastecimiento: 'DOMINIO_ABASTECIMIENTO',
  'Tesorería': 'DOMINIO_TESORERIA',
  Distribución: 'DOMINIO_DISTRIBUCION',
  'Fiscal (SUNAT)': 'DOMINIO_FISCAL',
  Plataforma: 'DOMINIO_PLATAFORMA'
};

const DOMINIO_ICONO = {
  Comercial: 'bi bi-basket',
  Abastecimiento: 'bi bi-box-seam',
  'Tesorería': 'bi bi-wallet2',
  Distribución: 'bi bi-truck',
  'Fiscal (SUNAT)': 'bi bi-file-earmark-text',
  Plataforma: 'bi bi-sliders'
};

function filtrarVisible(item) {
  if (item.visible === false) return false;
  if (item.submenu) {
    item.submenu = item.submenu.filter((sub) => sub.visible !== false);
    return item.submenu.length > 0;
  }
  return true;
}

/** Módulo con submenú dentro de un dominio. */
function moduloEnSubmenu(mod) {
  const links = (mod.submenu || []).filter((s) => s.visible !== false);
  if (!links.length) return null;
  return {
    tipo: 'modulo',
    modulo: mod.modulo,
    nombre: mod.nombre,
    icono: mod.icono || 'bi bi-folder2',
    visible: true,
    submenu: links
  };
}

/** Enlace directo o módulo hijo dentro del dominio. */
function itemEnSubmenuDominio(item) {
  if (item.visible === false) return null;
  if (item.ruta && !item.submenu) {
    return {
      nombre: item.nombre,
      ruta: item.ruta,
      permiso: item.permiso || '',
      visible: true,
      modulo: item.modulo || null
    };
  }
  if (item.submenu && item.submenu.length) {
    return moduloEnSubmenu(item);
  }
  return null;
}

function dominioDesplegable(nombreGrupo, items) {
  const submenu = (items || []).map(itemEnSubmenuDominio).filter(Boolean);
  if (!submenu.length) return null;
  const modulo = DOMINIO_MODULO_KEY[nombreGrupo] || `DOMINIO_${nombreGrupo.replace(/\s/g, '_').toUpperCase()}`;
  return {
    tipo: 'dominio',
    modulo,
    nombre: nombreGrupo,
    icono: DOMINIO_ICONO[nombreGrupo] || 'bi bi-grid',
    visible: true,
    submenu
  };
}

/** Elimina dominios/grupos vacíos y separadores huérfanos. */
function limpiarGruposVacios(items) {
  if (!Array.isArray(items)) return items;
  const filtered = items.filter((item) => {
    if (item.tipo === 'grupo') return false;
    if (item.tipo === 'dominio') {
      return Array.isArray(item.submenu) && item.submenu.length > 0;
    }
    if (item.tipo === 'separador') return true;
    return true;
  });
  const out = [];
  for (const item of filtered) {
    if (item.tipo === 'separador') {
      if (out.length > 0 && out[out.length - 1].tipo !== 'separador') {
        out.push(item);
      }
      continue;
    }
    out.push(item);
  }
  while (out.length > 0 && out[0].tipo === 'separador') out.shift();
  while (out.length > 0 && out[out.length - 1].tipo === 'separador') out.pop();
  return out;
}

function ensamblarSecciones(secciones) {
  const flat = [];
  for (const sec of secciones) {
    const bloque = (sec.items || []).filter((item) => {
      if (item.tipo === 'separador') return true;
      return filtrarVisible(item);
    });
    if (bloque.length === 0) continue;
    if (sec.grupo) {
      const dom = dominioDesplegable(sec.grupo, bloque);
      if (dom) flat.push(dom);
    } else {
      flat.push(...bloque);
    }
  }
  return limpiarGruposVacios(flat);
}

function planPermiteComprasSunatMenu(deploymentMode, planCodeEfectivo) {
  if (deploymentMode !== 'saas') return true;
  const p = String(planCodeEfectivo || '').toLowerCase().trim();
  const orden = { demo: 1, basico: 2, emprendedor: 3, profesional: 4, empresarial: 5, enterprise: 6 };
  return (orden[p] || 1) >= 3;
}

/** Rubro Grifo en BD: código `GRF` (tabla Rubros). */
function esRubroGrifo(ctx) {
  const codigo = String(ctx?.codigoRubro || '').trim().toUpperCase();
  if (codigo === 'GRF' || codigo === 'GRIFO') return true;
  const rubroTexto = String(ctx?.rubro || '').trim().toLowerCase();
  return rubroTexto === 'grifo' || rubroTexto.includes('grifo');
}

/** Rubro Hotel en BD: código `HOTEL` o `HTL`. */
function esRubroHotel(ctx) {
  const codigo = String(ctx?.codigoRubro || '').trim().toUpperCase();
  if (codigo === 'HOTEL' || codigo === 'HTL') return true;
  const rubroTexto = String(ctx?.rubro || '').trim().toLowerCase();
  return rubroTexto === 'hotel' || rubroTexto.includes('hotel');
}

function etiquetaHistorialVentas(ctx) {
  return esRubroHotel(ctx) ? 'Recepción' : 'Historial';
}

/**
 * Menú completo por dominios (empresa operativa estándar).
 */
function construirNavegacionPorDominios(ctx) {
  const { esAdmin, permisos, permisosData, tieneVerEnviosChofer, codigoRubro, rubro } = ctx;
  const can = (p) => esAdmin || permisos.includes(p);
  const rubroGrifo = esRubroGrifo({ codigoRubro, rubro });
  const labelHistorialVentas = etiquetaHistorialVentas({ codigoRubro, rubro });
  const dm = permisosData.deploymentMode;
  const planCode = permisosData.planCodeEfectivo;
  const sunatCompras = planPermiteComprasSunatMenu(dm, planCode);

  const secciones = [];

  const inicio = [];
  if (can('VER_DASHBOARD')) {
    inicio.push({
      modulo: 'DASHBOARD',
      nombre: 'Dashboard',
      icono: 'bi bi-speedometer2',
      ruta: '/home',
      permiso: 'VER_DASHBOARD',
      visible: true
    });
  }
  if (inicio.length) secciones.push({ items: inicio });

  const comercial = [];

  if (can('VER_VENTAS')) {
    const subVentas = [
      { nombre: 'Venta rápida', ruta: '/ventas/rapida', permiso: 'CREAR_VENTAS', visible: can('CREAR_VENTAS') },
      { nombre: 'Nueva Venta', ruta: '/ventas/create', permiso: 'CREAR_VENTAS', visible: can('CREAR_VENTAS') },
      { nombre: labelHistorialVentas, ruta: '/ventas', permiso: 'VER_VENTAS', visible: true },
      { nombre: 'Reporte detallado', ruta: '/ventas/reporte-detallado', permiso: 'REPORTE_DETALLADO_VENTAS', visible: can('REPORTE_DETALLADO_VENTAS') },
      { nombre: 'Cotizaciones', ruta: '/cotizaciones', permiso: 'VER_VENTAS', visible: true }
    ].filter((s) => s.visible);
    if (subVentas.length) {
      comercial.push({
        modulo: 'VENTAS',
        nombre: 'Ventas',
        icono: 'bi bi-cart',
        ruta: null,
        permiso: 'VER_VENTAS',
        visible: true,
        submenu: subVentas
      });
    }
  }

  if (can('VER_PRODUCTOS')) {
    comercial.push({
      modulo: 'PRODUCTOS',
      nombre: 'Productos',
      icono: 'bi bi-box',
      ruta: null,
      permiso: 'VER_PRODUCTOS',
      visible: true,
      submenu: [
        { nombre: 'Lista de Productos', ruta: '/productos', permiso: 'VER_PRODUCTOS', visible: true },
        { nombre: 'Códigos SUNAT', ruta: '/productos/codigos-sunat', permiso: 'EDITAR_PRODUCTOS', visible: can('EDITAR_PRODUCTOS') },
        { nombre: 'Categorías', ruta: '/categorias', permiso: 'VER_PRODUCTOS', visible: true },
        { nombre: 'Marcas', ruta: '/marcas', permiso: 'VER_PRODUCTOS', visible: true },
        { nombre: 'Precios', ruta: '/precios', permiso: 'GESTIONAR_PRECIOS', visible: can('GESTIONAR_PRECIOS') }
      ].filter((s) => s.visible)
    });
  }

  if (can('VER_CLIENTES')) {
    comercial.push({
      modulo: 'CLIENTES',
      nombre: 'Clientes',
      icono: 'bi bi-people',
      ruta: null,
      permiso: 'VER_CLIENTES',
      visible: true,
      submenu: [
        { nombre: 'Lista de Clientes', ruta: '/clientes', permiso: 'VER_CLIENTES', visible: true },
        { nombre: 'Nuevo Cliente', ruta: '/cliente/create', permiso: 'CREAR_CLIENTES', visible: can('CREAR_CLIENTES') }
      ].filter((s) => s.visible)
    });
  }

  if (comercial.length) secciones.push({ grupo: 'Comercial', items: comercial });

  const abastecimiento = [];

  if (can('VER_COMPRAS')) {
    abastecimiento.push({
      modulo: 'COMPRAS',
      nombre: 'Compras',
      icono: 'bi bi-bag',
      ruta: null,
      permiso: 'VER_COMPRAS',
      visible: true,
      submenu: [
        { nombre: 'Registrar Compras', ruta: '/compras/create', permiso: 'CREAR_COMPRAS', visible: can('CREAR_COMPRAS') },
        { nombre: 'Consultar Compras', ruta: '/compras', permiso: 'VER_COMPRAS', visible: true },
        { nombre: 'Reporte detallado', ruta: '/compras/reporte-detallado', permiso: 'REPORTE_DETALLADO_COMPRAS', visible: can('REPORTE_DETALLADO_COMPRAS') },
        {
          nombre: 'Compras SUNAT',
          ruta: '/compras/comprobantes-sunat',
          permiso: 'VER_COMPRAS',
          visible: sunatCompras
        },
        { nombre: 'Proveedores', ruta: '/proveedores', permiso: 'VER_PROVEEDORES', visible: can('VER_PROVEEDORES') }
      ].filter((s) => s.visible)
    });
  }

  if (can('VER_INVENTARIO')) {
    abastecimiento.push({
      modulo: 'INVENTARIO',
      nombre: 'Inventario',
      icono: 'bi bi-boxes',
      ruta: null,
      permiso: 'VER_INVENTARIO',
      visible: true,
      submenu: [
        { nombre: 'Stock General', ruta: '/inventario', permiso: 'VER_INVENTARIO', visible: true },
        { nombre: 'Stock Actual', ruta: '/inventario/stock-actual', permiso: 'VER_INVENTARIO', visible: true },
        { nombre: 'Conteo físico', ruta: '/inventario/conteo-fisico', permiso: 'VER_INVENTARIO', visible: true },
        { nombre: 'Kardex', ruta: '/inventario/kardex', permiso: 'VER_INVENTARIO', visible: true },
        { nombre: 'Movimientos', ruta: '/inventario/movimientos', permiso: 'VER_INVENTARIO', visible: true },
        { nombre: 'Ingresos y salidas', ruta: '/inventario/ingreso-salida', permiso: 'VER_INVENTARIO', visible: true },
        { nombre: 'Productos vendidos', ruta: '/inventario/productos-vendidos', permiso: 'VER_INVENTARIO', visible: true },
        { nombre: 'Productos comprados', ruta: '/inventario/productos-comprados', permiso: 'VER_INVENTARIO', visible: true }
      ]
    });
  }

  if (abastecimiento.length) secciones.push({ grupo: 'Abastecimiento', items: abastecimiento });

  const tesoreria = [];

  if (can('VER_CAJA') || can('VER_CREDITOS') || can('REGISTRAR_MOVIMIENTOS') || can('VER_ARQUEO')) {
    const subCaja = [
      { nombre: 'Gestión de Cajas', ruta: '/caja', permiso: 'VER_CAJA', visible: can('VER_CAJA') },
      { nombre: 'Ventas pendientes de pago', ruta: '/caja/ventas-pendientes-pago', permiso: 'VER_CAJA', visible: can('VER_CAJA') },
      { nombre: 'Cobranza de Créditos', ruta: '/creditos', permiso: 'VER_CREDITOS', visible: can('VER_CREDITOS') },
      { nombre: 'Pago a Proveedores', ruta: '/caja/pago-proveedores', permiso: 'VER_COMPRAS', visible: can('VER_COMPRAS') },
      { nombre: 'Recibo Ingreso', ruta: '/caja/recibo-ingreso', permiso: 'REGISTRAR_MOVIMIENTOS', visible: can('REGISTRAR_MOVIMIENTOS') },
      { nombre: 'Recibo Egreso', ruta: '/caja/recibo-egreso', permiso: 'REGISTRAR_MOVIMIENTOS', visible: can('REGISTRAR_MOVIMIENTOS') },
      { nombre: 'Arqueo de Caja', ruta: '/caja/arqueo', permiso: 'VER_ARQUEO', visible: can('VER_ARQUEO') || can('VER_CAJA') }
    ].filter((s) => s.visible);
    if (subCaja.length) {
      tesoreria.push({
        modulo: 'CAJA',
        nombre: 'Caja',
        icono: 'bi bi-cash-coin',
        ruta: null,
        permiso: 'VER_CAJA',
        visible: true,
        submenu: subCaja
      });
    }
  }

  if (can('VER_ANALISIS')) {
    tesoreria.push({
      modulo: 'ANALISIS',
      nombre: 'Análisis financiero',
      icono: 'bi bi-graph-up',
      ruta: '/analisis',
      permiso: 'VER_ANALISIS',
      visible: true
    });
  }

  if (can('VER_REPORTES')) {
    tesoreria.push({
      modulo: 'REPORTES',
      nombre: 'Reportes',
      icono: 'bi bi-bar-chart',
      ruta: '/reportes',
      permiso: 'VER_REPORTES',
      visible: true
    });
  }

  if (tesoreria.length) secciones.push({ grupo: 'Tesorería', items: tesoreria });

  const distribucion = [];
  const subDespachos = [
    { nombre: 'Despachos', ruta: '/despachos', permiso: 'VER_DESPACHOS', visible: can('VER_DESPACHOS') },
    { nombre: 'Envíos programados', ruta: '/envios', permiso: 'VER_ENVIOS', visible: can('VER_ENVIOS') },
    { nombre: 'Mis envíos (Chofer)', ruta: '/envios/mis-envios', permiso: 'VER_ENVIOS_CHOFER', visible: esAdmin || tieneVerEnviosChofer }
  ];
  if (rubroGrifo) {
    subDespachos.push(
      { nombre: 'Programaciones', ruta: '/programaciones', permiso: 'VER_DESPACHOS', visible: can('VER_DESPACHOS') },
      { nombre: 'Vales de despacho', ruta: '/vales-despacho', permiso: 'VER_DESPACHOS', visible: can('VER_DESPACHOS') }
    );
  }
  const subDespachosVisibles = subDespachos.filter((s) => s.visible);

  if (subDespachosVisibles.length) {
    distribucion.push({
      modulo: 'DESPACHOS',
      nombre: 'Despachos y envíos',
      icono: 'bi bi-truck',
      ruta: null,
      permiso: 'VER_DESPACHOS',
      visible: true,
      submenu: subDespachosVisibles
    });
  }

  if (distribucion.length) secciones.push({ grupo: 'Distribución', items: distribucion });

  const fiscal = [];
  if (can('VER_CONFIGURACION')) {
    fiscal.push({
      modulo: 'FACTURACION',
      nombre: 'Facturación electrónica',
      icono: 'bi bi-file-earmark-text',
      ruta: null,
      permiso: 'VER_CONFIGURACION',
      visible: true,
      submenu: [
        { nombre: 'Resumen diario', ruta: '/facturacion/resumenes-diarios', permiso: 'VER_CONFIGURACION', visible: true },
        { nombre: 'Emisión de notas', ruta: '/facturacion/notas-credito-debito', permiso: 'VER_CONFIGURACION', visible: true },
        { nombre: 'Comunicación de baja', ruta: '/facturacion/comunicacion-baja', permiso: 'VER_CONFIGURACION', visible: true },
        { nombre: 'Emisión de guías', ruta: '/facturacion/emision-guias', permiso: 'VER_CONFIGURACION', visible: true }
      ]
    });
  }
  if (fiscal.length) secciones.push({ grupo: 'Fiscal (SUNAT)', items: fiscal });

  const plataforma = [];

  if (can('VER_CONFIGURACION')) {
    plataforma.push({
      modulo: 'CATALOGOS',
      nombre: 'Catálogos',
      icono: 'bi bi-journal-bookmark',
      ruta: null,
      permiso: 'VER_CONFIGURACION',
      visible: true,
      submenu: [
        { nombre: 'Forma Pago', ruta: '/catalogos/forma-pago', permiso: 'VER_CONFIGURACION', visible: true },
        { nombre: 'Tipo Movimientos', ruta: '/catalogos/tipo-movimientos', permiso: 'VER_CONFIGURACION', visible: true },
        { nombre: 'Conceptos', ruta: '/catalogos/conceptos', permiso: 'VER_CONFIGURACION', visible: true },
        { nombre: 'Clasificación Conceptos', ruta: '/catalogos/clasificacion-conceptos', permiso: 'VER_CONFIGURACION', visible: true },
        { nombre: 'Motivo Traslado', ruta: '/catalogos/motivo-traslado', permiso: 'VER_CONFIGURACION', visible: true },
        { nombre: 'Motivo Nota Credito', ruta: '/catalogos/motivo-nota-credito', permiso: 'VER_CONFIGURACION', visible: true }
      ]
    });

    plataforma.push({
      modulo: 'CONFIGURACION',
      nombre: 'Configuración',
      icono: 'bi bi-gear',
      ruta: null,
      permiso: 'VER_CONFIGURACION',
      visible: true,
      submenu: [
        { nombre: 'General', ruta: '/configuracion', permiso: 'VER_CONFIGURACION', visible: true },
        { nombre: 'Sucursales', ruta: '/sucursal', permiso: 'GESTIONAR_SUCURSALES', visible: can('GESTIONAR_SUCURSALES') },
        { nombre: 'Colaboradores', ruta: '/colaborador', permiso: 'VER_USUARIOS', visible: can('VER_USUARIOS') },
        { nombre: 'Roles', ruta: '/rol', permiso: 'GESTIONAR_ROLES', visible: can('GESTIONAR_ROLES') },
        { nombre: 'Log de auditoría', ruta: '/auditoria', permiso: 'VER_CONFIGURACION', visible: true }
       // { nombre: 'Integraciones / APIs', ruta: '/configuracion/integraciones', permiso: 'VER_CONFIGURACION', visible: true },
       // { nombre: 'Vincular WhatsApp', ruta: '/configuracion/whatsapp', permiso: 'VER_CONFIGURACION', visible: true },
       // { nombre: 'Bot WhatsApp', ruta: '/configuracion/whatsapp-bot', permiso: 'VER_CONFIGURACION', visible: true }
      ].filter((s) => s.visible)
    });
  }

  if (can('VER_EMPRESA')) {
    plataforma.push({
      modulo: 'EMPRESA',
      nombre: 'Empresa',
      icono: 'bi bi-building-check',
      ruta: '/editar-empresa',
      permiso: 'VER_EMPRESA',
      visible: true
    });
  }

  if (esAdmin) {
    plataforma.push({
      modulo: 'UTILIDADES',
      nombre: 'Utilidades',
      icono: 'bi bi-graph-up-arrow',
      ruta: '/utilidades',
      permiso: 'VER_UTILIDADES',
      visible: true
    });
  }

  if (plataforma.length) secciones.push({ grupo: 'Plataforma', items: plataforma });

  return ensamblarSecciones(secciones);
}

/**
 * Menú reducido empresa gestora, con mismos dominios.
 */
function construirNavegacionGestoraPorDominios(ctx) {
  const { esAdmin, permisos, tieneVerEnviosChofer, codigoRubro, rubro } = ctx;
  const can = (p) => esAdmin || permisos.includes(p);
  const labelHistorialVentas = etiquetaHistorialVentas({ codigoRubro, rubro });
  const secciones = [];

  const inicio = [];
  if (can('VER_DASHBOARD')) {
    inicio.push({
      modulo: 'DASHBOARD',
      nombre: 'Dashboard',
      icono: 'bi bi-speedometer2',
      ruta: '/home',
      permiso: 'VER_DASHBOARD',
      visible: true
    });
  }
  if (can('VER_ANALISIS')) {
    inicio.push({
      modulo: 'ANALISIS',
      nombre: 'Análisis financiero',
      icono: 'bi bi-graph-up',
      ruta: '/analisis',
      permiso: 'VER_ANALISIS',
      visible: true
    });
  }
  if (inicio.length) secciones.push({ items: inicio });

  const comercial = [];
  const subVentas = [];
  if (can('CREAR_VENTAS')) {
    subVentas.push({ nombre: 'Venta rápida', ruta: '/ventas/rapida', permiso: 'CREAR_VENTAS', visible: true });
    subVentas.push({ nombre: 'Nueva Venta', ruta: '/ventas/create', permiso: 'CREAR_VENTAS', visible: true });
  }
  if (can('VER_VENTAS')) {
    subVentas.push({ nombre: labelHistorialVentas, ruta: '/ventas', permiso: 'VER_VENTAS', visible: true });
    subVentas.push({ nombre: 'Cotizaciones', ruta: '/cotizaciones', permiso: 'VER_VENTAS', visible: true });
  }
  if (can('REPORTE_DETALLADO_VENTAS')) {
    subVentas.push({
      nombre: 'Reporte detallado',
      ruta: '/ventas/reporte-detallado',
      permiso: 'REPORTE_DETALLADO_VENTAS',
      visible: true
    });
  }
  if (subVentas.length) {
    comercial.push({
      modulo: 'VENTAS',
      nombre: 'Ventas',
      icono: 'bi bi-cart',
      ruta: null,
      permiso: 'VER_VENTAS',
      visible: true,
      submenu: subVentas
    });
  }
  if (comercial.length) secciones.push({ grupo: 'Comercial', items: comercial });

  const tesoreria = [];
  const subCaja = [];
  if (can('VER_CAJA')) {
    subCaja.push({ nombre: 'Gestión de Cajas', ruta: '/caja', permiso: 'VER_CAJA', visible: true });
    subCaja.push({ nombre: 'Ventas pendientes de pago', ruta: '/caja/ventas-pendientes-pago', permiso: 'VER_CAJA', visible: true });
  }
  if (can('VER_CREDITOS')) subCaja.push({ nombre: 'Cobranza de Créditos', ruta: '/creditos', permiso: 'VER_CREDITOS', visible: true });
  if (can('VER_COMPRAS')) subCaja.push({ nombre: 'Pago a Proveedores', ruta: '/caja/pago-proveedores', permiso: 'VER_COMPRAS', visible: true });
  if (can('REGISTRAR_MOVIMIENTOS')) {
    subCaja.push({ nombre: 'Recibo Ingreso', ruta: '/caja/recibo-ingreso', permiso: 'REGISTRAR_MOVIMIENTOS', visible: true });
    subCaja.push({ nombre: 'Recibo Egreso', ruta: '/caja/recibo-egreso', permiso: 'REGISTRAR_MOVIMIENTOS', visible: true });
  }
  if (can('VER_ARQUEO') || can('VER_CAJA')) {
    subCaja.push({ nombre: 'Arqueo de Caja', ruta: '/caja/arqueo', permiso: 'VER_ARQUEO', visible: true });
  }
  if (subCaja.length) {
    tesoreria.push({
      modulo: 'CAJA',
      nombre: 'Caja',
      icono: 'bi bi-cash-coin',
      ruta: null,
      permiso: 'VER_CAJA',
      visible: true,
      submenu: subCaja
    });
  }
  if (tesoreria.length) secciones.push({ grupo: 'Tesorería', items: tesoreria });

  if (can('VER_INVENTARIO')) {
    secciones.push({
      grupo: 'Abastecimiento',
      items: [
        {
          modulo: 'INVENTARIO',
          nombre: 'Inventario',
          icono: 'bi bi-boxes',
          ruta: null,
          permiso: 'VER_INVENTARIO',
          visible: true,
          submenu: [
            { nombre: 'Stock General', ruta: '/inventario', permiso: 'VER_INVENTARIO', visible: true },
            { nombre: 'Stock Actual', ruta: '/inventario/stock-actual', permiso: 'VER_INVENTARIO', visible: true },
            { nombre: 'Conteo físico', ruta: '/inventario/conteo-fisico', permiso: 'VER_INVENTARIO', visible: true },
            { nombre: 'Kardex', ruta: '/inventario/kardex', permiso: 'VER_INVENTARIO', visible: true },
            { nombre: 'Movimientos', ruta: '/inventario/movimientos', permiso: 'VER_INVENTARIO', visible: true },
            { nombre: 'Ingresos y salidas', ruta: '/inventario/ingreso-salida', permiso: 'VER_INVENTARIO', visible: true },
            { nombre: 'Productos vendidos', ruta: '/inventario/productos-vendidos', permiso: 'VER_INVENTARIO', visible: true },
            { nombre: 'Productos comprados', ruta: '/inventario/productos-comprados', permiso: 'VER_INVENTARIO', visible: true }
          ]
        }
      ]
    });
  }

  const subDespachos = [
    { nombre: 'Despachos', ruta: '/despachos', permiso: 'VER_DESPACHOS', visible: can('VER_DESPACHOS') },
    { nombre: 'Envíos programados', ruta: '/envios', permiso: 'VER_ENVIOS', visible: can('VER_ENVIOS') },
    { nombre: 'Mis envíos (Chofer)', ruta: '/envios/mis-envios', permiso: 'VER_ENVIOS_CHOFER', visible: esAdmin || tieneVerEnviosChofer }
  ].filter((s) => s.visible);
  if (subDespachos.length) {
    secciones.push({
      grupo: 'Distribución',
      items: [
        {
          modulo: 'DESPACHOS',
          nombre: 'Despachos y envíos',
          icono: 'bi bi-truck',
          ruta: null,
          permiso: 'VER_DESPACHOS',
          visible: true,
          submenu: subDespachos
        }
      ]
    });
  }

  const subConfig = [
    { nombre: 'General', ruta: '/configuracion', permiso: 'VER_CONFIGURACION', visible: can('VER_CONFIGURACION') },
    { nombre: 'Colaboradores', ruta: '/colaborador', permiso: 'VER_USUARIOS', visible: can('VER_USUARIOS') },
    { nombre: 'Roles', ruta: '/rol', permiso: 'GESTIONAR_ROLES', visible: can('GESTIONAR_ROLES') }
  ].filter((s) => s.visible);
  const plataforma = [];
  if (subConfig.length) {
    plataforma.push({
      modulo: 'CONFIGURACION',
      nombre: 'Configuración',
      icono: 'bi bi-gear',
      ruta: null,
      permiso: 'VER_CONFIGURACION',
      visible: true,
      submenu: subConfig
    });
  }
  if (can('VER_EMPRESA')) {
    plataforma.push({
      modulo: 'EMPRESA',
      nombre: 'Empresa',
      icono: 'bi bi-building-check',
      ruta: '/editar-empresa',
      permiso: 'VER_EMPRESA',
      visible: true
    });
  }
  if (plataforma.length) secciones.push({ grupo: 'Plataforma', items: plataforma });

  return ensamblarSecciones(secciones);
}

module.exports = {
  limpiarGruposVacios,
  construirNavegacionPorDominios,
  construirNavegacionGestoraPorDominios,
  planPermiteComprasSunatMenu,
  esRubroGrifo,
  DOMINIO_MODULO_KEY
};
