// SIEMPRE usa environment para URLs (regla 2.2)
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { global } from './global';
import { 
    Permiso, 
    PermisosUsuario, 
    MenuItem, 
    ModuloInfo 
} from '../interfaces/permisos-interface';

interface ApiResponse<T> {
    message: string;
    data: T;
}

@Injectable({
    providedIn: 'root'
})
export class PermisosService {
    private url: string;
    
    // Signals para estado reactivo
    private _permisos = signal<string[]>([]);
    private _navegacion = signal<MenuItem[]>([]);
    private _cargando = signal<boolean>(false);

    // Exponer datos reactivos
    permisos = this._permisos.asReadonly();
    navegacion = this._navegacion.asReadonly();
    cargando = this._cargando.asReadonly();

    // Computed para verificar permisos fácilmente
    tienePermisos = computed(() => this._permisos().length > 0);

    constructor(private http: HttpClient) {
        this.url = global.url;
    }

    /**
     * Carga los permisos del usuario autenticado
     */
    cargarPermisosUsuario(): Observable<ApiResponse<PermisosUsuario>> {
        this._cargando.set(true);
        return this.http.get<ApiResponse<PermisosUsuario>>(
            `${this.url}permisos/usuario`,
            { withCredentials: true }
        ).pipe(
            tap(response => {
                if (response.data) {
                    this._permisos.set(response.data.listaPermisos);
                }
                this._cargando.set(false);
            }),
            catchError(error => {
                console.error('Error al cargar permisos:', error);
                this._cargando.set(false);
                return of({ message: 'Error', data: { permisos: [], permisosPorModulo: {}, listaPermisos: [] } });
            })
        );
    }

    /**
     * Carga la navegación del sidebar basada en permisos
     */
    cargarNavegacion(): Observable<ApiResponse<MenuItem[]>> {
        this._cargando.set(true);
        return this.http.get<ApiResponse<MenuItem[]>>(
            `${this.url}permisos/navegacion`,
            { withCredentials: true }
        ).pipe(
            tap(response => {
                // No reemplazar por []: vacía el sidebar en toda la app si la API falla o responde sin ítems.
                if (response.data && response.data.length > 0) {
                    this._navegacion.set(response.data);
                }
                this._cargando.set(false);
            }),
            catchError(error => {
                console.error('Error al cargar navegación:', error);
                this._cargando.set(false);
                return of({ message: 'Error', data: [] });
            })
        );
    }

    /**
     * Verifica si el usuario tiene un permiso específico
     */
    tienePermiso(nombrePermiso: string): boolean {
        const permisos = this._permisos();
        return permisos.includes(nombrePermiso);
    }

    /**
     * Verifica si el usuario tiene alguno de los permisos especificados
     */
    tieneAlgunPermiso(nombresPermisos: string[]): boolean {
        const permisos = this._permisos();
        return nombresPermisos.some(p => permisos.includes(p));
    }

    /**
     * Verifica si el usuario tiene todos los permisos especificados
     */
    tieneTodosLosPermisos(nombresPermisos: string[]): boolean {
        const permisos = this._permisos();
        return nombresPermisos.every(p => permisos.includes(p));
    }

    /**
     * Obtiene todos los permisos de la empresa (solo admin)
     */
    obtenerPermisosEmpresa(): Observable<ApiResponse<Permiso[]>> {
        return this.http.get<ApiResponse<Permiso[]>>(
            `${this.url}permisos/empresa`,
            { withCredentials: true }
        );
    }

    /**
     * Obtiene los permisos de un rol específico
     */
    obtenerPermisosRol(idRol: string): Observable<ApiResponse<Permiso[]>> {
        return this.http.get<ApiResponse<Permiso[]>>(
            `${this.url}permisos/rol/${idRol}`,
            { withCredentials: true }
        );
    }

    /**
     * Obtiene los módulos disponibles
     */
    obtenerModulos(): Observable<ApiResponse<ModuloInfo[]>> {
        return this.http.get<ApiResponse<ModuloInfo[]>>(
            `${this.url}permisos/modulos`,
            { withCredentials: true }
        );
    }

    /**
     * Actualiza los permisos de un rol
     */
    actualizarPermisosRol(idRol: string, permisos: string[]): Observable<ApiResponse<any>> {
        return this.http.put<ApiResponse<any>>(
            `${this.url}permisos/rol/${idRol}`,
            { permisos },
            { withCredentials: true }
        );
    }

    /**
     * Inicializa los permisos por defecto de la empresa
     */
    inicializarPermisos(): Observable<ApiResponse<any>> {
        return this.http.post<ApiResponse<any>>(
            `${this.url}permisos/inicializar`,
            {},
            { withCredentials: true }
        );
    }

    /**
     * Limpia los permisos (al cerrar sesión)
     */
    limpiarPermisos(): void {
        this._permisos.set([]);
        this._navegacion.set([]);
    }
}
