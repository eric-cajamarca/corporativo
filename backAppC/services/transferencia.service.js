const transferenciaRepository = require('../repositories/transferencia.repository');

exports.crearTransferencia = async (pool, datos, usuarioAutenticado) => {
    const transaction = pool.transaction();
    
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        validarDatosTransferencia(datos);

        // Iniciar transacción
        await transaction.begin();

        // 1. Verificar que las sucursales existan y estén activas
        const sucursalOrigen = await transferenciaRepository.obtenerSucursal(
            transaction,
            datos.idSucursalOrigen,
            datos.idEmpresa
        );

        if (!sucursalOrigen) {
            throw new Error('SUCURSAL_NO_ENCONTRADA');
        }

        if (!sucursalOrigen.estado) {
            throw new Error('SUCURSAL_INACTIVA');
        }

        const sucursalDestino = await transferenciaRepository.obtenerSucursal(
            transaction,
            datos.idSucursalDestino,
            datos.idEmpresa
        );

        if (!sucursalDestino) {
            throw new Error('SUCURSAL_NO_ENCONTRADA');
        }

        if (!sucursalDestino.estado) {
            throw new Error('SUCURSAL_INACTIVA');
        }

        // 2. Verificar stock para cada producto en origen
        for (const item of datos.items) {
            const stockActual = await transferenciaRepository.obtenerStockProducto(
                transaction,
                item.idProducto,
                datos.idSucursalOrigen,
                datos.idEmpresa
            );

            if (!stockActual || stockActual.cantidad < item.cantidad) {
                throw new Error('STOCK_INSUFICIENTE');
            }

            // Verificar que el producto exista
            const producto = await transferenciaRepository.obtenerProducto(
                transaction,
                item.idProducto,
                datos.idEmpresa
            );

            if (!producto) {
                throw new Error('PRODUCTO_NO_ENCONTRADO');
            }
        }

        // 3. Crear movimiento de salida (origen)
        const movimientoSalida = await transferenciaRepository.crearMovimiento(
            transaction,
            {
                idEmpresa: datos.idEmpresa,
                idSucursal: datos.idSucursalOrigen,
                tipoMovimiento: 'TR', // Transferencia
                docRelacionado: datos.docRelacionado,
                idUsuario: datos.idUsuario,
                observaciones: `Transferencia a ${sucursalDestino.nombre}. ${datos.observaciones}`
            }
        );

        const idMovimientoSalida = movimientoSalida.recordset[0]?.idMovimiento;

        // 4. Crear movimiento de entrada (destino)
        const movimientoEntrada = await transferenciaRepository.crearMovimiento(
            transaction,
            {
                idEmpresa: datos.idEmpresa,
                idSucursal: datos.idSucursalDestino,
                tipoMovimiento: 'TR', // Transferencia
                docRelacionado: datos.docRelacionado,
                idUsuario: datos.idUsuario,
                observaciones: `Transferencia desde ${sucursalOrigen.nombre}. ${datos.observaciones}`,
                idMovimientoRelacionado: idMovimientoSalida
            }
        );

        const idMovimientoEntrada = movimientoEntrada.recordset[0]?.idMovimiento;

        // 5. Procesar cada item
        const itemsProcesados = [];
        for (const item of datos.items) {
            // 5.1. Restar stock en origen
            await transferenciaRepository.ajustarStock(
                transaction,
                {
                    idEmpresa: datos.idEmpresa,
                    idSucursal: datos.idSucursalOrigen,
                    idProducto: item.idProducto,
                    cantidad: -item.cantidad, // Restar
                    idUsuario: datos.idUsuario,
                    tipoMovimiento: 'TR_SALIDA',
                    idMovimiento: idMovimientoSalida,
                    observaciones: `Transferencia a ${sucursalDestino.nombre}`
                }
            );

            // 5.2. Agregar detalle de movimiento salida
            await transferenciaRepository.agregarDetalleMovimiento(
                transaction,
                {
                    idMovimiento: idMovimientoSalida,
                    idProducto: item.idProducto,
                    cantidad: item.cantidad,
                    tipo: 'SALIDA'
                }
            );

            // 5.3. Sumar stock en destino
            await transferenciaRepository.ajustarStock(
                transaction,
                {
                    idEmpresa: datos.idEmpresa,
                    idSucursal: datos.idSucursalDestino,
                    idProducto: item.idProducto,
                    cantidad: item.cantidad, // Sumar
                    idUsuario: datos.idUsuario,
                    tipoMovimiento: 'TR_ENTRADA',
                    idMovimiento: idMovimientoEntrada,
                    observaciones: `Transferencia desde ${sucursalOrigen.nombre}`
                }
            );

            // 5.4. Agregar detalle de movimiento entrada
            await transferenciaRepository.agregarDetalleMovimiento(
                transaction,
                {
                    idMovimiento: idMovimientoEntrada,
                    idProducto: item.idProducto,
                    cantidad: item.cantidad,
                    tipo: 'ENTRADA'
                }
            );

            itemsProcesados.push({
                idProducto: item.idProducto,
                cantidad: item.cantidad,
                procesado: true
            });
        }

        // 6. Actualizar movimientos con relación
        await transferenciaRepository.actualizarMovimientoRelacionado(
            transaction,
            idMovimientoSalida,
            idMovimientoEntrada
        );

        await transferenciaRepository.actualizarMovimientoRelacionado(
            transaction,
            idMovimientoEntrada,
            idMovimientoSalida
        );

        // 7. Confirmar transacción
        await transaction.commit();

        return {
            success: true,
            data: {
                idMovimientoSalida: idMovimientoSalida,
                idMovimientoEntrada: idMovimientoEntrada,
                items: itemsProcesados,
                sucursalOrigen: sucursalOrigen.nombre,
                sucursalDestino: sucursalDestino.nombre,
                fecha: new Date().toISOString()
            },
            message: 'Transferencia realizada exitosamente',
            idMovimiento: idMovimientoSalida,
            totalItems: datos.items.length
        };

    } catch (error) {
        // Revertir transacción en caso de error
        if (transaction._aborted === false) {
            await transaction.rollback();
        }
        
        console.error('Error en service al crear transferencia:', error);
        throw error;
    }
};

