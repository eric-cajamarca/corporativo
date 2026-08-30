/**
 * Acceso al listado global de empresas (y reset 2FA plataforma): rol superAdmin
 * y JWT empresa = EMPRESA_PRINCIPAL_ID cuando está definido.
 * Sin EMPRESA_PRINCIPAL_ID: solo superAdmin (desarrollo; en producción conviene definir el UUID).
 */

function normalizarGuid(v) {
  if (v == null) return '';
  return String(v)
    .trim()
    .replace(/[{}]/g, '')
    .toLowerCase();
}

exports.puedeAccesoListadoPlataformaEmpresas = (req) => {
  if (!req.user) return false;
  if (req.user.rol !== 'superAdmin') return false;

  const principal = process.env.EMPRESA_PRINCIPAL_ID;
  if (principal != null && String(principal).trim() !== '') {
    const a = normalizarGuid(req.user.empresa);
    const b = normalizarGuid(principal);
    return a !== '' && a === b;
  }

  return true;
};

exports.normalizarGuid = normalizarGuid;
