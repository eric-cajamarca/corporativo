/** SQL reutilizable: nombre de usuario registrador y último modificador en Ventas. */
const SQL_SELECT_USUARIO_VENTAS = `
  LTRIM(RTRIM(ISNULL(uwReg.nombres, '') + ' ' + ISNULL(uwReg.apellidos, ''))) AS usuarioRegistro,
  LTRIM(RTRIM(ISNULL(uwMod.nombres, '') + ' ' + ISNULL(uwMod.apellidos, ''))) AS usuarioModifica,
  CONVERT(VARCHAR(19), v.fModificacion, 120) AS fModificacion
`;

const SQL_JOIN_USUARIO_VENTAS = `
  LEFT JOIN UsuarioWeb uwReg ON uwReg.idUsuario = v.idUsuario AND uwReg.idEmpresa = v.idEmpresa
  LEFT JOIN UsuarioWeb uwMod ON uwMod.idUsuario = v.idUsuarioModifica AND uwMod.idEmpresa = v.idEmpresa
`;

/** SQL reutilizable: nombre de usuario registrador y último modificador en Compras. */
const SQL_SELECT_USUARIO_COMPRAS = `
  LTRIM(RTRIM(ISNULL(uwReg.nombres, '') + ' ' + ISNULL(uwReg.apellidos, ''))) AS usuarioRegistro,
  LTRIM(RTRIM(ISNULL(uwMod.nombres, '') + ' ' + ISNULL(uwMod.apellidos, ''))) AS usuarioModifica,
  CONVERT(VARCHAR(19), Compras.fModificacion, 120) AS fModificacion
`;

const SQL_JOIN_USUARIO_COMPRAS = `
  LEFT JOIN UsuarioWeb uwReg ON uwReg.idUsuario = Compras.idUsuario AND uwReg.idEmpresa = Compras.idEmpresa
  LEFT JOIN UsuarioWeb uwMod ON uwMod.idUsuario = Compras.idUsuarioModifica AND uwMod.idEmpresa = Compras.idEmpresa
`;

module.exports = {
  SQL_SELECT_USUARIO_VENTAS,
  SQL_JOIN_USUARIO_VENTAS,
  SQL_SELECT_USUARIO_COMPRAS,
  SQL_JOIN_USUARIO_COMPRAS
};
