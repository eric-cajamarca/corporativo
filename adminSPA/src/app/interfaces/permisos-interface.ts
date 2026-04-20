// SIEMPRE declara interfaces/models para todos los datos de APIs (regla 2.1)
// SIEMPRE usa PascalCase para interfaces/models en TypeScript (regla 6.1)

export interface Permiso {
    idPermiso: string;
    nombre: string;
    descripcion: string;
    modulo: string;
}

export interface PermisosPorModulo {
    [modulo: string]: string[];
}

/** SaaS + suscripción ACTIVA/DEMO: límites del plan y si puede crear recursos. */
export interface LimitesPlanAcciones {
    planCode?: string;
    maxUsuarios: number;
    maxSucursales: number;
    maxDireccionesEmpresa: number;
    usuariosActivos: number;
    usuariosOcupados: number;
    sucursales: number;
    direccionesEmpresa: number;
    puedeCrearUsuario: boolean;
    puedeCrearSucursal: boolean;
    puedeAgregarDireccionEmpresa: boolean;
    excedeUsuarios: boolean;
    excedeSucursales: boolean;
    excedeDirecciones: boolean;
}

export interface PermisosUsuario {
    permisos: Permiso[];
    permisosPorModulo: PermisosPorModulo;
    listaPermisos: string[];
    /** Modo despliegue (API); en Enterprise no aplica tope de plan en el cliente. */
    deploymentMode?: 'saas' | 'enterprise';
    planCodeEfectivo?: string | null;
    /** Códigos de módulo de menú permitidos por `SaasPlanModulo` (SaaS). */
    modulosPlanMenu?: string[];
    /** Solo SaaS con suscripción que aplica límites; null si no aplica. */
    limitesPlan?: LimitesPlanAcciones | null;
}

export interface SubMenuItem {
    nombre: string;
    ruta: string;
    permiso: string;
    visible: boolean;
}

export interface MenuItem {
    modulo?: string;
    nombre?: string;
    icono?: string;
    ruta?: string | null;
    permiso?: string;
    visible?: boolean;
    submenu?: SubMenuItem[];
    tipo?: string; // 'separador'
}

export interface NavegacionSidebar {
    items: MenuItem[];
}

export interface ModuloInfo {
    modulo: string;
    permisos: string;
    totalPermisos: number;
}