exports.obtenerTransferencias = async (pool, filtros, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        const transferencias = await transferenciaRepository.obtenerTransferencias(
            pool,
            filtros
        );

        return {
            success: true,
            data: transferencias,
            message: 'Transferencias obtenidas exitosamente',
            totalTransferencias: transferencias.length
        };

    } catch (error) {
        console.error('Error en service al obtener transferencias:', error);
        throw error;
    }
};

exports.obtenerTransferenciaPorId = async (pool, idMovimiento, idEmpresa, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        const transferencia = await transferenciaRepository.obtenerTransferenciaPorId(
            pool,
            idMovimiento,
            idEmpresa
        );

        if (!transferencia) {
            throw new Error('TRANSFERENCIA_NO_ENCONTRADA');
        }

        // Obtener detalles de la transferencia
        const detalles = await transferenciaRepository.obtenerDetallesTransferencia(
            pool,
            idMovimiento
        );

        // Obtener movimiento relacionado (entrada/salida)
        const movimientoRelacionado = transferencia.idMovimientoRelacionado 
            ? await transferenciaRepository.obtenerMovimientoRelacionado(
                pool,
                transferencia.idMovimientoRelacionado,
                idEmpresa
              )
            : null;

        return {
            success: true,
            data: {
                ...transferencia,
                detalles: detalles,
                movimientoRelacionado: movimientoRelacionado
            },
            message: 'Transferencia obtenida exitosamente'
        };

    } catch (error) {
        console.error('Error en service al obtener transferencia:', error);
        throw error;
    }
};

