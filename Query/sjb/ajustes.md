# AJUSTES
- lo primero es que prepares el sidebar con los enlaces hacia los modulos y subModulos segun la base de datos. 
- ajusta permisos por empresa, por sucursal y por usuario.que los enlaces se muestren en el sidebar solo si el usuario que esta logeado esta autorizado para acceder.



#GESTION DE EMPRESAS
- mejora la intarface de create-empresa, revisa errores de seguridad y mejora la interface (profesinal pero no muy colorida)
- en index-empresa implementa un modal para establecer gestores de empresas (crud completo) y comfiguracion de la empresa.

- para manejo de roles ya tienes un componente creado, crea un componente para.
- en la carpeta colaboradores y sus componentes implementa los roles, permisos, rol permisos y sesiones de usuario. ve tu si es mejor crear un componente individual para cada uno y despues mostraro como modal o solo manejarlo como modal integrado solo a ese componente. recuerda que colaboradores equivale a la tabla UsuarioWeb de la base de datos.

- tambien implementar permisos para asignar que usuario puede acceder a que sucursal. ( toma una buena desicion)



# SIDEBAR
- quiero que el sidebar tenga un boton para ocultar o mostrar el sidebar
- que llenes el sidebar con los enlaces a los modulos y subModulos que tiene el sistema segun la @base_datos_mejorada.sql (teniendo en cuenta los permisos del ususario).

# INICIO
- quiero que inicio contenga todos los modulos ecepto generar ventas, la ventana generar nueva venta quiero que sea independiente, para poder hacer varias ventas a la vez o abrir varias ventanas y que estas mantengan guardada la lista de venta en localstoge momentaneamente hasta que se haya realizado la venta. solo alli se borrará lo guardado en localstorage.

- quiero que contenga el sidebar y el componente topnav como (navbar)
- mejora el diseño del componente topnav


# PRODUCTOS
- Los productos de deben crearse de dos maneras, de forma indiviual en el componente crearProducto con sus tados basicos y de forma grupal en registrar compras.

- como veras en crear compras uso una api para consultar el contenido de una compra mediante el xml del comprobante. que viene desde factiliza. quiero mantener esta api y crear productos en bloque si estos no existieran en la base de datos. antes de crear el producto se debe asignar un lote y una ubizacion de ese lote. que todo el objeto baya al backend y si falla la insercion de un producto que lo demas no se registre.

- manten el card de la tabla detalleCompras  ya que en ella puedo agregar o editar un producto con sus datos dependientes denecesarios. ( si tienes una popuesta mejor, hazme saberlo)
- el modulo de establecer los precios de productos que se mantengan tal cual, si puedes mejorarla si pero no cambiar  la dinamica.

- los productos que son ingresados por una factura siempre crearan un muevo lote y este tiene que tener una ubicacion en ka tabla lotesUbicacion y ubicacionesPrioridad agregadas a la base de datos(si tienes que modificar algo aqui, avisame). OJO la tabla stock sucursal ya no deberia usarse, solo sucursal y lotes y lo que dependan de ello.


# IMPLEMENTAR MODULOS FALTANTES
- implementa el modulo caja completo (gestionar cajas y lo demas necesario), he agregado una tabla de formas de pago a la base de datos base_datos_mejorada.sql y esta dentro de documentoController.js. recuerda que quiero un arqueo de caja en donde me jale dinamicamente cuanto de las ventas es al credito, contado, con yape, con plin, efectivo ...etc.


- implementa el modulo creditos completo con el segimiento por usuario y todo lo que sea necesario para un buen control.
- implementa el modulo compras completo siguiendo algunas especificaciones anteriores. y todo lo que sea necesario.
- implementa el modulo ventas completo, y comforme a lo que en la base de datos esta. mejora el diseño y completa la venta enviando a imprimir la factura. 
- para imprecion de comprobantes quiero tener tres opciones A4, A5 y tickets, recuerda que para generar reportes en pdf o excel se debe conectar a pdf-backend.


