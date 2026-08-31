/**
 * Guía compacta para el asistente de la plataforma (usuarios logueados; no enviar PDFs enteros a Gemini).
 */
const GUIA_EFAFERP = `
Eres el asistente de la plataforma EFAFERP (ERP de BUSINESS SOFT COMPANY SAC, Perú). Ayudas a usuarios con sesión iniciada (dueño, cajero u operador) a usar el sistema.
Hablas en español, claro, en pasos numerados. No inventas menús ni pantallas.

Reglas:
- Nunca pidas ni muestres API keys, certificados, claves SOL ni contraseñas.
- No ejecutas cambios: solo guías. El usuario hace clic en las pantallas.
- Si no estás seguro, di que no sabes y sugiere el Centro de ayuda (tutoriales PDF).
- Cuando indiques una pantalla, incluye un enlace markdown: [texto](/ruta).
- Usa la herramienta diagnosticar_empresa si el usuario dice que "no anda", "está mal", SUNAT, productos vacíos o configuración.

Pantallas (rutas reales):
- Configuración general y facturación SUNAT: [Configuración](/configuracion) — pestaña Facturación: [Facturación SUNAT](/configuracion?tab=facturacion)
  Pasos SUNAT reales (NO existe un interruptor "Modo prueba" ni "Beta" en la pantalla):
  1) Usuario SOL secundario y clave.
  2) Certificado digital .pfx y su clave.
  3) Series de factura y boleta.
  4) Activar "Usar envío directo (SOAP BillService)" si corresponde.
  5) En el campo **URL BillService SUNAT** poner la URL. Eso define pruebas vs producción:
     - Pruebas SUNAT (beta): https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService
     - Producción (comprobantes reales): https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService
  Nunca digas "desactiva modo prueba/beta". Di: cambia la URL BillService a la de producción y guarda.
- Productos (lista): [Productos](/productos)
- Nuevo producto: [Agregar producto](/productos/create)
- Clientes: [Clientes](/clientes)
- Compras / ingreso stock: [Compras](/compras)
- Ventas: [Ventas](/ventas)
- Cotizaciones: [Cotizaciones](/cotizaciones)
- WhatsApp vincular: [WhatsApp](/configuracion/whatsapp)
- Bot WhatsApp: [Bot WhatsApp](/configuracion/whatsapp-bot)
- Guías de remisión: [Guías](/facturacion/guias-remision)

Errores frecuentes:
- No emite boleta/factura: falta certificado, usuario SOL, series, o la URL BillService sigue en e-beta (pruebas).
- "No hay productos": ir a Productos → Nuevo; o registrar una compra para dar stock.
- WhatsApp no responde: vincular número y activar el bot en Configuración.
`.trim();

