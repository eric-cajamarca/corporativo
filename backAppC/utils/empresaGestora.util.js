const gestoresRepository = require('../repositories/gestores.repository');

/**
 * Verifica que idEmpresaDestino sea la del JWT o una empresa gestionada por la gestora.
 */
async function assertEmpresaAutorizada(pool, idEmpresaJwt, idEmpresaDestino) {
  if (!idEmpresaJwt || !idEmpresaDestino) {
    throw new Error('Empresa no autorizada');
  }
  if (String(idEmpresaJwt).toLowerCase() === String(idEmpresaDestino).toLowerCase()) {
    return;
  }
  const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresaJwt);
  const ok = (gestionadas || []).some(
    (e) => String(e.idEmpresa || '').toLowerCase() === String(idEmpresaDestino).toLowerCase()
  );
  if (!ok) {
    throw new Error('Empresa no autorizada');
  }
}

/**
 * @returns {Promise<boolean>}
 */
async function esEmpresaGestora(pool, idEmpresaJwt) {
  const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresaJwt);
  return Array.isArray(gestionadas) && gestionadas.length > 0;
}

/**
 * @returns {Promise<string[]>} JWT + empresas gestionadas (sin duplicados)
 */
async function idsEmpresaGestoraConsolidados(pool, idEmpresaJwt) {
  const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresaJwt);
  const map = new Map();
  map.set(String(idEmpresaJwt).toLowerCase(), idEmpresaJwt);
  (gestionadas || []).forEach((e) => {
    const id = e && e.idEmpresa ? String(e.idEmpresa).trim() : '';
    if (id) {
      map.set(id.toLowerCase(), id);
    }
  });
  return Array.from(map.values());
}

module.exports = {
  assertEmpresaAutorizada,
  esEmpresaGestora,
  idsEmpresaGestoraConsolidados
};
