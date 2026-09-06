const sql = require('mssql');
const { sanitizarMensajeSunat, parsearComprobante } = require('../utils/asistenteDueno.consultas');

function bit(v) {
  return v === true || v === 1 || v === '1';
}

async function safe(fn, fallback, etiqueta) {
  try {
    return await fn();
  } catch (err) {
    console.error(`asistenteDuenoConsultas ${etiqueta}:`, err.message);
    return fallback;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function armarFicha(pool, idEmpresa, usuario) {
  const rawUser = usuario && usuario.idUsuario ? String(usuario.idUsuario) : '';
  const idUsuario = UUID_RE.test(rawUser) ? rawUser : null;
  const rolJwt = usuario && usuario.rol ? String(usuario.rol) : '';

  const empresa = await safe(
    async () => {
      const r = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
          SELECT LTRIM(RTRIM(ISNULL(rubro, ''))) AS rubro
          FROM Empresas WHERE idEmpresa = @idEmpresa
        `);
      return r.recordset[0] || {};
    },
    {},
    'empresa'
  );

  const esGestora = await safe(
    async () => {
      const r = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query('SELECT COUNT(1) AS n FROM Gestores_Empresas WHERE idEmpresaOrigen = @idEmpresa AND estado = 1');
      return Number((r.recordset[0] || {}).n) > 0;
    },
    false,
    'gestora'
  );

  let rol = rolJwt;
  let permisos = [];
  if (idUsuario) {
    const rowRol = await safe(
      async () => {
        const r = await pool
          .request()
          .input('idUsuario', sql.UniqueIdentifier, idUsuario)
          .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
          .query(`
            SELECT R.descripcion AS rol
            FROM UsuarioWeb U
            INNER JOIN Rol R ON R.idRol = U.idRol
            WHERE U.idUsuario = @idUsuario AND U.idEmpresa = @idEmpresa
          `);
        return r.recordset[0] || null;
      },
      null,
      'rol'
    );
    if (rowRol && rowRol.rol) rol = String(rowRol.rol);
    const rowsPerm = await safe(
      async () => {
        const r = await pool
          .request()
          .input('idUsuario', sql.UniqueIdentifier, idUsuario)
          .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
          .query(`
            SELECT DISTINCT p.nombre
            FROM Permisos p
            INNER JOIN RolPermisos rp ON p.idPermiso = rp.idPermiso
            INNER JOIN UsuarioWeb u ON rp.idRol = u.idRol
            WHERE u.idUsuario = @idUsuario AND p.idEmpresa = @idEmpresa AND p.estado = 1 AND u.estado = 1
          `);
        return r.recordset || [];
      },
      [],
      'permisos'
    );
    permisos = rowsPerm.map((x) => String(x.nombre || '')).filter(Boolean);
  }

  const fac = await safe(
    async () => {
      const r = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
          SELECT TOP 1
            CASE WHEN certificadoDigital IS NOT NULL AND LEN(LTRIM(RTRIM(ISNULL(certificadoDigital, '')))) > 20 THEN 1 ELSE 0 END AS tieneCertificado,
            CASE WHEN LTRIM(RTRIM(ISNULL(usuarioSunat, ''))) <> '' THEN 1 ELSE 0 END AS tieneUsuarioSunat,
            CASE WHEN LTRIM(RTRIM(ISNULL(serieFactura, ''))) <> '' THEN 1 ELSE 0 END AS tieneSerieFactura,
            CASE WHEN LTRIM(RTRIM(ISNULL(serieBoleta, ''))) <> '' THEN 1 ELSE 0 END AS tieneSerieBoleta,
            ISNULL(envioDirectoSunat, 0) AS envioDirectoSunat,
            ISNULL(useResumenDiarioBoletas, 0) AS useResumenDiarioBoletas,
            ISNULL(usaGuiasElectronicas, 0) AS usaGuiasElectronicas,
            ISNULL(urlEnvio, '') AS urlEnvio
          FROM ConfiguracionFacturacionElectronica
          WHERE idEmpresa = @idEmpresa
        `);
      return r.recordset[0] || null;
    },
    null,
    'facturacion'
  );

  const urlEnvio = fac ? String(fac.urlEnvio || '') : '';
  const facturacion = {
    configurada: !!fac,
    tieneCertificado: fac ? Number(fac.tieneCertificado) === 1 : false,
    tieneUsuarioSunat: fac ? Number(fac.tieneUsuarioSunat) === 1 : false,
    tieneSerieFactura: fac ? Number(fac.tieneSerieFactura) === 1 : false,
    tieneSerieBoleta: fac ? Number(fac.tieneSerieBoleta) === 1 : false,
    envioDirecto: fac ? bit(fac.envioDirectoSunat) : false,
    usaResumenDiario: fac ? bit(fac.useResumenDiarioBoletas) : false,
    urlEsBeta: /e-beta\.sunat|cpfegem-beta/i.test(urlEnvio)
  };

  const guiasRemitente = fac ? bit(fac.usaGuiasElectronicas) : false;
  const guiasTransportista = await safe(
    async () => {
      if (!guiasRemitente) return false;
      const r = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query('SELECT COUNT(1) AS n FROM Vehiculos WHERE idEmpresa = @idEmpresa');
      return Number((r.recordset[0] || {}).n) > 0;
    },
    false,
    'vehiculos'
  );

  const sucursalesUsuario = idUsuario
    ? await safe(
        async () => {
          const r = await pool
            .request()
            .input('idUsuario', sql.UniqueIdentifier, idUsuario)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
              SELECT us.idSucursal, s.nombre
              FROM UsuarioSucursal us
              INNER JOIN Sucursal s ON s.idSucursal = us.idSucursal
              WHERE us.idUsuario = @idUsuario AND s.idEmpresa = @idEmpresa AND ISNULL(us.estado, 1) = 1
            `);
          return r.recordset || [];
        },
        [],
        'sucursalesUsuario'
      )
    : [];

  const cajas = await safe(
    async () => {
      const r = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
          SELECT c.nombre AS caja, ISNULL(s.nombre, '') AS sucursal, c.idSucursal,
            CASE WHEN ac.idApertura IS NOT NULL THEN 1 ELSE 0 END AS abierta
          FROM Cajas c
          LEFT JOIN Sucursal s ON s.idSucursal = c.idSucursal
          LEFT JOIN AperturasCaja ac ON ac.idCaja = c.idCaja AND ac.estado = 1
          WHERE c.idEmpresa = @idEmpresa AND ISNULL(c.estado, 1) = 1
        `);
      return r.recordset || [];
    },
    [],
    'cajas'
  );

  const abiertas = cajas.filter((c) => Number(c.abierta) === 1);
  const idsUser = new Set(sucursalesUsuario.map((s) => String(s.idSucursal || '').toLowerCase()));
  const abiertaEnUsuario =
    idsUser.size === 0
      ? abiertas.length > 0
      : abiertas.some((c) => idsUser.has(String(c.idSucursal || '').toLowerCase()));

  const productos = await safe(
    async () => {
      const r = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query('SELECT COUNT(1) AS n FROM Productos WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1');
      return Number((r.recordset[0] || {}).n) || 0;
    },
    0,
    'productos'
  );

  const rubro = String(empresa.rubro || '').slice(0, 40);
  const esAdmin = /^administrador$/i.test(String(rol || ''));
  const setPerm = new Set(permisos);
  const tiene = (nombre) => esAdmin || setPerm.has(nombre);
  const puede = {
    configuracion: tiene('VER_CONFIGURACION'),
    ventas: tiene('VER_VENTAS') || tiene('CREAR_VENTAS'),
    caja: tiene('VER_CAJA'),
    creditos: tiene('VER_CREDITOS'),
    inventario: tiene('VER_INVENTARIO')
  };

  return {
    rubro,
    esGestora,
    esHotel: /hotel/i.test(rubro),
    rol: String(rol || 'usuario').slice(0, 40),
    permisos,
    puede,
    facturacion,
    caja: {
      algunaAbierta: abiertas.length > 0,
      abiertaEnUsuario,
      sucursalesAbiertas: [...new Set(abiertas.map((c) => c.sucursal || c.caja).filter(Boolean))].slice(0, 6)
    },
    guias: { remitente: guiasRemitente, transportista: guiasTransportista },
    productos,
    sucursalesUsuario: sucursalesUsuario.map((s) => String(s.nombre || '')).filter(Boolean).slice(0, 8)
  };
}

