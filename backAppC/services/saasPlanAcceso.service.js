const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');
const saasPlanAccesoRepository = require('../repositories/saasPlanAcceso.repository');

/**
 * Plan efectivo para límites de menú y APIs.
 * Sin suscripción activa/demo: se asume empresarial (compatibilidad instalaciones previas).
 */
async function obtenerPlanCodeActivo(pool, idEmpresa) {
  const row = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
  if (!row) return 'empresarial';
  const st = String(row.estado || '')
    .trim()
    .toUpperCase();
  if (st !== 'ACTIVA' && st !== 'DEMO') return 'empresarial';
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
  const orden = { demo: 1, emprendedor: 2, profesional: 3, empresarial: 4, enterprise: 5 };
  return orden[p] || 2;
}

/**
 * Filtra ítems de navegación según SaasPlanModulo y reglas de submenú (caja / cotizaciones).
 */
async function filtrarNavegacionPorPlan(pool, idEmpresa, items) {
  if (!items || !Array.isArray(items)) return items;
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
    if (item.tipo === 'separador') {
      out.push(item);
      continue;
    }
    const mod = (item.modulo || '').toString().trim().toUpperCase();
    if (mod && !set.has(mod)) {
      continue;
    }

    if (item.submenu && item.submenu.length > 0) {
      let sub = item.submenu.map((s) => ({ ...s }));

      if (mod === 'VENTAS' && nv < 2) {
        sub = sub.filter((s) => (s.ruta || '').toString() !== '/cotizaciones');
      }

      const pc = (planCode || '').toLowerCase();

      if (mod === 'CAJA' && pc === 'demo') {
        // Demo: solo Gestión de cajas y Arqueo (el resto de planes ve todos los subítems permitidos por rol).
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
          return true;
        });
      }

      if (sub.length === 0) {
        continue;
      }
      out.push({ ...item, submenu: sub });
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
  return collapsed;
}

module.exports = {
  obtenerPlanCodeActivo,
  planPermiteFactilizaNombre,
  filtrarNavegacionPorPlan
};
