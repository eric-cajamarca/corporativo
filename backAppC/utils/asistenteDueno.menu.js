/**
 * Mapa del sidebar y flujos de enseñanza del asistente de la plataforma.
 * No usar en el bot comercial de WhatsApp.
 */

const MENU = [
  { padre: 'Ventas', item: 'Venta rápida', ruta: '/ventas/rapida' },
  { padre: 'Ventas', item: 'Nueva Venta', ruta: '/ventas/create' },
  { padre: 'Ventas', item: 'Historial / Resumen de ventas', ruta: '/ventas' },
  { padre: 'Ventas', item: 'Cotizaciones', ruta: '/cotizaciones' },
  { padre: 'Productos', item: 'Lista de Productos', ruta: '/productos' },
  { padre: 'Clientes', item: 'Lista de Clientes', ruta: '/clientes' },
  { padre: 'Clientes', item: 'Nuevo Cliente', ruta: '/cliente/create' },
  { padre: 'Compras', item: 'Registrar Compras', ruta: '/compras/create' },
  { padre: 'Compras', item: 'Consultar Compras', ruta: '/compras' },
  { padre: 'Inventario', item: 'Ingresos y salidas', ruta: '/inventario/ingresos' },
  { padre: 'Inventario', item: 'Stock Actual', ruta: '/inventario/stock-actual' },
  { padre: 'Inventario', item: 'Conteo físico', ruta: '/inventario/conteo-fisico' },
  { padre: 'Caja', item: 'Gestión de Cajas', ruta: '/caja' },
  { padre: 'Caja', item: 'Arqueo de Caja', ruta: '/caja/arqueo' },
  { padre: 'Caja', item: 'Cobranza de Créditos', ruta: '/creditos' },
  { padre: 'Inventario', item: 'Kardex', ruta: '/inventario/kardex' },
  { padre: 'Compras', item: 'Proveedores', ruta: '/proveedores' },
  { padre: 'Despachos y envíos', item: 'Despachos', ruta: '/despachos' },
  { padre: 'Facturación electrónica', item: 'Emisión de notas', ruta: '/facturacion/notas-credito-debito' },
  { padre: 'Facturación electrónica', item: 'Emisión de guías', ruta: '/facturacion/emision-guias' },
  { padre: 'Facturación electrónica', item: 'Resumen diario', ruta: '/facturacion/resumenes-diarios' },
  { padre: 'Facturación electrónica', item: 'Comunicación de baja', ruta: '/facturacion/comunicacion-baja' }
];

function textoMenu() {
  return [
    'Menú izquierdo (nombres reales; no inventes otros):',
    '- **Ventas**: Venta rápida, Nueva Venta, historial, Cotizaciones.',
    '- **Productos**: Lista de Productos. El alta es el botón **Nuevo Producto** en esa lista (o /productos/create).',
    '- **Clientes**: Lista de Clientes, Nuevo Cliente.',
    '- **Compras**: Registrar Compras, Consultar Compras, Proveedores.',
    '- **Inventario**: Ingresos y salidas, Stock Actual, Conteo físico, Kardex.',
    '- **Caja**: Gestión de Cajas, Arqueo de Caja, Cobranza de Créditos.',
    '- **Despachos y envíos**: Despachos.',
    '- **Facturación electrónica**: Resumen diario, Emisión de notas, Comunicación de baja, Emisión de guías.',
    'Para ir a una pantalla: «En el menú izquierdo abre **Padre** y pulsa **Ítem**» más el enlace markdown.'
  ].join('\n');
}

function textoIrMenu(flujo) {
  if (!flujo || !flujo.menu) return '';
  const { padre, item, ruta } = flujo.menu;
  return `En el menú izquierdo abre **${padre}** y pulsa **${item}**. [${item}](${ruta}).`;
}

