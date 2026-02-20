-- Migración: Galería de imágenes por producto
-- Tabla ProductosImagen y clave de configuración PRODUCTOS_CON_IMAGENES

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProductosImagen')
BEGIN
    CREATE TABLE [dbo].[ProductosImagen](
        [idImagen] [uniqueidentifier] NOT NULL DEFAULT NEWID(),
        [idEmpresa] [uniqueidentifier] NOT NULL,
        [idProducto] [uniqueidentifier] NOT NULL,
        [rutaArchivo] [varchar](255) NOT NULL,
        [orden] [tinyint] NOT NULL DEFAULT 1,
        [fRegistro] [datetime2](7) NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT [PK_ProductosImagen] PRIMARY KEY CLUSTERED ([idImagen] ASC),
        CONSTRAINT [FK_ProductosImagen_Empresas] FOREIGN KEY([idEmpresa]) REFERENCES [dbo].[Empresas]([idEmpresa]),
        CONSTRAINT [FK_ProductosImagen_Productos] FOREIGN KEY([idProducto]) REFERENCES [dbo].[Productos]([idProducto]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_ProductosImagen_EmpresaProducto] ON [dbo].[ProductosImagen]([idEmpresa], [idProducto]);
    CREATE INDEX [IX_ProductosImagen_Producto] ON [dbo].[ProductosImagen]([idProducto]);

    PRINT 'Tabla ProductosImagen creada.';
END
ELSE
    PRINT 'Tabla ProductosImagen ya existe.';
GO

-- Clave PRODUCTOS_CON_IMAGENES: se inserta por empresa cuando el usuario active la opción en Configuración.
-- Si no existe la fila, el sistema asume valor 'false'. No es obligatorio insertar aquí para todas las empresas.
