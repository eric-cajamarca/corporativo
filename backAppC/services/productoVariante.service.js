const productoVarianteRepository = require('../repositories/productoVariante.repository');

exports.crearVariante = async (pool, datos, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        validarDatosVariante(datos);

        // Verificar que el producto base exista
        const productoBase = await productoVarianteRepository.obtenerProductoPorId(
            pool,
            datos.idProductoBase,
            datos.idEmpresa
        );

        if (!productoBase) {
            throw new Error('PRODUCTO_BASE_NO_EXISTE');
        }

        // Verificar que SKU no exista
        const skuExistente = await productoVarianteRepository.verificarSkuExistente(
            pool,
            datos.sku,
            datos.idEmpresa
        );

        if (skuExistente) {
            throw new Error('SKU_DUPLICADO');
        }

        // Verificar atributos si se proporcionan
        if (datos.atributos && datos.atributos.length > 0) {
            for (const atributo of datos.atributos) {
                const atributoValido = await productoVarianteRepository.verificarAtributoValor(
                    pool,
                    atributo.idAtributo,
                    atributo.idValor,
                    datos.idEmpresa
                );

                if (!atributoValido) {
                    throw new Error('ATRIBUTO_NO_EXISTE');
                }
            }
        }

        // Crear variante
        const resultado = await productoVarianteRepository.crearVariante(
            pool,
            {
                idProductoBase: datos.idProductoBase,
                sku: datos.sku,
                precio: datos.precio,
                idUsuario: datos.idUsuario
            }
        );

        const idVariante = resultado.recordset[0]?.idVariante;

        // Asociar atributos si existen
        if (idVariante && datos.atributos.length > 0) {
            for (const atributo of datos.atributos) {
                await productoVarianteRepository.asociarAtributoVariante(
                    pool,
                    {
                        idVariante: idVariante,
                        idAtributo: atributo.idAtributo,
                        idValor: atributo.idValor
                    }
                );
            }
        }

        return {
            success: true,
            data: resultado,
            message: 'Variante creada exitosamente',
            idVariante: idVariante
        };

    } catch (error) {
        console.error('Error en service al crear variante:', error);
        throw error;
    }
};

exports.obtenerVariantesProducto = async (pool, idProductoBase, idEmpresa, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        const variantes = await productoVarianteRepository.obtenerVariantesProducto(
            pool,
            idProductoBase,
            idEmpresa
        );

        // Obtener stock por sucursal para cada variante
        const variantesConStock = [];
        for (const variante of variantes) {
            const stock = await productoVarianteRepository.obtenerStockVariante(
                pool,
                variante.idVariante,
                idEmpresa
            );
            variantesConStock.push({
                ...variante,
                stock: stock
            });
        }

        // Obtener atributos disponibles para este producto
        const atributos = await productoVarianteRepository.obtenerAtributosProducto(
            pool,
            idProductoBase,
            idEmpresa
        );

        return {
            success: true,
            data: {
                productoBase: variantes[0]?.productoBase || null,
                variantes: variantesConStock,
                atributos: atributos,
                totalVariantes: variantes.length
            },
            message: 'Variantes obtenidas exitosamente'
        };

    } catch (error) {
        console.error('Error en service al obtener variantes:', error);
        throw error;
    }
};

exports.obtenerVariantePorId = async (pool, idVariante, idEmpresa, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        const variante = await productoVarianteRepository.obtenerVariantePorId(
            pool,
            idVariante,
            idEmpresa
        );

        if (!variante) {
            throw new Error('VARIANTE_NO_ENCONTRADA');
        }

        // Obtener atributos de la variante
        const atributos = await productoVarianteRepository.obtenerAtributosVariante(
            pool,
            idVariante
        );

        // Obtener stock por sucursal
        const stock = await productoVarianteRepository.obtenerStockVariante(
            pool,
            idVariante,
            idEmpresa
        );

        return {
            success: true,
            data: {
                ...variante,
                atributos: atributos,
                stock: stock
            },
            message: 'Variante obtenida exitosamente'
        };

    } catch (error) {
        console.error('Error en service al obtener variante:', error);
        throw error;
    }
};