const FLUJOS = [
  {
    id: 'emitir-boleta',
    titulo: 'Emitir boleta o factura',
    re: /\b((emit\w*|cobrar|hacer).{0,24}(boleta|factura|comprobante)|venta r[aá]pida|c[oó]mo (hago |hago una )?venta)\b/i,
    rutas: [/\/ventas\/rapida/i],
    menu: { padre: 'Ventas', item: 'Venta rápida', ruta: '/ventas/rapida' },
    irA: '/ventas/rapida',
    pasos: [
      { clave: 'ir', texto: '' },
      {
        clave: 'comprobante',
        texto:
          'En **Comprobante** elige *Boleta* (o *Factura* si el cliente tiene RUC). No hay pestaña «Comprobantes» ni «Modo boleta».'
      },
      {
        clave: 'cliente',
        texto:
          'En **N° documento** escribe DNI o RUC y pulsa la lupa, o el icono de personas junto a **Cliente**. Atajo **F8**.'
      },
      {
        clave: 'producto',
        texto:
          'En **Buscar producto** escribe nombre o código y haz clic en la fila para agregarlo. Atajo **F2**.'
      },
      {
        clave: 'cobrar',
        texto: 'Pulsa **Cobrar** (F4). Si hay varias formas de pago, usa **Pagos mixtos**.'
      }
    ]
  },
  {
    id: 'nueva-venta',
    titulo: 'Nueva venta',
    re: /\b(nueva venta|venta completa|datos del comprobante)\b/i,
    rutas: [/\/ventas\/create/i],
    menu: { padre: 'Ventas', item: 'Nueva Venta', ruta: '/ventas/create' },
    irA: '/ventas/create',
    pasos: [
      { clave: 'ir', texto: '' },
      {
        clave: 'comprobante',
        texto: 'Pulsa **Datos del Comprobante** y elige boleta o factura (y la serie).'
      },
      { clave: 'cliente', texto: 'Pulsa **Cliente** (o F6) y busca o registra al cliente.' },
      {
        clave: 'producto',
        texto: 'Usa **Buscar Código** o **Buscar** (F2) y agrega productos al **Detalle de Venta**.'
      },
      {
        clave: 'pago',
        omitirSiModo: ['cotizacion'],
        texto: 'Pulsa **Forma de pago** (F4) y registra el cobro. En cotización este paso no aplica.'
      },
      {
        clave: 'registrar',
        texto: 'Pulsa **Registrar venta**.',
        textoSiModo: {
          cotizacion:
            'Pulsa **Registrar venta**. Aunque el botón diga eso, al ser cotización (CT) se guarda la cotización. No uses **Forma de pago**.'
        }
      }
    ]
  },
  {
    id: 'cotizacion',
    titulo: 'Cotización',
    re: /\b(cotiz(ar|aci[oó]n|aciones)?)\b/i,
    rutas: [/\/ventas\/create/i, /\/cotizaciones/i],
    menu: { padre: 'Ventas', item: 'Nueva Venta', ruta: '/ventas/create' },
    irA: '/ventas/create',
    modoForzado: 'cotizacion',
    pasos: [
      { clave: 'ir', texto: '' },
      {
        clave: 'comprobante',
        texto:
          'Pulsa **Datos del Comprobante** y elige el tipo *Cotización* (CT). El historial de cotizaciones está en **Ventas → Cotizaciones**.'
      },
      { clave: 'cliente', texto: 'Pulsa **Cliente** (o F6) y busca o registra al cliente.' },
      {
        clave: 'producto',
        texto: 'Agrega productos con **Buscar** (F2) al **Detalle de Venta**.'
      },
      {
        clave: 'registrar',
        texto:
          'Pulsa **Registrar venta**. Aunque el botón diga eso, guarda la cotización. No uses **Forma de pago**.'
      }
    ]
  },
  {
    id: 'compra',
    titulo: 'Registrar una compra',
    re: /\b(compra|registrar compra|ingresar compra|factura (del )?proveedor)\b/i,
    rutas: [/\/compras\/create/i],
    menu: { padre: 'Compras', item: 'Registrar Compras', ruta: '/compras/create' },
    irA: '/compras/create',
    pasos: [
      { clave: 'ir', texto: '' },
      {
        clave: 'proveedor',
        texto:
          'En **Número de documento** escribe el RUC y pulsa **Buscar**, o **Elegir** para tomar un proveedor de la lista.'
      },
      {
        clave: 'comprobante',
        texto: 'Completa **Comprobante**, serie/número y fechas.'
      },
      {
        clave: 'producto',
        texto: 'Agrega productos al detalle (cantidad y costo). Eso ingresa stock.'
      },
      { clave: 'registrar', texto: 'Pulsa **Registrar Compra**.' }
    ]
  },
  {
    id: 'inventario-inicial',
    titulo: 'Inventario inicial / ingreso sin factura',
    re: /\b(inventario inicial|sin comprobante|ingresos? de (inventario|mercader)|abastecimiento|ingresos y salidas)\b/i,
    rutas: [/\/inventario\/ingresos/i, /\/inventario\/ingreso-salida/i],
    menu: { padre: 'Inventario', item: 'Ingresos y salidas', ruta: '/inventario/ingresos' },
    irA: '/inventario/ingresos',
    pasos: [
      { clave: 'ir', texto: '' },
      {
        clave: 'tipo',
        texto:
          'En **Tipo de movimiento** elige *Inventario inicial* (código II). No pidas factura de compra aquí.'
      },
      {
        clave: 'producto',
        texto: 'Pulsa **Buscar producto** o **Agregar línea** e indica cantidad (y costo si aplica).'
      },
      { clave: 'registrar', texto: 'Pulsa **Guardar ingreso**.' }
    ]
  },
  {
    id: 'abrir-caja',
    titulo: 'Abrir caja',
    re: /\b(abrir caja|apertura de caja|no (me )?deja vender|caja abierta|gesti[oó]n de cajas)\b/i,
    rutas: [/\/caja\/?(\?|$)/i],
    menu: { padre: 'Caja', item: 'Gestión de Cajas', ruta: '/caja' },
    irA: '/caja',
    pasos: [
      { clave: 'ir', texto: '' },
      {
        clave: 'abrir',
        texto:
          'Si no hay caja, pulsa **Nueva caja**. En la tarjeta, el botón verde abre la caja (debe quedar **Abierta**). Sin caja abierta no se cobra en ventas.'
      }
    ]
  },
  {
    id: 'alta-producto',
    titulo: 'Crear producto',
    re: /\b((crear|nuevo|alta de) producto|dar de alta (un )?producto)\b/i,
    rutas: [/\/productos\/create/i],
    menu: { padre: 'Productos', item: 'Lista de Productos', ruta: '/productos' },
    irA: '/productos/create',
    pasos: [
      { clave: 'ir', texto: 'En el menú izquierdo abre **Productos** → **Lista de Productos** y pulsa **Nuevo Producto**. [Agregar producto](/productos/create).' },
      {
        clave: 'descripcion',
        texto:
          'En **Datos Básicos** completa **Descripción**, **Categoría**, **Marca** y **Presentación**.'
      },
      { clave: 'inventario', texto: 'Pasa a **Inventario y Lote** si vas a cargar cantidad inicial.' },
      { clave: 'precios', texto: 'En **Precios** pon el precio de venta y pulsa **Guardar producto**.' }
    ]
  },
  {
    id: 'alta-cliente',
    titulo: 'Crear cliente',
    re: /\b((crear|nuevo|alta de) cliente|registrar (un )?cliente)\b/i,
    rutas: [/\/cliente\/create/i, /\/clientes\/?(\?|$)/i],
    menu: { padre: 'Clientes', item: 'Nuevo Cliente', ruta: '/cliente/create' },
    irA: '/cliente/create',
    pasos: [
      { clave: 'ir', texto: '' },
      {
        clave: 'doc',
        texto:
          'Elige **Tipo de documento**, escribe el número y pulsa **Buscar**. Completa los datos y **Registrar**.'
      }
    ]
  },
  {
    id: 'notas',
    titulo: 'Nota de crédito o débito',
    re: /\b(nota de (cr[eé]dito|d[eé]bito)|notas de (cr[eé]dito|d[eé]bito)|emisi[oó]n de notas|anular (una )?(boleta|factura) con nota)\b/i,
    rutas: [/\/facturacion\/notas-credito-debito/i],
    menu: { padre: 'Facturación electrónica', item: 'Emisión de notas', ruta: '/facturacion/notas-credito-debito' },
    irA: '/facturacion/notas-credito-debito',
    pasos: [
      { clave: 'ir', texto: '' },
      {
        clave: 'origen',
        texto:
          'En **Buscar comprobante origen** elige serie y número (o RUC) de la boleta/factura aceptada y pulsa **Buscar**. Luego **Usar este**.'
      },
      {
        clave: 'registrar',
        texto: 'Completa el motivo y pulsa **Crear nota de crédito** o **Crear nota de débito**. Luego puedes enviarla a SUNAT.'
      }
    ]
  },
  {
    id: 'creditos',
    titulo: 'Cobranza de créditos',
    re: /\b(cr[eé]ditos?|cuotas?|cobranza|cobrar cuota|letra)\b/i,
    rutas: [/\/creditos/i],
    menu: { padre: 'Caja', item: 'Cobranza de Créditos', ruta: '/creditos' },
    irA: '/creditos',
    pasos: [
      { clave: 'ir', texto: '' },
      {
        clave: 'buscar',
        texto: 'En **Cobranza de Créditos** busca al cliente o el número y pulsa la lupa. Abre el crédito (ojo / cuotas).'
      },
      {
        clave: 'registrar',
        texto: 'Elige la cuota y pulsa **Registrar Pago** (o **Cobrar seleccionadas**). La venta al crédito se marca en Nueva Venta, no aquí.'
      }
    ]
  },
  {
    id: 'guias',
    titulo: 'Guía de remisión',
    re: /\b(gu[ií]a(s)? de remisi[oó]n|emisi[oó]n de gu[ií]as|guia remitente|guia transportista)\b/i,
    rutas: [/\/facturacion\/(emision-guias|guias-remision|guias-transportista)/i],
    menu: { padre: 'Facturación electrónica', item: 'Emisión de guías', ruta: '/facturacion/emision-guias' },
    irA: '/facturacion/emision-guias',
    pasos: [
      { clave: 'ir', texto: '' },
      {
        clave: 'tipo',
        texto:
          'Pulsa **Guía remitente** (o **Guía transportista** si aplica). El listado queda en Emisión de guías.'
      },
      {
        clave: 'origen',
        texto: 'Si parte de una venta, usa **buscar comprobante origen**. Completa partida, llegada y bultos.'
      },
      { clave: 'registrar', texto: 'Pulsa **Guardar guía**. Después envíala a SUNAT desde **Emisión de guías**.' }
    ]
  },
  {
    id: 'kardex',
    titulo: 'Consultar kardex',
    re: /\b(kardex|movimientos de (un )?producto|historial de stock)\b/i,
    rutas: [/\/inventario\/kardex/i],
    menu: { padre: 'Inventario', item: 'Kardex', ruta: '/inventario/kardex' },
    irA: '/inventario/kardex',
    pasos: [
      { clave: 'ir', texto: '' },
      {
        clave: 'producto',
        texto: 'Pulsa **Buscar producto**, elige el ítem y **Buscar**. Sin producto puedes exportar el Formato 13.1 (todos).'
      }
    ]
  },
  {
    id: 'stock-actual',
    titulo: 'Stock actual',
    re: /\b(stock actual|existencias|cu[aá]nto stock|qu[eé] hay en almac[eé]n)\b/i,
    rutas: [/\/inventario\/stock-actual/i],
    menu: { padre: 'Inventario', item: 'Stock Actual', ruta: '/inventario/stock-actual' },
    irA: '/inventario/stock-actual',
    pasos: [{ clave: 'ir', texto: '' }, { clave: 'ver', texto: 'Ahí ves existencias por producto y sucursal. Usa refrescar si acabas de comprar o ingresar.' }]
  },
  {
    id: 'conteo-fisico',
    titulo: 'Conteo físico',
    re: /\b(conteo f[ií]sico|inventario f[ií]sico|ajuste por conteo)\b/i,
    rutas: [/\/inventario\/conteo-fisico/i],
    menu: { padre: 'Inventario', item: 'Conteo físico', ruta: '/inventario/conteo-fisico' },
    irA: '/inventario/conteo-fisico',
    pasos: [
      { clave: 'ir', texto: '' },
      { clave: 'registrar', texto: 'Registra las cantidades contadas. El sistema ajusta la diferencia respecto al stock del sistema.' }
    ]
  },
  {
    id: 'arqueo',
    titulo: 'Arqueo de caja',
    re: /\b(arqueo)\b/i,
    rutas: [/\/caja\/arqueo/i],
    menu: { padre: 'Caja', item: 'Arqueo de Caja', ruta: '/caja/arqueo' },
    irA: '/caja/arqueo',
    pasos: [
      { clave: 'ir', texto: '' },
      { clave: 'ver', texto: 'Consulta el arqueo de la caja/fecha. El cierre del turno se hace en **Caja → Gestión de Cajas**.' }
    ]
  },
  {
    id: 'proveedores',
    titulo: 'Proveedores',
    re: /\b(proveedores?|alta de proveedor|nuevo proveedor)\b/i,
    rutas: [/\/proveedores/i],
    menu: { padre: 'Compras', item: 'Proveedores', ruta: '/proveedores' },
    irA: '/proveedores',
    pasos: [
      { clave: 'ir', texto: '' },
      { clave: 'nuevo', texto: 'Pulsa **Nuevo proveedor**. Para comprar, el proveedor también se puede elegir en **Registrar Compras**.' }
    ]
  },
  {
    id: 'despachos',
    titulo: 'Despachos',
    re: /\b(despacho|env[ií]os?|chofer)\b/i,
    rutas: [/\/despachos/i],
    menu: { padre: 'Despachos y envíos', item: 'Despachos', ruta: '/despachos' },
    irA: '/despachos',
    pasos: [
      { clave: 'ir', texto: '' },
      {
        clave: 'buscar',
        texto: 'Busca la venta y pulsa **Crear despacho** (o el botón de crear en el resultado). Completa chofer/vehículo si pide.'
      }
    ]
  },
  {
    id: 'resumen-diario',
    titulo: 'Resumen diario SUNAT',
    re: /\b(resumen diario|res[uú]menes diarios|\bRC\b)\b/i,
    rutas: [/\/facturacion\/resumenes-diarios/i],
    menu: { padre: 'Facturación electrónica', item: 'Resumen diario', ruta: '/facturacion/resumenes-diarios' },
    irA: '/facturacion/resumenes-diarios',
    pasos: [
      { clave: 'ir', texto: '' },
      {
        clave: 'enviar',
        texto:
          'Elige la fecha y pulsa **Enviar resumen**. Esto aplica si en Configuración → Facturación está activo «Usar resumen diario (RC)» para boletas.'
      }
    ]
  },
  {
    id: 'baja-sunat',
    titulo: 'Comunicación de baja',
    re: /\b(comunicaci[oó]n de baja|dar de baja|anular (en )?sunat)\b/i,
    rutas: [/\/facturacion\/comunicacion-baja/i],
    menu: { padre: 'Facturación electrónica', item: 'Comunicación de baja', ruta: '/facturacion/comunicacion-baja' },
    irA: '/facturacion/comunicacion-baja',
    pasos: [
      { clave: 'ir', texto: '' },
      { clave: 'registrar', texto: 'Busca el comprobante y genera la comunicación de baja. No inventes un botón «Anular SUNAT» en Ventas si no existe.' }
    ]
  },
  {
    id: 'salida-inventario',
    titulo: 'Salida de inventario',
    re: /\b(salida(s)? de inventario|merma|baja de stock)\b/i,
    rutas: [/\/inventario\/salidas/i],
    menu: { padre: 'Inventario', item: 'Ingresos y salidas', ruta: '/inventario/salidas' },
    irA: '/inventario/salidas',
    pasos: [
      { clave: 'ir', texto: 'En el menú izquierdo abre **Inventario** → **Ingresos y salidas**, luego **Ir a salidas**. [Salidas](/inventario/salidas).' },
      { clave: 'tipo', texto: 'Elige el **Tipo de movimiento** (merma, reajuste negativo, etc.).' },
      { clave: 'producto', texto: 'Agrega productos y cantidades. Pulsa el botón de guardar salida.' }
    ]
  }
];

