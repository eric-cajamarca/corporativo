const categoriaService = require('../services/categoria.service');
const { withPool } = require('../utils/dbPool.util');

const obtener_Categorias_idEmpresa = async (req, res) => {
  if (!req.user) {
    return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
  }
  try {
    const data = await withPool((pool) =>
      categoriaService.obtenerCategoriasPorEmpresa(pool, req.user, req.params.idEmpresa)
    );
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS' || error.message === 'Empresa no autorizada') {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('categoria.obtener_Categorias_idEmpresa:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

const obtener_Categorias = async (req, res) => {
  if (!req.user) {
    return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
  }
  try {
    const data = await withPool((pool) => categoriaService.obtenerCategorias(pool, req.user));
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('categoria.obtener_Categorias:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

const obtener_Categoria_id = async (req, res) => {
  if (!req.user) {
    return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
  }
  try {
    const data = await withPool((pool) => categoriaService.obtenerCategoriaPorId(pool, req.user, req.params.id));
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('categoria.obtener_Categoria_id:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

const crear_Categoria = async (req, res) => {
  if (!req.user) {
    return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
  }
  try {
    const data = await withPool((pool) => categoriaService.crearCategoria(pool, req.user, req.body));
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('categoria.crear_Categoria:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

const editar_Categoria = async (req, res) => {
  if (!req.user) {
    return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
  }
  try {
    const data = await withPool((pool) =>
      categoriaService.editarCategoria(pool, req.user, req.params.id, req.body)
    );
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('categoria.editar_Categoria:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

const cambiar_estado_categoria = async (req, res) => {
  if (!req.user) {
    return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
  }
  try {
    const data = await withPool((pool) =>
      categoriaService.cambiarEstadoCategoria(pool, req.user, req.params.id, req.body)
    );
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    console.error('categoria.cambiar_estado_categoria:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

const eliminar_Categoria = async (req, res) => {
  if (!req.user) {
    return res.status(200).send({ message: 'No Acces', data: undefined });
  }
  try {
    const data = await withPool((pool) => categoriaService.eliminarCategoria(pool, req.user, req.params.id));
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(200).send({ message: 'No Acces', data: undefined });
    }
    console.error('categoria.eliminar_Categoria:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

module.exports = {
  obtener_Categorias,
  obtener_Categorias_idEmpresa,
  obtener_Categoria_id,
  crear_Categoria,
  editar_Categoria,
  cambiar_estado_categoria,
  eliminar_Categoria
};
