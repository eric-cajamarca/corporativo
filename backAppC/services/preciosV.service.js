const precioProductoRepository = require('../repositories/preciosV.repository');

exports.crearPrecioProducto = async (pool, precioData, usuarioAutenticado) => {
    try {
        // Validar permisos del usuario
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        // Validaciones de negocio
        validarDatosPrecio(precioData);
        
        // Lógica adicional (si necesitas verificar algo más antes de crear)
        // Ejemplo: Verificar si el producto existe, si la moneda es válida, etc.
        
        // Llamar al repository
        const result = await precioProductoRepository.crearPrecioProducto(
            pool, 
            precioData
        );
        
        return { 
            success: true, 
            data: result,
            message: 'Precio del producto creado exitosamente'
        };
    } catch (error) {
        console.error('Error en service al crear precio producto:', error);
        throw error;
    }
};

// Función de validación interna
function validarDatosPrecio(precioData) {
    const { idLista, idProducto, precio, idMoneda, idUsuario } = precioData;
    
    // Validar campos requeridos
    if (!idLista || !idProducto || precio === undefined || !idMoneda || !idUsuario) {
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
    if (!idEmpresa || !idSucursal || !nombre || !idMoneda) {
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

exports.obtenerListasPrecioEmpresa = async (pool, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        if (!usuarioAutenticado.idEmpresa) {
            throw new Error('EMPRESA_NO_ASIGNADA');
        }

        const listas = await precioProductoRepository.obtenerListasPrecioEmpresa(
            pool,
            usuarioAutenticado.idEmpresa
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

    } catch (error) {
        console.error('Error en service al desactivar/eliminar lista de precios:', error);
        throw error;
    }
};