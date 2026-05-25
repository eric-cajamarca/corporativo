const { withPool } = require('../utils/dbPool.util');
const whatsappBotConsultasRepository = require('../repositories/whatsappBotConsultas.repository');
const { variantesBusquedaCelular, soloDigitos } = require('../utils/telefonoWhatsApp.util');

function celularComparable(celular) {
  const d = soloDigitos(celular);
  if (d.length >= 9) return d.slice(-9);
  return d;
}

function resolverDesdeFilas(rows) {
  const lista = rows || [];
  if (lista.length === 0) {
    return { encontrado: false, ambiguo: false, cliente: null, candidatos: [] };
  }
  if (lista.length === 1) {
    return { encontrado: true, ambiguo: false, cliente: lista[0], candidatos: lista };
  }

  const refs = new Set(lista.map((r) => celularComparable(r.celular)).filter(Boolean));
  if (refs.size === 1) {
    const preferido =
      lista.find((r) => !/^XX/i.test(String(r.rSocial || '').trim())) || lista[0];
    return { encontrado: true, ambiguo: false, cliente: preferido, candidatos: lista };
  }

  return { encontrado: false, ambiguo: true, cliente: null, candidatos: lista };
}

async function resolverCliente(idEmpresa, digitosCelular) {
  const variantes = variantesBusquedaCelular(digitosCelular);
  const rows = await withPool((pool) =>
    whatsappBotConsultasRepository.buscarPorCelular(pool, idEmpresa, variantes)
  );
  return resolverDesdeFilas(rows);
}

module.exports = { resolverCliente, resolverDesdeFilas };