exports.revertirTransferencia = async (pool, datos, usuarioAutenticado) => {
    const transaction = pool.transaction();
    
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        if (!datos.idMovimiento || !datos.motivo) {
            throw new Error('CAMPOS_REQUERIDOS');
        }

        await transaction.begin();

        // 1. Obtener la transferencia original
        const transferenciaOriginal = await transferenciaRepository.obtenerTransferenciaPorId(
            transaction,
            datos.idMovimiento,
            datos.idEmpresa
        );

        if (!transferenciaOriginal) {
            throw new Error('TRANSFERENCIA_NO_ENCONTRADA');
        }

        // 2. Verificar si ya fue revertida
        if (transferenciaOriginal.revertido) {
            throw new Error('TRANSFERENCIA_YA_REVERTIDA');
        }

        // 3. Obtener el movimiento relacionado
        const movimientoRelacionado = transferenciaOriginal.idMovimientoRelacionado 
            ? await transferenciaRepository.obtenerMovimientoRelacionado(
                transaction,
                transferenciaOriginal.idMovimientoRelacionado,
                datos.idEmpresa
              )
            : null;

        if (!movimientoRelacionado) {
            throw new Error('MOVIMIENTO_RELACIONADO_NO_ENCONTRADO');
        }

        // 4. Determinar qué movimiento es salida y cuál entrada
        let movimientoSalida, movimientoEntrada;
        
        if (transferenciaOriginal.tipoMovimiento === 'TR_SALIDA' || 
            transferenciaOriginal.observaciones?.includes('Transferencia a')) {
            movimientoSalida = transferenciaOriginal;
            movimientoEntrada = movimientoRelacionado;
        } else {
            movimientoSalida = movimientoRelacionado;
            movimientoEntrada = transferenciaOriginal;
        }

        // 5. Obtener detalles para revertir
        const detalles = await transferenciaRepository.obtenerDetallesTransferencia(
            transaction,
            datos.idMovimiento
        );

        // 6. Verificar stock para reversión
        for (const detalle of detalles) {
            const stockActual = await transferenciaRepository.obtenerStockProducto(
                transaction,
                detalle.idProducto,
                movimientoEntrada.idSucursal, // Stock debe estar en destino para revertir
                datos.idEmpresa
            );

            if (!stockActual || stockActual.cantidad < detalle.cantidad) {
                throw new Error('STOCK_INSUFICIENTE_REVERSION');
            }
        }

        // 7. Crear movimiento de reversión
        const movimientoReversion = await transferenciaRepository.crearMovimiento(
            transaction,
            {
                idEmpresa: datos.idEmpresa,
                idSucursal: movimientoSalida.idSucursal,
                tipoMovimiento: 'TR_REVERSION',
                docRelacionado: movimientoSalida.docRelacionado,
                idUsuario: datos.idUsuario,
                observaciones: `Reversión de transferencia ${datos.idMovimiento}. Motivo: ${datos.motivo}`,
                idMovimientoRelacionado: datos.idMovimiento
            }
        );

        const idMovimientoReversion = movimientoReversion.recordset[0]?.idMovimiento;

        // 8. Revertir cada item
        for (const detalle of detalles) {
            // 8.1. Revertir en destino (restar)
            await transferenciaRepository.ajustarStock(
                transaction,
                {
                    idEmpresa: datos.idEmpresa,
                    idSucursal: movimientoEntrada.idSucursal,
                    idProducto: detalle.idProducto,
                    cantidad: -detalle.cantidad, // Restar del destino
                    idUsuario: datos.idUsuario,
                    tipoMovimiento: 'TR_REVERSION',
                    idMovimiento: idMovimientoReversion,
                    observaciones: `Reversión a ${movimientoSalida.idSucursal}`
                }
            );

            // 8.2. Revertir en origen (sumar)
            await transferenciaRepository.ajustarStock(
                transaction,
                {
                    idEmpresa: datos.idEmpresa,
                    idSucursal: movimientoSalida.idSucursal,
                    idProducto: detalle.idProducto,
                    cantidad: detalle.cantidad, // Sumar al origen
                    idUsuario: datos.idUsuario,
                    tipoMovimiento: 'TR_REVERSION',
                    idMovimiento: idMovimientoReversion,
                    observaciones: `Reversión desde ${movimientoEntrada.idSucursal}`
                }
            );

            // 8.3. Agregar detalle de reversión
            await transferenciaRepository.agregarDetalleMovimiento(
                transaction,
                {
                    idMovimiento: idMovimientoReversion,
                    idProducto: detalle.idProducto,
                    cantidad: detalle.cantidad,
                    tipo: 'REVERSION'
                }
            );
        }

        // 9. Marcar como revertido
        await transferenciaRepository.marcarComoRevertido(
            transaction,
            datos.idMovimiento,
            idMovimientoReversion
        );

        await transferenciaRepository.marcarComoRevertido(
            transaction,
            movimientoRelacionado.idMovimiento,
            idMovimientoReversion
        );

        await transaction.commit();

        return {
            success: true,
            data: {
                idMovimientoReversion: idMovimientoReversion,
                transferenciaOriginal: datos.idMovimiento,
                itemsRevertidos: detalles.length
            },
            message: 'Transferencia revertida exitosamente',
            idMovimientoReverso: idMovimientoReversion
        };

    } catch (error) {
        if (transaction._aborted === false) {
            await transaction.rollback();
        }
        
        console.error('Error en service al revertir transferencia:', error);
        throw error;
    }
};

