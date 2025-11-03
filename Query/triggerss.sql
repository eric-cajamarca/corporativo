
--triggers para sctockSucursal insert, update y deleted
CREATE TRIGGER trg_DetalleCompras_Insert
	ON DetalleCompras
	AFTER INSERT
	AS
	BEGIN
		SET NOCOUNT ON;
    
		BEGIN TRY
			-- Actualizar o insertar en StockSucursal cuando se agrega un nuevo detalle de compra
			MERGE StockSucursal AS target
			USING (SELECT idEmpresa, idSucursal, idProducto, cantidad FROM inserted) AS source
			ON (target.idEmpresa = source.idEmpresa 
				AND target.idSucursal = source.idSucursal 
				AND target.idProducto = source.idProducto)
        
			WHEN MATCHED THEN
				UPDATE SET 
					target.cantidad = target.cantidad + source.cantidad,
					target.fIngreso = GETDATE()
        
			WHEN NOT MATCHED THEN
				INSERT (idEmpresa, idSucursal, idProducto, cantidad,fIngreso, idUsuario)
				VALUES (source.idEmpresa, source.idSucursal, source.idProducto, 
					   source.cantidad,'' , GETDATE(), (SELECT TOP 1 idUsuario FROM inserted));
		END TRY
		BEGIN CATCH
			-- Registrar el error
			DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
			RAISERROR('Error en trigger trg_DetalleCompras_Insert: %s', 16, 1, @ErrorMessage);
		END CATCH
	END;



CREATE TRIGGER trg_DetalleCompras_Update
	ON DetalleCompras
	AFTER UPDATE
	AS
	BEGIN
		SET NOCOUNT ON;
    
		-- Solo procesar si cambió la cantidad
		IF UPDATE(cantidad)
		BEGIN
			BEGIN TRY
				-- Calcular la diferencia entre el valor nuevo y el antiguo
				WITH CantidadCambio AS (
					SELECT 
						i.idEmpresa, 
						i.idSucursal, 
						i.idProducto, 
						(i.cantidad - d.cantidad) AS diferencia
					FROM inserted i
					JOIN deleted d ON i.idDetalleCompra = d.idDetalleCompra
				)
            
				-- Actualizar StockSucursal con la diferencia
				UPDATE ss
				SET ss.cantidad = ss.cantidad + cc.diferencia,
					ss.fIngreso = GETDATE()
				FROM StockSucursal ss
				JOIN CantidadCambio cc ON ss.idEmpresa = cc.idEmpresa
									  AND ss.idSucursal = cc.idSucursal
									  AND ss.idProducto = cc.idProducto;
			END TRY
			BEGIN CATCH
				-- Registrar el error
				DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
				RAISERROR('Error en trigger trg_DetalleCompras_Update: %s', 16, 1, @ErrorMessage);
			END CATCH
		END
END;


CREATE TRIGGER trg_DetalleCompras_Delete
	ON DetalleCompras
	AFTER DELETE
	AS
	BEGIN
		SET NOCOUNT ON;
    
		BEGIN TRY
			-- Disminuir el stock cuando se elimina un detalle de compra
			UPDATE ss
			SET ss.cantidad = ss.cantidad - d.cantidad,
				ss.fIngreso = GETDATE()
			FROM StockSucursal ss
			JOIN deleted d ON ss.idEmpresa = d.idEmpresa
						   AND ss.idSucursal = d.idSucursal
						   AND ss.idProducto = d.idProducto;
        
			-- Opcional: Eliminar registro de StockSucursal si la cantidad llega a cero
			DELETE FROM StockSucursal
			WHERE cantidad <= 0
			AND idStockSucursal IN (
				SELECT ss.idStockSucursal
				FROM StockSucursal ss
				JOIN deleted d ON ss.idEmpresa = d.idEmpresa
							   AND ss.idSucursal = d.idSucursal
							   AND ss.idProducto = d.idProducto
			);
		END TRY
		BEGIN CATCH
			-- Registrar el error
			DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
			RAISERROR('Error en trigger trg_DetalleCompras_Delete: %s', 16, 1, @ErrorMessage);
		END CATCH
END;