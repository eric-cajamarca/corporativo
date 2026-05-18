const { forEach } = require('jszip');
const precioProductoRepository = require('../repositories/preciosV.repository');

// exports.crearPrecioProducto = async (pool, Data, usuarioAutenticado) => {
//     try {
//         // Validar permisos del usuario
//         if (!usuarioAutenticado) {
//             throw new Error('NO_ACCESO');
//         }

//         console.log('Datos recibidos en el service para crear precio producto:', Data);
//         //aqui quiero recorrer el objeto Data
//         //         Datos recibidos para crear precio de producto: [
//         //   {
//         //     idLista: '3',
//         //     idProducto: 'FB6D30D5-3A1B-49DB-A094-7EA20117607C',
//         //     precio: 50,
//         //     idMoneda: 1,
//         //     idUsuario: 'USUARIO_ACTUAL'
//         //   },
//         //   {
//         //     idLista: '3',
//         //     idProducto: 'B74CCDA2-B15D-4A5B-9F2E-195150B04077',
//         //     precio: 30,
//         //     idMoneda: 1,
//         //     idUsuario: 'USUARIO_ACTUAL'
//         //   },
//         //   {
//         //     idLista: '3',
//         //     idProducto: 'AD5E6683-E965-4D44-B5A3-2CEAFC9FB4F7',
//         //     precio: 120,
//         //     idMoneda: 1,
//         //     idUsuario: 'USUARIO_ACTUAL'
//         //   }
//         // ]
//                 const precioData = forEach(Data, (item) => {
//                     return {
//                         idLista: item.idLista,
//                         idProducto: item.idProducto,
//                         precio: item.precio,
//                         idMoneda: item.idMoneda,
//                         idUsuario: usuarioAutenticado.idUsuario
//                     };

//                     // Validaciones de negocio
//                     validarDatosPrecio(precioData);


//                 });

       

        
//         // Lógica adicional (si necesitas verificar algo más antes de crear)
//         // Ejemplo: Verificar si el producto existe, si la moneda es válida, etc.
        
//         // Llamar al repository
//         const result = await precioProductoRepository.crearPrecioProducto(
//             pool, 
//             precioData
//         );
        
//         return { 
//             success: true, 
//             data: result,
//             message: 'Precio del producto creado exitosamente'
//         };
//     } catch (error) {
//         console.error('Error en service al crear precio producto:', error);
//         throw error;
//     }
// };


exports.crearPrecioProducto = async (pool, Data, usuarioAutenticado) => {
    try {
        // Validar permisos del usuario
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

                
        // Validar que Data sea un array
        if (!Array.isArray(Data)) {
            throw new Error('LOS_DATOS_DEBEN_SER_UN_ARRAY');
        }

        const resultados = [];
        const errores = [];

        // Recorrer cada precio en el array
        for (const item of Data) {
            try {
                // Crear objeto de precio
                const precioData = {
                    idLista: item.idLista,
                    idProducto: item.idProducto,
                    idPrecio: item.idPrecio, // Puede ser null para nuevos precios
                    precio: item.precio,
                    idMoneda: item.idMoneda,
                    idUsuario: usuarioAutenticado.sub
                };

                // Validar datos del precio
                validarDatosPrecio(precioData);

                // Verificar si el precio ya existe
                const precioExistente = await precioProductoRepository.verificarPrecioExistente(
                    pool,
                    precioData.idLista,
                    precioData.idProducto
                );

                let result;
                let mensaje;

                if (precioExistente) {
                    // Actualizar precio existente
                                        result = await precioProductoRepository.actualizarPrecioProducto(
                        pool,
                        precioData
                    );
                    mensaje = 'Precio actualizado';
                                    } else {
                    // Crear nuevo precio
                                        result = await precioProductoRepository.crearPrecioProducto(
                        pool,
                        precioData
                    );
                    mensaje = 'Precio creado';
                }

                resultados.push({
                    success: true,
                    data: result,
                    message: mensaje,
                    idProducto: precioData.idProducto,
                    precio: precioData.precio,
                    accion: precioExistente ? 'actualizado' : 'creado'
                });

            } catch (error) {
                errores.push({
                    idProducto: item.idProducto,
                    precio: item.precio,
                    error: error.message
                });
            }
        }

        // Si hay errores, informar pero no fallar completamente
        if (errores.length > 0) {
            console.warn(`Se encontraron ${errores.length} errores:`, errores);
        }

        return { 
            success: resultados.length > 0,
            data: resultados,
            errores: errores,
            message: `Procesados ${resultados.length} precios (${errores.length} con error)`,
            resumen: {
                total: Data.length,
                exitosos: resultados.length,
                fallidos: errores.length,
                actualizados: resultados.filter(r => r.accion === 'actualizado').length,
                creados: resultados.filter(r => r.accion === 'creado').length
            }
        };
        
    } catch (error) {
        console.error('Error en service al crear precio producto:', error);
        throw error;
    }
};

