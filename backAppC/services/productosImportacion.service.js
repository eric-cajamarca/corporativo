const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const productosImportacionRepository = require('../repositories/productosImportacion.repository');
const productosMutacionesService = require('./productosMutaciones.service');

const MAX_FILAS = 2000;
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
  const precioStr = leerCelda(mapaNorm, [
    'preciolistacliente',
    'precio lista cliente',
    'precioventa',
    'precio venta',
    'precio lista'
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
    precioStr,
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
      !row.precioStr &&
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
    'precioListaCliente',
    'categoria',
    'marca'
  ];
  const ejemplo = ['EJEMPLO001', 'Producto de demostración', 'NIU', 10, 5.5, 8.99, 'VARIOS', 'SM'];
  const ws = XLSX.utils.aoa_to_sheet([headers, ejemplo]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Productos');
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

  const errores = [];
  const vistosCodigo = new Map();

  const filasResueltas = [];

  for (const f of filasParseadas) {
    const msgs = [];

    if (!f.codigo) msgs.push('Falta codigo');
    if (!f.descripcion) msgs.push('Falta descripcion');
    if (!f.presentacionCodigo) msgs.push('Falta presentacion (código ej. NIU)');
    const costo = parseFloat(String(f.costoStr).replace(',', '.'));
    if (Number.isNaN(costo) || costo < 0) msgs.push('costoUnitario inválido');
    const precio = parseFloat(String(f.precioStr).replace(',', '.'));
    if (Number.isNaN(precio) || precio <= 0) msgs.push('precioListaCliente debe ser > 0');
    const cantidadInicial = parseFloat(String(f.cantidadStr).replace(',', '.'));
    if (Number.isNaN(cantidadInicial) || cantidadInicial < 0) msgs.push('cantidadInicial inválida');

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
      precioListaCliente: precio,
      cantidadInicial,
      idSucursal
    });
  }

  return { filasResueltas, errores, idSucursal };
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
      precioListaCliente: r.precioListaCliente
    }))
  };
}

async function ejecutarImportacion(pool, user, buffer) {
  asegurarPuedeImportar(user);
  const idEmpresa = user.empresa;
  const filas = parseBufferAObjetos(buffer);
  const { filasResueltas, errores } = await resolverYValidarFilas(pool, idEmpresa, filas);

  if (filasResueltas.length === 0) {
    return {
      total: filas.length,
      insertados: 0,
      detalle: [],
      erroresValidacion: errores,
      erroresEjecucion: []
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
        precioVenta: r.precioListaCliente,
        idListaPrecio: null,
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

  return {
    total: filas.length,
    insertados: insertados.length,
    detalle: insertados,
    erroresValidacion: errores,
    erroresEjecucion
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
