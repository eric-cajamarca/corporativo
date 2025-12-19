const sql = require('mssql');
const dbConfig = require('../dbconfig');
const productoCompuestoService = require('../services/productoCompuesto.service');

const crear_producto_compuesto = async function (req, res) {
    let pool;
    try {
        if (!req.user) {
            return res.status(401).send({ 
                message: 'No Access', 
                data: undefined 
            });
        }

        const { 
            idProductoPadre,
            componentes  // Array: [{idProductoHijo, cantidad}, ...]
        } = req.body;

        // Validaciones básicas
        if (!idProductoPadre || !componentes || !Array.isArray(componentes) || componentes.length === 0) {
            return res.status(400).send({ 
                message: 'Faltan campos requeridos', 
                data: undefined 
            });
        }

        pool = await sql.connect(dbConfig);
        
        const resultado = await productoCompuestoService.crearProductoCompuesto(
            pool,
            {
                idProductoPadre,
                componentes,
                idEmpresa: req.user.empresa,
                idUsuario: req.user.idUsuario
            },
            req.user
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message,
            totalComponentes: resultado.totalComponentes
        });

    } catch (error) {
        console.error('Error al crear producto compuesto:', error);

        switch (error.message) {
            case 'NO_ACCESO':
                return res.status(401).send({ message: 'No Access', data: undefined });
            case 'CAMPOS_REQUERIDOS':
                return res.status(400).send({ message: 'Faltan campos requeridos', data: undefined });
            case 'PRODUCTO_PADRE_NO_EXISTE':
                return res.status(404).send({ message: 'Producto padre no encontrado', data: undefined });
            case 'COMPONENTE_NO_EXISTE':
                return res.status(404).send({ message: 'Uno o más componentes no existen', data: undefined });
            case 'PRODUCTO_NO_ES_SIMPLE':
                return res.status(400).send({ message: 'El producto padre debe ser de tipo compuesto', data: undefined });
            case 'COMPONENTE_DUPLICADO':
                return res.status(400).send({ message: 'Componentes duplicados en la lista', data: undefined });
            default:
                return res.status(500).send({ message: 'Error interno del servidor', data: undefined });
        }
    } finally {
        if (pool) await pool.close();
    }
};

const obtener_componentes = async function (req, res) {
    let pool;
    try {
        if (!req.user) {
            return res.status(401).send({ message: 'No Access', data: undefined });
        }

        const { idProductoPadre } = req.params;

        if (!idProductoPadre) {
            return res.status(400).send({ message: 'ID de producto requerido', data: undefined });
        }

        pool = await sql.connect(dbConfig);
        
        const resultado = await productoCompuestoService.obtenerComponentes(
            pool,
            idProductoPadre,
            req.user.empresa,
            req.user
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message
        });

    } catch (error) {
        console.error('Error al obtener componentes:', error);
        
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

const actualizar_componentes = async function (req, res) {
    let pool;
    try {
        if (!req.user) {
            return res.status(401).send({ message: 'No Access', data: undefined });
        }

        const { idProductoPadre } = req.params;
        const { componentes } = req.body; // Nuevo array de componentes

        if (!idProductoPadre || !componentes || !Array.isArray(componentes)) {
            return res.status(400).send({ message: 'Faltan campos requeridos', data: undefined });
        }

        pool = await sql.connect(dbConfig);
        
        const resultado = await productoCompuestoService.actualizarComponentes(
            pool,
            {
                idProductoPadre,
                componentes,
                idEmpresa: req.user.empresa,
                idUsuario: req.user.idUsuario
            },
            req.user
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message,
            cambios: resultado.cambios
        });

    } catch (error) {
        console.error('Error al actualizar componentes:', error);
        // Manejo de errores similar al crear
        res.status(500).send({ message: 'Error interno del servidor', data: undefined });
    } finally {
        if (pool) await pool.close();
    }
};

const eliminar_producto_compuesto = async function (req, res) {
    let pool;
    try {
        if (!req.user) {
            return res.status(401).send({ message: 'No Access', data: undefined });
        }

        const { idProductoPadre } = req.params;

        if (!idProductoPadre) {
            return res.status(400).send({ message: 'ID de producto requerido', data: undefined });
        }

        pool = await sql.connect(dbConfig);
        
        const resultado = await productoCompuestoService.eliminarProductoCompuesto(
            pool,
            idProductoPadre,
            req.user.empresa,
            req.user
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message
        });

    } catch (error) {
        console.error('Error al eliminar producto compuesto:', error);
        res.status(500).send({ message: 'Error interno del servidor', data: undefined });
    } finally {
        if (pool) await pool.close();
    }
};

const calcular_stock_compuesto = async function (req, res) {
    let pool;
    try {
        if (!req.user) {
            return res.status(401).send({ message: 'No Access', data: undefined });
        }

        const { idProductoPadre, idSucursal } = req.params;

        if (!idProductoPadre) {
            return res.status(400).send({ message: 'ID de producto requerido', data: undefined });
        }

        pool = await sql.connect(dbConfig);
        
        const resultado = await productoCompuestoService.calcularStockCompuesto(
            pool,
            {
                idProductoPadre,
                idSucursal: idSucursal || null, // null = todas las sucursales
                idEmpresa: req.user.empresa
            },
            req.user
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message,
            stockDisponible: resultado.stockDisponible
        });

    } catch (error) {
        console.error('Error al calcular stock compuesto:', error);
        res.status(500).send({ message: 'Error interno del servidor', data: undefined });
    } finally {
        if (pool) await pool.close();
    }
};

module.exports = {
    crear_producto_compuesto,
    obtener_componentes,
    actualizar_componentes,
    eliminar_producto_compuesto,
    calcular_stock_compuesto
};