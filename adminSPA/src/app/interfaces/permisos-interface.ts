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

export interface PermisosUsuario {
    permisos: Permiso[];
    permisosPorModulo: PermisosPorModulo;
    listaPermisos: string[];
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