async function consultarCaja(pool, idEmpresa, ficha) {
  if (ficha && ficha.puede && !ficha.puede.caja) {
    return { sinPermiso: true, mensaje: 'No tiene permiso VER_CAJA. Pida al administrador.' };
  }
  const caja = (ficha && ficha.caja) || {};
  return {
    abiertaEnUsuario: !!caja.abiertaEnUsuario,
    algunaAbierta: !!caja.algunaAbierta,
    abiertas: caja.sucursalesAbiertas || []
  };
}

async function consultarErrorSunat(pool, idEmpresa, ficha, comp) {
  if (ficha && ficha.puede && !ficha.puede.ventas) {
    return { sinPermiso: true, mensaje: 'No tiene permiso para ver ventas/SUNAT. Pida al administrador.' };
  }
  const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  const parsed = parsearComprobante(comp);
  let extra = '';
  if (parsed) {
    req.input('serie', sql.VarChar(8), parsed.serie).input('numero', sql.Int, parsed.numero);
    extra = ' AND RTRIM(ce.serie) = @serie AND TRY_CONVERT(INT, ce.numero) = @numero';
  }
  const r = await req.query(`
    SELECT TOP 1
      RTRIM(ce.serie) + '-' + LTRIM(RTRIM(CONVERT(VARCHAR(12), ce.numero))) AS comp,
      LEFT(ISNULL(ce.codigoRespuesta, ''), 20) AS codigo,
      LEFT(ISNULL(ce.descripcionRespuesta, ''), 200) AS mensaje,
      ISNULL(es.descripcion, '') AS estado
    FROM ComprobantesElectronicos ce
    LEFT JOIN EstadosSunat es ON es.idEstadoSunat = ce.idEstadoSunat
    WHERE ce.idEmpresa = @idEmpresa
      AND (
        NULLIF(LTRIM(RTRIM(ce.descripcionRespuesta)), '') IS NOT NULL
        OR NULLIF(LTRIM(RTRIM(ce.codigoRespuesta)), '') IS NOT NULL
      )
      ${extra}
        ${
        parsed
          ? ''
          : `AND (
        NULLIF(LTRIM(RTRIM(ce.codigoRespuesta)), '') NOT IN ('0', '0000')
        OR ce.descripcionRespuesta LIKE N'%rechaz%'
        OR ce.descripcionRespuesta LIKE N'%error%'
        OR ce.descripcionRespuesta LIKE N'%invocar%'
        OR ce.idEstadoSunat NOT IN (1, 3)
      )`
      }
    ORDER BY ISNULL(ce.fechaRespuesta, ce.fechaEmision) DESC
  `);
  const row = r.recordset[0];
  if (!row) return { encontrado: false };
  return {
    encontrado: true,
    comp: String(row.comp || '').slice(0, 20),
    codigo: String(row.codigo || '').slice(0, 20),
    mensaje: sanitizarMensajeSunat(row.mensaje),
    estado: String(row.estado || '').slice(0, 40)
  };
}

