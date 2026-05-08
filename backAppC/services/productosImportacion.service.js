const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const productosImportacionRepository = require('../repositories/productosImportacion.repository');
const productosMutacionesService = require('./productosMutaciones.service');

const MAX_FILAS = 4000;
const MAX_BYTES = 8 * 1024 * 1024;

function asegurarPuedeImportar(user) {
  if (!user || !user.empresa) {
    throw new Error('NO_ACCESS');
  }
  const r = (user.rol || '').toString();
  if (r !== 'Administrador' && r !== 'superAdmin') {
    throw new Error('NO_PERMISO_IMPORTACION');
  }
}

function normalizarClaveEncabezado(k) {
  return String(k || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '');
}

function leerCelda(mapaNorm, aliases) {
  for (const a of aliases) {
    const v = mapaNorm[normalizarClaveEncabezado(a)];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return '';
}

function normalizarNumeroFlexible(valueRaw) {
  let txt = String(valueRaw ?? '').trim();
  if (!txt) return '';
  txt = txt.replace(/\s+/g, '');
  if (txt.includes(',') && txt.includes('.')) {
    const lastComma = txt.lastIndexOf(',');
    const lastDot = txt.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Formato: 1.234,56
      txt = txt.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato: 1,234.56
      txt = txt.replace(/,/g, '');
    }
    return txt;
  }
  if (txt.includes(',')) {
    const parts = txt.split(',');
    if (parts.length > 2) {
      txt = `${parts.slice(0, -1).join('')}.${parts[parts.length - 1]}`;
    } else {
      txt = txt.replace(',', '.');
    }
    return txt;
  }
  if (txt.includes('.')) {
    const parts = txt.split('.');
    if (parts.length > 2) {
      txt = `${parts.slice(0, -1).join('')}.${parts[parts.length - 1]}`;
    }
    return txt;
  }
  return txt;
}

function parseNumeroFlexible(valueRaw) {
  const txt = normalizarNumeroFlexible(valueRaw);
  if (txt === '') return NaN;
  return parseFloat(txt);
}

function parsePrecioImportacion(valueRaw, fieldLabel, errores) {
  const txt = normalizarNumeroFlexible(valueRaw);
  if (txt === '') return 0;
  const v = parseFloat(txt);
  if (Number.isNaN(v)) {
    errores.push(`${fieldLabel} inválido`);
    return 0;
  }
  if (v < 0) {
    errores.push(`${fieldLabel} no puede ser negativo`);
    return 0;
  }
  return v;
}

/**
 * Convierte fila genérica de sheet_to_json a objeto normalizado (claves internas).
 */
function filaDesdeMapa(mapaNorm, numeroFila) {
  const codigo = leerCelda(mapaNorm, ['codigo', 'código', 'sku']);
  const descripcion = leerCelda(mapaNorm, ['descripcion', 'descripción', 'nombre producto']);
  const presentacionCodigo = leerCelda(mapaNorm, ['presentacion', 'presentación', 'unidad', 'codigo unidad', 'um']);
  const cantidadStr = leerCelda(mapaNorm, [
    'cantidadinicial',
    'cantidad inicial',
    'stockinicial',
    'stock inicial',
    'cantidad'
  ]);
  const costoStr = leerCelda(mapaNorm, ['costounitario', 'costo unitario', 'cunitario', 'costo']);
  const precioClienteStr = leerCelda(mapaNorm, [
    'preciolistacliente',
    'precio lista cliente',
    'preciocliente',
    'precio cliente',
    'precioventa',
    'precio venta',
    'precio lista'
  ]);
  const precioNormalStr = leerCelda(mapaNorm, [
    'preciolistanormal',
    'precio lista normal',
    'precionormal',
    'precio normal'
  ]);
  const precioMayoristaStr = leerCelda(mapaNorm, [
    'preciolistamayorista',
    'precio lista mayorista',
    'preciomayorista',
    'precio mayorista'
  ]);
  const categoriaAlias = leerCelda(mapaNorm, ['categoria', 'categoría']);
  const marcaAlias = leerCelda(mapaNorm, ['marca']);

  return {
    numeroFila,
    codigo,
    descripcion,
    presentacionCodigo,
    cantidadStr,
    costoStr,
    precioClienteStr,
    precioNormalStr,
    precioMayoristaStr,
    categoriaAlias,
    marcaAlias
  };
}

