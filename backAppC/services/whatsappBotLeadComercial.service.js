const { withPool } = require('../utils/dbPool.util');
const repo = require('../repositories/whatsappBotLeadComercial.repository');
const ficha = require('../utils/whatsappBotComercial.conocimiento');

function estadoDesdeComercial(com, quiereLlamada) {
  const nombreOk = ficha.esNombrePersona(com?.nombre);
  const horarioOk = Boolean(com?.mejorHorario);
  const celOk = ficha.celularValido(com?.celular || com?.celularWeb);
  if (quiereLlamada && nombreOk && horarioOk && (celOk || !com?.requiereCelular)) return 'llamada_pendiente';
  if (com?.intencionCompra === 'alta') return 'interesado';
  if (com?.rubro || nombreOk) return 'nuevo';
  return 'nuevo';
}

async function registrarDesdeTurno(idEmpresa, ctx, ia, textoEntrada) {
  const com = ia?.comercial;
  if (!com) return;
  const nombreOk = ficha.esNombrePersona(com.nombre);
  const tieneAlgo = nombreOk || com.rubro || com.necesidad || ia.quiereLlamada || com.intencionCompra === 'alta';
  if (!tieneAlgo) return;

  const tel = String(ctx?.telefonoLog || ctx?.digitosCelular || '').slice(0, 40);
  if (!tel) return;
  const celular = ctx?.digitosCelular || com.celular || com.celularWeb || null;

  await withPool((pool) =>
    repo.upsert(pool, {
      idEmpresa,
      telefonoLog: tel,
      digitosCelular: celular,
      nombre: nombreOk ? com.nombre : null,
      rubro: com.rubro,
      rubroLibre: com.rubroLibre,
      necesidad: com.necesidad,
      intencionCompra: com.intencionCompra,
      encaja: com.encaja,
      mejorHorario: com.mejorHorario,
      estado: estadoDesdeComercial(com, ia.quiereLlamada),
      quiereLlamada: Boolean(ia.quiereLlamada || com.quiereLlamada),
      ultimoMensaje: String(textoEntrada || '').slice(0, 500)
    })
  );
}

module.exports = { registrarDesdeTurno };
