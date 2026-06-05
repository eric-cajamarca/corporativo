import { Routes } from '@angular/router';
import { LoginEmpresaComponent } from './components/login-empresa/login-empresa.component';
import { RecuperarPasswordComponent } from './components/recuperar-password/recuperar-password.component';
import { IndexEmpresaComponent } from './components/empresa/index-empresa/index-empresa.component';
import { CreateEmpresaComponent } from './components/empresa/create-empresa/create-empresa.component';
import { VerificarEmpresaComponent } from './components/empresa/verificar-empresa/verificar-empresa.component';
import { UpdateEmpresaComponent } from './components/empresa/update-empresa/update-empresa.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { InicioComponent } from './components/inicio/inicio.component';
import { IndexColaboradorComponent } from './components/colaboradores/index-colaborador/index-colaborador.component';
import { CreateColaboradorComponent } from './components/colaboradores/create-colaborador/create-colaborador.component';
import { UpdateColaboradorComponent } from './components/colaboradores/update-colaborador/update-colaborador.component';
import { IndexProductoComponent } from './components/productos/index-producto/index-producto.component';
import { CreateProductoComponent } from './components/productos/create-producto/create-producto.component';
import { IndexCategoriaComponent } from './components/categorias/index-categoria/index-categoria.component';
import { CreateCategoriaComponent } from './components/categorias/create-categoria/create-categoria.component';
import { IndexMarcaComponent } from './components/marcas/index-marca/index-marca.component';
import { IndexRolComponent } from './components/roles/index-rol/index-rol.component';
import { CreateRolComponent } from './components/roles/create-rol/create-rol.component';
import { UpdateRolComponent } from './components/roles/update-rol/update-rol.component';
import { CreateMarcaComponent } from './components/marcas/create-marca/create-marca.component';
import { IndexSucursalComponent } from './components/sucursal/index-sucursal/index-sucursal.component';
import { CreateSucursalComponent } from './components/sucursal/create-sucursal/create-sucursal.component';
import { UpdateSucursalComponent } from './components/sucursal/update-sucursal/update-sucursal.component';
import { IndexComprasComponent } from './components/compras/index-compras/index-compras.component';
import { CreateComprasComponent } from './components/compras/create-compras/create-compras.component';
import { UpdateComprasComponent } from './components/compras/update-compras/update-compras.component';
import { DetalleComprasComponent } from './components/compras/detalle-compras/detalle-compras.component';
import { IndexComprobantesCompraSunatComponent } from './components/compras/index-comprobantes-compra-sunat/index-comprobantes-compra-sunat.component';
import { IndexClientesComponent } from './components/clientes/index-clientes/index-clientes.component';
import { UpdateClientesComponent } from './components/clientes/update-clientes/update-clientes.component';
import { CreateClientesComponent } from './components/clientes/create-clientes/create-clientes.component';
import { IndexDespachosComponent } from './components/despachos/index-despachos/index-despachos.component';
import { CreateDespachosComponent } from './components/despachos/create-despachos/create-despachos.component';
import { IndexProgramacionComponent } from './components/programaciones/index-programacion/index-programacion.component';
import { CreateProgramacionComponent } from './components/programaciones/create-programacion/create-programacion.component';
import { UpdateProgramacionComponent } from './components/programaciones/update-programacion/update-programacion.component';
import { VentasContainerComponent } from './components/ventas/ventas-container/ventas-container.component';
import { IndexVentasComponent } from './components/ventas/index-ventas/index-ventas.component';
import { CreateVentasComponent } from './components/ventas/create-ventas/create-ventas.component';
import { CreateVentaRapidaComponent } from './components/ventas/create-venta-rapida/create-venta-rapida.component';
import { DetalleVentaComponent } from './components/ventas/detalle-venta/detalle-venta.component';
import { UpdateVentaComponent } from './components/ventas/update-venta/update-venta.component';
import { IndexCotizacionesComponent } from './components/cotizaciones/index-cotizaciones/index-cotizaciones.component';
import { DetalleCotizacionComponent } from './components/cotizaciones/detalle-cotizacion/detalle-cotizacion.component';
import { UpdateCotizacionComponent } from './components/cotizaciones/update-cotizacion/update-cotizacion.component';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guards';
import { empresaGestoraGuard } from './guards/empresa-gestora.guard';
import { superAdminPlataformaEmpresasGuard } from './guards/superadmin-plataforma-empresas.guard';
import { saasPlanModuloGuard } from './guards/saas-plan-modulo.guard';
import { IndexProveedorComponent } from './components/proveedores/index-proveedor/index-proveedor.component';
import { CreateProveedorComponent } from './components/proveedores/create-proveedor/create-proveedor.component';
import { UpdateProveedorComponent } from './components/proveedores/update-proveedor/update-proveedor.component';
import { PrincipalInventarioComponent } from './components/inventarios/principal-inventario/principal-inventario.component';
import { CreatePreciosComponent } from './components/preciosV/create-precios/create-precios.component';
import { LoteListComponent } from './components/inventario/lote-list/lote-list.component';
import { LoteFormComponent } from './components/inventario/lote-form/lote-form.component';
import { UbicacionPrioridadListComponent } from './components/inventario/ubicacion-prioridad-list/ubicacion-prioridad-list.component';
import { MovimientoUbicacionComponent } from './components/inventario/movimiento-ubicacion/movimiento-ubicacion.component';
import { ListaMovimientosInventarioComponent } from './components/inventario/lista-movimientos-inventario/lista-movimientos-inventario.component';
import { VentaPorPrioridadComponent } from './components/inventario/venta-por-prioridad/venta-por-prioridad.component';
import { AsignarStockUbicacionComponent } from './components/inventario/asignar-stock-ubicacion/asignar-stock-ubicacion.component';
import { IngresoInventarioComponent } from './components/inventario/movimiento-inventario/ingreso-inventario.component';
import { SalidaInventarioComponent } from './components/inventario/movimiento-inventario/salida-inventario.component';
import { KardexComponent } from './components/inventario/kardex/kardex.component';
import { StockActualComponent } from './components/inventario/stock-actual/stock-actual.component';
import { ConteoFisicoComponent } from './components/inventario/conteo-fisico/conteo-fisico.component';
import { ProductosVendidosComponent } from './components/inventario/productos-vendidos/productos-vendidos.component';
import { ProductosCompradosComponent } from './components/inventario/productos-comprados/productos-comprados.component';
import { IndexCajaComponent } from './components/caja/index-caja/index-caja.component';
import { IndexCreditosComponent } from './components/creditos/index-creditos/index-creditos.component';
import { ArqueoCajaComponent } from './components/caja/arqueo-caja/arqueo-caja.component';
import { DashboardAnalisisComponent } from './components/analisis/dashboard-analisis/dashboard-analisis.component';
import { IndexConfiguracionComponent } from './components/configuracion/index-configuracion/index-configuracion.component';
import { IntegracionesComponent } from './components/configuracion/integraciones/integraciones.component';
import { MisSesionesDispositivosComponent } from './components/configuracion/mis-sesiones-dispositivos/mis-sesiones-dispositivos.component';
import { WhatsappVincularComponent } from './components/configuracion/whatsapp-vincular/whatsapp-vincular.component';
import { WhatsappBotComponent } from './components/configuracion/whatsapp-bot/whatsapp-bot.component';
import { IndexReportesComponent } from './components/reportes/index-reportes/index-reportes.component';
import { IndexUtilidadesComponent } from './components/utilidades/index-utilidades/index-utilidades.component';
import { PagoProveedoresComponent } from './components/caja/pago-proveedores/pago-proveedores.component';
import { ReciboIngresoComponent } from './components/caja/recibo-ingreso/recibo-ingreso.component';
import { ReciboEgresoComponent } from './components/caja/recibo-egreso/recibo-egreso.component';
import { ConteoDineroComponent } from './components/caja/conteo-dinero/conteo-dinero.component';
import { VentasPendientesPagoComponent } from './components/caja/ventas-pendientes-pago/ventas-pendientes-pago.component';
import { IndexFormaPagoComponent } from './components/catalogos/forma-pago/index-forma-pago.component';
import { IndexTipoMovimientosComponent } from './components/catalogos/tipo-movimientos/index-tipo-movimientos.component';
import { IndexClasificacionConceptosComponent } from './components/catalogos/clasificacion-conceptos/index-clasificacion-conceptos.component';
import { IndexConceptosComponent } from './components/catalogos/conceptos/index-conceptos.component';
import { IndexMotivoTrasladoComponent } from './components/catalogos/motivo-traslado/index-motivo-traslado.component';
import { IndexMotivoNotaCreditoComponent } from './components/catalogos/motivo-nota-credito/index-motivo-nota-credito.component';
import { ResumenesDiariosComponent } from './components/facturacion/resumenes-diarios/resumenes-diarios.component';
import { NotasCreditoDebitoComponent } from './components/facturacion/notas-credito-debito/notas-credito-debito.component';
import { ComunicacionBajaComponent } from './components/facturacion/comunicacion-baja/comunicacion-baja.component';
import { GuiasRemisionComponent } from './components/facturacion/guias-remision/guias-remision.component';
import { GuiasConfiguracionComponent } from './components/facturacion/guias-configuracion/guias-configuracion.component';
import { GuiasTransportistaComponent } from './components/facturacion/guias-transportista/guias-transportista.component';
import { EmisionGuiasComponent } from './components/facturacion/emision-guias/emision-guias.component';
import { LogAuditoriaComponent } from './components/auditoria/log-auditoria/log-auditoria.component';
import { IndexRubrosComponent } from './components/rubros/index-rubros/index-rubros.component';
import { IndexValesDespachoComponent } from './components/vales-despacho/index-vales-despacho/index-vales-despacho.component';
import { CreateValeDespachoComponent } from './components/vales-despacho/create-vale-despacho/create-vale-despacho.component';
import { MisEnviosChoferComponent } from './components/envios/mis-envios-chofer/mis-envios-chofer.component';
import { IndexEnviosComponent } from './components/envios/index-envios/index-envios.component';
import { PlanesPublicComponent } from './components/public/planes-public/planes-public.component';
import { CheckoutSuscripcionComponent } from './components/public/checkout-suscripcion/checkout-suscripcion.component';
import { MiSuscripcionComponent } from './components/cuenta/mi-suscripcion/mi-suscripcion.component';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'home',
         title: 'Inicio',
        pathMatch: 'full'
    },
    { path:'login-empresa', 
        component: LoginEmpresaComponent,
        title: 'Login Empresa',
     },
    {
      path: 'planes',
      component: PlanesPublicComponent,
      title: 'Planes y precios'
    },
    {
      path: 'suscribirse/:planCode',
      component: CheckoutSuscripcionComponent,
      title: 'Contratar plan'
    },
    { path: 'recuperar-password',
        component: RecuperarPasswordComponent,
        title: 'Recuperar contraseña',
     },
     {
        path: 'empresa',
        component: IndexEmpresaComponent,
        canActivate: [AuthGuard, superAdminPlataformaEmpresasGuard, empresaGestoraGuard, saasPlanModuloGuard],
        title: 'Empresas'
     },
     {
        path:'crear-empresa',
        component: CreateEmpresaComponent,
        title: 'Crear Empresa',
     },
     {
        path: 'verificar-empresa',
        component: VerificarEmpresaComponent,
        title: 'Verificar Empresa',
     },
     {
        path: 'editar-empresa',
        component: UpdateEmpresaComponent,
        canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard],
        title: 'Editar Empresa',
    },
     {
      path: 'sidebar',
      component: SidebarComponent,
      title: 'Sidebar',
     },
     {
      path: 'home',
      component: InicioComponent,
      canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Inicio',
     },
     {
      path: 'colaborador',
      component: IndexColaboradorComponent,
      canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Colaboradores',
     },
     {
      path: 'colaborador/create',
      component: CreateColaboradorComponent,
      canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Crear Colaborador',
     },
     {
      path: 'colaborador/:id',
      component: UpdateColaboradorComponent,
      canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Actualizar Colaborador',
     },
     {
      path: 'productos',
      component: IndexProductoComponent,
      canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Productos',
     },
     {
      path: 'productos/create',
      component: CreateProductoComponent,
      canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Crear Producto',
     },
     {
      path: 'categorias',
      component: IndexCategoriaComponent,
      canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Categorias',
     },
     {
      path: 'categorias/create',
      component: CreateCategoriaComponent,
      canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Crear Categoria',
     },
     { path: 'marcas', component: IndexMarcaComponent,canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard],title: 'Marcas'},
     {path: 'marcas/create', component: CreateMarcaComponent,canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard],title: 'Crear Marca'},

     { path: 'rol', component: IndexRolComponent,canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Roles'},
     { path: 'rol/create', component: CreateRolComponent,canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Crear Rol'},
     { path: 'rol/:id', component: UpdateRolComponent,canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Actualizar Rol'},

     //sucursales
     { path: 'sucursal',component: IndexSucursalComponent,canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Sucursales' },
     //{ path: 'sucursal/create', component: CreateSucursalComponent, title: 'Crear Sucursal' },
     {path: 'sucursal/:id', component: UpdateSucursalComponent,canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Actualizar Sucursal'},

     //compras (ruta fija antes de :id)
     { path: 'compras', component: IndexComprasComponent,canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Compras' },
     { path: 'compras/create', component: CreateComprasComponent,canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Crear Compra' },
     { path: 'compras/comprobantes-sunat', component: IndexComprobantesCompraSunatComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Compras SUNAT' },
     { path: 'compras/:id', component: UpdateComprasComponent,canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Actualizar Compra' },
     { path: 'detalle-compras', component: DetalleComprasComponent,canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Detalle Compra' },
     { path: 'inventario', component: PrincipalInventarioComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Inventario'},
     { path: 'inventario/stock-actual', component: StockActualComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Stock actual' },
     { path: 'inventario/conteo-fisico', component: ConteoFisicoComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Conteo físico' },
     { path: 'inventario/productos-vendidos', component: ProductosVendidosComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Productos vendidos' },
     { path: 'inventario/productos-comprados', component: ProductosCompradosComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Productos comprados' },
     { path: 'inventario/ingreso-salida', redirectTo: 'inventario/ingresos', pathMatch: 'full' },
     { path: 'inventario/ingresos', component: IngresoInventarioComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Ingresos de inventario' },
     { path: 'inventario/salidas', component: SalidaInventarioComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Salidas de inventario' },

     { path: 'clientes', component: IndexClientesComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Clientes'},
     { path: 'cliente/create', component: CreateClientesComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Crear Cliente'},
     { path: 'cliente/:id', component: UpdateClientesComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Actualizar Cliente'},

     { path: 'despachos', component: IndexDespachosComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Despachos'},
     { path: 'despachos/create', component: CreateDespachosComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Crear Despacho'},
     { path: 'despachos/create/:idVenta', component: CreateDespachosComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Crear Despacho'},

    { path: 'envios', component: IndexEnviosComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Envios programados'},
    { path: 'envios/mis-envios', component: MisEnviosChoferComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Mis envíos (Chofer)' },

     { path: 'programaciones', component: IndexProgramacionComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Programaciones' },
     { path: 'programacion/create',component: CreateProgramacionComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Crear Programacion'},
     { path: 'programacion/:id', component: UpdateProgramacionComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Actualizar Programacion'},

     {
      path: 'ventas',
      component: VentasContainerComponent,
      canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard],
      title: 'Ventas',
      children: [
        { path: '', component: IndexVentasComponent, title: 'Resumen de ventas' },
        { path: 'create', component: CreateVentasComponent, title: 'Crear nueva venta' },
        { path: 'rapida', component: CreateVentaRapidaComponent, title: 'Venta rápida' },
        { path: 'detalle/:id', component: DetalleVentaComponent, title: 'Detalle de venta' },
        { path: 'editar/:id', component: UpdateVentaComponent, title: 'Editar venta' },
      ]
    },

     { path: 'cotizaciones', component: IndexCotizacionesComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Cotizaciones' },
     { path: 'cotizaciones/editar/:id', component: UpdateCotizacionComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Editar cotización' },
     { path: 'cotizaciones/:id', component: DetalleCotizacionComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Detalle cotización' },

     { path: 'proveedores',component: IndexProveedorComponent,canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Proveedores' },
     { path: 'proveedores/create', component: CreateProveedorComponent,canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Crear Proveedor' },
     { path: 'proveedores/:id', component: UpdateProveedorComponent,canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Actualizar Proveedor' },

     {path: 'precios', component: CreatePreciosComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Crear Precio Venta' },

     { path: 'inventario/lotes', component: LoteListComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Lotes de Inventario' },
     { path: 'inventario/lotes/nuevo', component: LoteFormComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Nuevo Lote de Inventario' },
     { path: 'inventario/lotes/editar/:id', component: LoteFormComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Editar Lote de Inventario' },
     { path: 'inventario/ubicaciones', component: UbicacionPrioridadListComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Ubicaciones con Prioridad' },
     { path: 'inventario/movimientos', component: ListaMovimientosInventarioComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Movimientos' },
     { path: 'inventario/movimiento-entre-ubicaciones', component: MovimientoUbicacionComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Movimiento entre ubicaciones' },
     { path: 'inventario/kardex', component: KardexComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Kardex' },
     { path: 'inventario/venta-rapida', component: VentaPorPrioridadComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Venta por Prioridad' },
     { path: 'inventario/asignaciones', component: AsignarStockUbicacionComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Asignaciones de Stock' },

     // Nuevos módulos
     { path: 'caja', component: IndexCajaComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Gestión de Caja' },
     { path: 'caja/arqueo', component: ArqueoCajaComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Arqueo de Caja' },
     { path: 'caja/pago-proveedores', component: PagoProveedoresComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Pago a Proveedores' },
     { path: 'caja/recibo-ingreso', component: ReciboIngresoComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Recibo de Ingreso' },
     { path: 'caja/recibo-egreso', component: ReciboEgresoComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Recibo de Egreso' },
     { path: 'caja/conteo-dinero', component: ConteoDineroComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Conteo de Dinero' },
     { path: 'caja/ventas-pendientes-pago', component: VentasPendientesPagoComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Ventas pendientes de pago' },
     { path: 'creditos', component: IndexCreditosComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Créditos y Cuotas' },
     { path: 'analisis', component: DashboardAnalisisComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Análisis Financiero' },
     { path: 'configuracion', component: IndexConfiguracionComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Configuración del Sistema' },
     { path: 'cuenta/suscripcion', component: MiSuscripcionComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Mi suscripción' },
     { path: 'configuracion/integraciones', component: IntegracionesComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Integraciones y APIs de pago' },
     { path: 'configuracion/sesiones', component: MisSesionesDispositivosComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Sesiones y dispositivos' },
     { path: 'configuracion/whatsapp', component: WhatsappVincularComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Vincular WhatsApp' },
     { path: 'configuracion/whatsapp-bot', component: WhatsappBotComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Bot WhatsApp' },
     { path: 'rubros', component: IndexRubrosComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Configuración por rubro' },
     { path: 'vales-despacho', component: IndexValesDespachoComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Vales de despacho' },
    { path: 'vales-despacho/nuevo', component: CreateValeDespachoComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Nuevo vale de despacho' },
     { path: 'reportes', component: IndexReportesComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Reportes y Análisis' },
    { path: 'utilidades', component: IndexUtilidadesComponent, canActivate: [AuthGuard, AdminGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Utilidades' },

     // Catálogos
     { path: 'catalogos/forma-pago', component: IndexFormaPagoComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Forma Pago' },
     { path: 'catalogos/tipo-movimientos', component: IndexTipoMovimientosComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Tipo Movimientos' },
     { path: 'catalogos/conceptos', component: IndexConceptosComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Conceptos' },
     { path: 'catalogos/clasificacion-conceptos', component: IndexClasificacionConceptosComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Clasificación Conceptos' },
     { path: 'catalogos/motivo-traslado', component: IndexMotivoTrasladoComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Motivo Traslado' },
     { path: 'catalogos/motivo-nota-credito', component: IndexMotivoNotaCreditoComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Motivo Nota Credito' },
     { path: 'facturacion/resumenes-diarios', component: ResumenesDiariosComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Resúmenes diarios SUNAT' },
    { path: 'facturacion/notas-credito-debito', component: NotasCreditoDebitoComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Emisión de notas' },
    { path: 'facturacion/comunicacion-baja', component: ComunicacionBajaComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Comunicación de baja' },
    { path: 'facturacion/emision-guias', component: EmisionGuiasComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Emisión de guías' },
    { path: 'facturacion/guias/configuracion', component: GuiasConfiguracionComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Configuración de guías' },
    { path: 'facturacion/guias-remision', component: GuiasRemisionComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Guías de remisión' },
    { path: 'facturacion/guias-transportista', component: GuiasTransportistaComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Guías transportista' },
  { path: 'auditoria', component: LogAuditoriaComponent, canActivate: [AuthGuard, empresaGestoraGuard, saasPlanModuloGuard], title: 'Log de auditoría' },
];
