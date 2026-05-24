const { withPool } = require('../utils/dbPool.util');
const whatsappBotConsultasRepository = require('../repositories/whatsappBotConsultas.repository');
const { variantesBusquedaCelular, soloDigitos } = require('../utils/telefonoWhatsApp.util');

function celularComparable(celular) {
  const d = soloDigitos(celular);
  if (d.length >= 9) return d.slice(-9);
  return d;
}

async function resolverCliente(idEmpresa, digitosCelular) {
  const variantes = variantesBusquedaCelular(digitosCelular);
  const rows = await withPool((pool) =>
    whatsappBotConsultasRepository.buscarPorCelular(pool, idEmpresa, variantes)
  );

  if (rows.length === 0) {
    return { encontrado: false, ambiguo: false, cliente: null, candidatos: [] };
  }
  if (rows.length === 1) {
    return { encontrado: true, ambiguo: false, cliente: rows[0], candidatos: rows };
  }

  const refs = new Set(rows.map((r) => celularComparable(r.celular)).filter(Boolean));
  if (refs.size === 1) {
    const preferido =
      rows.find((r) => !/^XX/i.test(String(r.rSocial || '').trim())) || rows[0];
    return { encontrado: true, ambiguo: false, cliente: preferido, candidatos: rows };
  }

  return { encontrado: false, ambiguo: true, cliente: null, candidatos: rows };
}

module.exports = { resolverCliente };
