/**
 * Guía del asistente de la plataforma (usuarios logueados).
 * No usar en el bot comercial de WhatsApp.
 */
const {
  textoMenu,
  textoFlujo,
  resolverFlujo,
  estaEnRutaFlujo
} = require('./asistenteDueno.menu');
const GUIA_EFAFERP = `
Eres el asistente de la plataforma EFAFERP (ERP de BUSINESS SOFT COMPANY SAC, Perú). Ayudas a usuarios con sesión iniciada (dueño, cajero u operador) a usar el sistema.
Hablas en español, claro. No inventas menús, pestañas ni botones.

Reglas:
- Nunca pidas ni muestres API keys, certificados, claves SOL, contraseñas, tokens ni valores de campos.
- No ejecutas cambios: solo guías. El usuario hace clic en las pantallas.
- Enseñas el uso de la plataforma: primero el menú izquierdo, luego el clic en pantalla.
- Recibes un MAPA DE MENÚ, un FLUJO ACTIVO (tema del chat), una FOTO (vacio/lleno, sin values) y a veces un libreto de la ruta.
- foto.listos = pasos YA cubiertos. foto.faltantes = lo que aún falta. NUNCA pidas de nuevo un paso que esté en listos.
- Si el usuario dice «ya está», «ya lo elegí» o «todos los campos ya están», AVANZA al siguiente paso. No repitas el mismo clic.
- Guía UN solo paso por turno: el que indica SIGUIENTE PASO en el contexto. Luego espera.
- Cita botones y campos TAL CUAL aparecen en la foto o en el libreto (ej. **Cobrar**, **Buscar producto**, **Datos del Comprobante**).
- Si foto.modo es cotizacion: no pidas **Forma de pago**. El botón final sigue diciendo **Registrar venta** y guarda la cotización.
- Si un control no está en la foto ni en el libreto, di que no lo ves en esta pantalla. No inventes «pestaña Comprobantes», «Modo boleta», «Modo prueba» ni menús que no existan.
- Si no estás seguro, di que no sabes y sugiere el Centro de ayuda (tutoriales PDF).
- Cuando indiques otra pantalla, incluye un enlace markdown: [texto](/ruta).
- Recibes una FICHA cada turno (rubro, rol, puede.X, facturación sí/no, caja abierta, GRE). Úsala. No inventes datos que no estén ahí.
- NUNCA cites ni inventes montos (S/, totales, saldos, costos, cantidades de stock). Si hay crédito o saldo, di que hay pendiente y manda a [Créditos](/creditos) o a la venta. Stock: solo sí/no por sucursal y manda a Kardex/Stock actual.
- Si puede.X es no, NO enlaces esa ruta. Dile que pida el permiso al administrador. Sin VER_CONFIGURACION no mandes a Facturación SUNAT.
- "Error al invocar el servicio de SUNAT" no es un código de negocio de SUNAT: falló la llamada (red, URL o certificado). Explícalo con la ficha, sin inventar el CDR.
- Las consultas (caja, error SUNAT, stock, venta, guías) son DINÁMICAS: usa como máximo 1 o 2, solo si la pregunta lo pide. Nunca llames las 5. Si el contexto ya trae DATO DE CONSULTA, no vuelvas a llamar esa herramienta.
- Usa diagnosticar_empresa solo si pregunta qué le falta a la empresa o "no anda" de forma general. No uses búsqueda web.

Pantallas (rutas reales):
- Configuración general y facturación SUNAT: [Configuración](/configuracion) — pestaña Facturación: [Facturación SUNAT](/configuracion?tab=facturacion)
  Pestañas reales: General, Facturación, Envío SUNAT, Impuestos, Inventario, Ventas, Comprobante por defecto.
  Pasos SUNAT reales (NO existe un interruptor "Modo prueba" ni "Beta"):
  1) Usuario secundario y contraseña del usuario secundario.
  2) Certificado digital .pfx y su clave.
  3) Series de factura y boleta.
  4) Activar "Usar envío directo (SOAP BillService)" si corresponde.
  5) En **URL BillService SUNAT** poner la URL. Eso define pruebas vs producción:
     - Pruebas SUNAT (beta): https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService
     - Producción (comprobantes reales): https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService
  Nunca digas "desactiva modo prueba/beta". Di: cambia la URL BillService a la de producción y guarda.
- Productos (lista): [Productos](/productos) — botón **Nuevo Producto**
- Nuevo producto: [Agregar producto](/productos/create) — pestañas Datos Básicos, Inventario y Lote, Precios; **Guardar producto**
- Clientes: [Clientes](/clientes) — **Nuevo Cliente**
- Compras / ingreso stock: [Compras](/compras) — [Nueva compra](/compras/create)
- Ventas (historial): [Ventas](/ventas)
- Venta rápida (mostrador): [Venta rápida](/ventas/rapida) — Comprobante, Cliente (F8), Buscar producto, **Cobrar** (F4)
- Nueva venta (completa): [Nueva venta](/ventas/create) — **Datos del Comprobante**, **Cliente**, **Buscar**, **Forma de pago**, **Registrar venta**. El tipo se elige en un modal; si el cliente ya está habilitado, el comprobante YA está elegido.
- Cotización en la misma pantalla: en **Datos del Comprobante** elige el tipo Cotización (CT). No uses Forma de pago. El botón **Registrar venta** guarda la cotización.
- Cotizaciones (historial): [Cotizaciones](/cotizaciones)
- Inventario inicial (sin factura): [Ingresos de inventario](/inventario/ingresos) — tipo Inventario inicial (II). No uses Compras si no hay comprobante.
- Ingresos / salidas: [Ingresos](/inventario/ingresos) y [Salidas](/inventario/salidas). Conteo: [Conteo físico](/inventario/conteo-fisico).
- Caja (apertura, movimientos, arqueo): [Caja](/caja)
- Créditos y cuotas: [Créditos](/creditos)
- Sucursales: [Sucursales](/sucursal)
- Colaboradores y permisos: [Colaboradores](/colaborador)
- WhatsApp vincular: [WhatsApp](/configuracion/whatsapp)
- Bot WhatsApp: [Bot WhatsApp](/configuracion/whatsapp-bot)
- Guías de remisión: [Guías](/facturacion/guias-remision)
- Hotel (si el rubro es hotel): [Hotel](/hotel/configuracion)
- Inicio: [Inicio](/home) — accesos **Venta rápida**, **Nueva venta**, **Nueva Compra**, **Clientes**, **Productos**, **Caja**

Errores frecuentes:
- No emite boleta/factura: falta certificado, usuario secundario, series, o la URL BillService sigue en e-beta (pruebas).
- "No hay productos": ir a Productos → Nuevo Producto; o registrar una compra para dar stock.
- WhatsApp no responde: vincular número y activar el bot en Configuración.
`.trim();