// Función de validación
// function validarDatosPrecio(precioData) {
//     const { idLista, idProducto, precio, idMoneda } = precioData;
    
//     // Validar campos requeridos
//     if (!idLista || !idProducto || precio === undefined || !idMoneda) {
//         throw new Error('CAMPOS_REQUERIDOS');
//     }
    
//     // Validar tipos de datos
//     if (typeof precio !== 'number' || isNaN(precio)) {
//         throw new Error('PRECIO_INVALIDO');
//     }
    
//     if (precio < 0) {
//         throw new Error('PRECIO_NEGATIVO');
//     }
    
//     // Validar que idLista sea número
//     if (isNaN(parseInt(idLista))) {
//         throw new Error('ID_LISTA_INVALIDO');
//     }
    
//     // Validar que idMoneda sea número positivo
//     if (isNaN(parseInt(idMoneda)) || parseInt(idMoneda) <= 0) {
//         throw new Error('ID_MONEDA_INVALIDO');
//     }
// }



// Función de validación interna
function validarDatosPrecio(precioData) {
    const { idLista, idProducto, precio, idMoneda, idUsuario } = precioData;
    
    // Validar campos requeridos
    if (!idLista || !idProducto || precio === undefined || !idMoneda) {
        throw new Error('CAMPOS_REQUERIDOS');
    }
    
    // Validar tipos de datos
    if (typeof precio !== 'number' || isNaN(precio)) {
        throw new Error('PRECIO_INVALIDO');
    }
    
    if (precio < 0) {
        throw new Error('PRECIO_NEGATIVO');
    }
    
    // Puedes agregar más validaciones según tu negocio
    // Ejemplo: precio máximo, formatos específicos, etc.
}


exports.editarPrecioProducto = async (pool, precioData, usuarioAutenticado) => {
    try {
        // Validar que el usuario esté autenticado
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        // Validar datos de entrada
        validarDatosActualizacion(precioData);

        // Verificar si el precio existe antes de actualizar (opcional)
        const precioExistente = await precioProductoRepository.obtenerPrecioPorId(
            pool, 
            precioData.idPrecio
        );

        if (!precioExistente || precioExistente.recordset.length === 0) {
            throw new Error('PRECIO_NO_ENCONTRADO');
        }

        // Verificar permisos adicionales si es necesario
        // Ejemplo: solo el usuario que creó el precio puede editarlo
        if (precioExistente.recordset[0].idUsuario !== usuarioAutenticado.idUsuario) {
            // Solo si tu lógica de negocio lo requiere
            // throw new Error('PERMISO_DENEGADO');
        }

        // Llamar al repository para actualizar
        const result = await precioProductoRepository.actualizarPrecioProducto(
            pool,
            precioData
        );

        // Verificar si se actualizó correctamente
        if (result.rowsAffected[0] === 0) {
            throw new Error('NO_SE_ACTUALIZO');
        }

        return {
            success: true,
            data: result,
            message: 'Precio actualizado exitosamente',
            cambios: result.rowsAffected[0]
        };

    } catch (error) {
        console.error('Error en service al editar precio producto:', error);
        throw error;
    }
};

exports.obtenerPrecioPorId = async (pool, idPrecio) => {
    try {
        const result = await precioProductoRepository.obtenerPrecioPorId(
            pool, 
            idPrecio
        );
        if (!result || result.recordset.length === 0) {
            throw new Error('PRECIO_NO_ENCONTRADO');
        }

        return {
            success: true,
            data: result.recordset[0]
        };
    } catch (error) {
        console.error('Error en service al obtener precio por ID:', error);
        throw error;
    }
};


exports.eliminarPrecioProducto = async (pool, idPrecio, usuarioAutenticado) => {
    try {
        // Validar que el usuario esté autenticado
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }
        // Verificar si el precio existe antes de eliminar
        const precioExistente = await precioProductoRepository.obtenerPrecioPorId(
            pool, 
            idPrecio
        );
        if (!precioExistente || precioExistente.recordset.length === 0) {
            throw new Error('PRECIO_NO_ENCONTRADO');
        }
        // Llamar al repository para eliminar
        const result = await precioProductoRepository.eliminarPrecioProducto(
            pool,
            idPrecio
        );
        // Verificar si se eliminó correctamente
        if (result.rowsAffected[0] === 0) {
            throw new Error('NO_SE_ELIMINO');
        }
        return {
            success: true,
            message: 'Precio eliminado exitosamente',
            eliminados: result.rowsAffected[0]
        };
    }
    catch (error) {
        console.error('Error en service al eliminar precio producto:', error);
        throw error;
    }
};

