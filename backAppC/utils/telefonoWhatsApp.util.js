function soloDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function normalizarTelefonoWhatsApp(from) {
  const raw = String(from || '').trim();
  if (!raw) return { destino: '', digitos: '', logId: '' };
  if (raw.includes('@')) {
    const base = raw.split('@')[0].split(':')[0];
    const digitos = soloDigitos(base);
    return { destino: raw, digitos, logId: base.slice(0, 20) };
  }
  let digitos = soloDigitos(raw);
  if (digitos.length === 9 && digitos.startsWith('9')) {
    digitos = `51${digitos}`;
  }
  return { destino: digitos, digitos, logId: digitos.slice(0, 20) };
}

function variantesBusquedaCelular(digitos) {
  const d = soloDigitos(digitos);
  if (!d) return [];
  const set = new Set([d]);
  if (d.length === 11 && d.startsWith('51')) {
    set.add(d.slice(2));
  }
  if (d.length === 9) {
    set.add(`51${d}`);
  }
  if (d.length > 9) {
    set.add(d.slice(-9));
  }
  return [...set];
}

const SQL_CELULAR_NORM = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(celular,''), ' ', ''), '-', ''), '+', ''), '(', ''), ')', '')";

module.exports = {
  soloDigitos,
  normalizarTelefonoWhatsApp,
  variantesBusquedaCelular,
  SQL_CELULAR_NORM
};