async function consultarStock(pool, idEmpresa, ficha, busqueda) {
  if (ficha && ficha.puede && !ficha.puede.inventario) {
    return { sinPermiso: true, mensaje: 'No tiene permiso VER_INVENTARIO. Pida al administrador.' };
  }
  const q = String(busqueda || '').replace(/[%_[\]]/g, '').trim().slice(0, 40);
  if (q.length < 2) return { encontrado: false };
  const prod = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('q', sql.VarChar(40), `%${q}%`)
    .query(`
      SELECT TOP 1 idProducto, LEFT(ISNULL(descripcion, codigo), 60) AS descripcion
      FROM Productos
      WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1
        AND (descripcion LIKE @q OR codigo LIKE @q)
      ORDER BY descripcion
    `);
  const p = prod.recordset[0];
  if (!p) return { encontrado: false };
  const lots = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, p.idProducto)
    .query(`
      SELECT ISNULL(s.nombre, 'Sin sucursal') AS sucursal,
        CASE WHEN ISNULL(SUM(l.cantidadDisponible), 0) > 0 THEN 1 ELSE 0 END AS hay
      FROM Lotes l
      LEFT JOIN Sucursal s ON s.idSucursal = l.idSucursal
      WHERE l.idEmpresa = @idEmpresa AND l.idProducto = @idProducto
      GROUP BY ISNULL(s.nombre, 'Sin sucursal')
    `);
  const con = [];
  const sin = [];
  for (const row of lots.recordset || []) {
    if (Number(row.hay) === 1) con.push(String(row.sucursal));
    else sin.push(String(row.sucursal));
  }
  return {
    encontrado: true,
    descripcion: String(p.descripcion || '').slice(0, 60),
    sucursalesConStock: con.slice(0, 8),
    sucursalesSinStock: sin.slice(0, 8)
  };
}

