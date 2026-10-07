// SIEMPRE usa environment para URLs (regla 2.2)
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, shareReplay, finalize } from 'rxjs';
import { global } from './global';
import { 
    Permiso, 
    PermisosUsuario, 
    MenuItem, 
    ModuloInfo,
    LimitesPlanAcciones
} from '../interfaces/permisos-interface';
import { moduloMenuRequeridoParaUrl } from '../config/ruta-plan-modulo.map';
import {
    normalizarRutaAbsoluta,
    planPermiteWhatsAppBot,
    planPermiteWhatsAppVinculado
} from '../config/saas-plan-reglas.util';

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
    private _deploymentMode = signal<'saas' | 'enterprise' | null>(null);
    private _planCodeEfectivo = signal<string | null>(null);
    private _modulosPlanMenu = signal<string[]>([]);
    private _limitesPlan = signal<LimitesPlanAcciones | null>(null);
    /** True tras primera carga de permisos (éxito o error) para que el guard no re-dispare en bucle. */
    private _contextoPlanCargado = signal<boolean>(false);
    private ultimaRespuestaPermisos: ApiResponse<PermisosUsuario> | null = null;
    private permisosEnVuelo: Observable<ApiResponse<PermisosUsuario>> | null = null;

    // Exponer datos reactivos
    permisos = this._permisos.asReadonly();
    navegacion = this._navegacion.asReadonly();
    cargando = this._cargando.asReadonly();
    deploymentMode = this._deploymentMode.asReadonly();
    planCodeEfectivo = this._planCodeEfectivo.asReadonly();
    modulosPlanMenu = this._modulosPlanMenu.asReadonly();
    limitesPlan = this._limitesPlan.asReadonly();
    contextoPlanCargado = this._contextoPlanCargado.asReadonly();

    // Computed para verificar permisos fácilmente
    tienePermisos = computed(() => this._permisos().length > 0);

    constructor(private http: HttpClient) {
        this.url = global.url;
    }

    /**
     * Carga los permisos del usuario autenticado
     */
    cargarPermisosUsuario(): Observable<ApiResponse<PermisosUsuario>> {
        if (this.ultimaRespuestaPermisos && this._contextoPlanCargado()) {
            return of(this.ultimaRespuestaPermisos);
        }
        if (this.permisosEnVuelo) {
            return this.permisosEnVuelo;
        }
        this._cargando.set(true);
        this.permisosEnVuelo = this.http.get<ApiResponse<PermisosUsuario>>(
            `${this.url}permisos/usuario`,
            { withCredentials: true }
        ).pipe(
            tap(response => {
                this.ultimaRespuestaPermisos = response;
                if (response.data) {
                    this._permisos.set(response.data.listaPermisos || []);
                    const dm = response.data.deploymentMode;
                    this._deploymentMode.set(dm === 'saas' || dm === 'enterprise' ? dm : 'enterprise');
                    this._planCodeEfectivo.set(
                        response.data.planCodeEfectivo != null ? String(response.data.planCodeEfectivo) : null
                    );
                    this._modulosPlanMenu.set(
                        Array.isArray(response.data.modulosPlanMenu) ? response.data.modulosPlanMenu : []
                    );
                    this._limitesPlan.set(
                        response.data.limitesPlan != null ? (response.data.limitesPlan as LimitesPlanAcciones) : null
                    );
                } else {
                    this._deploymentMode.set('enterprise');
                    this._planCodeEfectivo.set(null);
                    this._modulosPlanMenu.set([]);
                    this._limitesPlan.set(null);
                }
                this._contextoPlanCargado.set(true);
                this._cargando.set(false);
            }),
            catchError(error => {
                this._permisos.set([]);
                this._deploymentMode.set('enterprise');
                this._planCodeEfectivo.set(null);
                this._modulosPlanMenu.set([]);
                this._limitesPlan.set(null);
                this._contextoPlanCargado.set(true);
                this._cargando.set(false);
                return of({
                    message: 'Error',
                    data: {
                        permisos: [],
                        permisosPorModulo: {},
                        listaPermisos: [],
                        deploymentMode: 'enterprise' as const,
                        planCodeEfectivo: null,
                        modulosPlanMenu: [],
                        limitesPlan: null
                    }
                });
            }),
            finalize(() => {
                this.permisosEnVuelo = null;
            }),
            shareReplay(1)
        );
        return this.permisosEnVuelo;
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
     * True si la ruta está permitida por el plan SaaS (mismos tope que saasPlanModuloGuard).
     */
    puedeAccederRutaPlan(ruta: string): boolean {
        if (this.deploymentMode() !== 'saas') {
            return true;
        }
        const modulos = this.modulosPlanMenu();
        if (!modulos.length) {
            return true;
        }
        const requerido = moduloMenuRequeridoParaUrl(ruta);
        if (requerido === null) {
            return true;
        }
        const set = new Set(modulos.map((m) => m.toUpperCase()));
        if (!set.has(requerido.toUpperCase())) {
            return false;
        }
        const abs = normalizarRutaAbsoluta((ruta || '').split('?')[0] || '/');
        const planRaw = this.planCodeEfectivo();
        if (abs.startsWith('/configuracion/whatsapp-bot')) {
            return planPermiteWhatsAppBot(planRaw);
        }
        if (abs.startsWith('/configuracion/whatsapp')) {
            return planPermiteWhatsAppVinculado(planRaw);
        }
        const plan = (planRaw || '').toLowerCase();
        if (plan === 'demo') {
            if (abs === '/caja' || abs.startsWith('/caja/') || abs === '/creditos' || abs.startsWith('/creditos/')) {
                return abs === '/caja' || abs === '/caja/arqueo' || abs.startsWith('/caja/arqueo/');
            }
        }
        return true;
    }

    /**
     * Limpia los permisos (al cerrar sesión)
     */
    limpiarPermisos(): void {
        this.ultimaRespuestaPermisos = null;
        this.permisosEnVuelo = null;
        this._permisos.set([]);
        this._navegacion.set([]);
        this._deploymentMode.set(null);
        this._planCodeEfectivo.set(null);
        this._modulosPlanMenu.set([]);
        this._limitesPlan.set(null);
        this._contextoPlanCargado.set(false);
    }
}
