const sql = require('mssql');
const productosImagenRepository = require('../repositories/productosImagen.repository');
const productosRepository = require('../repositories/productos.repository');
const path = require('path');
const fs = require('fs');

const MAX_IMAGENES = 5;
const uploadsProductosDir = path.join(__dirname, '../uploads/productos');

/**
 * Lista imágenes de un producto. Valida que el producto pertenezca a idEmpresa.
 */
exports.listarPorProducto = async (pool, idEmpresa, idProducto) => {
  const producto = await productosRepository.obtenerProductoPorIdRepo(pool, idProducto, idEmpresa);
  if (!producto || !producto.idProducto) {
    throw new Error('Producto no encontrado o no pertenece a la empresa');
  }
  const lista = await productosImagenRepository.listarPorProducto(pool, idEmpresa, idProducto);
  return lista.map(row => ({
    idImagen: row.idImagen,
    idProducto: row.idProducto,
    rutaArchivo: row.rutaArchivo,
    orden: row.orden,
    fRegistro: row.fRegistro,
    url: `/productos-img/${row.rutaArchivo.replace(/\\/g, '/')}`
  }));
};

/**
 * Sube imágenes para un producto. req.files es el array de Multer; cada file tiene path.
 * Guarda en BD la ruta relativa idEmpresa/idProducto/filename.
 */
exports.subir = async (pool, idEmpresa, idProducto, files) => {
  if (!idEmpresa || !idProducto) {
    throw new Error('Falta idEmpresa o idProducto');
  }
  const producto = await productosRepository.obtenerProductoPorIdRepo(pool, idProducto, idEmpresa);
  if (!producto || !producto.idProducto) {
    throw new Error('Producto no encontrado o no pertenece a la empresa');
  }
  const count = await productosImagenRepository.contarPorProducto(pool, idProducto);
  const totalNuevas = Array.isArray(files) ? files.length : 0;
  if (count + totalNuevas > MAX_IMAGENES) {
    throw new Error(`Máximo ${MAX_IMAGENES} imágenes por producto. Actual: ${count}, intentando agregar: ${totalNuevas}`);
  }
  const idEmpresaStr = String(idEmpresa);
  const idProductoStr = String(idProducto);
  const rutasRelativas = [];
  const ordenInicial = count + 1;
  let orden = ordenInicial;
  for (const file of files || []) {
    if (!file || !file.filename) continue;
    const rutaRelativa = `${idEmpresaStr}/${idProductoStr}/${file.filename}`.replace(/\\/g, '/');
    await productosImagenRepository.insertar(pool, idEmpresa, idProducto, rutaRelativa, orden);
    rutasRelativas.push({ rutaArchivo: rutaRelativa, orden });
    orden++;
  }
  return rutasRelativas;
};

/**
 * Elimina una imagen por idImagen. Borra el registro y opcionalmente el archivo en disco.
 */
exports.eliminar = async (pool, idImagen, idEmpresa) => {
  const row = await productosImagenRepository.obtenerPorId(pool, idImagen, idEmpresa);
  if (!row) {
    throw new Error('Imagen no encontrada o no pertenece a la empresa');
  }
  const deleted = await productosImagenRepository.eliminar(pool, idImagen, idEmpresa);
  const filePath = path.join(uploadsProductosDir, row.rutaArchivo);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    console.error('productosImagen.service eliminar archivo:', e.message);
  }
  return { deleted: deleted > 0 };
};

/**
 * Coloca la imagen indicada como portada (orden = 1) y reasigna el resto 2..n.
 */
exports.marcarPortada = async (pool, idEmpresa, idProducto, idImagenPortada) => {
  if (!idEmpresa || !idProducto || !idImagenPortada) {
    throw new Error('Faltan datos para marcar portada');
  }
  const producto = await productosRepository.obtenerProductoPorIdRepo(pool, idProducto, idEmpresa);
  if (!producto || !producto.idProducto) {
    throw new Error('Producto no encontrado o no pertenece a la empresa');
  }
  const lista = await productosImagenRepository.listarPorProducto(pool, idEmpresa, idProducto);
  const idStr = (id) => String(id).toLowerCase();
  const target = idStr(idImagenPortada);
  const match = lista.find((row) => idStr(row.idImagen) === target);
  if (!match) {
    throw new Error('La imagen no pertenece a este producto');
  }
  const nuevaOrder = [
    match.idImagen,
    ...lista.filter((row) => idStr(row.idImagen) !== target).map((row) => row.idImagen)
  ];

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    let orden = 1;
    for (const idImagen of nuevaOrder) {
      await transaction
        .request()
        .input('idImagen', sql.UniqueIdentifier, idImagen)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idProducto', sql.UniqueIdentifier, idProducto)
        .input('orden', sql.TinyInt, orden)
        .query(`
          UPDATE ProductosImagen
          SET orden = @orden
          WHERE idImagen = @idImagen AND idEmpresa = @idEmpresa AND idProducto = @idProducto
        `);
      orden += 1;
    }
    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
  return { ok: true };
};
