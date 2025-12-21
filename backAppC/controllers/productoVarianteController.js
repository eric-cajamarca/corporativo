const sql = require('mssql');
const dbConfig = require('../dbconfig');
const productoVarianteService = require('../services/productoVariante.service');

const crear_variante = async function (req, res) {
    let pool;
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

        console.log('Crear variante - atributos recibidos:', req.body);
        // Validaciones básicas
        if (!idProductoBase ) {
            return res.status(400).send({ 
                message: 'SKU y Producto Base son requeridos', 
                data: undefined 
            });
        }

        pool = await sql.connect(dbConfig);
        
        const resultado = await productoVarianteService.crearVariante(
            pool,
            {
                idProductoBase,
                sku,
                precio: precio || null,
                atributos: atributos || [],
                // idEmpresa: req.user.empresa,
                // idUsuario: req.user.idUsuario
            },
            req.user
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
    let pool;
    try {
        if (!req.user) {
            return res.status(401).send({ message: 'No Access', data: undefined });
        }

        const { idProductoBase } = req.params;

        if (!idProductoBase) {
            return res.status(400).send({ message: 'ID de producto requerido', data: undefined });
        }

        pool = await sql.connect(dbConfig);
        
        const resultado = await productoVarianteService.obtenerVariantesProducto(
            pool,
            idProductoBase,
            req.user
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
    } finally {
        if (pool) await pool.close();
    }
};

const obtener_variante_por_id = async function (req, res) {
    let pool;
    try {
        if (!req.user) {
            return res.status(401).send({ message: 'No Access', data: undefined });
        }

        const { idVariante } = req.params;

        if (!idVariante) {
            return res.status(400).send({ message: 'ID de variante requerido', data: undefined });
        }

        pool = await sql.connect(dbConfig);
        
        const resultado = await productoVarianteService.obtenerVariantePorId(
            pool,
            idVariante,
            req.user
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message
        });

    } catch (error) {
        console.error('Error al obtener variante:', error);
        res.status(500).send({ message: 'Error interno del servidor', data: undefined });
    } finally {
        if (pool) await pool.close();
    }
};

const actualizar_variante = async function (req, res) {
    let pool;
    try {
        if (!req.user) {
            return res.status(401).send({ message: 'No Access', data: undefined });
        }

        const { idVariante } = req.params;
        const { sku, precio, atributos } = req.body;

        if (!idVariante) {
            return res.status(400).send({ message: 'ID de variante requerido', data: undefined });
        }

        pool = await sql.connect(dbConfig);
        
        const resultado = await productoVarianteService.actualizarVariante(
            pool,
            {
                idVariante,
                sku,
                precio,
                atributos,
            
            },
            req.user
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message
        });

    } catch (error) {
        console.error('Error al actualizar variante:', error);
        res.status(500).send({ message: 'Error interno del servidor', data: undefined });
    } finally {
        if (pool) await pool.close();
    }
};

const eliminar_variante = async function (req, res) {
    let pool;
    try {
        if (!req.user) {
            return res.status(401).send({ message: 'No Access', data: undefined });
        }

        const { idVariante } = req.params;

        if (!idVariante) {
            return res.status(400).send({ message: 'ID de variante requerido', data: undefined });
        }

        pool = await sql.connect(dbConfig);
        
        const resultado = await productoVarianteService.eliminarVariante(
            pool,
            idVariante,
            req.user
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message
        });

    } catch (error) {
        console.error('Error al eliminar variante:', error);
        res.status(500).send({ message: 'Error interno del servidor', data: undefined });
    } finally {
        if (pool) await pool.close();
    }
};

const crear_atributo = async function (req, res) {
    let pool;
    try {
        if (!req.user) {
            return res.status(401).send({ message: 'No Access', data: undefined });
        }

        const { nombre, tipo } = req.body;

        if (!nombre) {
            return res.status(400).send({ message: 'Nombre del atributo requerido', data: undefined });
        }

        pool = await sql.connect(dbConfig);
        
        const resultado = await productoVarianteService.crearAtributo(
            pool,
            {
                nombre,
                tipo: tipo || 'text'
            },
            req.user
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message,
            idAtributo: resultado.idAtributo
        });

    } catch (error) {
        console.error('Error al crear atributo:', error);
        res.status(500).send({ message: 'Error interno del servidor', data: undefined });
    } finally {
        if (pool) await pool.close();
    }
};

const agregar_valor_atributo = async function (req, res) {
    let pool;
    try {
        if (!req.user) {
            return res.status(401).send({ message: 'No Access', data: undefined });
        }

        const { idAtributo } = req.params;
        const { valor } = req.body;

        if (!idAtributo || !valor) {
            return res.status(400).send({ message: 'Atributo y valor requeridos', data: undefined });
        }

        pool = await sql.connect(dbConfig);
        
        const resultado = await productoVarianteService.agregarValorAtributo(
            pool,
            {
                idAtributo,
                valor
            },
            req.user
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message,
            idValor: resultado.idValor
        });

    } catch (error) {
        console.error('Error al agregar valor de atributo:', error);
        res.status(500).send({ message: 'Error interno del servidor', data: undefined });
    } finally {
        if (pool) await pool.close();
    }
};

const obtener_atributos_empresa = async function (req, res) {
    let pool;
    try {
        if (!req.user) {
            return res.status(401).send({ message: 'No Access', data: undefined });
        }

        pool = await sql.connect(dbConfig);
        
        const resultado = await productoVarianteService.obtenerAtributosEmpresa(
            pool,
            req.user
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message
        });

    } catch (error) {
        console.error('Error al obtener atributos:', error);
        res.status(500).send({ message: 'Error interno del servidor', data: undefined });
    } finally {
        if (pool) await pool.close();
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