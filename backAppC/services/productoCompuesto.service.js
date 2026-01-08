const productoCompuestoRepository = require('../repositories/productoCompuesto.repository');

exports.crearProductoCompuesto = async (pool, datos, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        // validarDatosCompuesto(datos);

        const idEmpresa = usuarioAutenticado.empresa;
        const idUsuario = usuarioAutenticado.sub;
        // Verificar que el producto padre exista y sea de tipo compuesto
        const productoPadre = await productoCompuestoRepository.obtenerProductoPorId(
            pool,
            datos.idProductoPadre,
            idEmpresa
        );

        if (!productoPadre) {
            throw new Error('PRODUCTO_PADRE_NO_EXISTE');
        }

        console.log('Producto padre encontrado:', productoPadre);
        
        // if (productoPadre.tipoProducto !== 'C') {
        //     throw new Error('PRODUCTO_NO_ES_COMPUESTO');
        // }

        // Verificar que todos los componentes existan y sean simples
        for (const componente of datos.componentes) {
            const productoHijo = await productoCompuestoRepository.obtenerProductoPorId(
                pool,
                componente.idProductoHijo,
                idEmpresa
            );

            if (!productoHijo) {
                throw new Error('COMPONENTE_NO_EXISTE');
            }

            if (productoHijo.tipoProducto !== 'S') {
                throw new Error('COMPONENTE_NO_ES_SIMPLE');
            }

            if (componente.cantidad <= 0) {
                throw new Error('CANTIDAD_INVALIDA');
            }
        }

        // Verificar duplicados
        const idsComponentes = datos.componentes.map(c => c.idProductoHijo);
        const hasDuplicates = new Set(idsComponentes).size !== idsComponentes.length;
        if (hasDuplicates) {
            throw new Error('COMPONENTE_DUPLICADO');
        }

        // Crear relaciones
        const resultados = [];
        for (const componente of datos.componentes) {
            const resultado = await productoCompuestoRepository.crearComponente(
                pool,
                {
                    idProductoPadre: datos.idProductoPadre,
                    idProductoHijo: componente.idProductoHijo,
                    cantidad: componente.cantidad,
                    idUsuario: idUsuario
                }
            );
            resultados.push(resultado);
        }

        return {
            success: true,
            data: resultados,
            message: 'Producto compuesto creado exitosamente',
            totalComponentes: datos.componentes.length
        };

    } catch (error) {
        console.error('Error en service al crear producto compuesto:', error);
        throw error;
    }
};

exports.obtenerComponentes = async (pool, idProductoPadre, idEmpresa, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        const componentes = await productoCompuestoRepository.obtenerComponentes(
            pool,
            idProductoPadre,
            idEmpresa
        );

        if (componentes.length === 0) {
            throw new Error('PRODUCTO_NO_ENCONTRADO');
        }

        // Calcular stock disponible del compuesto
        const stockPorSucursal = await productoCompuestoRepository.calcularStockCompuestoRepo(
            pool,
            idProductoPadre,
            idEmpresa
        );

        return {
            success: true,
            data: {
                componentes: componentes,
                infoStock: stockPorSucursal,
                totalComponentes: componentes.length
            },
            message: 'Componentes obtenidos exitosamente'
        };

    } catch (error) {
        console.error('Error en service al obtener componentes:', error);
        throw error;
    }
};

exports.actualizarComponentes = async (pool, datos, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        validarDatosCompuesto(datos);

        // Eliminar componentes existentes
        await productoCompuestoRepository.eliminarComponentes(
            pool,
            datos.idProductoPadre,
            datos.idEmpresa
        );

        // Crear nuevos componentes
        const resultados = [];
        for (const componente of datos.componentes) {
            const resultado = await productoCompuestoRepository.crearComponente(
                pool,
                {
                    idProductoPadre: datos.idProductoPadre,
                    idProductoHijo: componente.idProductoHijo,
                    cantidad: componente.cantidad,
                    idUsuario: datos.idUsuario
                }
            );
            resultados.push(resultado);
        }

        return {
            success: true,
            data: resultados,
            message: 'Componentes actualizados exitosamente',
            cambios: resultados.length
        };

    } catch (error) {
        console.error('Error en service al actualizar componentes:', error);
        throw error;
    }
};

exports.eliminarProductoCompuesto = async (pool, idProductoPadre, idEmpresa, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        const resultado = await productoCompuestoRepository.eliminarComponentes(
            pool,
            idProductoPadre,
            idEmpresa
        );

        return {
            success: true,
            data: resultado,
            message: 'Producto compuesto eliminado exitosamente',
            componentesEliminados: resultado.rowsAffected[0]
        };

    } catch (error) {
        console.error('Error en service al eliminar producto compuesto:', error);
        throw error;
    }
};

exports.calcularStockCompuesto = async (pool, datos, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        const stockDisponible = await productoCompuestoRepository.calcularStockCompuestoRepo(
            pool,
            datos.idProductoPadre,
            datos.idEmpresa,
            datos.idSucursal
        );

        return {
            success: true,
            data: stockDisponible,
            message: 'Stock calculado exitosamente',
            stockDisponible: stockDisponible.stockMinimo || 0
        };

    } catch (error) {
        console.error('Error en service al calcular stock compuesto:', error);
        throw error;
    }
};

// Función de validación
function validarDatosCompuesto(datos) {
    const { idProductoPadre, componentes } = datos;
    
    if (!idProductoPadre || !componentes || !Array.isArray(componentes)) {
        throw new Error('CAMPOS_REQUERIDOS');
    }
    
    if (componentes.length === 0) {
        throw new Error('COMPONENTES_VACIOS');
    }
    
    componentes.forEach((componente, index) => {
        if (!componente.idProductoHijo || !componente.cantidad) {
            throw new Error(`Componente ${index + 1} incompleto`);
        }
        
        if (componente.cantidad <= 0) {
            throw new Error(`Cantidad inválida en componente ${index + 1}`);
        }
    });
}