const TEMAS_GUIA = [
  {
    id: 'sunat',
    re: /\b(sunat|boleta|factura|certificado|\.pfx|usuario sol|serie|billservice|e-beta|facturaci[oó]n electr[oó]nica)\b/i,
    respuesta: [
      'Para emitir boleta/factura SUNAT, en [Configuración](/configuracion?tab=facturacion):',
      '1) Usuario SOL secundario y clave.',
      '2) Certificado digital .pfx y su clave.',
      '3) Series de factura y boleta.',
      '4) Activar envío directo SOAP si corresponde.',
      '5) En **URL BillService SUNAT**: pruebas = e-beta; producción = e-factura.sunat.gob.pe. No hay interruptor «modo prueba»: se cambia esa URL y se guarda.'
    ].join('\n')
  },
  {
    id: 'productos',
    re: /\b(producto|productos|c[oó]digo|kardex|stock|inventario|lote)\b/i,
    respuesta: [
      'Stock entra con una [compra](/compras) o un ingreso de inventario. El kardex baja al vender.',
      'Alta de ítem: [Productos](/productos) o [Agregar producto](/productos/create).',
      'Fracciones (1/4, gramos): en la lista, **Opciones → Convertir unidades de medida**.',
      'Si ves «no hay productos», crea el producto y luego cárgale stock con una compra.'
    ].join('\n')
  },
  {
    id: 'unidades',
    re: /\b(unidad(es)? de medida|conversi[oó]n|gal[oó]n|gramos?|1\/4|1\/32|granel)\b/i,
    respuesta: [
      'En [Productos](/productos) → **Opciones → Convertir unidades de medida**.',
      '«1 envase tiene» es cuántas unidades internas hay en el pote/galón (ej. 28 g). El kardex sigue contando envases.',
      'Vender 5 g no resta 5 potes: resta 5 ÷ N envases.'
    ].join('\n')
  },
  {
    id: 'matizado',
    re: /\b(matizad|f[oó]rmula|tinte)\b/i,
    respuesta: [
      'Las recetas se arman en [Matizador](/matizado) (solo rubro Pintura). Los gramos son por 1 galón.',
      'En [Nueva venta](/ventas/create) solo se jala la fórmula; el cliente no ve los tintes.'
    ].join('\n')
  },
  {
    id: 'ventas',
    re: /\b(venta|pos|caja|cotizaci[oó]n|ticket)\b/i,
    respuesta: [
      'Cobrar: [Ventas](/ventas) o [Nueva venta](/ventas/create).',
      'Cotizar sin cobrar: [Cotizaciones](/cotizaciones).',
      'Si pide unidad (galón, 1/4, gramo), elija la unidad; el kardex se descuenta en envases.'
    ].join('\n')
  },
  {
    id: 'whatsapp',
    re: /\b(whatsapp|bot|wsp|wa)\b/i,
    respuesta: [
      'Vincular número: [WhatsApp](/configuracion/whatsapp).',
      'Bot de pedidos/preventa: [Bot WhatsApp](/configuracion/whatsapp-bot). Si no responde, primero vincule y luego active el bot.'
    ].join('\n')
  },
  {
    id: 'guias',
    re: /\b(gu[ií]a(s)? de remisi[oó]n|guia transportista|remitente)\b/i,
    respuesta: 'Emisión de guías: [Guías de remisión](/facturacion/guias-remision).'
  },
  {
    id: 'clientes',
    re: /\b(cliente|ruc|dni)\b/i,
    respuesta: 'Alta y ficha: [Clientes](/clientes). El RUC se consulta en la ficha; no hace falta otra pantalla.'
  }
];

function pareceDiagnostico(texto) {
  return /\b(qu[eé] (me )?falta|no anda|est[aá] mal|diagn[oó]stic|configuraci[oó]n inicial|no emite|no hay productos|revisa(r)? (mi )?empresa)\b/i.test(
    String(texto || '')
  );
}

function textoDiagnostico(diag) {
  if (!diag) {
    return 'No pude leer el estado de la empresa. Revise [Configuración](/configuracion) y [Productos](/productos).';
  }
  const lineas = (diag.problemas || []).map((p, i) => `${i + 1}) ${p}`);
  if (!lineas.length) {
    return 'No veo huecos graves: hay productos, sucursal y facturación básica. Si no emite, revise la URL BillService en [Facturación SUNAT](/configuracion?tab=facturacion).';
  }
  return [
    'Revisé su empresa. Lo pendiente:',
    ...lineas,
    'Configuración SUNAT: [Facturación](/configuracion?tab=facturacion). Productos: [Productos](/productos).'
  ].join('\n');
}

function respuestaGuiaLocal(texto, ruta) {
  const t = String(texto || '');
  const hits = TEMAS_GUIA.filter((tema) => tema.re.test(t));
  if (hits.length) {
    return hits.map((h) => h.respuesta).join('\n\n');
  }
  const r = String(ruta || '');
  if (/configuracion/i.test(r)) {
    return TEMAS_GUIA.find((x) => x.id === 'sunat').respuesta;
  }
  if (/producto/i.test(r)) {
    return TEMAS_GUIA.find((x) => x.id === 'productos').respuesta;
  }
  return [
    'Puedo guiarte sin conexión a Gemini, con la guía de EFAFERP. Pregunta por SUNAT, productos, stock, ventas, WhatsApp o matizado.',
    'Pantallas: [Configuración](/configuracion), [Productos](/productos), [Ventas](/ventas), [Compras](/compras).',
    'Si dices «qué me falta», reviso el estado de tu empresa.'
  ].join('\n');
}

module.exports = {
  GUIA_EFAFERP,
  pareceDiagnostico,
  textoDiagnostico,
  respuestaGuiaLocal
};
