const { v4: uuidv4 } = require('uuid');
const productosImportacionRepository = require('../repositories/productosImportacion.repository');
const { esCodigoPresentacionServicio } = require('../utils/productoInventariable.util');
const productosMutacionesService = require('./productosMutaciones.service');
const pdfBackend = require('./pdfBackend.client');

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
    'cantidadinici',
    'cantidadini',
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
    'precio mayorista',
    'preciomayori'
  ]);
  const categoriaAlias = leerCelda(mapaNorm, ['categoria', 'categoría']);
  const marcaAlias = leerCelda(mapaNorm, ['marca']);
  const ubicacionCodigo = leerCelda(mapaNorm, [
    'ubicacion',
    'ubicación',
    'codigoubicacion',
    'codigo ubicacion',
    'codigoUbicacion'
  ]);

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
    marcaAlias,
    ubicacionCodigo
  };
}

/**
 * Delega la lectura del xlsx a pdf-backend (POST /api/reports/parse-excel).
 * Recibe { headers, rows: [{header: value}] } y aplica la normalización de negocio.
 *
 * Los códigos de error (ARCHIVO_DEMASIADO_GRANDE, EXCEL_SIN_HOJAS, EXCEL_SIN_DATOS,
 * DEMASIADAS_FILAS) los devuelve pdf-backend; aquí solo se relanzan tal cual para
 * que el controller los traduzca a HTTP de cara al frontend.
 */
async function parseBufferAObjetos(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error('EXCEL_SIN_DATOS');
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error('ARCHIVO_DEMASIADO_GRANDE');
  }

  let parsed;
  try {
    parsed = await pdfBackend.parsearExcel(buffer, {
      fileName: 'productos_importacion.xlsx',
      maxBytes: MAX_BYTES,
      maxFilas: MAX_FILAS
    });
  } catch (err) {
    if (err && err.code) {
      throw new Error(err.code);
    }
    console.error('contexto: productosImportacion parseBufferAObjetos pdf-backend', err);
    throw new Error('EXCEL_SIN_DATOS');
  }

  const filas = Array.isArray(parsed && parsed.rows) ? parsed.rows : [];
  if (filas.length === 0) {
    throw new Error('EXCEL_SIN_DATOS');
  }
  if (filas.length > MAX_FILAS) {
    throw new Error('DEMASIADAS_FILAS');
  }

  const out = [];
  let i = 0;
  for (const raw of filas) {
    i += 1;
    const numeroFila = i + 1;
    const mapaNorm = {};
    for (const [k, v] of Object.entries(raw || {})) {
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
      !row.marcaAlias &&
      !row.ubicacionCodigo;
    if (!vacia) {
      out.push(row);
    }
  }
  return out;
}

function buildUbicacionesIndex(rows) {
  const byCodigo = new Map();
  for (const row of rows || []) {
    const key = normalizarCodigoKey(row.codigoUbicacion);
    if (!key || byCodigo.has(key)) continue;
    byCodigo.set(key, {
      idUbicacion: Number(row.idUbicacion),
      codigoUbicacion: String(row.codigoUbicacion || '').trim()
    });
  }
  return byCodigo;
}

/**
 * Reglas de ubicación en importación:
 * - vacía: OK (lote sin LotesUbicacion, como antes)
 * - con valor y cantidadInicial <= 0: error
 * - con valor no registrado: error
 */
function resolverUbicacionImportacion(ubicacionCodigoRaw, cantidadInicial, ubicacionesIndex) {
  const codigo = String(ubicacionCodigoRaw || '').trim();
  if (!codigo) {
    return { idUbicacion: null, codigoUbicacion: '', error: null };
  }
  if (!(cantidadInicial > 0)) {
    return {
      idUbicacion: null,
      codigoUbicacion: codigo,
      error: 'ubicacion requiere cantidadInicial > 0'
    };
  }
  const hit = ubicacionesIndex.get(normalizarCodigoKey(codigo));
  if (!hit) {
    return {
      idUbicacion: null,
      codigoUbicacion: codigo,
      error: `Ubicación no registrada: "${codigo}". Use un código de la hoja Ubicaciones.`
    };
  }
  return {
    idUbicacion: hit.idUbicacion,
    codigoUbicacion: hit.codigoUbicacion,
    error: null
  };
}