const LIBRETOS = [
  {
    id: 'venta-rapida',
    match: (ruta) => /\/ventas\/rapida/i.test(ruta),
    titulo: 'Venta rápida',
    irA: '/ventas/rapida',
    pasos: [
      {
        clave: 'comprobante',
        texto:
          'Arriba a la izquierda, en **Comprobante**, elige *Boleta* (o *Factura* si el cliente tiene RUC). No hay pestaña «Comprobantes» ni «Modo boleta».'
      },
      {
        clave: 'cliente',
        texto:
          'En **N° documento** escribe DNI o RUC y pulsa la lupa, o el icono de personas junto a **Cliente**. Atajo **F8**.'
      },
      {
        clave: 'producto',
        texto:
          'En la sección **Buscar producto** escribe nombre o código y haz clic en la fila para agregarlo al detalle. Atajo **F2**.'
      },
      {
        clave: 'cobrar',
        texto:
          'Pulsa **Cobrar** (F4). Si hay varias formas de pago, usa **Pagos mixtos**. El botón se habilita cuando hay ítems en el detalle.'
      },
      {
        clave: 'sunat',
        texto:
          'Si SUNAT rechaza el comprobante, no se configura aquí. Ve a [Facturación SUNAT](/configuracion?tab=facturacion).'
      }
    ]
  },
  {
    id: 'venta-create',
    match: (ruta) => /\/ventas\/create/i.test(ruta),
    titulo: 'Nueva venta',
    irA: '/ventas/create',
    pasos: [
      {
        clave: 'comprobante',
        texto: 'Pulsa **Datos del Comprobante** y elige boleta o factura (y la serie).'
      },
      {
        clave: 'cliente',
        texto: 'Pulsa **Cliente** (o F6) y busca o registra al cliente.'
      },
      {
        clave: 'producto',
        texto:
          'En **Buscar Código** usa el escáner, o pulsa **Buscar** (F2) y agrega productos al **Detalle de Venta**.'
      },
      {
        clave: 'pago',
        omitirSiModo: ['cotizacion'],
        texto: 'Pulsa **Forma de pago** (F4) y registra el cobro. Si es crédito, completa **Cuotas crédito**. En cotización este paso no aplica.'
      },
      {
        clave: 'registrar',
        texto: 'Pulsa **Registrar venta**. Si pide **Emitir como**, elige Boleta o Factura.',
        textoSiModo: {
          cotizacion:
            'Pulsa **Registrar venta**. Aunque el botón diga eso, al ser cotización (CT) se guarda la cotización. No uses **Forma de pago**.'
        }
      }
    ]
  },
  {
    id: 'ventas-lista',
    match: (ruta) => /\/ventas\/?(\?|$)/i.test(ruta) && !/\/ventas\/(rapida|create|detalle|editar)/i.test(ruta),
    titulo: 'Ventas',
    irA: '/ventas',
    pasos: [
      {
        clave: 'ir',
        texto:
          'Este es el historial. Para cobrar ahora: [Venta rápida](/ventas/rapida) o [Nueva venta](/ventas/create).'
      }
    ]
  },
  {
    id: 'sunat',
    match: (ruta) => /\/configuracion/i.test(ruta),
    titulo: 'Configuración',
    irA: '/configuracion?tab=facturacion',
    pasos: [
      {
        clave: 'tab',
        texto: 'Abre la pestaña **Facturación** (no «Comprobantes»). [Facturación SUNAT](/configuracion?tab=facturacion).'
      },
      {
        clave: 'sol',
        texto:
          'Completa **Usuario secundario** y **Contraseña del usuario secundario**. No te pediré ni mostraré esas claves.'
      },
      {
        clave: 'certificado',
        texto: 'En **Archivo .pfx** sube el certificado y completa **Clave del certificado**. No pegues el archivo aquí.'
      },
      {
        clave: 'series',
        texto: 'Revisa las series de factura y boleta (número inicial si aún no emites).'
      },
      {
        clave: 'soap',
        texto: 'Marca **Usar envío directo (SOAP BillService)** si envías directo a SUNAT.'
      },
      {
        clave: 'url',
        texto:
          'En **URL BillService SUNAT** pon la de pruebas (e-beta) o la de producción (e-factura.sunat.gob.pe). No hay interruptor «modo prueba»: se cambia esa URL y se guarda. Luego ve a la pestaña **Envío SUNAT** si quieres el lote automático.'
      }
    ]
  },
  {
    id: 'productos-create',
    match: (ruta) => /\/productos\/create/i.test(ruta),
    titulo: 'Nuevo producto',
    irA: '/productos/create',
    pasos: [
      {
        clave: 'descripcion',
        texto:
          'En **Datos Básicos** completa **Descripción**, **Categoría**, **Marca** y **Presentación**. El **Código** puede ser correlativo.'
      },
      {
        clave: 'inventario',
        texto: 'Pasa a **Inventario y Lote**: sucursal, cantidad inicial y costo (si aplica).'
      },
      {
        clave: 'precios',
        texto: 'En **Precios** pon precio de venta (o margen) y pulsa **Guardar producto**.'
      }
    ]
  },
  {
    id: 'productos',
    match: (ruta) => /\/productos\/?(\?|$)/i.test(ruta) && !/\/productos\/(create|importar)/i.test(ruta),
    titulo: 'Productos',
    irA: '/productos',
    pasos: [
      {
        clave: 'nuevo',
        texto:
          'Pulsa **Nuevo Producto**. El stock se carga después con una [compra](/compras/create) o en la pestaña Inventario al crear.'
      }
    ]
  },
  {
    id: 'home',
    match: (ruta) => /\/home/i.test(ruta) || ruta === '/' || ruta === '',
    titulo: 'Inicio',
    irA: '/home',
    pasos: [
      {
        clave: 'ir',
        texto:
          'En accesos rápidos: **Venta rápida** (mostrador), **Nueva venta**, **Nueva Compra**, **Clientes**, **Productos** o **Caja**. Dime qué quieres hacer y te llevo al primer clic.'
      }
    ]
  },
  {
    id: 'clientes',
    match: (ruta) => /\/clientes\/?(\?|$)/i.test(ruta),
    titulo: 'Clientes',
    irA: '/clientes',
    pasos: [
      {
        clave: 'nuevo',
        texto: 'Pulsa **Nuevo Cliente**. También puedes registrar al cliente desde la venta (lupa o F8).'
      }
    ]
  },
  {
    id: 'cliente-create',
    match: (ruta) => /\/cliente\/create/i.test(ruta),
    titulo: 'Crear cliente',
    irA: '/cliente/create',
    pasos: [
      {
        clave: 'doc',
        texto:
          'Elige **Tipo de documento**, escribe el número y pulsa **Buscar** (consulta RUC/DNI). Completa los datos y guarda.'
      }
    ]
  },
  {
    id: 'compras-create',
    match: (ruta) => /\/compras\/create/i.test(ruta),
    titulo: 'Nueva compra',
    irA: '/compras/create',
    pasos: [
      {
        clave: 'proveedor',
        texto: 'Elige o registra el **Proveedor**.'
      },
      {
        clave: 'producto',
        texto: 'Agrega productos al detalle (cantidad y costo). Eso ingresa stock.'
      },
      {
        clave: 'registrar',
        texto: 'Completa forma de pago si aplica y pulsa **Registrar Compra**.'
      }
    ]
  },
  {
    id: 'compras',
    match: (ruta) => /\/compras\/?(\?|$)/i.test(ruta) && !/\/compras\/(create|comprobantes)/i.test(ruta),
    titulo: 'Compras',
    irA: '/compras',
    pasos: [
      {
        clave: 'ir',
        texto:
          'Si tienes factura del proveedor: [Nueva compra](/compras/create). Si es inventario inicial o ingreso sin comprobante: [Ingresos de inventario](/inventario/ingresos).'
      }
    ]
  },
  {
    id: 'inventario-ingresos',
    match: (ruta) => /\/inventario\/ingresos/i.test(ruta),
    titulo: 'Ingresos de inventario',
    irA: '/inventario/ingresos',
    pasos: [
      {
        clave: 'tipo',
        texto:
          'En **Tipo de movimiento** elige *Inventario inicial* (o entrada varia / reajuste). No pidas factura de compra aquí.'
      },
      {
        clave: 'producto',
        texto: 'Pulsa **Buscar producto** o **Agregar línea**, indica cantidad (y costo si aplica).'
      },
      {
        clave: 'registrar',
        texto: 'Pulsa **Guardar ingreso**.'
      }
    ]
  },
  {
    id: 'inventario',
    match: (ruta) => /\/inventario\/?(\?|$)/i.test(ruta) && !/\/inventario\//i.test(ruta),
    titulo: 'Inventario',
    irA: '/inventario',
    pasos: [
      {
        clave: 'ir',
        texto:
          'Stock sin factura: [Ingresos de inventario](/inventario/ingresos). Salidas: [Salidas](/inventario/salidas). Ver existencias: [Stock actual](/inventario/stock-actual). Si el artículo no existe, créalo en [Productos](/productos).'
      }
    ]
  },
  {
    id: 'caja',
    match: (ruta) => /\/caja\/?(\?|$)/i.test(ruta) && !/\/caja\//i.test(ruta),
    titulo: 'Caja',
    irA: '/caja',
    pasos: [
      {
        clave: 'abrir',
        texto:
          'Si no hay caja, pulsa **Nueva caja** / **Registrar caja**. En la tarjeta, el botón verde abre la caja (debe quedar **Abierta**). Sin caja abierta no se cobra en ventas.'
      }
    ]
  }
];

