const sql = require('mssql');

// Tablas globales que NO necesitan filtro de empresa
const TABLAS_GLOBALES = [
  'documentoidentidad', 'moneda', 'paises', 'departamentos', 'municipios',
  'mediospago', 'presentacion', 'documentos', 'estadopago', 'estadospedidos',
  'tiposmovimientocaja', 'tiposdespacho', 'tiposenvio', 'estadosenvio',
  'estadosunat', 'transportistas'
];

// Middleware que agrega req.querySafe
exports.querySafeMiddleware = (req, res, next) => {
  // Tu token ya tiene idEmpresa en req.user.empresa (del JWT)

  if (!req.user) {
    return next();
  }
  const idEmpresa = req.user?.empresa;

  if (!idEmpresa) {
    return res.status(403).json({ error: 'No autorizado: falta idEmpresa en token' });
  }

  // Método seguro que inyecta el filtro automáticamente
  req.querySafe = async (queryString, params = []) => {
    // Detecta si la tabla es global (no necesita filtro)
    const tablaMatch = queryString.match(/FROM\s+(\w+)/i);
    const nombreTabla = tablaMatch?.[1]?.toLowerCase();

    if (TABLAS_GLOBALES.includes(nombreTabla)) {
      // Tabla global: ejecuta sin filtro de empresa
      return ejecutarQuery(queryString, params);
    }

    // Tabla multi-empresa: INYECTA el filtro automáticamente
    const safeQuery = queryString.toUpperCase().includes('WHERE')
      ? `${queryString} AND idEmpresa = @idEmpresa`
      : `${queryString} WHERE idEmpresa = @idEmpresa`;

    // Agrega el parámetro idEmpresa al final
    const safeParams = [...params, {
      name: 'idEmpresa',
      type: sql.Int,
      value: idEmpresa
    }];

    return ejecutarQuery(safeQuery, safeParams);
  };

  next();
};

// Función helper para ejecutar queries con mssql
async function ejecutarQuery(queryString, params) {
  const pool = await sql.connect(); // Ya está conectado por tu dbConnection.js
  const request = pool.request();

  // Agrega todos los parámetros con su tipo
  params.forEach(param => {
    request.input(param.name, param.type, param.value);
  });

  return request.query(queryString);
}