async function generarPlantillaBuffer(pool, idEmpresa) {
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
    'marca',
    'ubicacion'
  ];
  const idSucursal = await productosImportacionRepository.obtenerIdSucursalPrincipal(pool, idEmpresa);
  let ubicaciones = [];
  if (idSucursal) {
    ubicaciones = await productosImportacionRepository.obtenerUbicacionesPorSucursal(
      pool,
      idEmpresa,
      idSucursal
    );
  }
  const ejemploUbicacion =
    ubicaciones.length > 0 ? String(ubicaciones[0].codigoUbicacion || '').trim() : '';
  const ejemplo = [
    'EJEMPLO001',
    'Producto de demostración',
    'NIU',
    10,
    5.5,
    9.9,
    8.99,
    8.5,
    'Varios',
    'SM',
    ejemploUbicacion
  ];
  const filasUbicaciones =
    ubicaciones.length > 0
      ? ubicaciones.map((u) => [
          String(u.codigoUbicacion || '').trim(),
          String(u.nombreSucursal || '').trim(),
          u.prioridad != null ? Number(u.prioridad) : ''
        ])
      : [['(sin ubicaciones registradas)', '', '']];

  return pdfBackend.generarExcel({
    sheets: [
      {
        // Sin title: el parser de importación usa la fila 1 como encabezados.
        worksheetName: 'Productos',
        columns: headers,
        rows: [ejemplo]
      },
      {
        worksheetName: 'Ubicaciones',
        columns: ['codigoUbicacion', 'sucursal', 'prioridad'],
        rows: filasUbicaciones,
        title: 'Ubicaciones registradas (sucursal principal). Copie un codigoUbicacion en la columna ubicacion de Productos'
      }
    ]
  });
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

function normalizarClaveCatalogo(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function normalizarCodigoKey(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizarMarcaAlias(value) {
  let norm = normalizarClaveCatalogo(value);
  if (!norm || norm === 'SINMARCA' || norm === 'SIN MARCA' || norm === 'SM') {
    norm = 'SM';
  }
  return norm;
}

function buildPresentacionesIndex(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const key = normalizarCodigoKey(row.codigo);
    if (!key || map.has(key)) continue;
    map.set(key, Number(row.idPresentacion));
  }
  return map;
}

function buildCategoriasIndex(rows) {
  const byName = new Map();
  let variosId = null;
  for (const row of rows || []) {
    const key = normalizarClaveCatalogo(row.nombre);
    if (!key) continue;
    if (!byName.has(key)) {
      byName.set(key, Number(row.idCategoria));
    }
    if (!variosId && key.includes('VARIO')) {
      variosId = Number(row.idCategoria);
    }
  }
  return { byName, variosId };
}

function buildMarcasIndex(rows) {
  const byName = new Map();
  let smId = null;
  for (const row of rows || []) {
    const key = normalizarMarcaAlias(row.nombre);
    if (!key) continue;
    if (!byName.has(key)) {
      byName.set(key, Number(row.idMarca));
    }
    if (!smId && (key === 'SM' || key.includes('SIN MARCA'))) {
      smId = Number(row.idMarca);
    }
  }
  return { byName, smId };
}

function resolverCategoriaId(index, aliasRaw) {
  const alias = normalizarClaveCatalogo(aliasRaw);
  const key = alias || 'VARIOS';
  if (index.byName.has(key)) {
    return index.byName.get(key);
  }
  if (key === 'VARIOS' && index.variosId != null) {
    return index.variosId;
  }
  return null;
}

function resolverMarcaId(index, aliasRaw) {
  const key = normalizarMarcaAlias(aliasRaw);
  if (index.byName.has(key)) {
    return index.byName.get(key);
  }
  if (key === 'SM' && index.smId != null) {
    return index.smId;
  }
  return null;
}

async function generarNoImportadosBuffer(rowsNoImportados) {
  const headers = ['fila', 'codigo', 'descripcion', 'motivo'];
  const rows = (rowsNoImportados || []).map((r) => [
    r.fila,
    r.codigo || '',
    r.descripcion || '',
    r.motivo || ''
  ]);
  return pdfBackend.generarExcel({
    worksheetName: 'NoImportados',
    columns: headers,
    rows
  });
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
  const [presentacionesRows, categoriasRows, marcasRows, codigosExistentes, ubicacionesRows] =
    await Promise.all([
      productosImportacionRepository.obtenerPresentacionesCatalogo(pool),
      productosImportacionRepository.obtenerCategoriasCatalogo(pool, idEmpresa),
      productosImportacionRepository.obtenerMarcasCatalogo(pool, idEmpresa),
      productosImportacionRepository.obtenerCodigosExistentes(
        pool,
        idEmpresa,
        filasParseadas.map((f) => f.codigo)
      ),
      productosImportacionRepository.obtenerUbicacionesPorSucursal(pool, idEmpresa, idSucursal)
    ]);
  const presentacionesIndex = buildPresentacionesIndex(presentacionesRows);
  const categoriasIndex = buildCategoriasIndex(categoriasRows);
  const marcasIndex = buildMarcasIndex(marcasRows);
  const ubicacionesIndex = buildUbicacionesIndex(ubicacionesRows);

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
    /* Columna vacía o ausente (p. ej. encabezado truncado en Excel) = stock inicial 0 */
    const cantidadInicialRaw =
      f.cantidadStr === '' || f.cantidadStr == null ? 0 : parseNumeroFlexible(f.cantidadStr);
    if (Number.isNaN(cantidadInicialRaw)) msgs.push('cantidadInicial inválida');
    const cantidadInicial = Number.isNaN(cantidadInicialRaw) ? 0 : Math.max(0, cantidadInicialRaw);

    const ck = normalizarCodigoKey(f.codigo);
    if (vistosCodigo.has(ck)) {
      msgs.push(`Código duplicado en el archivo (fila ${vistosCodigo.get(ck)})`);
    }

    let idPresentacion = null;
    if (f.presentacionCodigo && msgs.length === 0) {
      const presentacionKey = normalizarCodigoKey(f.presentacionCodigo);
      idPresentacion = presentacionesIndex.get(presentacionKey) ?? null;
      if (idPresentacion == null) {
        msgs.push(`Presentación no encontrada: "${f.presentacionCodigo}"`);
      }
    }

    let idCategoria = null;
    let idMarca = null;
    if (msgs.length === 0) {
      idCategoria = resolverCategoriaId(categoriasIndex, f.categoriaAlias);
      if (idCategoria == null) {
        msgs.push(
          `Categoría no encontrada para "${f.categoriaAlias || 'VARIOS'}". Cree una categoría "VARIOS" o indique el nombre exacto.`
        );
      }
      idMarca = resolverMarcaId(marcasIndex, f.marcaAlias);
      if (idMarca == null) {
        msgs.push(
          `Marca no encontrada para "${f.marcaAlias || 'SM'}". Cree una marca "SM" o "Sin marca" o indique el nombre exacto.`
        );
      }
    }

    if (msgs.length === 0 && f.codigo) {
      if (codigosExistentes.has(ck)) {
        msgs.push('El código ya existe en productos');
      }
    }

    let idUbicacion = null;
    let codigoUbicacion = '';
    if (msgs.length === 0) {
      const ub = resolverUbicacionImportacion(f.ubicacionCodigo, cantidadInicial, ubicacionesIndex);
      if (ub.error) {
        msgs.push(ub.error);
      } else {
        idUbicacion = ub.idUbicacion;
        codigoUbicacion = ub.codigoUbicacion;
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
      presentacionCodigo: f.presentacionCodigo,
      idCategoria,
      idMarca,
      cUnitario: costo,
      precioCliente,
      precioNormal,
      precioMayorista,
      cantidadInicial,
      idSucursal,
      idUbicacion,
      codigoUbicacion,
      listasPrecio
    });
  }

  return { filasResueltas, errores, idSucursal, listasPrecio };
}

