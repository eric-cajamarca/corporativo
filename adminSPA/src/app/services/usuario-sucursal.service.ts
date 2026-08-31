// SIEMPRE usa environment para URLs (regla 2.2)
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { global } from './global';

export interface SucursalUsuario {
    idUsuarioSucursal: number;
    idSucursal: string;
    esDefault: boolean;
    codigoSucursal: string;
    direccionSucursal: string;
    telefonoSucursal: string;
}

export interface SucursalConAsignacion {
    idSucursal: string;
    codigo: string;
    direccion: string;
    telefono: string;
    estadoSucursal: boolean;
    asignado: boolean;
    esDefault: boolean;
    idUsuarioSucursal: number | null;
}

export interface UsuarioEnSucursal {
    idUsuarioSucursal: number;
    idUsuario: string;
    esDefault: boolean;
    estado: boolean;
    fAsignacion: string;
    nombres: string;
    apellidos: string;
    email: string;
    estadoUsuario: boolean;
    rol: string;
}

interface ApiResponse<T> {
    message: string;
    data: T;
}

@Injectable({
    providedIn: 'root'
})
export class UsuarioSucursalService {
    private url: string;

    // Estado reactivo para las sucursales del usuario actual
    private _misSucursales = signal<SucursalUsuario[]>([]);
    private _sucursalDefault = signal<SucursalUsuario | null>(null);
    private _cargando = signal<boolean>(false);

    // Computed para acceso público
    misSucursales = computed(() => this._misSucursales());
    sucursalDefault = computed(() => this._sucursalDefault());
    cargando = computed(() => this._cargando());

    constructor(private http: HttpClient) {
        this.url = global.url;
    }

    /**
     * Carga las sucursales del usuario actual
     */
    cargarMisSucursales(): Observable<ApiResponse<SucursalUsuario[]>> {
        this._cargando.set(true);
        return this.http.get<ApiResponse<SucursalUsuario[]>>(
            `${this.url}usuario-sucursal/mis-sucursales`,
            { withCredentials: true }
        ).pipe(
            tap(response => {
                if (response.data) {
                    this._misSucursales.set(response.data);
                    const defaultSuc = response.data.find(s => s.esDefault);
                    this._sucursalDefault.set(defaultSuc || response.data[0] || null);
                }
                this._cargando.set(false);
            }),
            catchError(error => {
                this._cargando.set(false);
                return of({ message: 'Error', data: [] });
            })
        );
    }

    /**
     * Obtiene la sucursal default del usuario actual
     */
    obtenerSucursalDefault(): Observable<ApiResponse<SucursalUsuario>> {
        return this.http.get<ApiResponse<SucursalUsuario>>(
            `${this.url}usuario-sucursal/mi-sucursal-default`,
            { withCredentials: true }
        );
    }

    /**
     * Establece una sucursal como default
     */
    establecerSucursalDefault(idSucursal: string): Observable<ApiResponse<any>> {
        return this.http.put<ApiResponse<any>>(
            `${this.url}usuario-sucursal/sucursal-default`,
            { idSucursal },
            { withCredentials: true }
        ).pipe(
            tap(() => {
                // Actualizar el estado local
                const sucursales = this._misSucursales();
                const nuevasSucursales = sucursales.map(s => ({
                    ...s,
                    esDefault: s.idSucursal === idSucursal
                }));
                this._misSucursales.set(nuevasSucursales);
                this._sucursalDefault.set(nuevasSucursales.find(s => s.esDefault) || null);
            })
        );
    }

    /**
     * Obtiene sucursales de un usuario específico (admin)
     */
    obtenerSucursalesUsuario(idUsuario: string): Observable<ApiResponse<SucursalUsuario[]>> {
        return this.http.get<ApiResponse<SucursalUsuario[]>>(
            `${this.url}usuario-sucursal/usuario/${idUsuario}`,
            { withCredentials: true }
        );
    }

    /**
     * Obtiene sucursales con información de asignación (admin)
     */
    obtenerSucursalesConAsignacion(idUsuario: string): Observable<ApiResponse<SucursalConAsignacion[]>> {
        return this.http.get<ApiResponse<SucursalConAsignacion[]>>(
            `${this.url}usuario-sucursal/usuario/${idUsuario}/asignacion`,
            { withCredentials: true }
        );
    }

    /**
     * Obtiene usuarios de una sucursal (admin)
     */
    obtenerUsuariosSucursal(idSucursal: string): Observable<ApiResponse<UsuarioEnSucursal[]>> {
        return this.http.get<ApiResponse<UsuarioEnSucursal[]>>(
            `${this.url}usuario-sucursal/sucursal/${idSucursal}/usuarios`,
            { withCredentials: true }
        );
    }

    /**
     * Asigna un usuario a una sucursal
     */
    asignarUsuarioSucursal(idUsuario: string, idSucursal: string, esDefault: boolean = false): Observable<ApiResponse<any>> {
        return this.http.post<ApiResponse<any>>(
            `${this.url}usuario-sucursal`,
            { idUsuario, idSucursal, esDefault },
            { withCredentials: true }
        );
    }

    /**
     * Desasigna un usuario de una sucursal
     */
    desasignarUsuarioSucursal(idUsuarioSucursal: number): Observable<ApiResponse<any>> {
        return this.http.delete<ApiResponse<any>>(
            `${this.url}usuario-sucursal/${idUsuarioSucursal}`,
            { withCredentials: true }
        );
    }

    /**
     * Actualiza todas las asignaciones de un usuario
     */
    actualizarAsignaciones(idUsuario: string, sucursalesIds: string[]): Observable<ApiResponse<any>> {
        return this.http.put<ApiResponse<any>>(
            `${this.url}usuario-sucursal/asignaciones`,
            { idUsuario, sucursalesIds },
            { withCredentials: true }
        );
    }

    /**
     * Verifica si el usuario tiene acceso a una sucursal
     */
    verificarAcceso(idSucursal: string): Observable<ApiResponse<{ tieneAcceso: boolean }>> {
        return this.http.get<ApiResponse<{ tieneAcceso: boolean }>>(
            `${this.url}usuario-sucursal/verificar/${idSucursal}`,
            { withCredentials: true }
        );
    }

    /**
     * Limpia el estado
     */
    limpiar(): void {
        this._misSucursales.set([]);
        this._sucursalDefault.set(null);
    }
}
