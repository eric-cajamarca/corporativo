import { Routes } from '@angular/router';
import { LoginEmpresaComponent } from './components/login-empresa/login-empresa.component';
import { RecuperarPasswordComponent } from './components/recuperar-password/recuperar-password.component';
import { IndexEmpresaComponent } from './components/empresa/index-empresa/index-empresa.component';
import { CreateEmpresaComponent } from './components/empresa/create-empresa/create-empresa.component';
import { UpdateEmpresaComponent } from './components/empresa/update-empresa/update-empresa.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { InicioComponent } from './components/inicio/inicio.component';
import { IndexColaboradorComponent } from './components/colaboradores/index-colaborador/index-colaborador.component';
import { CreateColaboradorComponent } from './components/colaboradores/create-colaborador/create-colaborador.component';
import { UpdateColaboradorComponent } from './components/colaboradores/update-colaborador/update-colaborador.component';
import { IndexProductoComponent } from './components/productos/index-producto/index-producto.component';
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
import { IndexVentasComponent } from './components/ventas/index-ventas/index-ventas.component';
import { CreateVentasComponent } from './components/ventas/create-ventas/create-ventas.component';
import { AuthGuard } from './guards/auth.guard';
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
import { IndexCajaComponent } from './components/caja/index-caja/index-caja.component';
import { IndexCreditosComponent } from './components/creditos/index-creditos/index-creditos.component';
import { DashboardAnalisisComponent } from './components/analisis/dashboard-analisis/dashboard-analisis.component';
import { IndexConfiguracionComponent } from './components/configuracion/index-configuracion/index-configuracion.component';
import { IndexReportesComponent } from './components/reportes/index-reportes/index-reportes.component';

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
        canActivate: [AuthGuard],
        title: 'Empresas'
     },
     {
        path:'crear-empresa',
        component: CreateEmpresaComponent,
        title: 'Crear Empresa',
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

     { path: 'clientes', component: IndexClientesComponent, canActivate: [AuthGuard], title: 'Clientes'},
     { path: 'cliente/create', component: CreateClientesComponent, canActivate: [AuthGuard], title: 'Crear Cliente'},
     { path: 'cliente/:id', component: UpdateClientesComponent, canActivate: [AuthGuard], title: 'Actualizar Cliente'},

     { path: 'despachos', component: IndexDespachosComponent, canActivate: [AuthGuard], title: 'Despachos'},
     { path: 'despachos/create', component: CreateDespachosComponent, canActivate: [AuthGuard], title: 'Crear Despacho'},

     { path: 'programaciones', component: IndexProgramacionComponent, canActivate: [AuthGuard], title: 'Programaciones' },
     { path: 'programacion/create',component: CreateProgramacionComponent, canActivate: [AuthGuard], title: 'Crear Programacion'},
     { path: 'programacion/:id', component: UpdateProgramacionComponent, canActivate: [AuthGuard], title: 'Actualizar Programacion'},

     { path: 'ventas', component: IndexVentasComponent, canActivate: [AuthGuard], title: 'Resumen de ventas'},
     { path: 'ventas/create', component: CreateVentasComponent, canActivate: [AuthGuard], title: 'Crear nueva venta'},

     { path: 'proveedores',component: IndexProveedorComponent,canActivate: [AuthGuard], title: 'Proveedores' },
     { path: 'proveedores/create', component: CreateProveedorComponent,canActivate: [AuthGuard], title: 'Crear Proveedor' },
     { path: 'proveedores/:id', component: UpdateProveedorComponent,canActivate: [AuthGuard], title: 'Actualizar Proveedor' },

     {path: 'precios', component: CreatePreciosComponent, canActivate: [AuthGuard], title: 'Crear Precio Venta' },

     { path: 'inventario/lotes', component: LoteListComponent, canActivate: [AuthGuard], title: 'Lotes de Inventario' },
     { path: 'inventario/lotes/nuevo', component: LoteFormComponent, canActivate: [AuthGuard], title: 'Nuevo Lote de Inventario' },
     { path: 'inventario/lotes/editar/:id', component: LoteFormComponent, canActivate: [AuthGuard], title: 'Editar Lote de Inventario' },
     { path: 'inventario/ubicaciones', component: UbicacionPrioridadListComponent, canActivate: [AuthGuard], title: 'Ubicaciones con Prioridad' },
     { path: 'inventario/movimientos', component: MovimientoUbicacionComponent, canActivate: [AuthGuard], title: 'Movimiento entre Ubicaciones' },
     { path: 'inventario/venta-rapida', component: VentaPorPrioridadComponent, canActivate: [AuthGuard], title: 'Venta por Prioridad' },
     { path: 'inventario/asignaciones', component: AsignarStockUbicacionComponent, canActivate: [AuthGuard], title: 'Asignaciones de Stock' },

     // Nuevos módulos
     { path: 'caja', component: IndexCajaComponent, canActivate: [AuthGuard], title: 'Gestión de Caja' },
     { path: 'creditos', component: IndexCreditosComponent, canActivate: [AuthGuard], title: 'Créditos y Cuotas' },
     { path: 'analisis', component: DashboardAnalisisComponent, canActivate: [AuthGuard], title: 'Análisis Financiero' },
     { path: 'configuracion', component: IndexConfiguracionComponent, canActivate: [AuthGuard], title: 'Configuración del Sistema' },
     { path: 'reportes', component: IndexReportesComponent, canActivate: [AuthGuard], title: 'Reportes y Análisis' },
];
