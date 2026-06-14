// SIEMPRE usa environment para URLs (regla 2.2)
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { finalize, shareReplay, tap } from 'rxjs/operators';
import { global } from './global';

export interface EmpresaGestionada {
    idGestor: number;
    idEmpresa: string;
    ruc: string;
    razon_Social: string;
    nombreComercial: string;
    correo: string;
    celular: string;
    estado: boolean;
    estSunat: string;
    fAsignacion: string;
    estadoGestor: boolean;
}

export interface GestorInfo {
    idGestor: number;
    idEmpresaOrigen: string;
    idEmpresaDestino: string;
    estado: boolean;
    fAsignacion: string;
    rucOrigen: string;
    razonSocialOrigen: string;
    rucDestino: string;
    razonSocialDestino: string;
    correoDestino: string;
    estadoEmpresaDestino: boolean;
}

export interface BusquedaEmpresaResult {
    empresa: {
        idEmpresa: string;
        ruc: string;
        razon_Social: string;
        nombreComercial: string;
        correo: string;
        celular: string;
        estado: boolean;
        estSunat: string;
    };
    relacionExistente: {
        idGestor: number;
        estado: boolean;
    } | null;
}

export interface ConfiguracionEmpresa {
    idConfiguracion?: string;
    clave: string;
    valor: string;
    descripcion?: string;
    tipoDato?: string;
}

interface ApiResponse<T> {
    message: string;
    data: T;
}

export interface PermisosConfiguracionSistema {
    puedeEditarSistemaOperativo: boolean;
    /** Visible si empresa principal o rol superAdmin (backend). */
    mostrarTabSistema?: boolean;
    esEmpresaPrincipal?: boolean;
    esSuperAdmin?: boolean;
}

export interface EjecutarBackupAhoraResult {
    success: boolean;
    archivo?: string | null;
    rutaLocal?: string;
    mensaje?: string;
}

@Injectable({
    providedIn: 'root'
})
export class GestoresService {
    private url: string;
    /** Configuración de empresa en memoria (una petición por sesión hasta guardar o invalidar). */
    private configuracionMemoria: ApiResponse<ConfiguracionEmpresa[]> | null = null;
    private configuracionEnVuelo: Observable<ApiResponse<ConfiguracionEmpresa[]>> | null = null;

    constructor(private http: HttpClient) {
        this.url = global.url;
    }

    /** Tras guardar configuración en BD, forzar próximo GET. */
    invalidarCacheConfiguracion(): void {
        this.configuracionMemoria = null;
        this.configuracionEnVuelo = null;
    }

    /**
     * Obtiene las empresas gestionadas activas
     */
    obtenerEmpresasGestionadas(): Observable<ApiResponse<EmpresaGestionada[]>> {
        return this.http.get<ApiResponse<EmpresaGestionada[]>>(
            `${this.url}gestores`,
            { withCredentials: true }
        );
    }

    /**
     * Obtiene todos los gestores (activos e inactivos)
     */
    obtenerTodosGestores(): Observable<ApiResponse<GestorInfo[]>> {
        return this.http.get<ApiResponse<GestorInfo[]>>(
            `${this.url}gestores/todos`,
            { withCredentials: true }
        );
    }

    /**
     * Busca una empresa por RUC
     */
    buscarEmpresaPorRuc(ruc: string): Observable<ApiResponse<BusquedaEmpresaResult>> {
        return this.http.get<ApiResponse<BusquedaEmpresaResult>>(
            `${this.url}gestores/buscar/${ruc}`,
            { withCredentials: true }
        );
    }

    /**
     * Asigna una empresa como gestionada
     */
    asignarEmpresaGestionada(idEmpresaDestino: string): Observable<ApiResponse<any>> {
        return this.http.post<ApiResponse<any>>(
            `${this.url}gestores`,
            { idEmpresaDestino },
            { withCredentials: true }
        );
    }

