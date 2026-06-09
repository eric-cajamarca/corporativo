const { withPool } = require('../utils/dbPool.util');
const whatsappBotIdentidadRepository = require('../repositories/whatsappBotIdentidad.repository');
const { limpiarCodigosSunatAlFinal } = require('../utils/direccionClientePdf.util');
const { resolverNombresUbigeo } = require('../utils/ubigeoNombres.util');
const copy = require('./whatsappBot.copy');

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

function cacheGet(key) {
  const row = cache.get(key);
  if (!row || Date.now() - row.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return row.data;
}

function cacheSet(key, data) {
  cache.set(key, { data, at: Date.now() });
}

function formatearListaNombres(items, max = 12) {
  const nombres = (items || [])
    .map((x) => String(x.nombre || x.descripcion || '').trim())
    .filter(Boolean);
  const unicos = [...new Set(nombres)];
  if (!unicos.length) return null;
  return unicos.slice(0, max).map((n) => `• ${n}`).join('\n');
}

function formatearDireccionCompleta(perfil) {
  if (!perfil) return '';
  const calle = limpiarCodigosSunatAlFinal(String(perfil.direccion || '').trim());
  const { region, provincia, distrito } = resolverNombresUbigeo({
    region: perfil.region,
    provincia: perfil.provincia,
    distrito: perfil.distrito,
    ubigeo: perfil.ubigeo
  });
  const ubicacion = [region, provincia, distrito].filter(Boolean).join(' - ');
  if (calle && ubicacion) return `${calle}\n${ubicacion}`;
  return calle || ubicacion;
}

async function cargarPerfil(idEmpresa) {
  const key = `perfil:${idEmpresa}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const perfil = await withPool((pool) =>
    whatsappBotIdentidadRepository.obtenerPerfilEmpresa(pool, idEmpresa)
  );
  cacheSet(key, perfil);
  return perfil;
}

async function cargarQueVendemos(idEmpresa) {
  const key = `queVendemos:${idEmpresa}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await withPool(async (pool) => {
    let categorias = await whatsappBotIdentidadRepository.categoriasMasVendidas(pool, idEmpresa, 12);
    let marcas = await whatsappBotIdentidadRepository.marcasMasVendidas(pool, idEmpresa, 12);
    const desdeVentas = categorias.length > 0 || marcas.length > 0;

    if (!categorias.length) {
      categorias = await whatsappBotIdentidadRepository.categoriasActivasFallback(pool, idEmpresa, 12);
    }
    if (!marcas.length) {
      marcas = await whatsappBotIdentidadRepository.marcasActivasFallback(pool, idEmpresa, 12);
    }
    return { categorias, marcas, desdeVentas };
  });

  cacheSet(key, data);
  return data;
}

async function cargarProductosDestacados(idEmpresa) {
  const key = `productosTop:${idEmpresa}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const items = await withPool(async (pool) => {
    let rows = await whatsappBotIdentidadRepository.productosMasVendidos(pool, idEmpresa, 8);
    const desdeVentas = rows.length > 0;
    if (!rows.length) {
      rows = await whatsappBotIdentidadRepository.productosCatalogoFallback(pool, idEmpresa, 8);
    }
    return { items: rows, desdeVentas };
  });

  cacheSet(key, items);
  return items;
}

function acortarNombreProductoEjemplo(descripcion, max = 45) {
  const d = String(descripcion || '').trim();
  if (!d) return '';
  if (d.length <= max) return d;
  const corto = d.slice(0, max).trim();
  const lastSpace = corto.lastIndexOf(' ');
  if (lastSpace > 20) return corto.slice(0, lastSpace);
  return `${corto}…`;
}

/** Nombre corto del producto mas vendido (o del catalogo) para ejemplos de busqueda. */
async function obtenerNombreProductoEjemplo(idEmpresa) {
  const key = `ejemploBusqueda:${idEmpresa}`;
  const cached = cacheGet(key);
  if (cached !== null && cached !== undefined) return cached;

  const descripcion = await withPool((pool) =>
    whatsappBotIdentidadRepository.productoEjemploBusqueda(pool, idEmpresa)
  );
  const nombre = acortarNombreProductoEjemplo(descripcion);
  cacheSet(key, nombre);
  return nombre;
}

async function responderIdentidad(idEmpresa) {
  const perfil = await cargarPerfil(idEmpresa);
  const nombre = perfil?.nombre || perfil?.razonSocial || 'nuestra empresa';
  const rubro = perfil?.rubro ? `\n${perfil.rubro}` : '';
  return [
    `Soy *${nombre}*.${rubro}`,
    '',
    'Puedes preguntarme:',
    '• *QUÉ VENDES* — categorías y marcas',
    '• *QUÉ PRODUCTOS VENDES* — productos destacados',
    '• *DIRECCIÓN* — dónde estamos',
    '• *CONTACTO* — teléfono y correo',
    '',
    'O escribe *MENÚ* para ver las opciones de compra.'
  ].join('\n');
}

async function responderQueVendes(idEmpresa) {
  const { categorias, marcas, desdeVentas } = await cargarQueVendemos(idEmpresa);
  const perfil = await cargarPerfil(idEmpresa);
  const nombre = perfil?.nombre || 'Nosotros';
  const prefijo = desdeVentas
    ? `En *${nombre}* comercializamos (según ventas recientes):`
    : `En *${nombre}* trabajamos con:`;

  const txtCat = formatearListaNombres(categorias);
  const txtMar = formatearListaNombres(marcas);

  const bloques = [prefijo, ''];
  if (txtCat) {
    bloques.push('*Categorías:*', txtCat, '');
  }
  if (txtMar) {
    bloques.push('*Marcas:*', txtMar, '');
  }
  if (!txtCat && !txtMar) {
    bloques.push('Aún no tenemos catálogo cargado. Escríbeme el producto que buscas y te ayudo.');
  } else {
    bloques.push(
      'Para ver *productos destacados* escribe: *QUÉ PRODUCTOS VENDES*',
      'O dime qué producto estás buscando.'
    );
  }
  return bloques.join('\n');
}

async function responderProductosDestacados(idEmpresa) {
  const { items: productos, desdeVentas } = await cargarProductosDestacados(idEmpresa);
  const perfil = await cargarPerfil(idEmpresa);
  const nombre = perfil?.nombre || 'Nuestra tienda';

  if (!productos.length) {
    return [
      `*${nombre}*`,
      '',
      'Aún no tenemos productos destacados registrados.',
      copy.fraseEjemploBusqueda('')
    ].join('\n');
  }

  const lineas = productos.map((p, i) => {
    const cod = p.codigo ? ` (${p.codigo})` : '';
    return `${i + 1}. ${p.descripcion}${cod}`;
  });

  return [
    `*Productos destacados de ${nombre}*`,
    desdeVentas ? '_(más vendidos en los últimos meses)_' : '_(de nuestro catálogo)_',
    '',
    ...lineas,
    '',
    '*¿Qué producto estás buscando?*',
    copy.fraseEjemploBusqueda(acortarNombreProductoEjemplo(productos[0]?.descripcion))
  ].join('\n');
}

async function responderUbicacion(idEmpresa) {
  const perfil = await cargarPerfil(idEmpresa);
  const nombre = perfil?.nombre || 'Nuestra empresa';
  const dir = formatearDireccionCompleta(perfil);
  if (!dir) {
    return [
      `*${nombre}*`,
      '',
      'Aún no tenemos una dirección registrada en el sistema.',
      perfil?.telefono ? `Teléfono: ${perfil.telefono}` : '',
      'Contáctanos y te indicamos nuestra ubicación.'
    ].filter(Boolean).join('\n');
  }
  const extras = [];
  if (perfil?.telefono) extras.push(`Teléfono: ${perfil.telefono}`);
  return [
    `*${nombre}*`,
    '',
    '*Dirección:*',
    dir,
    ...extras
  ].filter(Boolean).join('\n');
}

async function responderContacto(idEmpresa) {
  const perfil = await cargarPerfil(idEmpresa);
  const nombre = perfil?.nombre || 'Nuestra empresa';
  const lineas = [`*Contacto — ${nombre}*`, ''];
  if (perfil?.telefono) lineas.push(`Teléfono / WhatsApp: ${perfil.telefono}`);
  if (perfil?.correo) lineas.push(`Correo: ${perfil.correo}`);
  if (perfil?.ruc) lineas.push(`RUC: ${perfil.ruc}`);
  if (lineas.length <= 2) {
    lineas.push('Aún no tenemos datos de contacto registrados.');
  }
  return lineas.join('\n');
}

const INTENCIONES_IDENTIDAD = new Set([
  'identidad',
  'que_vendes',
  'productos_destacados',
  'ubicacion',
  'contacto'
]);

async function getRespuesta(idEmpresa, intencion) {
  switch (intencion) {
    case 'identidad':
      return responderIdentidad(idEmpresa);
    case 'que_vendes':
      return responderQueVendes(idEmpresa);
    case 'productos_destacados':
      return responderProductosDestacados(idEmpresa);
    case 'ubicacion':
      return responderUbicacion(idEmpresa);
    case 'contacto':
      return responderContacto(idEmpresa);
    default:
      return null;
  }
}

module.exports = {
  getRespuesta,
  obtenerNombreProductoEjemplo,
  INTENCIONES_IDENTIDAD,
  invalidarCache: (idEmpresa) => {
    const p = String(idEmpresa);
    for (const k of [...cache.keys()]) {
      if (k.includes(p)) cache.delete(k);
    }
  }
};
