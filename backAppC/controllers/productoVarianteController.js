const productoVarianteService = require('../services/productoVariante.service');
const { withPool } = require('../utils/dbPool.util');

const crear_variante = async function (req, res) {
  try {
    if (!req.user) {
      return res.status(401).send({
        message: 'No Access',
        data: undefined
      });
    }

    const {
      idProductoBase,
      sku,
      precio,
      atributos // Array: [{idAtributo, idValor}, ...]
    } = req.body;

    if (!idProductoBase) {
      return res.status(400).send({
        message: 'SKU y Producto Base son requeridos',
        data: undefined
      });
    }

    const resultado = await withPool((pool) =>
      productoVarianteService.crearVariante(
        pool,
        {
          idProductoBase,
          sku,
          precio: precio || null,
          atributos: atributos || []
        },
        req.user
      )
    );

    res.status(200).send({
      data: resultado.data,
      message: resultado.message,
      idVariante: resultado.idVariante
    });
  } catch (error) {
    console.error('Error al crear variante:', error);

    switch (error.message) {
      case 'NO_ACCESO':
        return res.status(401).send({ message: 'No Access', data: undefined });
      case 'CAMPOS_REQUERIDOS':
        return res.status(400).send({ message: 'Faltan campos requeridos', data: undefined });
      case 'PRODUCTO_BASE_NO_EXISTE':
        return res.status(404).send({ message: 'Producto base no encontrado', data: undefined });
      case 'SKU_DUPLICADO':
        return res.status(409).send({ message: 'El SKU ya existe', data: undefined });
      case 'ATRIBUTO_NO_EXISTE':
        return res.status(404).send({ message: 'Uno o más atributos no existen', data: undefined });
      default:
        return res.status(500).send({ message: 'Error interno del servidor', data: undefined });
    }
  }
};

const obtener_variantes_producto = async function (req, res) {
  try {
    if (!req.user) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }

    const { idProductoBase } = req.params;

    if (!idProductoBase) {
      return res.status(400).send({ message: 'ID de producto requerido', data: undefined });
    }

    const resultado = await withPool((pool) =>
      productoVarianteService.obtenerVariantesProducto(pool, idProductoBase, req.user)
    );

    res.status(200).send({
      data: resultado.data,
      message: resultado.message,
      totalVariantes: resultado.totalVariantes
    });
  } catch (error) {
    console.error('Error al obtener variantes:', error);

    if (error.message === 'NO_ACCESO') {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    if (error.message === 'PRODUCTO_NO_ENCONTRADO') {
      return res.status(404).send({ message: 'Producto no encontrado', data: undefined });
    }

    res.status(500).send({ message: 'Error interno del servidor', data: undefined });
  }
};

const obtener_variante_por_id = async function (req, res) {
  try {
    if (!req.user) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }

    const { idVariante } = req.params;

    if (!idVariante) {
      return res.status(400).send({ message: 'ID de variante requerido', data: undefined });
    }

    const resultado = await withPool((pool) =>
      productoVarianteService.obtenerVariantePorId(pool, idVariante, req.user)
    );

    res.status(200).send({
      data: resultado.data,
      message: resultado.message
    });
  } catch (error) {
    console.error('Error al obtener variante:', error);
    res.status(500).send({ message: 'Error interno del servidor', data: undefined });
  }
};

const actualizar_variante = async function (req, res) {
  try {
    if (!req.user) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }

    const { idVariante } = req.params;
    const { sku, precio, atributos } = req.body;

    if (!idVariante) {
      return res.status(400).send({ message: 'ID de variante requerido', data: undefined });
    }

    const resultado = await withPool((pool) =>
      productoVarianteService.actualizarVariante(
        pool,
        {
          idVariante,
          sku,
          precio,
          atributos
        },
        req.user
      )
    );

    res.status(200).send({
      data: resultado.data,
      message: resultado.message
    });
  } catch (error) {
    console.error('Error al actualizar variante:', error);
    res.status(500).send({ message: 'Error interno del servidor', data: undefined });
  }
};

const eliminar_variante = async function (req, res) {
  try {
    if (!req.user) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }

    const { idVariante } = req.params;

    if (!idVariante) {
      return res.status(400).send({ message: 'ID de variante requerido', data: undefined });
    }

    const resultado = await withPool((pool) =>
      productoVarianteService.eliminarVariante(pool, idVariante, req.user)
    );

    res.status(200).send({
      data: resultado.data,
      message: resultado.message
    });
  } catch (error) {
    console.error('Error al eliminar variante:', error);
    res.status(500).send({ message: 'Error interno del servidor', data: undefined });
  }
};

const crear_atributo = async function (req, res) {
  try {
    if (!req.user) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }

    const { nombre, tipo } = req.body;

    if (!nombre) {
      return res.status(400).send({ message: 'Nombre del atributo requerido', data: undefined });
    }

    const resultado = await withPool((pool) =>
      productoVarianteService.crearAtributo(
        pool,
        {
          nombre,
          tipo: tipo || 'text'
        },
        req.user
      )
    );

    res.status(200).send({
      data: resultado.data,
      message: resultado.message,
      idAtributo: resultado.idAtributo
    });
  } catch (error) {
    console.error('Error al crear atributo:', error);
    res.status(500).send({ message: 'Error interno del servidor', data: undefined });
  }
};

const agregar_valor_atributo = async function (req, res) {
  try {
    if (!req.user) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }

    const { idAtributo } = req.params;
    const { valor } = req.body;

    if (!idAtributo || !valor) {
      return res.status(400).send({ message: 'Atributo y valor requeridos', data: undefined });
    }

    const resultado = await withPool((pool) =>
      productoVarianteService.agregarValorAtributo(
        pool,
        {
          idAtributo,
          valor
        },
        req.user
      )
    );

    res.status(200).send({
      data: resultado.data,
      message: resultado.message,
      idValor: resultado.idValor
    });
  } catch (error) {
    console.error('Error al agregar valor de atributo:', error);
    res.status(500).send({ message: 'Error interno del servidor', data: undefined });
  }
};

const obtener_atributos_empresa = async function (req, res) {
  try {
    if (!req.user) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }

    const resultado = await withPool((pool) =>
      productoVarianteService.obtenerAtributosEmpresa(pool, req.user)
    );

    res.status(200).send({
      data: resultado.data,
      message: resultado.message
    });
  } catch (error) {
    console.error('Error al obtener atributos:', error);
    res.status(500).send({ message: 'Error interno del servidor', data: undefined });
  }
};

module.exports = {
  crear_variante,
  obtener_variantes_producto,
  obtener_variante_por_id,
  actualizar_variante,
  eliminar_variante,
  crear_atributo,
  agregar_valor_atributo,
  obtener_atributos_empresa
};
