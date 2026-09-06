import {
  AsistenteCampoEstado,
  AsistenteFotoCampo,
  AsistenteFotoPantalla
} from '../models/asistente-dueno.model';

const MAX_ACCIONES = 20;
const MAX_CAMPOS = 20;
const MAX_FALTANTES = 10;
const MAX_TEXTO = 80;
const MAX_JSON = 2800;

const SENSIBLE_RE =
  /password|contrase[nñ]a|token|authorization|cookie|certificado|\.pfx|clave\s*(sol|del)|usuario\s*sol|cvv|cvc|tarjeta|api.?key|secret|refresh/i;

const EXCLUIR_SEL = '.asistente-panel, .asistente-fab, [data-asistente-excluir], nav.sidebar, app-sidebar, app-topnav';

const RUTAS_SENSIBLES =
  /\/configuracion|\/whatsapp|\/sesiones|\/login|\/integraciones|\/colaborador/i;

export function redactarMensajeUsuario(texto: string): string {
  let t = String(texto || '');
  t = t.replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, '[certificado]');
  t = t.replace(/\b(?:\d[ -]?){13,19}\b/g, '[tarjeta]');
  t = t.replace(/\b[A-Za-z0-9+/]{80,}={0,2}\b/g, '[dato-largo]');
  t = t.replace(/(clave|password|contrase[nñ]a|token|pfx)\s*[:=]\s*\S+/gi, '$1: [oculto]');
  return t.trim().slice(0, 2000);
}

export function esEtiquetaSensible(etiqueta: string, name = '', type = ''): boolean {
  if (type === 'password' || type === 'hidden') return true;
  return SENSIBLE_RE.test(`${etiqueta} ${name} ${type}`);
}

function recortar(v: unknown, max = MAX_TEXTO): string {
  return String(v || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function visible(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.closest(EXCLUIR_SEL) || el.closest('[hidden]')) return false;
  const st = getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) {
    return false;
  }
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2;
}

function raizContenido(): HTMLElement {
  const main = document.querySelector<HTMLElement>('main.main-content');
  if (main) return main;
  return document.body;
}

function textoBoton(el: HTMLElement): string {
  const raw = recortar(el.innerText || el.textContent);
  if (raw.length >= 2) return raw;
  return recortar(el.getAttribute('title') || el.getAttribute('aria-label') || el.getAttribute('placeholder'));
}

function controlDeLabel(label: HTMLLabelElement): HTMLElement | null {
  const forId = label.htmlFor;
  if (forId) {
    const byId = document.getElementById(forId);
    if (byId instanceof HTMLElement) return byId;
  }
  const wrap = label.closest('.col-md-6, .col-md-4, .col-md-3, .col-12, .col-lg-4, .form-group, .mb-3, [class*="col-"]');
  if (wrap) {
    const vecino = wrap.querySelector('input, select, textarea');
    if (vecino instanceof HTMLElement) return vecino;
  }
  return label.querySelector('input, select, textarea');
}

function valorPareceVacio(raw: string): boolean {
  const v = recortar(raw);
  if (!v) return true;
  if (/^0+-0+$/.test(v)) return true;
  if (/^(seleccione|seleccionar|--)/i.test(v)) return true;
  return false;
}

function estadoControl(el: HTMLElement, sensible: boolean): AsistenteCampoEstado {
  if (sensible) return 'oculto';
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? 'lleno' : 'vacio';
    if (el.type === 'file') return el.files && el.files.length > 0 ? 'lleno' : 'vacio';
    return valorPareceVacio(el.value) ? 'vacio' : 'lleno';
  }
  if (el instanceof HTMLTextAreaElement) {
    return valorPareceVacio(el.value) ? 'vacio' : 'lleno';
  }
  if (el instanceof HTMLSelectElement) {
    const opt = el.selectedOptions[0];
    const textoOpt = recortar(opt?.textContent);
    const vacio =
      !el.value ||
      el.value === '' ||
      opt?.disabled === true ||
      valorPareceVacio(el.value) ||
      valorPareceVacio(textoOpt);
    return vacio ? 'vacio' : 'lleno';
  }
  const texto = recortar((el as HTMLInputElement).value || el.textContent);
  return valorPareceVacio(texto) ? 'vacio' : 'lleno';
}

function recolectarAcciones(root: HTMLElement): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const nodos = root.querySelectorAll<HTMLElement>(
    'button, a.btn, .quick-action-btn, [role="tab"].nav-link, .nav-link.active'
  );
  for (const el of Array.from(nodos)) {
    if (!visible(el)) continue;
    if (el.classList.contains('btn-close') || el.getAttribute('aria-label') === 'Cerrar asistente') {
      continue;
    }
    const txt = textoBoton(el);
    if (txt.length < 2 || seen.has(txt)) continue;
    seen.add(txt);
    out.push(txt);
    if (out.length >= MAX_ACCIONES) break;
  }
  return out;
}

