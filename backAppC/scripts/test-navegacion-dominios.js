/**
 * Prueba rápida Fase 1: navegación por dominios.
 * Ejecutar: node backAppC/scripts/test-navegacion-dominios.js
 */
const {
  construirNavegacionPorDominios,
  limpiarGruposVacios,
  construirNavegacionGestoraPorDominios
} = require('../utils/navegacionDominios.util');

const permisosAdmin = [
  'VER_DASHBOARD', 'VER_CAJA', 'VER_CREDITOS', 'REGISTRAR_MOVIMIENTOS', 'VER_ARQUEO',
  'VER_ANALISIS', 'VER_VENTAS', 'CREAR_VENTAS', 'VER_COMPRAS', 'CREAR_COMPRAS',
  'VER_PROVEEDORES', 'VER_INVENTARIO', 'VER_PRODUCTOS', 'GESTIONAR_PRECIOS',
  'VER_CLIENTES', 'CREAR_CLIENTES', 'VER_CONFIGURACION', 'GESTIONAR_SUCURSALES',
  'VER_USUARIOS', 'GESTIONAR_ROLES', 'VER_DESPACHOS', 'VER_ENVIOS', 'VER_REPORTES',
  'VER_EMPRESA'
];

const navSinGrifo = construirNavegacionPorDominios({
  esAdmin: true,
  permisos: permisosAdmin,
  permisosData: { deploymentMode: 'saas', planCodeEfectivo: 'profesional' },
  tieneVerEnviosChofer: false,
  codigoRubro: 'FER'
});
const nav = construirNavegacionPorDominios({
  esAdmin: true,
  permisos: permisosAdmin,
  permisosData: { deploymentMode: 'saas', planCodeEfectivo: 'profesional' },
  tieneVerEnviosChofer: false,
  codigoRubro: 'GRF'
});

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const dominios = nav.filter((i) => i.tipo === 'dominio');
assert(dominios.length >= 4, 'debe haber dominios desplegables');
const nombresDom = dominios.map((i) => i.nombre);
assert(nombresDom.includes('Comercial'), 'falta dominio Comercial');
assert(nombresDom.includes('Tesorería'), 'falta dominio Tesorería');
assert(!nav.some((i) => i.tipo === 'grupo'), 'no debe quedar tipo grupo plano');

const domComercial = nav.find((i) => i.modulo === 'DOMINIO_COMERCIAL');
assert(domComercial && domComercial.submenu, 'Comercial debe tener submenu');
const ventas = domComercial.submenu.find((s) => s.tipo === 'modulo' && s.modulo === 'VENTAS');
assert(ventas && ventas.submenu, 'falta módulo Ventas en Comercial');
assert(!ventas.submenu.some((s) => s.ruta === '/clientes'), 'Clientes no debe estar en submenú Ventas');

const modClientes = domComercial.submenu.find((s) => s.tipo === 'modulo' && s.modulo === 'CLIENTES');
assert(modClientes, 'falta módulo Clientes en Comercial');

const domDistSin = navSinGrifo.find((i) => i.modulo === 'DOMINIO_DISTRIBUCION');
const despachosSin = domDistSin?.submenu?.find((s) => s.tipo === 'modulo' && s.modulo === 'DESPACHOS');
assert(!despachosSin?.submenu?.some((s) => s.ruta === '/programaciones'), 'sin GRF no debe mostrar Programaciones');
assert(!despachosSin?.submenu?.some((s) => s.ruta === '/vales-despacho'), 'sin GRF no debe mostrar Vales');

const domDist = nav.find((i) => i.modulo === 'DOMINIO_DISTRIBUCION');
const despachos = domDist?.submenu?.find((s) => s.tipo === 'modulo' && s.modulo === 'DESPACHOS');
assert(despachos && despachos.submenu.some((s) => s.ruta === '/programaciones'), 'con GRF falta Programaciones');
assert(despachos.submenu.some((s) => s.ruta === '/vales-despacho'), 'con GRF falta Vales de despacho');

const domPlat = nav.find((i) => i.modulo === 'DOMINIO_PLATAFORMA');
const config = domPlat?.submenu?.find((s) => s.tipo === 'modulo' && s.modulo === 'CONFIGURACION');
assert(config?.submenu?.some((s) => s.ruta === '/configuracion/whatsapp-bot'), 'falta Bot WhatsApp');

const limpio = limpiarGruposVacios([
  { tipo: 'dominio', modulo: 'DOMINIO_X', nombre: 'Vacío', submenu: [] },
  { tipo: 'separador' }
]);
assert(limpio.length === 0, 'dominio vacío debe eliminarse');

const gestora = construirNavegacionGestoraPorDominios({
  esAdmin: true,
  permisos: permisosAdmin,
  tieneVerEnviosChofer: false
});
assert(gestora.some((i) => i.tipo === 'dominio' && i.nombre === 'Comercial'), 'gestora: dominio Comercial');

const { filtrarNavegacionPorPlan } = require('../services/saasPlanAcceso.service');

(async () => {
  const filtrado = await filtrarNavegacionPorPlan(null, '00000000-0000-0000-0000-000000000000', nav);
  assert(Array.isArray(filtrado) && filtrado.length > 0, 'filtrar plan no debe vaciar menú');
  const domFiltrado = filtrado.filter((i) => i.tipo === 'dominio');
  assert(domFiltrado.length >= 1, 'filtrar plan debe conservar dominios');
  console.log('OK navegacion-dominios:', nombresDom.join(', '));
  console.log('OK filtrarNavegacionPorPlan');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