function completarPasosIr(flujo) {
  if (!flujo) return flujo;
  return {
    ...flujo,
    pasos: (flujo.pasos || []).map((p) => {
      if (p.clave !== 'ir' || (p.texto && p.texto.trim())) return p;
      return { ...p, texto: textoIrMenu(flujo) };
    })
  };
}

function textoDeMensaje(item) {
  if (!item) return '';
  if (typeof item.text === 'string') return item.text;
  const parts = item.parts || [];
  return parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('\n');
}

function flujoPorTexto(texto) {
  const t = String(texto || '');
  if (!t.trim()) return null;
  return FLUJOS.find((f) => f.re.test(t)) || null;
}

function flujoPorRuta(ruta) {
  const r = String(ruta || '');
  return FLUJOS.find((f) => (f.rutas || []).some((re) => re.test(r))) || null;
}

function estaEnRutaFlujo(flujo, ruta) {
  if (!flujo) return false;
  return (flujo.rutas || []).some((re) => re.test(String(ruta || '')));
}

/**
 * Mantiene el tema del chat: un mensaje nuevo que encaje en otro flujo lo cambia;
 * si no, se conserva el último flujo del historial; si no, el de la ruta.
 */
function resolverFlujo(texto, ruta, historial) {
  const delMensaje = flujoPorTexto(texto);
  if (delMensaje) return completarPasosIr(delMensaje);

  const lista = Array.isArray(historial) ? historial : [];
  for (let i = lista.length - 1; i >= 0; i -= 1) {
    const t = textoDeMensaje(lista[i]);
    const porId = /\[flujo:([a-z0-9-]+)\]/i.exec(t);
    if (porId) {
      const found = FLUJOS.find((f) => f.id === porId[1]);
      if (found) return completarPasosIr(found);
    }
    const porTexto = flujoPorTexto(t);
    if (porTexto) return completarPasosIr(porTexto);
  }

  const porRuta = flujoPorRuta(ruta);
  return porRuta ? completarPasosIr(porRuta) : null;
}

function textoFlujo(flujo) {
  if (!flujo) return 'No hay un flujo de enseñanza activo. Pregunta cómo emitir una boleta, registrar una compra, abrir caja o crear un producto.';
  const f = completarPasosIr(flujo);
  return [
    `Flujo: ${f.titulo} (id ${f.id})`,
    f.menu ? `Menú: **${f.menu.padre}** → **${f.menu.item}** → [${f.menu.item}](${f.menu.ruta})` : '',
    'Pasos (uno por turno; salta «ir» si ya está en esa pantalla; salta claves en foto.listos):',
    ...f.pasos.map((p, i) => `${i + 1}) [${p.clave}] ${p.texto}`)
  ]
    .filter(Boolean)
    .join('\n');
}

module.exports = {
  MENU,
  FLUJOS,
  textoMenu,
  textoIrMenu,
  textoFlujo,
  resolverFlujo,
  estaEnRutaFlujo,
  completarPasosIr
};
