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
import { DetalleVentaComponent } from './components/ventas/detalle-venta/detalle-venta.component';
import { UpdateVentaComponent } from './components/ventas/update-venta/update-venta.component';
import { IndexCotizacionesComponent } from './components/cotizaciones/index-cotizaciones/index-cotizaciones.component';
import { DetalleCotizacionComponent } from './components/cotizaciones/detalle-cotizacion/detalle-cotizacion.component';
import { UpdateCotizacionComponent } from './components/cotizaciones/update-cotizacion/update-cotizacion.component';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guards';
import { IndexProveedorComponent } from './components/proveedores/index-proveedor/index-proveedor.component';
import { CreateProveedorComponent } from './components/proveedores/create-proveedor/create-proveedor.component';
import { UpdateProveedorComponent } from './components/proveedores/update-proveedor/update-proveedor.component';
import { PrincipalInventarioComponent } from './components/inventarios/principal-inventario/principal-inventario.component';
import { CreatePreciosComponent } from './components/preciosV/create-precios/create-precios.component';
import { LoteListComponent } from './components/inventario/lote-list/lote-list.component';
import { LoteFormComponent } from './components/inventario/lote-form/lote-form.component';
import { UbicacionPrioridadListComponent } from './components/inventario/ubicacion-prioridad-list/ubicacion-prioridad-list.component';
import { MovimientoUbicacionComponent } from './components/inventario/movimiento-ubicacion/movimiento-ubicacion.component';
import { VentaPorPrioridadComponent } from './components/inventario/venta-por-prioridad/venta-por-prioridad.component';
import { AsignarStockUbicacionComponent } from './components/inventario/asignar-stock-ubicacion/asignar-stock-ubicacion.component';
import { MovimientoInventarioComponent } from './components/inventario/movimiento-inventario/movimiento-inventario.component';
import { KardexComponent } from './components/inventario/kardex/kardex.component';
import { IndexCajaComponent } from './components/caja/index-caja/index-caja.component';
import { IndexCreditosComponent } from './components/creditos/index-creditos/index-creditos.component';
import { ArqueoCajaComponent } from './components/caja/arqueo-caja/arqueo-caja.component';
import { DashboardAnalisisComponent } from './components/analisis/dashboard-analisis/dashboard-analisis.component';
import { IndexConfiguracionComponent } from './components/configuracion/index-configuracion/index-configuracion.component';
import { IntegracionesComponent } from './components/configuracion/integraciones/integraciones.component';
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
import { LogAuditoriaComponent } from './components/auditoria/log-auditoria/log-auditoria.component';
import { IndexRubrosComponent } from './components/rubros/index-rubros/index-rubros.component';
import { IndexValesDespachoComponent } from './components/vales-despacho/index-vales-despacho/index-vales-despacho.component';
import { CreateValeDespachoComponent } from './components/vales-despacho/create-vale-despacho/create-vale-despacho.component';

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
    { path: 'recuperar-password',
        component: RecuperarPasswordComponent,
        title: 'Recuperar contraseña',
     },
     {
        path: 'empresa',
        component: IndexEmpresaComponent,
        canActivate: [AuthGuard, AdminGuard],
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
        canActivate: [AuthGuard],
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
      canActivate: [AuthGuard],
      title: 'Inicio',
     },
     {
      path: 'colaborador',
      component: IndexColaboradorComponent,
      canActivate: [AuthGuard],
      title: 'Colaboradores',
     },
     {
      path: 'colaborador/create',
      component: CreateColaboradorComponent,
      canActivate: [AuthGuard],
      title: 'Crear Colaborador',
     },
     {
      path: 'colaborador/:id',
      component: UpdateColaboradorComponent,
      canActivate: [AuthGuard],
      title: 'Actualizar Colaborador',
     },
     {
      path: 'productos',
      component: IndexProductoComponent,
      canActivate: [AuthGuard],
      title: 'Productos',
     },
     {
      path: 'productos/create',
      component: CreateProductoComponent,
      canActivate: [AuthGuard],
      title: 'Crear Producto',
     },
     {
      path: 'categorias',
      component: IndexCategoriaComponent,
      canActivate: [AuthGuard],
      title: 'Categorias',
     },
     {
      path: 'categorias/create',
      component: CreateCategoriaComponent,
      canActivate: [AuthGuard],
      title: 'Crear Categoria',
     },
     { path: 'marcas', component: IndexMarcaComponent,canActivate: [AuthGuard],title: 'Marcas'},
     {path: 'marcas/create', component: CreateMarcaComponent,canActivate: [AuthGuard],title: 'Crear Marca'},

     { path: 'rol', component: IndexRolComponent,canActivate: [AuthGuard], title: 'Roles'},
     { path: 'rol/create', component: CreateRolComponent,canActivate: [AuthGuard], title: 'Crear Rol'},
     { path: 'rol/:id', component: UpdateRolComponent,canActivate: [AuthGuard], title: 'Actualizar Rol'},

     //sucursales
     { path: 'sucursal',component: IndexSucursalComponent,canActivate: [AuthGuard], title: 'Sucursales' },
     //{ path: 'sucursal/create', component: CreateSucursalComponent, title: 'Crear Sucursal' },
     {path: 'sucursal/:id', component: UpdateSucursalComponent,canActivate: [AuthGuard], title: 'Actualizar Sucursal'},

     //compras
     { path: 'compras', component: IndexComprasComponent,canActivate: [AuthGuard], title: 'Compras' },
     { path: 'compras/create', component: CreateComprasComponent,canActivate: [AuthGuard], title: 'Crear Compra' },
     { path: 'compras/:id', component: UpdateComprasComponent,canActivate: [AuthGuard], title: 'Actualizar Compra' },
     { path: 'detalle-compras', component: DetalleComprasComponent,canActivate: [AuthGuard], title: 'Detalle Compra' },
     { path: 'inventario', component: PrincipalInventarioComponent, canActivate: [AuthGuard], title: 'Inventario'},
     { path: 'inventario/ingreso-salida', component: MovimientoInventarioComponent, canActivate: [AuthGuard], title: 'Movimiento de inventario' },

     { path: 'clientes', component: IndexClientesComponent, canActivate: [AuthGuard], title: 'Clientes'},
     { path: 'cliente/create', component: CreateClientesComponent, canActivate: [AuthGuard], title: 'Crear Cliente'},
     { path: 'cliente/:id', component: UpdateClientesComponent, canActivate: [AuthGuard], title: 'Actualizar Cliente'},

     { path: 'despachos', component: IndexDespachosComponent, canActivate: [AuthGuard], title: 'Despachos'},
     { path: 'despachos/create', component: CreateDespachosComponent, canActivate: [AuthGuard], title: 'Crear Despacho'},
     { path: 'despachos/create/:idVenta', component: CreateDespachosComponent, canActivate: [AuthGuard], title: 'Crear Despacho'},

     { path: 'programaciones', component: IndexProgramacionComponent, canActivate: [AuthGuard], title: 'Programaciones' },
     { path: 'programacion/create',component: CreateProgramacionComponent, canActivate: [AuthGuard], title: 'Crear Programacion'},
     { path: 'programacion/:id', component: UpdateProgramacionComponent, canActivate: [AuthGuard], title: 'Actualizar Programacion'},

     {
      path: 'ventas',
      component: VentasContainerComponent,
      canActivate: [AuthGuard],
      title: 'Ventas',
      children: [
        { path: '', component: IndexVentasComponent, title: 'Resumen de ventas' },
        { path: 'create', component: CreateVentasComponent, title: 'Crear nueva venta' },
        { path: 'detalle/:id', component: DetalleVentaComponent, title: 'Detalle de venta' },
        { path: 'editar/:id', component: UpdateVentaComponent, title: 'Editar venta' },
      ]
    },

     { path: 'cotizaciones', component: IndexCotizacionesComponent, canActivate: [AuthGuard], title: 'Cotizaciones' },
     { path: 'cotizaciones/editar/:id', component: UpdateCotizacionComponent, canActivate: [AuthGuard], title: 'Editar cotización' },
     { path: 'cotizaciones/:id', component: DetalleCotizacionComponent, canActivate: [AuthGuard], title: 'Detalle cotización' },

     { path: 'proveedores',component: IndexProveedorComponent,canActivate: [AuthGuard], title: 'Proveedores' },
     { path: 'proveedores/create', component: CreateProveedorComponent,canActivate: [AuthGuard], title: 'Crear Proveedor' },
     { path: 'proveedores/:id', component: UpdateProveedorComponent,canActivate: [AuthGuard], title: 'Actualizar Proveedor' },

     {path: 'precios', component: CreatePreciosComponent, canActivate: [AuthGuard], title: 'Crear Precio Venta' },

     { path: 'inventario/lotes', component: LoteListComponent, canActivate: [AuthGuard], title: 'Lotes de Inventario' },
     { path: 'inventario/lotes/nuevo', component: LoteFormComponent, canActivate: [AuthGuard], title: 'Nuevo Lote de Inventario' },
     { path: 'inventario/lotes/editar/:id', component: LoteFormComponent, canActivate: [AuthGuard], title: 'Editar Lote de Inventario' },
     { path: 'inventario/ubicaciones', component: UbicacionPrioridadListComponent, canActivate: [AuthGuard], title: 'Ubicaciones con Prioridad' },
     { path: 'inventario/movimientos', component: MovimientoUbicacionComponent, canActivate: [AuthGuard], title: 'Movimiento entre Ubicaciones' },
     { path: 'inventario/kardex', component: KardexComponent, canActivate: [AuthGuard], title: 'Kardex' },
     { path: 'inventario/venta-rapida', component: VentaPorPrioridadComponent, canActivate: [AuthGuard], title: 'Venta por Prioridad' },
     { path: 'inventario/asignaciones', component: AsignarStockUbicacionComponent, canActivate: [AuthGuard], title: 'Asignaciones de Stock' },

     // Nuevos módulos
     { path: 'caja', component: IndexCajaComponent, canActivate: [AuthGuard], title: 'Gestión de Caja' },
     { path: 'caja/arqueo', component: ArqueoCajaComponent, canActivate: [AuthGuard], title: 'Arqueo de Caja' },
     { path: 'caja/pago-proveedores', component: PagoProveedoresComponent, canActivate: [AuthGuard], title: 'Pago a Proveedores' },
     { path: 'caja/recibo-ingreso', component: ReciboIngresoComponent, canActivate: [AuthGuard], title: 'Recibo de Ingreso' },
     { path: 'caja/recibo-egreso', component: ReciboEgresoComponent, canActivate: [AuthGuard], title: 'Recibo de Egreso' },
     { path: 'caja/conteo-dinero', component: ConteoDineroComponent, canActivate: [AuthGuard], title: 'Conteo de Dinero' },
     { path: 'caja/ventas-pendientes-pago', component: VentasPendientesPagoComponent, canActivate: [AuthGuard], title: 'Ventas pendientes de pago' },
     { path: 'creditos', component: IndexCreditosComponent, canActivate: [AuthGuard], title: 'Créditos y Cuotas' },
     { path: 'analisis', component: DashboardAnalisisComponent, canActivate: [AuthGuard], title: 'Análisis Financiero' },
     { path: 'configuracion', component: IndexConfiguracionComponent, canActivate: [AuthGuard], title: 'Configuración del Sistema' },
     { path: 'configuracion/integraciones', component: IntegracionesComponent, canActivate: [AuthGuard], title: 'Integraciones y APIs de pago' },
     { path: 'rubros', component: IndexRubrosComponent, canActivate: [AuthGuard], title: 'Configuración por rubro' },
     { path: 'vales-despacho', component: IndexValesDespachoComponent, canActivate: [AuthGuard], title: 'Vales de despacho' },
    { path: 'vales-despacho/nuevo', component: CreateValeDespachoComponent, canActivate: [AuthGuard], title: 'Nuevo vale de despacho' },
     { path: 'reportes', component: IndexReportesComponent, canActivate: [AuthGuard], title: 'Reportes y Análisis' },
    { path: 'utilidades', component: IndexUtilidadesComponent, canActivate: [AuthGuard, AdminGuard], title: 'Utilidades' },

     // Catálogos
     { path: 'catalogos/forma-pago', component: IndexFormaPagoComponent, canActivate: [AuthGuard], title: 'Forma Pago' },
     { path: 'catalogos/tipo-movimientos', component: IndexTipoMovimientosComponent, canActivate: [AuthGuard], title: 'Tipo Movimientos' },
     { path: 'catalogos/conceptos', component: IndexConceptosComponent, canActivate: [AuthGuard], title: 'Conceptos' },
     { path: 'catalogos/clasificacion-conceptos', component: IndexClasificacionConceptosComponent, canActivate: [AuthGuard], title: 'Clasificación Conceptos' },
     { path: 'catalogos/motivo-traslado', component: IndexMotivoTrasladoComponent, canActivate: [AuthGuard], title: 'Motivo Traslado' },
     { path: 'catalogos/motivo-nota-credito', component: IndexMotivoNotaCreditoComponent, canActivate: [AuthGuard], title: 'Motivo Nota Credito' },
     { path: 'facturacion/resumenes-diarios', component: ResumenesDiariosComponent, canActivate: [AuthGuard], title: 'Resúmenes diarios SUNAT' },
    { path: 'facturacion/notas-credito-debito', component: NotasCreditoDebitoComponent, canActivate: [AuthGuard], title: 'Notas de crédito / débito' },
    { path: 'facturacion/comunicacion-baja', component: ComunicacionBajaComponent, canActivate: [AuthGuard], title: 'Comunicación de baja' },
    { path: 'facturacion/guias/configuracion', component: GuiasConfiguracionComponent, canActivate: [AuthGuard], title: 'Configuración de guías' },
    { path: 'facturacion/guias-remision', component: GuiasRemisionComponent, canActivate: [AuthGuard], title: 'Guías de remisión' },
    { path: 'facturacion/guias-transportista', component: GuiasTransportistaComponent, canActivate: [AuthGuard], title: 'Guías transportista' },
  { path: 'auditoria', component: LogAuditoriaComponent, canActivate: [AuthGuard], title: 'Log de auditoría' },
];