function agregarCampo(
  out: AsistenteFotoCampo[],
  seen: Set<string>,
  label: HTMLLabelElement,
  exigirVisible: boolean
): void {
  if (exigirVisible && !visible(label)) return;
  if (label.closest(EXCLUIR_SEL)) return;
  const etiqueta = recortar(label.innerText || label.textContent);
  if (etiqueta.length < 2 || seen.has(etiqueta)) return;
  const control = controlDeLabel(label);
  const name = control ? recortar(control.getAttribute('name') || control.id, 40) : '';
  const type = control instanceof HTMLInputElement ? control.type : '';
  const sensible = esEtiquetaSensible(etiqueta, name, type);
  const estado = control ? estadoControl(control, sensible) : sensible ? 'oculto' : 'vacio';
  seen.add(etiqueta);
  out.push({ etiqueta, estado });
}

function recolectarCampos(root: HTMLElement): AsistenteFotoCampo[] {
  const seen = new Set<string>();
  const out: AsistenteFotoCampo[] = [];
  const labels = root.querySelectorAll<HTMLLabelElement>(
    'label.form-label, label.col-form-label, label.form-check-label, label'
  );
  for (const label of Array.from(labels)) {
    agregarCampo(out, seen, label, true);
    if (out.length >= MAX_CAMPOS) return out;
  }
  // Modales cerrados: el valor sigue en el DOM; solo estado, nunca el value.
  const enModal = root.querySelectorAll<HTMLLabelElement>('.modal label.form-label, .modal label');
  for (const label of Array.from(enModal)) {
    agregarCampo(out, seen, label, false);
    if (out.length >= MAX_CAMPOS) break;
  }
  return out;
}

function contarFilasCarrito(root: HTMLElement): number {
  const tablas = root.querySelectorAll('table');
  for (const tabla of Array.from(tablas)) {
    if (!visible(tabla)) continue;
    const heads = recortar(
      Array.from(tabla.querySelectorAll('th'))
        .map((th) => th.textContent || '')
        .join(' ')
    );
    if (!/producto|descripci[oó]n|detalle|cantidad/i.test(heads)) continue;
    const filas = Array.from(tabla.querySelectorAll('tbody tr')).filter((tr) => visible(tr));
    return filas.length;
  }
  return -1;
}

function botonPorTexto(root: HTMLElement, re: RegExp): HTMLButtonElement | HTMLAnchorElement | null {
  const nodos = root.querySelectorAll<HTMLElement>('button, a.btn');
  for (const el of Array.from(nodos)) {
    if (!visible(el)) continue;
    if (re.test(textoBoton(el))) {
      return el as HTMLButtonElement | HTMLAnchorElement;
    }
  }
  return null;
}

function estaDeshabilitado(el: HTMLElement | null): boolean | null {
  if (!el) return null;
  if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) return el.disabled;
  return el.getAttribute('disabled') != null || el.classList.contains('disabled');
}

export function claveDeEtiqueta(etiqueta: string): string | null {
  const e = String(etiqueta || '');
  if (/tipo de comprobante|^comprobante$/i.test(e) && !/destino|defecto/i.test(e)) return 'comprobante';
  if (/^cliente$|raz[oó]n social/i.test(e)) return 'cliente';
  if (/n[°ºo]\s*documento/i.test(e)) return 'cliente';
  if (/^proveedor/i.test(e)) return 'proveedor';
  if (/^descripci[oó]n/i.test(e)) return 'descripcion';
  if (/tipo de movimiento/i.test(e)) return 'tipo';
  if (/tipo de documento/i.test(e)) return 'doc';
  return null;
}

function recolectarCamposMarcados(root: HTMLElement): { clave: string; estado: AsistenteCampoEstado }[] {
  const out: { clave: string; estado: AsistenteCampoEstado }[] = [];
  const nodos = root.querySelectorAll<HTMLElement>('[data-asistente-campo]');
  for (const el of Array.from(nodos)) {
    if (el.closest(EXCLUIR_SEL)) continue;
    const clave = recortar(el.getAttribute('data-asistente-campo'), 40).toLowerCase();
    if (!clave) continue;
    const control =
      el.matches('input, select, textarea') ? el : el.querySelector('input, select, textarea');
    if (!(control instanceof HTMLElement)) continue;
    const type = control instanceof HTMLInputElement ? control.type : '';
    const sensible = esEtiquetaSensible(clave, control.getAttribute('name') || '', type);
    out.push({ clave, estado: estadoControl(control, sensible) });
  }
  return out;
}