async function validarArchivoConFilas(pool, user, filas) {
  asegurarPuedeImportar(user);
  const idEmpresa = user.empresa;
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
      precioMayorista: r.precioMayorista,
      ubicacion: r.codigoUbicacion || ''
    }))
  };
}

async function validarArchivo(pool, user, buffer) {
  const filas = await parseBufferAObjetos(buffer);
  return validarArchivoConFilas(pool, user, filas);
}

async function ejecutarImportacionConFilas(pool, user, filas) {
  asegurarPuedeImportar(user);
  const idEmpresa = user.empresa;
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
            base64: (await generarNoImportadosBuffer(noImportados)).toString('base64'),
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

    const esServicio = esCodigoPresentacionServicio(r.presentacionCodigo);
    const lote =
      !esServicio && r.cantidadInicial > 0
        ? {
            idSucursal: r.idSucursal,
            cantidadIngresada: r.cantidadInicial,
            costoUnitario: r.cUnitario,
            idUbicacion: r.idUbicacion || null
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
    const buffer = await generarNoImportadosBuffer(noImportados);
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

async function ejecutarImportacion(pool, user, buffer) {
  const filas = await parseBufferAObjetos(buffer);
  return ejecutarImportacionConFilas(pool, user, filas);
}

module.exports = {
  asegurarPuedeImportar,
  parseBufferAObjetos,
  generarPlantillaBuffer,
  validarArchivo,
  validarArchivoConFilas,
  ejecutarImportacion,
  ejecutarImportacionConFilas,
  buildUbicacionesIndex,
  resolverUbicacionImportacion,
  resolverYValidarFilas,
  MAX_FILAS,
  MAX_BYTES
};