const TEMAS_GUIA = [
  {
    id: 'sunat',
    re: /\b(sunat|boleta|factura|certificado|\.pfx|usuario sol|usuario secundario|serie|billservice|e-beta|facturaci[oó]n electr[oó]nica)\b/i,
    respuesta: [
      'Para emitir boleta/factura SUNAT, en [Configuración](/configuracion?tab=facturacion) pestaña **Facturación**:',
      '1) Usuario secundario y clave.',
      '2) Certificado digital .pfx y su clave.',
      '3) Series de factura y boleta.',
      '4) Activar **Usar envío directo (SOAP BillService)** si corresponde.',
      '5) En **URL BillService SUNAT**: pruebas = e-beta; producción = e-factura.sunat.gob.pe. No hay interruptor «modo prueba»: se cambia esa URL y se guarda.',
      'Cobrar el documento en [Venta rápida](/ventas/rapida) (**Comprobante** + **Cobrar**), no en Configuración.'
    ].join('\n')
  },
  {
    id: 'productos',
    re: /\b(producto|productos|c[oó]digo|kardex|stock|lote)\b/i,
    respuesta: [
      'Stock entra con una [compra](/compras/create) o un ingreso de inventario. El kardex baja al vender.',
      'Alta de ítem: [Productos](/productos) → **Nuevo Producto**, o [Agregar producto](/productos/create).',
      'Fracciones (1/4, gramos): en la lista, **Opciones → Convertir unidades de medida**.',
      'Si ves «no hay productos», crea el producto y luego cárgale stock con una compra o un ingreso.'
    ].join('\n')
  },
  {
    id: 'inventario-mov',
    re: /\b(inventario inicial|sin comprobante|ingresos? de (inventario|mercader)|abastecimiento|ingresos y salidas|conteo f[ií]sico|entradas y salidas)\b/i,
    respuesta: [
      'Inventario inicial o ingreso **sin factura**: [Ingresos de inventario](/inventario/ingresos). Tipo de movimiento: *Inventario inicial* (código II). Luego **Buscar producto** y **Guardar ingreso**.',
      'Si tienes comprobante del proveedor: [Nueva compra](/compras/create).',
      'Salidas / mermas: [Salidas](/inventario/salidas). Ajuste por conteo: [Conteo físico](/inventario/conteo-fisico).',
      'Crear el SKU (si no existe): [Nuevo Producto](/productos/create). Eso no carga stock masivo.'
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
    re: /\b(matizad\w*|f[oó]rmula|tinte)\b/i,
    respuesta: [
      'Las recetas se arman en [Matizador](/matizado) (solo rubro Pintura). Los gramos son por 1 galón.',
      'En [Nueva venta](/ventas/create) solo se jala la fórmula; el cliente no ve los tintes.'
    ].join('\n')
  },
  {
    id: 'ventas',
    re: /\b(venta|pos|caja|cotizaci[oó]n|ticket|cobrar)\b/i,
    respuesta: [
      'Mostrador: [Venta rápida](/ventas/rapida) — **Comprobante**, **Cliente** (F8), **Buscar producto**, **Cobrar** (F4).',
      'Venta con más datos: [Nueva venta](/ventas/create) — **Datos del Comprobante**, **Cliente**, **Buscar**, **Forma de pago**, **Registrar venta**.',
      'Cotizar en la misma pantalla: tipo Cotización (CT) en **Datos del Comprobante**; no uses Forma de pago; **Registrar venta** guarda la cotización. Historial: [Cotizaciones](/cotizaciones).',
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
    respuesta: 'Alta: [Clientes](/clientes) → **Nuevo Cliente**. Desde la venta: **N° documento** + lupa o F8.'
  },
  {
    id: 'caja',
    re: /\b(caja|arqueo|apertura de caja|cierre de caja|recibo de (ingreso|egreso))\b/i,
    respuesta: [
      'Caja del día: [Caja](/caja). Ahí se abre (botón verde en la tarjeta), se registran movimientos y se cierra.',
      'Arqueo: [Arqueo](/caja/arqueo). Recibos: [Ingreso](/caja/recibo-ingreso) y [Egreso](/caja/recibo-egreso).',
      'Si no deja vender, casi siempre falta *abrir caja* en la sucursal activa.'
    ].join('\n')
  },
  {
    id: 'creditos',
    re: /\b(cr[eé]dito|cuotas?|cobranza|saldo (del )?cliente|letra)\b/i,
    respuesta: [
      'Créditos y cuotas: [Créditos](/creditos). Ahí se cobran cuotas y se ve la cartera.',
      'La venta al crédito se marca en [Nueva venta](/ventas/create) (**Forma de pago** crédito).'
    ].join('\n')
  },
  {
    id: 'sucursal',
    re: /\b(sucursal(es)?|almac[eé]n|local)\b/i,
    respuesta: 'Sucursales y almacén: [Sucursales](/sucursal). El stock es por sucursal; elija la sucursal activa arriba a la derecha.'
  },
  {
    id: 'usuarios',
    re: /\b(colaborador|usuario|permisos|rol|cajero|vendedor)\b/i,
    respuesta: 'Usuarios y permisos: [Colaboradores](/colaborador). Cree el usuario y asigne un rol; no comparta la cuenta del dueño.'
  },
  {
    id: 'hotel',
    re: /\b(hotel|habitaci[oó]n|check-?in|check-?out|reserva)\b/i,
    respuesta: 'Módulo hotel: [Configuración hotel](/hotel/configuracion). Check-in/out y reservas están en el menú Hotel (solo si el rubro de la empresa es hotel).'
  }
];

const ESTADOS_CAMPO = new Set(['vacio', 'lleno', 'oculto']);
const MAX_FOTO_JSON = 3000;

function recortar(v, max) {
  return String(v || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function redactarMensajeUsuario(texto) {
  let t = String(texto || '');
  t = t.replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, '[certificado]');
  t = t.replace(/\b(?:\d[ -]?){13,19}\b/g, '[tarjeta]');
  t = t.replace(/\b[A-Za-z0-9+/]{80,}={0,2}\b/g, '[dato-largo]');
  t = t.replace(/(clave|password|contrase[nñ]a|token|pfx)\s*[:=]\s*\S+/gi, '$1: [oculto]');
  return recortar(t, 2000);
}

function sanitizarFotoPantalla(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const acciones = Array.isArray(raw.acciones)
    ? raw.acciones.map((x) => recortar(x, 80)).filter(Boolean).slice(0, 20)
    : [];
  const campos = Array.isArray(raw.campos)
    ? raw.campos
        .slice(0, 20)
        .map((c) => ({
          etiqueta: recortar(c && c.etiqueta, 80),
          estado: ESTADOS_CAMPO.has(c && c.estado) ? c.estado : 'oculto'
        }))
        .filter((c) => c.etiqueta)
    : [];
  const faltantes = Array.isArray(raw.faltantes)
    ? raw.faltantes.map((x) => recortar(x, 40).toLowerCase()).filter(Boolean).slice(0, 10)
    : [];
  const listos = Array.isArray(raw.listos)
    ? raw.listos.map((x) => recortar(x, 40).toLowerCase()).filter(Boolean).slice(0, 10)
    : [];
  const modo = recortar(raw.modo, 20).toLowerCase();
  const foto = {
    ruta: recortar(raw.ruta, 200),
    pantalla: recortar(raw.pantalla, 80),
    paso: recortar(raw.paso, 60),
    modo: /^(cotizacion|venta)$/.test(modo) ? modo : '',
    acciones,
    campos,
    faltantes,
    listos
  };
  if (JSON.stringify(foto).length > MAX_FOTO_JSON) {
    foto.acciones = foto.acciones.slice(0, 10);
    foto.campos = foto.campos.slice(0, 10);
  }
  return foto;
}

function resolverLibreto(ruta) {
  const r = String(ruta || '');
  return LIBRETOS.find((lib) => lib.match(r)) || null;
}

function pasosVisibles(libreto, modo) {
  const m = String(modo || '');
  return (libreto.pasos || []).filter((p) => !Array.isArray(p.omitirSiModo) || !p.omitirSiModo.includes(m));
}

function textoDePaso(paso, modo) {
  if (!paso) return '';
  const extra = paso.textoSiModo && modo && paso.textoSiModo[modo];
  return extra || paso.texto;
}

function textoLibreto(libreto, modo) {
  if (!libreto) {
    return 'No hay libreto específico para esta ruta. Usa solo la foto y la guía general. No inventes menús.';
  }
  const pasos = pasosVisibles(libreto, modo);
  return [
    `Pantalla: ${libreto.titulo}`,
    libreto.irA ? `Enlace: [${libreto.titulo}](${libreto.irA})` : '',
    modo ? `Modo detectado: ${modo}` : '',
    'Pasos reales (guía uno por turno; salta los que estén en foto.listos):',
    ...pasos.map((p, i) => `${i + 1}) ${textoDePaso(p, modo)}`)
  ]
    .filter(Boolean)
    .join('\n');
}

function textoDeMensaje(item) {
  if (!item) return '';
  if (typeof item.text === 'string') return item.text;
  const parts = item.parts || [];
  return parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('\n');
}

function usuarioConfirmoPaso(texto) {
  return /\b(ya (est[aá]|lo (eleg[ií]|hice|llen[eé]|complet[eé]|puse|seleccion[eé]))|todos los campos ya|ya todos)\b/i.test(
    String(texto || '')
  );
}

function usuarioEnFlujo(texto) {
  return (
    usuarioConfirmoPaso(texto) ||
    /\b(ya estoy|estoy en|qu[eé] m[aá]s|sigue|siguiente|ahora qu[eé])\b/i.test(String(texto || ''))
  );
}

function clavesDelUltimoAsistente(historial) {
  const lista = Array.isArray(historial) ? historial : [];
  let last = '';
  for (let i = lista.length - 1; i >= 0; i -= 1) {
    if (lista[i] && lista[i].role === 'model') {
      last = textoDeMensaje(lista[i]);
      break;
    }
  }
  if (!last) return [];
  const keys = [];
  if (/datos del comprobante|tipo de comprobante|\*\*comprobante\*\*/i.test(last)) keys.push('comprobante');
  if (/\*\*cliente\*\*|\(o F6\)|\(F8\)/i.test(last)) keys.push('cliente');
  if (/buscar producto|detalle de venta|buscar c[oó]digo/i.test(last)) keys.push('producto');
  if (/forma de pago/i.test(last)) keys.push('pago');
  if (/registrar venta|^cobrar\b|\*\*cobrar\*\*/i.test(last)) keys.push('registrar');
  if (/tipo de movimiento|inventario inicial/i.test(last)) keys.push('tipo');
  if (/guardar ingreso/i.test(last)) keys.push('registrar');
  return keys;
}

function resolverPasoActual(libreto, foto, texto, historial, flujo, ruta) {
  const guia = flujo || libreto;
  if (!guia) return null;
  const modo = (flujo && flujo.modoForzado) || (foto && foto.modo) || '';
  const pasos = pasosVisibles(guia, modo);
  if (!pasos.length) return null;
  const omitir = new Set(((foto && foto.listos) || []).map((x) => String(x).toLowerCase()));
  const faltan = new Set(((foto && foto.faltantes) || []).map((x) => String(x).toLowerCase()));
  if (flujo && estaEnRutaFlujo(flujo, (foto && foto.ruta) || ruta)) {
    omitir.add('ir');
  }
  if (usuarioConfirmoPaso(texto)) {
    clavesDelUltimoAsistente(historial).forEach((k) => omitir.add(k));
    if (/todos los campos/i.test(String(texto || ''))) {
      pasos.forEach((p) => {
        if (p.clave && p.clave !== 'registrar' && p.clave !== 'cobrar' && p.clave !== 'producto') {
          omitir.add(p.clave);
        }
      });
    }
  }
  const pendiente = pasos.find((p) => p.clave && faltan.has(p.clave) && !omitir.has(p.clave));
  if (pendiente) return pendiente;
  const siguiente = pasos.find((p) => p.clave && !omitir.has(p.clave) && p.clave !== 'sunat');
  return siguiente || null;
}

function armarContextoGuia(foto, ruta, titulo, texto, historial, fichaTexto, datoConsulta) {
  const rutaEff = (foto && foto.ruta) || ruta;
  const flujo = resolverFlujo(texto, rutaEff, historial);
  const lib = resolverLibreto(rutaEff);
  const modo = (flujo && flujo.modoForzado) || (foto && foto.modo) || '';
  const paso = resolverPasoActual(lib, foto, texto, historial, flujo, rutaEff);
  const listos = ((foto && foto.listos) || []).join(', ') || 'ninguno';
  const siguiente = paso
    ? textoDePaso(paso, modo)
    : 'Los datos visibles ya están. Si falta un producto en el detalle, agrégalo; si no, pulsa el botón de cierre (Cobrar / Registrar venta / Guardar ingreso).';
  return [
    fichaTexto || '',
    datoConsulta ? `DATO DE CONSULTA (ya resuelto; no llames esa herramienta otra vez):\n${datoConsulta}` : '',
    `Pantalla actual: ruta="${ruta || '/'}" título="${titulo || ''}".`,
    textoMenu(),
    `FLUJO ACTIVO:\n${textoFlujo(flujo)}`,
    foto
      ? `FOTO DE PANTALLA (sin values ni secretos; no inventes botones ausentes de acciones):\n${JSON.stringify(foto)}`
      : 'FOTO DE PANTALLA: no disponible.',
    !flujo && lib ? `LIBRETO DE ESTA RUTA:\n${textoLibreto(lib, modo)}` : '',
    `Pasos YA listos (NO los pidas otra vez): ${listos}.`,
    `SIGUIENTE PASO (di solo esto, no el paso anterior):\n${siguiente}`,
    'Si el usuario no está en la pantalla del flujo, el primer paso es el menú. Si ya está, no pidas volver al menú. Un paso por turno.'
  ]
    .filter(Boolean)
    .join('\n\n');
}

function parecePedidoPasoAPaso(texto) {
  return /\b(c[oó]mo|como|qu[eé] hago|siguiente paso|paso a paso|gu[ií]ame|d[oó]nde (hago|clic|doy)|emitir|cobrar|qu[eé] m[aá]s|sigue)\b/i.test(
    String(texto || '')
  );
}

function respuestaDesdeLibreto(ruta, foto, texto, historial) {
  const rutaEff = (foto && foto.ruta) || ruta;
  const flujo = resolverFlujo(texto, rutaEff, historial);
  const lib = resolverLibreto(rutaEff);
  const guia = flujo || lib;
  if (!guia) return null;
  const paso = resolverPasoActual(lib, foto, texto, historial, flujo, rutaEff);
  if (!paso) return null;
  const modo = (flujo && flujo.modoForzado) || (foto && foto.modo) || '';
  const titulo = (flujo && flujo.titulo) || guia.titulo;
  return `Siguiente paso en **${titulo}**:\n${textoDePaso(paso, modo)}`;
}

function pareceDiagnostico(texto) {
  return /\b(qu[eé] (me )?falta|no anda|est[aá] mal|diagn[oó]stic|configuraci[oó]n inicial|no emite|no hay productos|revisa(r)? (mi )?empresa)\b/i.test(
    String(texto || '')
  );
}

function textoDiagnostico(diag, ficha) {
  const puedeCfg = !ficha || !ficha.puede || ficha.puede.configuracion;
  const enlaceCfg = puedeCfg
    ? '[Facturación SUNAT](/configuracion?tab=facturacion)'
    : 'Facturación SUNAT (pida VER_CONFIGURACION al administrador)';
  if (!diag) {
    return `No pude leer el estado de la empresa. Revise ${enlaceCfg} y [Productos](/productos).`;
  }
  const lineas = (diag.problemas || []).map((p, i) => `${i + 1}) ${p}`);
  if (!lineas.length) {
    return `No veo huecos graves: hay productos, sucursal y facturación básica. Si no emite, revise la URL BillService en ${enlaceCfg}.`;
  }
  return [
    'Revisé su empresa. Lo pendiente:',
    ...lineas,
    `Configuración SUNAT: ${enlaceCfg}. Productos: [Productos](/productos).`
  ].join('\n');
}

function filtrarEnlacesPorPermiso(texto, ficha) {
  if (!ficha || !ficha.puede) return String(texto || '');
  let t = String(texto || '');
  if (!ficha.puede.configuracion) {
    t = t.replace(
      /\[([^\]]+)\]\(\/configuracion[^)]*\)/gi,
      'esa pantalla de configuración (pida VER_CONFIGURACION al administrador)'
    );
  }
  if (!ficha.puede.caja) {
    t = t.replace(/\[([^\]]+)\]\(\/caja[^)]*\)/gi, 'Caja (pida VER_CAJA al administrador)');
  }
  if (!ficha.puede.creditos) {
    t = t.replace(/\[([^\]]+)\]\(\/creditos[^)]*\)/gi, 'Créditos (pida VER_CREDITOS al administrador)');
  }
  if (!ficha.puede.inventario) {
    t = t.replace(/\[([^\]]+)\]\(\/inventario[^)]*\)/gi, 'Inventario (pida VER_INVENTARIO al administrador)');
  }
  if (!ficha.puede.ventas) {
    t = t.replace(/\[([^\]]+)\]\(\/ventas[^)]*\)/gi, 'Ventas (pida VER_VENTAS al administrador)');
    t = t.replace(
      /\[([^\]]+)\]\(\/facturacion\/(emision-guias|guias-remision|guias-transportista|notas-credito-debito)[^)]*\)/gi,
      'esa pantalla de facturación (pida permiso al administrador)'
    );
  }
  return t;
}