exports.actualizarVariante = async (pool, datos, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        if (!datos.idVariante) {
            throw new Error('CAMPOS_REQUERIDOS');
        }

        // Verificar que la variante exista
        const varianteExistente = await productoVarianteRepository.obtenerVariantePorId(
            pool,
            datos.idVariante,
            datos.idEmpresa
        );

        if (!varianteExistente) {
            throw new Error('VARIANTE_NO_ENCONTRADA');
        }

        // Si se cambia SKU, verificar que no exista
        if (datos.sku && datos.sku !== varianteExistente.sku) {
            const skuExistente = await productoVarianteRepository.verificarSkuExistente(
                pool,
                datos.sku,
                datos.idEmpresa
            );

            if (skuExistente) {
                throw new Error('SKU_DUPLICADO');
            }
        }

        // Actualizar variante
        const resultado = await productoVarianteRepository.actualizarVariante(
            pool,
            {
                idVariante: datos.idVariante,
                sku: datos.sku,
                precio: datos.precio,
                idUsuario: datos.idUsuario
            }
        );

        // Actualizar atributos si se proporcionan
        if (datos.atributos) {
            // Eliminar atributos actuales
            await productoVarianteRepository.eliminarAtributosVariante(
                pool,
                datos.idVariante
            );

            // Agregar nuevos atributos
            for (const atributo of datos.atributos) {
                await productoVarianteRepository.asociarAtributoVariante(
                    pool,
                    {
                        idVariante: datos.idVariante,
                        idAtributo: atributo.idAtributo,
                        idValor: atributo.idValor
                    }
                );
            }
        }

        return {
            success: true,
            data: resultado,
            message: 'Variante actualizada exitosamente'
        };

    } catch (error) {
        console.error('Error en service al actualizar variante:', error);
        throw error;
    }
};

exports.eliminarVariante = async (pool, idVariante, idEmpresa, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        // Verificar que no haya stock en ninguna sucursal
        const stock = await productoVarianteRepository.verificarStockVariante(
            pool,
            idVariante,
            idEmpresa
        );

        if (stock.totalStock > 0) {
            throw new Error('VARIANTE_CON_STOCK');
        }

        const resultado = await productoVarianteRepository.eliminarVariante(
            pool,
            idVariante,
            idEmpresa
        );

        return {
            success: true,
            data: resultado,
            message: 'Variante eliminada exitosamente'
        };

    } catch (error) {
        console.error('Error en service al eliminar variante:', error);
        throw error;
    }
};

exports.crearAtributo = async (pool, datos, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        if (!datos.nombre) {
            throw new Error('CAMPOS_REQUERIDOS');
        }

        // Verificar que no exista atributo con mismo nombre
        const atributoExistente = await productoVarianteRepository.verificarAtributoExistente(
            pool,
            datos.nombre,
            datos.idEmpresa
        );

        if (atributoExistente) {
            throw new Error('ATRIBUTO_DUPLICADO');
        }

        const resultado = await productoVarianteRepository.crearAtributo(
            pool,
            {
                nombre: datos.nombre,
                tipo: datos.tipo,
                idEmpresa: datos.idEmpresa,
                idUsuario: datos.idUsuario
            }
        );

        const idAtributo = resultado.recordset[0]?.idAtributo;

        return {
            success: true,
            data: resultado,
            message: 'Atributo creado exitosamente',
            idAtributo: idAtributo
        };

    } catch (error) {
        console.error('Error en service al crear atributo:', error);
        throw error;
    }
};

exports.agregarValorAtributo = async (pool, datos, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        if (!datos.idAtributo || !datos.valor) {
            throw new Error('CAMPOS_REQUERIDOS');
        }

        // Verificar que el atributo exista
        const atributoExistente = await productoVarianteRepository.obtenerAtributoPorId(
            pool,
            datos.idAtributo,
            datos.idEmpresa
        );

        if (!atributoExistente) {
            throw new Error('ATRIBUTO_NO_EXISTE');
        }

        // Verificar que no exista valor duplicado para este atributo
        const valorExistente = await productoVarianteRepository.verificarValorAtributoExistente(
            pool,
            datos.idAtributo,
            datos.valor
        );

        if (valorExistente) {
            throw new Error('VALOR_DUPLICADO');
        }

        const resultado = await productoVarianteRepository.agregarValorAtributo(
            pool,
            {
                idAtributo: datos.idAtributo,
                valor: datos.valor,
                idUsuario: datos.idUsuario
            }
        );

        const idValor = resultado.recordset[0]?.idValor;

        return {
            success: true,
            data: resultado,
            message: 'Valor de atributo agregado exitosamente',
            idValor: idValor
        };

    } catch (error) {
        console.error('Error en service al agregar valor de atributo:', error);
        throw error;
    }
};

exports.obtenerAtributosEmpresa = async (pool, idEmpresa, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        const atributos = await productoVarianteRepository.obtenerAtributosEmpresa(
            pool,
            idEmpresa
        );

        return {
            success: true,
            data: atributos,
            message: 'Atributos obtenidos exitosamente'
        };

    } catch (error) {
        console.error('Error en service al obtener atributos:', error);
        throw error;
    }
};

// Función de validación
function validarDatosVariante(datos) {
    const { idProductoBase, sku } = datos;
    
    if (!idProductoBase || !sku) {
        throw new Error('CAMPOS_REQUERIDOS');
    }
    
    if (sku.length < 3 || sku.length > 50) {
        throw new Error('SKU_LONGITUD_INVALIDA');
    }
    
    if (datos.precio && datos.precio < 0) {
        throw new Error('PRECIO_INVALIDO');
    }
}