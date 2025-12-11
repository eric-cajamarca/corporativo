import { Routes } from '@angular/router';
import { LoginEmpresaComponent } from './components/login-empresa/login-empresa.component';
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
import { AuthGuard } from './guards/auth.guards';
import { IndexProveedorComponent } from './components/proveedores/index-proveedor/index-proveedor.component';
import { CreateProveedorComponent } from './components/proveedores/create-proveedor/create-proveedor.component';
import { UpdateProveedorComponent } from './components/proveedores/update-proveedor/update-proveedor.component';
import { PrincipalInventarioComponent } from './components/inventarios/principal-inventario/principal-inventario.component';
import { CreatePreciosComponent } from './components/preciosV/create-precios/create-precios.component';

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
        path: 'empresa',
        component: IndexEmpresaComponent,
        canActivate: [AuthGuard],
        title: 'Empresas'
     },
     {
        path:'crear-empresa',
        component: CreateEmpresaComponent,
        canActivate: [AuthGuard],
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

     { path: 'clientes', component: IndexClientesComponent, title: 'Clientes'},
     { path: 'cliente/create', component: CreateClientesComponent, title: 'Crear Cliente'},
     { path: 'cliente/:id', component: UpdateClientesComponent, title: 'Actualizar Cliente'},

     { path: 'despachos', component: IndexDespachosComponent, title: 'Despachos'},
     { path: 'despachos/create', component: CreateDespachosComponent, title: 'Crear Despacho'},

     { path: 'programaciones', component: IndexProgramacionComponent, title: 'Programaciones' },
     { path: 'programacion/create',component: CreateProgramacionComponent, title: 'Crear Programacion'},
     { path: 'programacion/:id', component: UpdateProgramacionComponent, title: 'Actualizar Programacion'},

     { path: 'ventas', component: IndexVentasComponent, title: 'Resumen de ventas'},
     { path: 'ventas/create', component: CreateVentasComponent, title: 'Crear nueva venta'},

     { path: 'proveedores',component: IndexProveedorComponent,canActivate: [AuthGuard], title: 'Proveedores' },
     { path: 'proveedores/create', component: CreateProveedorComponent,canActivate: [AuthGuard], title: 'Crear Proveedor' },
     { path: 'proveedores/:id', component: UpdateProveedorComponent,canActivate: [AuthGuard], title: 'Actualizar Proveedor' },

     {path: 'precios', component: CreatePreciosComponent, canActivate: [AuthGuard], title: 'Crear Precio Venta' },
     
     

];
