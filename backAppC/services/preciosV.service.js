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

