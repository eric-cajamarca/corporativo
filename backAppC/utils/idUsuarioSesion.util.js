/**
 * UUID del usuario logueado desde el payload JWT (helpers/jwt createToken usa `sub`).
 */
function idUsuarioDesdePayloadUser(user) {
  if (!user || typeof user !== "object") return null;
  const u = user.sub != null ? user.sub : user.idUsuario;
  if (u == null) return null;
  const s = String(u).trim();
  return s.length > 0 ? s : null;
}

module.exports = { idUsuarioDesdePayloadUser };