function respuestaGuiaLocal(texto, ruta, foto, historial) {
  const t = String(texto || '');
  const desdeLibreto = respuestaDesdeLibreto(ruta, foto, t, historial);
  const flujoNuevo = resolverFlujo(t, '', []);
  const enPantallaConLibreto = !!resolverLibreto((foto && foto.ruta) || ruta);
  if (desdeLibreto && (parecePedidoPasoAPaso(t) || usuarioEnFlujo(t) || (flujoNuevo && flujoNuevo.re.test(t)))) {
    return desdeLibreto;
  }
  const hits = TEMAS_GUIA.filter((tema) => tema.re.test(t));
  const hitsAjenos = hits.filter((h) => !['ventas', 'clientes', 'productos', 'caja'].includes(h.id));
  if (hitsAjenos.length && !usuarioEnFlujo(t)) {
    return hitsAjenos.map((h) => h.respuesta).join('\n\n');
  }
  if (enPantallaConLibreto && desdeLibreto) return desdeLibreto;
  if (hits.length) {
    return hits.map((h) => h.respuesta).join('\n\n');
  }
  if (desdeLibreto) return desdeLibreto;
  const r = String((foto && foto.ruta) || ruta || '');
  if (/configuracion/i.test(r)) {
    return TEMAS_GUIA.find((x) => x.id === 'sunat').respuesta;
  }
  if (/producto/i.test(r)) {
    return TEMAS_GUIA.find((x) => x.id === 'productos').respuesta;
  }
  if (/caja/i.test(r)) {
    return TEMAS_GUIA.find((x) => x.id === 'caja').respuesta;
  }
  if (/credito/i.test(r)) {
    return TEMAS_GUIA.find((x) => x.id === 'creditos').respuesta;
  }
  if (/inventario/i.test(r)) {
    return TEMAS_GUIA.find((x) => x.id === 'inventario-mov').respuesta;
  }
  return [
    'Puedo guiarte sin conexión a Gemini, con la guía de EFAFERP. Pregunta por SUNAT, productos, stock, ventas, caja, créditos, WhatsApp o matizado.',
    'Pantallas: [Configuración](/configuracion), [Productos](/productos), [Venta rápida](/ventas/rapida), [Caja](/caja), [Compras](/compras).',
    'Si dices «qué me falta», reviso el estado de tu empresa.'
  ].join('\n');
}

module.exports = {
  GUIA_EFAFERP,
  LIBRETOS,
  pareceDiagnostico,
  textoDiagnostico,
  respuestaGuiaLocal,
  sanitizarFotoPantalla,
  redactarMensajeUsuario,
  resolverLibreto,
  resolverFlujo,
  armarContextoGuia,
  resolverPasoActual,
  filtrarEnlacesPorPermiso
};
