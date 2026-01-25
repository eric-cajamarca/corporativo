// SIEMPRE usa environment para URLs (regla 2.2)
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

@Injectable({
    providedIn: 'root'
})
export class GestoresService {
    private url: string;

    constructor(private http: HttpClient) {
        this.url = global.url;
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
     * Obtiene la configuración de la empresa
     */
    obtenerConfiguracion(): Observable<ApiResponse<ConfiguracionEmpresa[]>> {
        return this.http.get<ApiResponse<ConfiguracionEmpresa[]>>(
            `${this.url}gestores/configuracion`,
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
        );
    }
}