// Función de validación interna
function validarDatosActualizacion(precioData) {
    const { idPrecio, idLista, idProducto, precio, idMoneda, idUsuario } = precioData;
    
    // Validar campos requeridos
    if (!idPrecio || !idLista || !idProducto || precio === undefined || !idMoneda || !idUsuario) {
        throw new Error('CAMPOS_REQUERIDOS');
    }
    
    // Validar que idPrecio sea numérico
    if (typeof idPrecio !== 'number' || isNaN(idPrecio)) {
        throw new Error('ID_PRECIO_INVALIDO');
    }
    
    // Validar precio
    if (typeof precio !== 'number' || isNaN(precio)) {
        throw new Error('PRECIO_INVALIDO');
    }
    
    if (precio < 0) {
        throw new Error('PRECIO_NEGATIVO');
    }
    
    // Validar que idMoneda sea positivo
    if (idMoneda <= 0) {
        throw new Error('MONEDA_INVALIDA');
    }
}

////////////////////////////////////////////////////////////////////////////////////////////

exports.crearListaPrecio = async (pool, listaData, usuarioAutenticado) => {
    try {
        // Validar que el usuario esté autenticado
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        // Validar datos de entrada
        validarDatosListaPrecio(listaData);

        // Verificar si ya existe una lista con el mismo nombre en la misma empresa
        const listaExistente = await precioProductoRepository.obtenerListaPorNombre(
            pool,
            listaData.idEmpresa,
            listaData.nombre
        );

        if (listaExistente.recordset.length > 0) {
            throw new Error('NOMBRE_DUPLICADO');
        }

        // Lógica de negocio: Si la lista es principal, verificar que no exista otra principal activa
        if (listaData.principal) {
            const principalExistente = await precioProductoRepository.verificarPrincipalExistente(
                pool,
                listaData.idEmpresa
            );

            if (principalExistente.recordset.length > 0) {
                throw new Error('YA_EXISTE_PRINCIPAL');
            }
        }

        // Lógica de negocio: Validar fechas
        if (listaData.fecha_inicio && listaData.fecha_fin) {
            const fechaInicio = new Date(listaData.fecha_inicio);
            const fechaFin = new Date(listaData.fecha_fin);
            
            if (fechaFin < fechaInicio) {
                throw new Error('FECHA_FIN_MENOR');
            }
        }

        // Llamar al repository para crear la lista de precios
        const result = await precioProductoRepository.crearListaPrecio(
            pool,
            listaData
        );

        return {
            success: true,
            data: result,
            message: 'Lista de precios creada exitosamente',
            idGenerado: result.recordset && result.recordset[0] ? result.recordset[0].idLista : null
        };

    } catch (error) {
        console.error('Error en service al crear lista de precios:', error);
        throw error;
    }
};

// Función de validación interna
function validarDatosListaPrecio(listaData) {
    const { 
        idEmpresa, 
        idSucursal, 
        nombre, 
        idMoneda, 
        principal, 
        conIgv, 
        activo 
    } = listaData;
    
    // Validar campos requeridos
    if (!idEmpresa || !nombre || !idMoneda) {
        throw new Error('CAMPOS_REQUERIDOS');
    }
    
    // Validar longitud del nombre
    if (nombre.length < 3 || nombre.length > 100) {
        throw new Error('NOMBRE_LONGITUD_INVALIDA');
    }
    
    // Validar que idMoneda sea positivo
    if (idMoneda <= 0) {
        throw new Error('MONEDA_INVALIDA');
    }
    
    // Validar valores booleanos
    if (typeof principal !== 'boolean') {
        throw new Error('PRINCIPAL_INVALIDO');
    }
    
    if (typeof conIgv !== 'boolean') {
        throw new Error('CON_IGV_INVALIDO');
    }
    
    if (typeof activo !== 'boolean') {
        throw new Error('ACTIVO_INVALIDO');
    }
}