    /**
     * Remueve (desactiva) una empresa gestionada
     */
    removerEmpresaGestionada(idGestor: number): Observable<ApiResponse<any>> {
        return this.http.put<ApiResponse<any>>(
            `${this.url}gestores/remover/${idGestor}`,
            {},
            { withCredentials: true }
        );
    }

    /**
     * Activa una empresa gestionada
     */
    activarEmpresaGestionada(idGestor: number): Observable<ApiResponse<any>> {
        return this.http.put<ApiResponse<any>>(
            `${this.url}gestores/activar/${idGestor}`,
            {},
            { withCredentials: true }
        );
    }

    /**
     * Elimina permanentemente una empresa gestionada
     */
    eliminarEmpresaGestionada(idGestor: number): Observable<ApiResponse<any>> {
        return this.http.delete<ApiResponse<any>>(
            `${this.url}gestores/${idGestor}`,
            { withCredentials: true }
        );
    }

    /**
     * Obtiene la configuración de la empresa (caché en memoria por sesión).
     */
    obtenerConfiguracion(opciones?: { evitarCache?: boolean }): Observable<ApiResponse<ConfiguracionEmpresa[]>> {
        if (!opciones?.evitarCache && this.configuracionMemoria?.data != null) {
            const data = Array.isArray(this.configuracionMemoria.data)
                ? [...this.configuracionMemoria.data]
                : this.configuracionMemoria.data;
            return of({ ...this.configuracionMemoria, data } as ApiResponse<ConfiguracionEmpresa[]>);
        }
        if (!opciones?.evitarCache && this.configuracionEnVuelo) {
            return this.configuracionEnVuelo;
        }
        const peticion = this.http
            .get<ApiResponse<ConfiguracionEmpresa[]>>(
                `${this.url}gestores/configuracion`,
                { withCredentials: true }
            )
            .pipe(
                tap((res) => {
                    if (res?.data != null) {
                        const d = res.data;
                        this.configuracionMemoria = {
                            ...res,
                            data: Array.isArray(d) ? [...d] : d
                        } as ApiResponse<ConfiguracionEmpresa[]>;
                    }
                }),
                shareReplay(1),
                finalize(() => {
                    this.configuracionEnVuelo = null;
                })
            );
        this.configuracionEnVuelo = peticion;
        return peticion;
    }

    /**
     * Mapa idEmpresa → VENTAS_USAR_DESCUENTO_EN_TOTAL (gestora + gestionadas).
     */
    obtenerDescuentoVentaPorEmpresas(): Observable<ApiResponse<Record<string, boolean>>> {
        return this.http.get<ApiResponse<Record<string, boolean>>>(
            `${this.url}gestores/configuracion/descuento-por-empresa`,
            { withCredentials: true }
        );
    }

    /**
     * Guarda la configuración de la empresa
     */
    guardarConfiguracion(configuraciones: ConfiguracionEmpresa[]): Observable<ApiResponse<any>> {
        return this.http.post<ApiResponse<any>>(
            `${this.url}gestores/configuracion`,
            { configuraciones },
            { withCredentials: true }
        ).pipe(
            tap(() => this.invalidarCacheConfiguracion())
        );
    }

    obtenerPermisosConfiguracionSistema(): Observable<ApiResponse<PermisosConfiguracionSistema>> {
        return this.http.get<ApiResponse<PermisosConfiguracionSistema>>(
            `${this.url}gestores/configuracion/sistema-permisos`,
            { withCredentials: true }
        );
    }

    /** Ejecuta backup_sqlserver.ps1 en el servidor (Windows + sqlcmd). */
    ejecutarBackupAhora(opciones?: {
        rutaBackupLocal?: string;
        rutaBackupSecundaria?: string;
        googleDriveRemote?: string;
    }): Observable<ApiResponse<EjecutarBackupAhoraResult>> {
        return this.http.post<ApiResponse<EjecutarBackupAhoraResult>>(
            `${this.url}gestores/backup/ejecutar`,
            opciones || {},
            { withCredentials: true }
        );
    }
}
