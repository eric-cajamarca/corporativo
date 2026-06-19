const { isSaas } = require('../config/deployment.config');
const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');
const saasPlanAccesoRepository = require('../repositories/saasPlanAcceso.repository');
const { limpiarGruposVacios } = require('../utils/navegacionDominios.util');

/**
 * Plan efectivo para límites de menú y APIs.
 * Sin suscripción activa/demo: se asume profesional (compatibilidad instalaciones previas).
 */
async function obtenerPlanCodeActivo(pool, idEmpresa) {
  if (!isSaas()) return 'profesional';
  const row = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
  if (!row) return 'profesional';
  const st = String(row.estado || '')
    .trim()
    .toUpperCase();
  if (st !== 'ACTIVA' && st !== 'DEMO') return 'profesional';
  return String(row.planCode || 'demo')
    .trim()
    .toLowerCase();
}

async function planPermiteFactilizaNombre(pool, idEmpresa, nombreServicio) {
  const planCode = await obtenerPlanCodeActivo(pool, idEmpresa);
  return saasPlanAccesoRepository.planPermiteFactilizaServicioNombre(pool, planCode, nombreServicio);
}

function nivelPlan(planCode) {
  const p = (planCode || '').toLowerCase();
  const orden = { demo: 1, basico: 2, emprendedor: 3, profesional: 4, empresarial: 5, enterprise: 6 };
  return orden[p] || 2;
}

const NIVEL_MIN_EMPRENDEDOR = 3;

function planPermiteWhatsApp(planCode) {
  return nivelPlan(planCode) >= NIVEL_MIN_EMPRENDEDOR;
}

function filtrarLinksModulo(modulo, links, planCode, nv) {
  let sub = links.map((s) => ({ ...s }));
  const mod = (modulo || '').toString().trim().toUpperCase();
  const pc = (planCode || '').toLowerCase();

  if (mod === 'CAJA' && pc === 'demo') {
    const ruta = (s) => (s.ruta || '').toString();
    sub = sub.filter(
      (s) => ruta(s) === '/caja' || ruta(s) === '/caja/arqueo' || ruta(s).startsWith('/caja/arqueo/')
    );
  }

  if (mod === 'CONFIGURACION' && pc === 'demo') {
    const ruta = (s) => (s.ruta || '').toString();
    sub = sub.filter((s) => {
      const r = ruta(s);
      if (r === '/sucursal' || r.startsWith('/sucursal/')) return false;
      if (r === '/rol' || r.startsWith('/rol/')) return false;
      if (r === '/auditoria' || r.startsWith('/auditoria/')) return false;
      if (r.startsWith('/configuracion/whatsapp')) return false;
      return true;
    });
  } else if (mod === 'CONFIGURACION' && !planPermiteWhatsApp(pc)) {
    const ruta = (s) => (s.ruta || '').toString();
    sub = sub.filter((s) => !ruta(s).startsWith('/configuracion/whatsapp'));
  }

  return sub.filter((s) => s.visible !== false);
}

/**
 * Filtra ítems de navegación según SaasPlanModulo y reglas de submenú (caja / cotizaciones).
 */
async function filtrarNavegacionPorPlan(pool, idEmpresa, items) {
  if (!items || !Array.isArray(items)) return items;
  if (!isSaas()) return items;
  const planCode = await obtenerPlanCodeActivo(pool, idEmpresa);
  const nv = nivelPlan(planCode);

  let permitidos = [];
  try {
    permitidos = await saasPlanAccesoRepository.listarModulosPorPlan(pool, planCode);
  } catch {
    permitidos = [];
  }
  if (!permitidos.length) {
    return items;
  }
  const set = new Set(permitidos.map((x) => x.toUpperCase()));

  const out = [];
  for (const item of items) {
    if (item.tipo === 'grupo') {
      continue;
    }
    if (item.tipo === 'separador') {
      out.push(item);
      continue;
    }

    if (item.tipo === 'dominio') {
      let sub = (item.submenu || []).map((s) => ({ ...s }));
      sub = sub
        .map((s) => {
          if (s.tipo === 'modulo') {
            const mod = (s.modulo || '').toString().trim().toUpperCase();
            if (mod && !set.has(mod)) return null;
            const links = filtrarLinksModulo(mod, s.submenu || [], planCode, nv);
            if (!links.length) return null;
            return { ...s, submenu: links };
          }
          const modLeaf = (s.modulo || '').toString().trim().toUpperCase();
          if (modLeaf && !set.has(modLeaf)) return null;
          if (s.visible === false) return null;
          return s;
        })
        .filter(Boolean);
      if (sub.length === 0) continue;
      out.push({ ...item, submenu: sub });
      continue;
    }

    const mod = (item.modulo || '').toString().trim().toUpperCase();
    if (mod && !set.has(mod)) {
      continue;
    }

    if (item.submenu && item.submenu.length > 0) {
      const links = filtrarLinksModulo(mod, item.submenu, planCode, nv);
      if (links.length === 0) continue;
      out.push({ ...item, submenu: links });
      continue;
    }

    out.push(item);
  }

  const collapsed = [];
  for (const it of out) {
    if (it.tipo === 'separador') {
      if (collapsed.length === 0) continue;
      if (collapsed[collapsed.length - 1].tipo === 'separador') continue;
      collapsed.push(it);
    } else {
      collapsed.push(it);
    }
  }
  while (collapsed.length > 0 && collapsed[0].tipo === 'separador') {
    collapsed.shift();
  }
  while (collapsed.length > 0 && collapsed[collapsed.length - 1].tipo === 'separador') {
    collapsed.pop();
  }
  return limpiarGruposVacios(collapsed);
}

module.exports = {
  obtenerPlanCodeActivo,
  planPermiteFactilizaNombre,
  filtrarNavegacionPorPlan
};