exports.editarListaPrecio = async (pool, listaData, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        validarDatosListaPrecio(listaData);

        const listaExistente = await precioProductoRepository.obtenerListaPorId(
            pool,
            listaData.idLista,
            listaData.idEmpresa
        );

        if (listaExistente.recordset.length === 0) {
            throw new Error('LISTA_NO_ENCONTRADA');
        }

        const result = await precioProductoRepository.actualizarListaPrecio(
            pool,
            listaData
        );

        if (result.rowsAffected[0] === 0) {
            throw new Error('NO_SE_ACTUALIZO');
        }

        return {
            success: true,
            data: result,
            message: 'Lista de precios actualizada exitosamente'
        };

    } catch (error) {
        console.error('Error en service al editar lista de precios:', error);
        throw error;
    }
};

exports.obtenerListasPrecioPorProducto = async (pool, idProducto, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        if (!usuarioAutenticado.idEmpresa) {
            throw new Error('EMPRESA_NO_ASIGNADA');
        }

        if (!idProducto) {
            throw new Error('PRODUCTO_NO_VALIDO');
        }

        const listas = await precioProductoRepository.obtenerListasPrecioPorProducto(
            pool,
            idProducto,
            usuarioAutenticado.idEmpresa
        );

        return listas;

    } catch (error) {
        console.error('Error en service al obtener listas por producto:', error);
        throw error;
    }
};

exports.obtenerListasPrecioEmpresa = async (pool, usuarioAutenticado, idEmpresaDestino = null) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        if (!usuarioAutenticado.empresa) {
            throw new Error('EMPRESA_NO_ASIGNADA');
        }

        let idEmpresa = usuarioAutenticado.empresa;
        const dest = idEmpresaDestino != null ? String(idEmpresaDestino).trim() : '';
        if (dest) {
            const { assertEmpresaAutorizada } = require('../utils/empresaGestora.util');
            await assertEmpresaAutorizada(pool, usuarioAutenticado.empresa, dest);
            idEmpresa = dest;
        }

        const listas = await precioProductoRepository.obtenerListasPrecioEmpresa(
            pool,
            idEmpresa
        );

        return listas;

    } catch (error) {
        console.error('Error en service al obtener listas de empresa:', error);
        throw error;
    }
};

exports.desactivarListaPrecio = async (pool, idLista, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        if (!idLista) {
            throw new Error('ID_LISTA_INVALIDO');
        }

        const lista = await precioProductoRepository.obtenerListaPorIdSimple(pool, idLista);
        
        if (!lista) {
            throw new Error('LISTA_NO_ENCONTRADA');
        }
        // Verificar si la lista esta activa o desactivada
        if (!lista.activo) {
                        if (cantidadUso > 0) {
                result = await precioProductoRepository.activarListaPrecio(pool, idLista);
                mensaje = 'Lista de precios activada (contiene productos)';
            }
            
            return {
            success: true,
            data: result,
            message: mensaje,
            Activada: cantidadUso === 0
            };

        }else{
                         const cantidadUso = await precioProductoRepository.verificarUsoListaPrecio(pool, idLista);
        

            let result;
            let mensaje;

            if (cantidadUso > 0) {
                result = await precioProductoRepository.desactivarListaPrecio(pool, idLista);
                mensaje = 'Lista de precios desactivada (contiene productos)';
            } else {
                result = await precioProductoRepository.eliminarListaPrecio(pool, idLista);
                mensaje = 'Lista de precios eliminada (no tiene productos)';
            }

            return {
            success: true,
            data: result,
            message: mensaje,
            eliminada: cantidadUso === 0
            };
        }

        
       

    } catch (error) {
        console.error('Error en service al desactivar/eliminar lista de precios:', error);
        throw error;
    }
};


// exports.activarListaPrecio = async (pool, idLista, usuarioAutenticado) => {
//     try {
//         if (!usuarioAutenticado) {
//             throw new Error('NO_ACCESO');
//         }

//         if (!idLista) {
//             throw new Error('ID_LISTA_INVALIDO');
//         }

//         const lista = await precioProductoRepository.obtenerListaPorIdSimple(pool, idLista);
        
//         if (!lista) {
//             throw new Error('LISTA_NO_ENCONTRADA');
//         }

//         const cantidadUso = await precioProductoRepository.verificarUsoListaPrecio(pool, idLista);
        
//         let result;
//         let mensaje;

//         if (cantidadUso > 0) {
//             result = await precioProductoRepository.desactivarListaPrecio(pool, idLista);
//             mensaje = 'Lista de precios activada (contiene productos)';
//         }

//         return {
//             success: true,
//             data: result,
//             message: mensaje,
//             eliminada: cantidadUso === 0
//         };

//     } catch (error) {
//         console.error('Error en service al desactivar/eliminar lista de precios:', error);
//         throw error;
//     }
// };