exports.verificarStockTransferencia = async (pool, datos, usuarioAutenticado) => {
    try {
        if (!usuarioAutenticado) {
            throw new Error('NO_ACCESO');
        }

        validarDatosVerificacionStock(datos);

        const resultados = [];
        let tieneStockSuficiente = true;
        const productosSinStock = [];

        for (const item of datos.items) {
            const stockActual = await transferenciaRepository.obtenerStockProducto(
                pool,
                item.idProducto,
                datos.idSucursalOrigen,
                datos.idEmpresa
            );

            const disponible = stockActual ? stockActual.cantidad : 0;
            const suficiente = disponible >= item.cantidad;

            if (!suficiente) {
                tieneStockSuficiente = false;
                productosSinStock.push({
                    idProducto: item.idProducto,
                    cantidadRequerida: item.cantidad,
                    cantidadDisponible: disponible
                });
            }

            resultados.push({
                idProducto: item.idProducto,
                cantidadRequerida: item.cantidad,
                cantidadDisponible: disponible,
                suficiente: suficiente,
                deficit: suficiente ? 0 : item.cantidad - disponible
            });
        }

        return {
            success: true,
            data: resultados,
            message: tieneStockSuficiente ? 'Stock suficiente para transferencia' : 'Stock insuficiente',
            tieneStockSuficiente: tieneStockSuficiente,
            productosSinStock: productosSinStock,
            totalItems: datos.items.length,
            itemsConStock: resultados.filter(r => r.suficiente).length
        };

    } catch (error) {
        console.error('Error en service al verificar stock:', error);
        throw error;
    }
};

// Funciones de validación
function validarDatosTransferencia(datos) {
    const { idSucursalOrigen, idSucursalDestino, items } = datos;
    
    if (!idSucursalOrigen || !idSucursalDestino || !items || !Array.isArray(items)) {
        throw new Error('CAMPOS_REQUERIDOS');
    }
    
    if (idSucursalOrigen === idSucursalDestino) {
        throw new Error('SUCURSALES_IGUALES');
    }
    
    if (items.length === 0) {
        throw new Error('ITEMS_VACIOS');
    }
    
    items.forEach((item, index) => {
        if (!item.idProducto || !item.cantidad) {
            throw new Error(`Item ${index + 1} incompleto`);
        }
        
        if (item.cantidad <= 0) {
            throw new Error(`Cantidad inválida en item ${index + 1}`);
        }
    });
}

function validarDatosVerificacionStock(datos) {
    const { idSucursalOrigen, items } = datos;
    
    if (!idSucursalOrigen || !items || !Array.isArray(items)) {
        throw new Error('CAMPOS_REQUERIDOS');
    }
    
    if (items.length === 0) {
        throw new Error('ITEMS_VACIOS');
    }
}