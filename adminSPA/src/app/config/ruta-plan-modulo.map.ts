import { normalizarRutaAbsoluta } from './saas-plan-reglas.util';

/**
 * Prefijo de URL (sin dominio, con `/` inicial, sin query) → código de módulo de menú (`SaasPlanModulo.moduloCodigo`).
 * Orden: prefijos más largos primero para que gane el más específico.
 * `null` = no aplica tope por plan (cuenta, plataforma, etc.).
 */
const REGLAS: readonly { prefijo: string; modulo: string }[] = [
  { prefijo: '/configuracion/integraciones', modulo: 'CONFIGURACION' },
  { prefijo: '/facturacion/guias/configuracion', modulo: 'FACTURACION' },
  { prefijo: '/facturacion/', modulo: 'FACTURACION' },
  { prefijo: '/catalogos/', modulo: 'CATALOGOS' },
  { prefijo: '/inventario/', modulo: 'INVENTARIO' },
  { prefijo: '/ventas/', modulo: 'VENTAS' },
  { prefijo: '/cotizaciones/', modulo: 'VENTAS' },
  { prefijo: '/compras/comprobantes-sunat', modulo: 'COMPRAS' },
  { prefijo: '/compras/', modulo: 'COMPRAS' },
  { prefijo: '/proveedores/', modulo: 'COMPRAS' },
  { prefijo: '/caja/', modulo: 'CAJA' },
  { prefijo: '/vales-despacho/', modulo: 'DESPACHOS' },
  { prefijo: '/despachos/', modulo: 'DESPACHOS' },
  { prefijo: '/envios/', modulo: 'DESPACHOS' },
  { prefijo: '/programacion/', modulo: 'DESPACHOS' },
  { prefijo: '/colaborador/', modulo: 'CONFIGURACION' },
  { prefijo: '/rol/', modulo: 'CONFIGURACION' },
  { prefijo: '/sucursal/', modulo: 'CONFIGURACION' },
  { prefijo: '/cliente/', modulo: 'CLIENTES' },
  { prefijo: '/productos/', modulo: 'PRODUCTOS' },
  { prefijo: '/categorias/', modulo: 'PRODUCTOS' },
  { prefijo: '/marcas/', modulo: 'PRODUCTOS' },
  { prefijo: '/home', modulo: 'DASHBOARD' },
  { prefijo: '/ventas', modulo: 'VENTAS' },
  { prefijo: '/cotizaciones', modulo: 'VENTAS' },
  { prefijo: '/compras', modulo: 'COMPRAS' },
  { prefijo: '/detalle-compras', modulo: 'COMPRAS' },
  { prefijo: '/proveedores', modulo: 'COMPRAS' },
  { prefijo: '/inventario', modulo: 'INVENTARIO' },
  { prefijo: '/productos', modulo: 'PRODUCTOS' },
  { prefijo: '/categorias', modulo: 'PRODUCTOS' },
  { prefijo: '/marcas', modulo: 'PRODUCTOS' },
  { prefijo: '/precios', modulo: 'PRODUCTOS' },
  { prefijo: '/rol', modulo: 'CONFIGURACION' },
  { prefijo: '/colaborador', modulo: 'CONFIGURACION' },
  { prefijo: '/sucursal', modulo: 'CONFIGURACION' },
  { prefijo: '/clientes', modulo: 'CLIENTES' },
  { prefijo: '/cliente', modulo: 'CLIENTES' },
  { prefijo: '/despachos', modulo: 'DESPACHOS' },
  { prefijo: '/envios', modulo: 'DESPACHOS' },
  { prefijo: '/programaciones', modulo: 'DESPACHOS' },
  { prefijo: '/programacion', modulo: 'DESPACHOS' },
  { prefijo: '/vales-despacho', modulo: 'DESPACHOS' },
  { prefijo: '/caja', modulo: 'CAJA' },
  { prefijo: '/creditos', modulo: 'CAJA' },
  { prefijo: '/analisis', modulo: 'ANALISIS' },
  { prefijo: '/configuracion', modulo: 'CONFIGURACION' },
  { prefijo: '/rubros', modulo: 'CONFIGURACION' },
  { prefijo: '/auditoria', modulo: 'CONFIGURACION' },
  { prefijo: '/reportes', modulo: 'REPORTES' },
  { prefijo: '/utilidades', modulo: 'UTILIDADES' },
  { prefijo: '/editar-empresa', modulo: 'EMPRESA' }
];

/** Rutas sin tope por catálogo de módulos del plan (SaaS). */
function esRutaExentaPlan(abs: string): boolean {
  if (abs === '/' || abs === '') {
    return true;
  }
  if (abs.startsWith('/cuenta/')) {
    return true;
  }
  if (abs === '/empresa' || abs.startsWith('/empresa/')) {
    return true;
  }
  if (abs === '/sidebar' || abs.startsWith('/sidebar/')) {
    return true;
  }
  return false;
}

/**
 * Resuelve el módulo de menú requerido para una URL, o `null` si la ruta está exenta o no está mapeada.
 */
export function moduloMenuRequeridoParaUrl(urlCompleta: string): string | null {
  const abs = normalizarRutaAbsoluta(urlCompleta.split('?')[0] || '/');
  if (esRutaExentaPlan(abs)) {
    return null;
  }
  for (const { prefijo, modulo } of REGLAS) {
    if (abs === prefijo || abs.startsWith(`${prefijo}/`)) {
      return modulo;
    }
  }
  return null;
}