function detectarModo(root: HTMLElement): string {
  const selects = root.querySelectorAll('select');
  for (const sel of Array.from(selects)) {
    const opt = sel.selectedOptions[0];
    const txt = recortar(opt?.textContent);
    if (/cotizaci/i.test(txt) || /\bCT\b/i.test(txt)) return 'cotizacion';
    if (/\bboleta\b/i.test(txt)) return 'venta';
    if (/\bfactura\b/i.test(txt)) return 'venta';
  }
  return '';
}

function inferirFaltantesYListos(
  ruta: string,
  root: HTMLElement,
  campos: AsistenteFotoCampo[],
  filasCarrito: number,
  marcados: { clave: string; estado: AsistenteCampoEstado }[]
): { faltantes: string[]; listos: string[] } {
  const listos = new Set<string>();
  const faltan = new Set<string>();
  const enVentas = /\/ventas/i.test(ruta);
  const enCompras = /\/compras/i.test(ruta);

  for (const campo of campos) {
    const clave = claveDeEtiqueta(campo.etiqueta);
    if (!clave || campo.estado === 'oculto') continue;
    if (campo.estado === 'lleno') listos.add(clave);
    if (campo.estado === 'vacio' && !listos.has(clave)) faltan.add(clave);
  }
  for (const m of marcados) {
    if (m.estado === 'oculto') continue;
    if (m.estado === 'lleno') listos.add(m.clave);
    if (m.estado === 'vacio' && !listos.has(m.clave)) faltan.add(m.clave);
  }

  const btnCliente = botonPorTexto(root, /^cliente$/i);
  const btnPago = botonPorTexto(root, /forma de pago/i);
  const btnCierre = botonPorTexto(root, /registrar venta|^cobrar$/i);

  const clienteOff = estaDeshabilitado(btnCliente);
  const pagoOff = estaDeshabilitado(btnPago);
  const cierreOff = estaDeshabilitado(btnCierre);

  if (clienteOff === false) listos.add('comprobante');
  if (clienteOff === true && enVentas) faltan.add('comprobante');
  if (pagoOff === false) listos.add('cliente');
  if (pagoOff === true && clienteOff === false && enVentas) faltan.add('cliente');
  if (cierreOff === false) listos.add('producto');
  if (cierreOff === true && (enVentas || enCompras)) faltan.add('producto');

  if (filasCarrito > 0) {
    listos.add('producto');
    faltan.delete('producto');
  } else if (filasCarrito === 0 && (enVentas || enCompras)) {
    faltan.add('producto');
  }

  for (const k of listos) faltan.delete(k);

  return {
    faltantes: Array.from(faltan).slice(0, MAX_FALTANTES),
    listos: Array.from(listos).slice(0, MAX_FALTANTES)
  };
}

function recortarSiGrande(foto: AsistenteFotoPantalla): AsistenteFotoPantalla {
  let actual = foto;
  while (JSON.stringify(actual).length > MAX_JSON) {
    if (actual.acciones.length > 8) {
      actual = { ...actual, acciones: actual.acciones.slice(0, actual.acciones.length - 2) };
    } else if (actual.campos.length > 8) {
      actual = { ...actual, campos: actual.campos.slice(0, actual.campos.length - 2) };
    } else {
      break;
    }
  }
  return actual;
}

/** Resumen de la pantalla visible. Nunca incluye values, tokens ni HTML. */
export function capturarFotoPantalla(ruta: string, tituloPagina = ''): AsistenteFotoPantalla {
  if (typeof document === 'undefined') {
    return {
      ruta: recortar(ruta, 200),
      pantalla: recortar(tituloPagina),
      paso: '',
      modo: '',
      acciones: [],
      campos: [],
      faltantes: [],
      listos: []
    };
  }

  if (RUTAS_SENSIBLES.test(ruta)) {
    return {
      ruta: recortar(ruta, 200),
      pantalla: recortar(tituloPagina),
      paso: '',
      modo: '',
      acciones: [],
      campos: [],
      faltantes: [],
      listos: []
    };
  }

  const root = raizContenido();
  const heading = root.querySelector('h1, h2, h3, h4, h5');
  const tabActiva = root.querySelector('.nav-link.active, [role="tab"][aria-selected="true"]');
  const acciones = recolectarAcciones(root);
  const campos = recolectarCampos(root);
  const marcados = recolectarCamposMarcados(root);
  const filasCarrito = contarFilasCarrito(root);
  const inferido = inferirFaltantesYListos(ruta, root, campos, filasCarrito, marcados);
  const foto: AsistenteFotoPantalla = {
    ruta: recortar(ruta, 200),
    pantalla: recortar((heading && visible(heading) ? heading.textContent : '') || tituloPagina),
    paso: recortar(tabActiva instanceof HTMLElement ? textoBoton(tabActiva) : ''),
    modo: detectarModo(root),
    acciones,
    campos,
    faltantes: inferido.faltantes,
    listos: inferido.listos
  };
  return recortarSiGrande(foto);
}
