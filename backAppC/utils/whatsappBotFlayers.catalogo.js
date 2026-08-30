/**
 * Catálogo de flayers: los 4 de la web + cualquier PNG/JPG/WEBP en las carpetas.
 */
const fs = require('fs');
const path = require('path');

const EXTS = ['.png', '.jpg', '.jpeg', '.webp'];
const DIRS = [
  path.join(__dirname, '../uploads/flayers-comercial'),
  path.join(__dirname, '../../adminSPA/public/flayers'),
  path.join(__dirname, '../../flayers'),
  path.join(__dirname, '../../flayers/_src')
];
const DIR_HTML = path.join(__dirname, '../../adminSPA/public/flayers');

const CONOCIDOS = {
  inventario: {
    titulo: 'Control de inventario',
    claves: ['inventario', 'stock', 'merma', 'kardex'],
    url: '/flayers/inventario.html'
  },
  'robos-internos': {
    titulo: 'Robos internos',
    claves: ['robo', 'robos', 'merma', 'seguridad'],
    url: '/flayers/robos-internos.html'
  },
  'utilidad-producto': {
    titulo: 'Utilidad por producto',
    claves: ['utilidad', 'ganancia', 'margen'],
    url: '/flayers/utilidad-producto.html'
  },
  cobranzas: {
    titulo: 'Cobranzas',
    claves: ['cobranza', 'cobranzas', 'cobrar', 'credito', 'crédito'],
    url: '/flayers/cobranzas.html'
  },
  'fiestas-patrias': {
    titulo: 'Fiestas Patrias',
    claves: ['fiestas', 'patrias', '28 de julio'],
    url: '/flayers/fiestas-patrias.html'
  },
  'testimonio-repuestos': {
    titulo: 'Testimonio repuestos',
    claves: ['testimonio', 'repuestos', 'repuesto'],
    url: null
  }
};

const STOP = new Set(['flyer', 'flayer', 'src', 'img', 'image', 'foto', 'png', 'jpg', 'nuevo', 'nueva']);

function slugDeNombre(nombre) {
  return path
    .basename(nombre, path.extname(nombre))
    .replace(/^flyer-?\d{4}-?\d{0,2}-?\d{0,2}-?/i, '')
    .replace(/[^a-z0-9-_]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function tituloDesdeSlug(slug) {
  const limpio = String(slug || '').replace(/[-_]+/g, ' ').trim();
  if (!limpio) return 'Guía';
  return limpio.replace(/\b\w/g, (c) => c.toUpperCase());
}

function clavesDesdeSlug(slug) {
  return String(slug || '')
    .split(/[-_]+/)
    .map((p) => p.toLowerCase())
    .filter((p) => p.length > 2 && !STOP.has(p) && !/^\d+$/.test(p));
}

function htmlExiste(slug) {
  try {
    return fs.existsSync(path.join(DIR_HTML, `${slug}.html`));
  } catch {
    return false;
  }
}

function listarDirectorios() {
  return DIRS.filter((d) => {
    try {
      return fs.existsSync(d) && fs.statSync(d).isDirectory();
    } catch {
      return false;
    }
  });
}

function listar() {
  const bySlug = new Map();
  for (const [slug, meta] of Object.entries(CONOCIDOS)) {
    bySlug.set(slug, {
      slug,
      titulo: meta.titulo,
      claves: meta.claves.slice(),
      url: meta.url || (htmlExiste(slug) ? `/flayers/${slug}.html` : null),
      tieneImagen: false,
      archivo: null
    });
  }

  for (const dir of listarDirectorios()) {
    let nombres = [];
    try {
      nombres = fs.readdirSync(dir);
    } catch (err) {
      console.error('whatsappBotFlayers leer dir:', err.message);
      continue;
    }
    for (const name of nombres) {
      const ext = path.extname(name).toLowerCase();
      if (!EXTS.includes(ext)) continue;
      const slug = slugDeNombre(name);
      if (!slug) continue;
      const archivo = path.join(dir, name);
      const prev = bySlug.get(slug) || {
        slug,
        titulo: tituloDesdeSlug(slug),
        claves: clavesDesdeSlug(slug),
        url: htmlExiste(slug) ? `/flayers/${slug}.html` : null,
        tieneImagen: false,
        archivo: null
      };
      if (!prev.archivo) {
        prev.archivo = archivo;
        prev.tieneImagen = true;
      }
      if (!prev.claves.length) prev.claves = clavesDesdeSlug(slug);
      if (!prev.url && htmlExiste(slug)) prev.url = `/flayers/${slug}.html`;
      bySlug.set(slug, prev);
    }
  }

  return [...bySlug.values()];
}

function resolver(texto) {
  const items = listar();
  const t = String(texto || '').trim();
  if (/^\d{1,2}$/.test(t)) {
    const n = Number(t);
    if (n >= 1 && n <= items.length) return items[n - 1];
  }
  const lower = t.toLowerCase();
  return (
    items.find((f) => f.slug === lower || f.slug === slugDeNombre(t))
    || items.find((f) => (f.claves || []).some((c) => new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(lower)))
    || null
  );
}

function leerImagen(slugOFlayer) {
  const slug = typeof slugOFlayer === 'string' ? slugOFlayer : slugOFlayer?.slug;
  const item = typeof slugOFlayer === 'object' && slugOFlayer?.archivo
    ? slugOFlayer
    : listar().find((f) => f.slug === String(slug || '').toLowerCase());
  const archivo = item?.archivo;
  if (!archivo || !fs.existsSync(archivo)) return null;
  try {
    const buf = fs.readFileSync(archivo);
    if (!buf.length) return null;
    return {
      imageBase64: buf.toString('base64'),
      filename: path.basename(archivo)
    };
  } catch (err) {
    console.error('whatsappBotFlayers leer imagen:', err.message);
    return null;
  }
}

function slugsDisponibles() {
  return listar().map((f) => f.slug);
}

module.exports = {
  EXTS,
  DIRS,
  listar,
  resolver,
  leerImagen,
  slugsDisponibles,
  slugDeNombre
};
