import { Routes } from '@angular/router';
// Solo guards aquí: los componentes se cargan con loadComponent (lazy) para no inflar el bundle inicial.
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guards';
import { empresaGestoraGuard } from './guards/empresa-gestora.guard';
import { superAdminPlataformaEmpresasGuard } from './guards/superadmin-plataforma-empresas.guard';
import { saasPlanModuloGuard } from './guards/saas-plan-modulo.guard';

const loadHomePublic = () =>
  import('./components/public/home-public/home-public.component').then((m) => m.HomePublicComponent);

export const routes: Routes = [

    {
      path: 'publico',
      loadComponent: loadHomePublic,
      title: 'EFAFERP | Controla ventas, stock y créditos de tu negocio'
    },

    {
      path: '',
      pathMatch: 'full',
      loadComponent: () =>
        import('./components/public/root-redirect/root-redirect.component').then((m) => m.RootRedirectComponent),
      title: 'EFAFERP | Controla ventas, stock y créditos de tu negocio'
    },

    {
      path: 'politicas/terminos',
      loadComponent: () => import('./components/public/legal-terminos/legal-terminos.component').then((m) => m.LegalTerminosComponent),
      title: 'Términos y condiciones'
    },

    {
      path: 'politicas/privacidad',
      loadComponent: () => import('./components/public/legal-privacidad/legal-privacidad.component').then((m) => m.LegalPrivacidadComponent),
      title: 'Política de privacidad'
    },

    {
      path: 'politicas/devoluciones',
      loadComponent: () => import('./components/public/legal-devoluciones/legal-devoluciones.component').then((m) => m.LegalDevolucionesComponent),
      title: 'Política de devoluciones'
    },

    {
      path: 'politicas/libro-reclamaciones',
      loadComponent: () =>
        import('./components/public/legal-libro-reclamaciones/legal-libro-reclamaciones.component').then(
          (m) => m.LegalLibroReclamacionesComponent
        ),
      title: 'Libro de reclamaciones'
    },

    { path:'login-empresa', 
        loadComponent: () => import('./components/login-empresa/login-empresa.component').then((m) => m.LoginEmpresaComponent),
        title: 'Login Empresa',
     },

    {
      path: 'planes',
      loadComponent: () => import('./components/public/planes-public/planes-public.component').then((m) => m.PlanesPublicComponent),
      title: 'Planes y precios | EFAFERP'
    },

    {
      path: 'suscribirse/:planCode',
      loadComponent: () => import('./components/public/checkout-suscripcion/checkout-suscripcion.component').then((m) => m.CheckoutSuscripcionComponent),
      title: 'Contratar plan | EFAFERP'
    },

    { path: 'recuperar-password',
        loadComponent: () => import('./components/recuperar-password/recuperar-password.component').then((m) => m.RecuperarPasswordComponent),
        title: 'Recuperar contraseña',
     },

     {
        path:'crear-empresa',
        loadComponent: () => import('./components/empresa/create-empresa/create-empresa.component').then((m) => m.CreateEmpresaComponent),
        title: 'Crear empresa | EFAFERP',
     },

     {
        path: 'verificar-empresa',
        loadComponent: () => import('./components/empresa/verificar-empresa/verificar-empresa.component').then((m) => m.VerificarEmpresaComponent),
        title: 'Verificar Empresa',
     },

     {
      path: 'sidebar',
      loadComponent: () => import('./components/sidebar/sidebar.component').then((m) => m.SidebarComponent),
      title: 'Sidebar',
     },

  {
    path: '',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./layouts/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [

     {
        path: 'empresa',
        loadComponent: () => import('./components/empresa/index-empresa/index-empresa.component').then((m) => m.IndexEmpresaComponent),
        canActivate: [superAdminPlataformaEmpresasGuard, empresaGestoraGuard, saasPlanModuloGuard],
        title: 'Empresas'
     },

     {
        path: 'libro-reclamaciones',
        loadComponent: () =>
          import('./components/plataforma/index-libro-reclamaciones/index-libro-reclamaciones.component').then(
            (m) => m.IndexLibroReclamacionesComponent
          ),
        canActivate: [superAdminPlataformaEmpresasGuard, empresaGestoraGuard],
        title: 'Libro de reclamaciones'
     },

     {
        path: 'pagos-suscripcion',
        loadComponent: () =>
          import('./components/plataforma/pagos-suscripcion-manual/pagos-suscripcion-manual.component').then(
            (m) => m.PagosSuscripcionManualComponent
          ),
        canActivate: [superAdminPlataformaEmpresasGuard, empresaGestoraGuard],
        title: 'Pagos manuales de suscripción'
     },

     {
        path: 'editar-empresa',
        loadComponent: () => import('./components/empresa/update-empresa/update-empresa.component').then((m) => m.UpdateEmpresaComponent),
        canActivate: [empresaGestoraGuard, saasPlanModuloGuard],
        title: 'Editar Empresa',
    },

     {
      path: 'home',
      loadComponent: () => import('./components/inicio/inicio.component').then((m) => m.InicioComponent),
      canActivate: [empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Inicio',
     },

     {
      path: 'colaborador',
      loadComponent: () => import('./components/colaboradores/index-colaborador/index-colaborador.component').then((m) => m.IndexColaboradorComponent),
      canActivate: [empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Colaboradores',
     },

     {
      path: 'colaborador/create',
      loadComponent: () => import('./components/colaboradores/create-colaborador/create-colaborador.component').then((m) => m.CreateColaboradorComponent),
      canActivate: [empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Crear Colaborador',
     },

     {
      path: 'colaborador/:id',
      loadComponent: () => import('./components/colaboradores/update-colaborador/update-colaborador.component').then((m) => m.UpdateColaboradorComponent),
      canActivate: [empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Actualizar Colaborador',
     },

     {
      path: 'productos',
      loadComponent: () => import('./components/productos/index-producto/index-producto.component').then((m) => m.IndexProductoComponent),
      canActivate: [empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Productos',
     },

     {
      path: 'productos/create',
      loadComponent: () => import('./components/productos/create-producto/create-producto.component').then((m) => m.CreateProductoComponent),
      canActivate: [empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Crear Producto',
     },

     {
      path: 'productos/importar',
      loadComponent: () => import('./components/productos/importar-productos-wizard/importar-productos-wizard.component').then((m) => m.ImportarProductosWizardComponent),
      canActivate: [empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Importar productos',
     },

     {
      path: 'productos/codigos-sunat',
      loadComponent: () =>
        import('./components/productos/codigos-sunat-productos/codigos-sunat-productos.component').then(
          (m) => m.CodigosSunatProductosComponent
        ),
      canActivate: [empresaGestoraGuard, saasPlanModuloGuard, AdminGuard],
      title: 'Códigos SUNAT productos',
     },

     {
      path: 'categorias',
      loadComponent: () => import('./components/categorias/index-categoria/index-categoria.component').then((m) => m.IndexCategoriaComponent),
      canActivate: [empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Categorias',
     },

     {
      path: 'categorias/create',
      loadComponent: () => import('./components/categorias/create-categoria/create-categoria.component').then((m) => m.CreateCategoriaComponent),
      canActivate: [empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Crear Categoria',
     },

     { path: 'marcas', loadComponent: () => import('./components/marcas/index-marca/index-marca.component').then((m) => m.IndexMarcaComponent),canActivate: [empresaGestoraGuard, saasPlanModuloGuard],title: 'Marcas'},

     {path: 'marcas/create', loadComponent: () => import('./components/marcas/create-marca/create-marca.component').then((m) => m.CreateMarcaComponent),canActivate: [empresaGestoraGuard, saasPlanModuloGuard],title: 'Crear Marca'},


     { path: 'rol', loadComponent: () => import('./components/roles/index-rol/index-rol.component').then((m) => m.IndexRolComponent),canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Roles'},

     { path: 'rol/create', loadComponent: () => import('./components/roles/create-rol/create-rol.component').then((m) => m.CreateRolComponent),canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Crear Rol'},

     { path: 'rol/:id', loadComponent: () => import('./components/roles/update-rol/update-rol.component').then((m) => m.UpdateRolComponent),canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Actualizar Rol'},


     //sucursales
     { path: 'sucursal',loadComponent: () => import('./components/sucursal/index-sucursal/index-sucursal.component').then((m) => m.IndexSucursalComponent),canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Sucursales' },

     //{ path: 'sucursal/create', loadComponent: () => import('./components/sucursal/create-sucursal/create-sucursal.component').then((m) => m.CreateSucursalComponent), title: 'Crear Sucursal' },
     {path: 'sucursal/:id', loadComponent: () => import('./components/sucursal/update-sucursal/update-sucursal.component').then((m) => m.UpdateSucursalComponent),canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Actualizar Sucursal'},


     //compras (ruta fija antes de :id)
     { path: 'compras', loadComponent: () => import('./components/compras/index-compras/index-compras.component').then((m) => m.IndexComprasComponent),canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Compras' },

     { path: 'compras/create', loadComponent: () => import('./components/compras/create-compras/create-compras.component').then((m) => m.CreateComprasComponent),canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Crear Compra' },

     { path: 'compras/comprobantes-sunat', loadComponent: () => import('./components/compras/index-comprobantes-compra-sunat/index-comprobantes-compra-sunat.component').then((m) => m.IndexComprobantesCompraSunatComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Compras SUNAT' },

     { path: 'compras/reporte-detallado', loadComponent: () => import('./components/compras/reporte-compras-detallado/reporte-compras-detallado.component').then((m) => m.ReporteComprasDetalladoComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Reporte detallado de compras' },

     { path: 'compras/:id', loadComponent: () => import('./components/compras/update-compras/update-compras.component').then((m) => m.UpdateComprasComponent),canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Actualizar Compra' },

     { path: 'detalle-compras', loadComponent: () => import('./components/compras/detalle-compras/detalle-compras.component').then((m) => m.DetalleComprasComponent),canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Detalle Compra' },

     { path: 'inventario', loadComponent: () => import('./components/inventarios/principal-inventario/principal-inventario.component').then((m) => m.PrincipalInventarioComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Inventario'},

     { path: 'inventario/stock-actual', loadComponent: () => import('./components/inventario/stock-actual/stock-actual.component').then((m) => m.StockActualComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Stock actual' },

     { path: 'inventario/conteo-fisico', loadComponent: () => import('./components/inventario/conteo-fisico/conteo-fisico.component').then((m) => m.ConteoFisicoComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Conteo físico' },

     { path: 'inventario/productos-vendidos', loadComponent: () => import('./components/inventario/productos-vendidos/productos-vendidos.component').then((m) => m.ProductosVendidosComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Productos vendidos' },

     { path: 'inventario/productos-comprados', loadComponent: () => import('./components/inventario/productos-comprados/productos-comprados.component').then((m) => m.ProductosCompradosComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Productos comprados' },

     { path: 'inventario/ingreso-salida', redirectTo: 'inventario/ingresos', pathMatch: 'full' },

     { path: 'inventario/ingresos', loadComponent: () => import('./components/inventario/movimiento-inventario/ingreso-inventario.component').then((m) => m.IngresoInventarioComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Ingresos de inventario' },

     { path: 'inventario/salidas', loadComponent: () => import('./components/inventario/movimiento-inventario/salida-inventario.component').then((m) => m.SalidaInventarioComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Salidas de inventario' },


     { path: 'clientes', loadComponent: () => import('./components/clientes/index-clientes/index-clientes.component').then((m) => m.IndexClientesComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Clientes'},

     { path: 'cliente/create', loadComponent: () => import('./components/clientes/create-clientes/create-clientes.component').then((m) => m.CreateClientesComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Crear Cliente'},

     { path: 'cliente/:id', loadComponent: () => import('./components/clientes/update-clientes/update-clientes.component').then((m) => m.UpdateClientesComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Actualizar Cliente'},


     { path: 'despachos', loadComponent: () => import('./components/despachos/index-despachos/index-despachos.component').then((m) => m.IndexDespachosComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Despachos'},

     { path: 'despachos/create', loadComponent: () => import('./components/despachos/create-despachos/create-despachos.component').then((m) => m.CreateDespachosComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Crear Despacho'},

     { path: 'despachos/create/:idVenta', loadComponent: () => import('./components/despachos/create-despachos/create-despachos.component').then((m) => m.CreateDespachosComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Crear Despacho'},


    { path: 'envios', loadComponent: () => import('./components/envios/index-envios/index-envios.component').then((m) => m.IndexEnviosComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Envios programados'},

    { path: 'envios/mis-envios', loadComponent: () => import('./components/envios/mis-envios-chofer/mis-envios-chofer.component').then((m) => m.MisEnviosChoferComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Mis envíos (Chofer)' },


     { path: 'programaciones', loadComponent: () => import('./components/programaciones/index-programacion/index-programacion.component').then((m) => m.IndexProgramacionComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Programaciones' },

     { path: 'programacion/create',loadComponent: () => import('./components/programaciones/create-programacion/create-programacion.component').then((m) => m.CreateProgramacionComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Crear Programacion'},

     { path: 'programacion/:id', loadComponent: () => import('./components/programaciones/update-programacion/update-programacion.component').then((m) => m.UpdateProgramacionComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Actualizar Programacion'},


     {
      path: 'ventas',
      loadComponent: () => import('./components/ventas/ventas-container/ventas-container.component').then((m) => m.VentasContainerComponent),
      canActivate: [empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Ventas',
      children: [
        { path: '', loadComponent: () => import('./components/ventas/index-ventas/index-ventas.component').then((m) => m.IndexVentasComponent), title: 'Resumen de ventas' },
        { path: 'create', loadComponent: () => import('./components/ventas/create-ventas/create-ventas.component').then((m) => m.CreateVentasComponent), title: 'Crear nueva venta' },
        { path: 'rapida', loadComponent: () => import('./components/ventas/create-venta-rapida/create-venta-rapida.component').then((m) => m.CreateVentaRapidaComponent), title: 'Venta rápida' },
        { path: 'detalle/:id', loadComponent: () => import('./components/ventas/detalle-venta/detalle-venta.component').then((m) => m.DetalleVentaComponent), title: 'Detalle de venta' },
        { path: 'editar/:id', loadComponent: () => import('./components/ventas/update-venta/update-venta.component').then((m) => m.UpdateVentaComponent), title: 'Editar venta' },
        { path: 'reporte-detallado', loadComponent: () => import('./components/ventas/reporte-ventas-detallado/reporte-ventas-detallado.component').then((m) => m.ReporteVentasDetalladoComponent), title: 'Reporte detallado de ventas' },
      ]
    },


     { path: 'hotel/configuracion', loadComponent: () => import('./components/hotel/hotel-configuracion/hotel-configuracion.component').then((m) => m.HotelConfiguracionComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Configuración Hotel' },


     { path: 'cotizaciones', loadComponent: () => import('./components/cotizaciones/index-cotizaciones/index-cotizaciones.component').then((m) => m.IndexCotizacionesComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Cotizaciones' },

     { path: 'cotizaciones/editar/:id', loadComponent: () => import('./components/cotizaciones/update-cotizacion/update-cotizacion.component').then((m) => m.UpdateCotizacionComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Editar cotización' },

     { path: 'cotizaciones/:id', loadComponent: () => import('./components/cotizaciones/detalle-cotizacion/detalle-cotizacion.component').then((m) => m.DetalleCotizacionComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Detalle cotización' },


     { path: 'proveedores',loadComponent: () => import('./components/proveedores/index-proveedor/index-proveedor.component').then((m) => m.IndexProveedorComponent),canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Proveedores' },

     { path: 'proveedores/create', loadComponent: () => import('./components/proveedores/create-proveedor/create-proveedor.component').then((m) => m.CreateProveedorComponent),canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Crear Proveedor' },

     { path: 'proveedores/:id', loadComponent: () => import('./components/proveedores/update-proveedor/update-proveedor.component').then((m) => m.UpdateProveedorComponent),canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Actualizar Proveedor' },


     {path: 'precios', loadComponent: () => import('./components/preciosV/create-precios/create-precios.component').then((m) => m.CreatePreciosComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Crear Precio Venta' },


     { path: 'inventario/lotes', loadComponent: () => import('./components/inventario/lote-list/lote-list.component').then((m) => m.LoteListComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Lotes de Inventario' },

     { path: 'inventario/lotes/nuevo', loadComponent: () => import('./components/inventario/lote-form/lote-form.component').then((m) => m.LoteFormComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Nuevo Lote de Inventario' },

     { path: 'inventario/lotes/editar/:id', loadComponent: () => import('./components/inventario/lote-form/lote-form.component').then((m) => m.LoteFormComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Editar Lote de Inventario' },

     { path: 'inventario/ubicaciones', loadComponent: () => import('./components/inventario/ubicacion-prioridad-list/ubicacion-prioridad-list.component').then((m) => m.UbicacionPrioridadListComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Ubicaciones con Prioridad' },

     { path: 'inventario/movimientos', loadComponent: () => import('./components/inventario/lista-movimientos-inventario/lista-movimientos-inventario.component').then((m) => m.ListaMovimientosInventarioComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Movimientos' },

     { path: 'inventario/movimiento-entre-ubicaciones', loadComponent: () => import('./components/inventario/movimiento-ubicacion/movimiento-ubicacion.component').then((m) => m.MovimientoUbicacionComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Movimiento entre ubicaciones' },

     { path: 'inventario/kardex', loadComponent: () => import('./components/inventario/kardex/kardex.component').then((m) => m.KardexComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Kardex' },

     { path: 'inventario/venta-rapida', loadComponent: () => import('./components/inventario/venta-por-prioridad/venta-por-prioridad.component').then((m) => m.VentaPorPrioridadComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Venta por Prioridad' },

     { path: 'inventario/asignaciones', loadComponent: () => import('./components/inventario/asignar-stock-ubicacion/asignar-stock-ubicacion.component').then((m) => m.AsignarStockUbicacionComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Asignaciones de Stock' },


     // Nuevos módulos
     { path: 'caja', loadComponent: () => import('./components/caja/index-caja/index-caja.component').then((m) => m.IndexCajaComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Gestión de Caja' },

     { path: 'caja/arqueo', loadComponent: () => import('./components/caja/arqueo-caja/arqueo-caja.component').then((m) => m.ArqueoCajaComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Arqueo de Caja' },

     { path: 'caja/pago-proveedores', loadComponent: () => import('./components/caja/pago-proveedores/pago-proveedores.component').then((m) => m.PagoProveedoresComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Pago a Proveedores' },

     { path: 'caja/recibo-ingreso', loadComponent: () => import('./components/caja/recibo-ingreso/recibo-ingreso.component').then((m) => m.ReciboIngresoComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Recibo de Ingreso' },

     { path: 'caja/recibo-egreso', loadComponent: () => import('./components/caja/recibo-egreso/recibo-egreso.component').then((m) => m.ReciboEgresoComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Recibo de Egreso' },

     { path: 'caja/conteo-dinero', loadComponent: () => import('./components/caja/conteo-dinero/conteo-dinero.component').then((m) => m.ConteoDineroComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Conteo de Dinero' },

     { path: 'caja/ventas-pendientes-pago', loadComponent: () => import('./components/caja/ventas-pendientes-pago/ventas-pendientes-pago.component').then((m) => m.VentasPendientesPagoComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Ventas pendientes de pago' },

     { path: 'creditos', loadComponent: () => import('./components/creditos/index-creditos/index-creditos.component').then((m) => m.IndexCreditosComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Créditos y Cuotas' },

     { path: 'analisis', loadComponent: () => import('./components/analisis/dashboard-analisis/dashboard-analisis.component').then((m) => m.DashboardAnalisisComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Análisis Financiero' },

     { path: 'configuracion', loadComponent: () => import('./components/configuracion/index-configuracion/index-configuracion.component').then((m) => m.IndexConfiguracionComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Configuración del Sistema' },

     { path: 'cuenta/suscripcion', loadComponent: () => import('./components/cuenta/mi-suscripcion/mi-suscripcion.component').then((m) => m.MiSuscripcionComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Mi suscripción' },

     { path: 'configuracion/integraciones', loadComponent: () => import('./components/configuracion/integraciones/integraciones.component').then((m) => m.IntegracionesComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Integraciones y APIs de pago' },

     { path: 'configuracion/sesiones', loadComponent: () => import('./components/configuracion/mis-sesiones-dispositivos/mis-sesiones-dispositivos.component').then((m) => m.MisSesionesDispositivosComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Sesiones y dispositivos' },

     { path: 'configuracion/whatsapp', loadComponent: () => import('./components/configuracion/whatsapp-vincular/whatsapp-vincular.component').then((m) => m.WhatsappVincularComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Vincular WhatsApp' },

     { path: 'configuracion/whatsapp-bot', loadComponent: () => import('./components/configuracion/whatsapp-bot/whatsapp-bot.component').then((m) => m.WhatsappBotComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Bot WhatsApp' },

     { path: 'rubros', loadComponent: () => import('./components/rubros/index-rubros/index-rubros.component').then((m) => m.IndexRubrosComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Configuración por rubro' },

     { path: 'vales-despacho', loadComponent: () => import('./components/vales-despacho/index-vales-despacho/index-vales-despacho.component').then((m) => m.IndexValesDespachoComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Vales de despacho' },

    { path: 'vales-despacho/nuevo', loadComponent: () => import('./components/vales-despacho/create-vale-despacho/create-vale-despacho.component').then((m) => m.CreateValeDespachoComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Nuevo vale de despacho' },

     { path: 'reportes', loadComponent: () => import('./components/reportes/index-reportes/index-reportes.component').then((m) => m.IndexReportesComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Reportes y Análisis' },

    { path: 'utilidades', loadComponent: () => import('./components/utilidades/index-utilidades/index-utilidades.component').then((m) => m.IndexUtilidadesComponent), canActivate: [AdminGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Utilidades' },


     // Catálogos
     { path: 'catalogos/forma-pago', loadComponent: () => import('./components/catalogos/forma-pago/index-forma-pago.component').then((m) => m.IndexFormaPagoComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Forma Pago' },

     { path: 'catalogos/tipo-movimientos', loadComponent: () => import('./components/catalogos/tipo-movimientos/index-tipo-movimientos.component').then((m) => m.IndexTipoMovimientosComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Tipo Movimientos' },

     { path: 'catalogos/conceptos', loadComponent: () => import('./components/catalogos/conceptos/index-conceptos.component').then((m) => m.IndexConceptosComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Conceptos' },

     { path: 'catalogos/clasificacion-conceptos', loadComponent: () => import('./components/catalogos/clasificacion-conceptos/index-clasificacion-conceptos.component').then((m) => m.IndexClasificacionConceptosComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Clasificación Conceptos' },

     { path: 'catalogos/motivo-traslado', loadComponent: () => import('./components/catalogos/motivo-traslado/index-motivo-traslado.component').then((m) => m.IndexMotivoTrasladoComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Motivo Traslado' },

     { path: 'catalogos/motivo-nota-credito', loadComponent: () => import('./components/catalogos/motivo-nota-credito/index-motivo-nota-credito.component').then((m) => m.IndexMotivoNotaCreditoComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Motivo Nota Credito' },

     { path: 'facturacion/resumenes-diarios', loadComponent: () => import('./components/facturacion/resumenes-diarios/resumenes-diarios.component').then((m) => m.ResumenesDiariosComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Resúmenes diarios SUNAT' },

    { path: 'facturacion/notas-credito-debito', loadComponent: () => import('./components/facturacion/notas-credito-debito/notas-credito-debito.component').then((m) => m.NotasCreditoDebitoComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Emisión de notas' },

    { path: 'facturacion/comunicacion-baja', loadComponent: () => import('./components/facturacion/comunicacion-baja/comunicacion-baja.component').then((m) => m.ComunicacionBajaComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Comunicación de baja' },

    { path: 'facturacion/emision-guias', loadComponent: () => import('./components/facturacion/emision-guias/emision-guias.component').then((m) => m.EmisionGuiasComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Emisión de guías' },

    { path: 'facturacion/guias/configuracion', loadComponent: () => import('./components/facturacion/guias-configuracion/guias-configuracion.component').then((m) => m.GuiasConfiguracionComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Configuración de guías' },

    { path: 'facturacion/guias-remision', loadComponent: () => import('./components/facturacion/guias-remision/guias-remision.component').then((m) => m.GuiasRemisionComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Guías de remisión' },

    { path: 'facturacion/guias-transportista', loadComponent: () => import('./components/facturacion/guias-transportista/guias-transportista.component').then((m) => m.GuiasTransportistaComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Guías transportista' },

  { path: 'auditoria', loadComponent: () => import('./components/auditoria/log-auditoria/log-auditoria.component').then((m) => m.LogAuditoriaComponent), canActivate: [empresaGestoraGuard, saasPlanModuloGuard], title: 'Log de auditoría' }
    ]
  }

];