async function consultarVenta(pool, idEmpresa, ficha, comp) {
  if (ficha && ficha.puede && !ficha.puede.ventas) {
    return { sinPermiso: true, mensaje: 'No tiene permiso VER_VENTAS. Pida al administrador.' };
  }
  const parsed = parsearComprobante(comp);
  if (!parsed) return { encontrado: false };
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('serie', sql.VarChar(8), parsed.serie)
    .input('numero', sql.Int, parsed.numero)
    .query(`
      SELECT TOP 1
        v.compVenta,
        ISNULL(ep.descripcion, '') AS estadoPago,
        ISNULL(es.descripcion, '') AS estadoSunat,
        CASE WHEN EXISTS (
          SELECT 1 FROM CreditosClientes cr WHERE cr.idEmpresa = v.idEmpresa AND cr.idVenta = v.idVenta
        ) THEN 1 ELSE 0 END AS esCredito
      FROM Ventas v
      LEFT JOIN EstadoPago ep ON ep.idEstadoPago = v.idEstadoPago
      LEFT JOIN EstadosSunat es ON es.idEstadoSunat = v.idEstadoSunat
      WHERE v.idEmpresa = @idEmpresa
        AND RTRIM(v.serie) = @serie
        AND TRY_CONVERT(INT, v.numero) = @numero
        AND ISNULL(v.eliminado, 0) = 0
    `);
  const row = r.recordset[0];
  if (!row) return { encontrado: false };
  return {
    encontrado: true,
    comp: String(row.compVenta || parsed.comp).slice(0, 20),
    estadoPago: String(row.estadoPago || '').slice(0, 40),
    estadoSunat: String(row.estadoSunat || '').slice(0, 40),
    esCredito: Number(row.esCredito) === 1
  };
}

async function consultarGuias(pool, idEmpresa, ficha) {
  const g = (ficha && ficha.guias) || {};
  return { remitente: !!g.remitente, transportista: !!g.transportista };
}

async function ejecutarConsulta(pool, id, idEmpresa, ficha, extras) {
  if (id === 'caja') return consultarCaja(pool, idEmpresa, ficha);
  if (id === 'sunat') return consultarErrorSunat(pool, idEmpresa, ficha, extras && extras.comp);
  if (id === 'stock') return consultarStock(pool, idEmpresa, ficha, extras && extras.busqueda);
  if (id === 'venta') return consultarVenta(pool, idEmpresa, ficha, extras && extras.comp);
  if (id === 'guias') return consultarGuias(pool, idEmpresa, ficha);
  return { error: 'Consulta no permitida' };
}

module.exports = {
  armarFicha,
  ejecutarConsulta,
  consultarCaja,
  consultarErrorSunat,
  consultarStock,
  consultarVenta,
  consultarGuias
};