function parseBufferAObjetos(buffer) {
  if (!buffer || buffer.length > MAX_BYTES) {
    throw new Error('ARCHIVO_DEMASIADO_GRANDE');
  }
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const nombreHoja = wb.SheetNames[0];
  if (!nombreHoja) {
    throw new Error('EXCEL_SIN_HOJAS');
  }
  const sheet = wb.Sheets[nombreHoja];
  const filasRaw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  if (!Array.isArray(filasRaw) || filasRaw.length === 0) {
    throw new Error('EXCEL_SIN_DATOS');
  }
  if (filasRaw.length > MAX_FILAS) {
    throw new Error('DEMASIADAS_FILAS');
  }
  const out = [];
  let i = 0;
  for (const raw of filasRaw) {
    i += 1;
    const numeroFila = i + 1;
    const mapaNorm = {};
    for (const [k, v] of Object.entries(raw)) {
      mapaNorm[normalizarClaveEncabezado(k)] = v;
    }
    const row = filaDesdeMapa(mapaNorm, numeroFila);
    const vacia =
      !row.codigo &&
      !row.descripcion &&
      !row.presentacionCodigo &&
      !row.cantidadStr &&
      !row.costoStr &&
      !row.precioClienteStr &&
      !row.precioNormalStr &&
      !row.precioMayoristaStr &&
      !row.categoriaAlias &&
      !row.marcaAlias;
    if (!vacia) {
      out.push(row);
    }
  }
  return out;
}

function generarPlantillaBuffer() {
  const headers = [
    'codigo',
    'descripcion',
    'presentacion',
    'cantidadInicial',
    'costoUnitario',
    'precioNormal',
    'precioCliente',
    'precioMayorista',
    'categoria',
    'marca'
  ];
  const ejemplo = ['EJEMPLO001', 'Producto de demostración', 'NIU', 10, 5.5, 9.9, 8.99, 8.5, 'VARIOS', 'SM'];
  const ws = XLSX.utils.aoa_to_sheet([headers, ejemplo]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Productos');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function nombreNormalizadoLista(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolverListasPrecioImportacion(listas) {
  const out = {
    normal: null,
    cliente: null,
    mayorista: null
  };
  for (const l of listas || []) {
    const n = nombreNormalizadoLista(l?.nombre);
    if (!out.normal && n.includes('precio normal')) out.normal = l;
    if (!out.cliente && n.includes('precio cliente')) out.cliente = l;
    if (!out.mayorista && n.includes('precio mayorista')) out.mayorista = l;
  }
  return out;
}

function generarNoImportadosBuffer(rowsNoImportados) {
  const headers = ['fila', 'codigo', 'descripcion', 'motivo'];
  const body = (rowsNoImportados || []).map((r) => [r.fila, r.codigo || '', r.descripcion || '', r.motivo || '']);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'NoImportados');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Resuelve catálogos y valida negocio. Retorna filas listas para insertar o lista de errores.
 */
async function resolverYValidarFilas(pool, idEmpresa, filasParseadas) {
  const idSucursal = await productosImportacionRepository.obtenerIdSucursalPrincipal(pool, idEmpresa);
  if (!idSucursal) {
    throw new Error('SIN_SUCURSAL_PRINCIPAL');
  }

  const listasDisponibles = await productosImportacionRepository.obtenerListasPrecioBaseImportacion(pool, idEmpresa);
  const listasPrecio = resolverListasPrecioImportacion(listasDisponibles);
  const errores = [];
  if (!listasPrecio.normal) errores.push({ fila: 1, codigo: '', mensajes: ['No existe lista activa "Precio Normal".'] });
  if (!listasPrecio.cliente) errores.push({ fila: 1, codigo: '', mensajes: ['No existe lista activa "Precio Cliente".'] });
  if (!listasPrecio.mayorista) errores.push({ fila: 1, codigo: '', mensajes: ['No existe lista activa "Precio Mayorista".'] });
  if (errores.length > 0) {
    return { filasResueltas: [], errores, idSucursal, listasPrecio };
  }
  const vistosCodigo = new Map();

  const filasResueltas = [];

  for (const f of filasParseadas) {
    const msgs = [];

    if (!f.codigo) msgs.push('Falta codigo');
    if (!f.descripcion) msgs.push('Falta descripcion');
    if (!f.presentacionCodigo) msgs.push('Falta presentacion (código ej. NIU)');
    const costo = parseNumeroFlexible(f.costoStr);
    if (Number.isNaN(costo) || costo < 0) msgs.push('costoUnitario inválido');
    const precioNormal = parsePrecioImportacion(f.precioNormalStr, 'precioNormal', msgs);
    const precioCliente = parsePrecioImportacion(f.precioClienteStr, 'precioCliente', msgs);
    const precioMayorista = parsePrecioImportacion(f.precioMayoristaStr, 'precioMayorista', msgs);
    const cantidadInicialRaw = parseNumeroFlexible(f.cantidadStr);
    if (Number.isNaN(cantidadInicialRaw)) msgs.push('cantidadInicial inválida');
    const cantidadInicial = Number.isNaN(cantidadInicialRaw) ? 0 : Math.max(0, cantidadInicialRaw);

    const ck = f.codigo.toUpperCase();
    if (vistosCodigo.has(ck)) {
      msgs.push(`Código duplicado en el archivo (fila ${vistosCodigo.get(ck)})`);
    }

    let idPresentacion = null;
    if (f.presentacionCodigo && msgs.length === 0) {
      idPresentacion = await productosImportacionRepository.obtenerIdPresentacionPorCodigo(pool, f.presentacionCodigo);
      if (idPresentacion == null) {
        msgs.push(`Presentación no encontrada: "${f.presentacionCodigo}"`);
      }
    }

    let idCategoria = null;
    let idMarca = null;
    if (msgs.length === 0) {
      idCategoria = await productosImportacionRepository.obtenerIdCategoriaPorAlias(pool, idEmpresa, f.categoriaAlias);
      if (idCategoria == null) {
        msgs.push(
          `Categoría no encontrada para "${f.categoriaAlias || 'VARIOS'}". Cree una categoría "VARIOS" o indique el nombre exacto.`
        );
      }
      idMarca = await productosImportacionRepository.obtenerIdMarcaPorAlias(pool, idEmpresa, f.marcaAlias);
      if (idMarca == null) {
        msgs.push(
          `Marca no encontrada para "${f.marcaAlias || 'SM'}". Cree una marca "SM" o "Sin marca" o indique el nombre exacto.`
        );
      }
    }

    if (msgs.length === 0 && f.codigo) {
      const existe = await productosImportacionRepository.existeCodigoProducto(pool, idEmpresa, f.codigo);
      if (existe) {
        msgs.push('El código ya existe en productos');
      }
    }

    if (msgs.length > 0) {
      errores.push({ fila: f.numeroFila, codigo: f.codigo || '', mensajes: msgs });
      continue;
    }

    vistosCodigo.set(ck, f.numeroFila);
    filasResueltas.push({
      numeroFila: f.numeroFila,
      codigo: f.codigo.trim(),
      descripcion: f.descripcion.trim(),
      idPresentacion,
      idCategoria,
      idMarca,
      cUnitario: costo,
      precioCliente,
      precioNormal,
      precioMayorista,
      cantidadInicial,
      idSucursal,
      listasPrecio
    });
  }

  return { filasResueltas, errores, idSucursal, listasPrecio };
}

async function validarArchivo(pool, user, buffer) {
  asegurarPuedeImportar(user);
  const idEmpresa = user.empresa;
  const filas = parseBufferAObjetos(buffer);
  const { filasResueltas, errores } = await resolverYValidarFilas(pool, idEmpresa, filas);
  return {
    totalLeidas: filas.length,
    validas: filasResueltas.length,
    conError: errores.length,
    errores,
    vistaPrevia: filasResueltas.slice(0, 30).map((r) => ({
      fila: r.numeroFila,
      codigo: r.codigo,
      descripcion: r.descripcion,
      cantidadInicial: r.cantidadInicial,
      costoUnitario: r.cUnitario,
      precioNormal: r.precioNormal,
      precioCliente: r.precioCliente,
      precioMayorista: r.precioMayorista
    }))
  };
}

async function ejecutarImportacion(pool, user, buffer) {
  asegurarPuedeImportar(user);
  const idEmpresa = user.empresa;
  const filas = parseBufferAObjetos(buffer);
  const { filasResueltas, errores } = await resolverYValidarFilas(pool, idEmpresa, filas);

  if (filasResueltas.length === 0) {
    const noImportados = (errores || []).map((e) => ({
      fila: e.fila,
      codigo: e.codigo || '',
      descripcion: '',
      motivo: (e.mensajes || []).join('; ')
    }));
    const noImportadosExcel =
      noImportados.length > 0
        ? {
            fileName: `productos_no_importados_${Date.now()}.xlsx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            base64: generarNoImportadosBuffer(noImportados).toString('base64'),
            total: noImportados.length
          }
        : null;
    return {
      total: filas.length,
      insertados: 0,
      detalle: [],
      erroresValidacion: errores,
      erroresEjecucion: [],
      noImportadosExcel
    };
  }

  const idUsuario = await productosMutacionesService.resolverIdUsuarioParaProducto(pool, idEmpresa, user.sub);
  if (!idUsuario) {
    throw new Error('SIN_USUARIO_PRODUCTO');
  }

  const insertados = [];
  const erroresEjecucion = [];

  for (const r of filasResueltas) {
    const idProducto = uuidv4();
    const hoy = new Date();
    const FIngreso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    const datosProducto = {
      idProducto,
      Codigo: r.codigo,
      idCategoria: r.idCategoria,
      descripcion: r.descripcion,
      idMarca: r.idMarca,
      idPresentacion: r.idPresentacion,
      cUnitario: r.cUnitario,
      fProduccion: null,
      fVencimiento: null,
      idEmpresa,
      idUsuario,
      FIngreso,
      estado: 1,
      facturar: 'SI',
      alertaMinimo: 5,
      alertaMaximo: 50,
      tipoProducto: 'S',
      VecesVendidas: 0,
      permiteDescripcionEnVenta: 0
    };

    const lote =
      r.cantidadInicial > 0
        ? {
            idSucursal: r.idSucursal,
            cantidadIngresada: r.cantidadInicial,
            costoUnitario: r.cUnitario
          }
        : null;

    try {
      const resultado = await productosMutacionesService.crearProductoConTransaccion(pool, {
        datosProducto,
        usarCorrelativo: false,
        lote,
        precioVenta: r.precioCliente,
        idListaPrecio: null,
        preciosPorLista: [
          {
            idLista: r.listasPrecio.normal.idLista,
            idMoneda: r.listasPrecio.normal.idMoneda,
            precio: r.precioNormal
          },
          {
            idLista: r.listasPrecio.cliente.idLista,
            idMoneda: r.listasPrecio.cliente.idMoneda,
            precio: r.precioCliente
          },
          {
            idLista: r.listasPrecio.mayorista.idLista,
            idMoneda: r.listasPrecio.mayorista.idMoneda,
            precio: r.precioMayorista
          }
        ],
        idEmpresa
      });
      if (resultado.errorLista) {
        erroresEjecucion.push({ fila: r.numeroFila, codigo: r.codigo, mensajes: ['Lista de precios principal no configurada'] });
        continue;
      }
      insertados.push({ fila: r.numeroFila, idProducto: resultado.idProducto, codigo: r.codigo });
    } catch (e) {
      console.error('contexto: importacion producto fila', r.numeroFila, e);
      erroresEjecucion.push({
        fila: r.numeroFila,
        codigo: r.codigo,
        mensajes: [String(e.message || 'Error al insertar').slice(0, 200)]
      });
    }
  }

  const noImportados = [
    ...errores.map((e) => ({
      fila: e.fila,
      codigo: e.codigo || '',
      descripcion: '',
      motivo: (e.mensajes || []).join('; ')
    })),
    ...erroresEjecucion.map((e) => ({
      fila: e.fila,
      codigo: e.codigo || '',
      descripcion: '',
      motivo: (e.mensajes || []).join('; ')
    }))
  ];
  let noImportadosExcel = null;
  if (noImportados.length > 0) {
    const buffer = generarNoImportadosBuffer(noImportados);
    noImportadosExcel = {
      fileName: `productos_no_importados_${Date.now()}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: buffer.toString('base64'),
      total: noImportados.length
    };
  }

  return {
    total: filas.length,
    insertados: insertados.length,
    detalle: insertados,
    erroresValidacion: errores,
    erroresEjecucion,
    noImportadosExcel
  };
}

module.exports = {
  asegurarPuedeImportar,
  generarPlantillaBuffer,
  validarArchivo,
  ejecutarImportacion,
  MAX_FILAS,
  MAX_BYTES
};
