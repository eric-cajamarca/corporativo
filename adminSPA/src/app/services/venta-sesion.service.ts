import { Injectable } from '@angular/core';
import { VentaSesion, VentasProvisionalStorage } from '../interfaces/venta-sesion.interface';

export type VentaSesionModo = 'completa' | 'rapida';

const STORAGE_KEYS: Record<VentaSesionModo, string> = {
  completa: 'ventasProvisional',
  rapida: 'ventasProvisionalRapida'
};

const MAX_SESIONES = 10;

@Injectable({
  providedIn: 'root'
})
export class VentaSesionService {
  private modo: VentaSesionModo = 'completa';
  private sesiones: VentaSesion[] = [];
  private sesionActivaId: string | null = null;

  constructor() {
    this.cargarDesdeStorage();
  }

  setModo(modo: VentaSesionModo): void {
    if (this.modo === modo) return;
    this.modo = modo;
    this.sesionActivaId = null;
    this.cargarDesdeStorage();
  }

  getModo(): VentaSesionModo {
    return this.modo;
  }

  private getStorageKey(): string {
    return STORAGE_KEYS[this.modo];
  }

  private cargarDesdeStorage(): void {
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      if (!raw) {
        this.sesiones = [];
        return;
      }
      const data: VentasProvisionalStorage = JSON.parse(raw);
      this.sesiones = Array.isArray(data.sesiones) ? data.sesiones : [];
      if (this.sesiones.length > MAX_SESIONES) {
        this.sesiones = this.sesiones.slice(-MAX_SESIONES);
        this.persist();
      }
    } catch {
      this.sesiones = [];
    }
  }

  private persist(): void {
    try {
      const data: VentasProvisionalStorage = {
        sesiones: this.sesiones,
        ultimaActualizacion: new Date().toISOString()
      };
      localStorage.setItem(this.getStorageKey(), JSON.stringify(data));
    } catch (e) {
      console.error('VentaSesionService persist:', e);
    }
  }

  getSesionesGuardadas(): VentaSesion[] {
    return [...this.sesiones];
  }

  tieneSesionesGuardadas(): boolean {
    return this.sesiones.length > 0;
  }

  getSesionActivaId(): string | null {
    return this.sesionActivaId;
  }

  private generarNombre(): string {
    const n = this.sesiones.length + 1;
    return this.modo === 'rapida' ? `Venta r?pida ${n}` : `Venta ${n}`;
  }

  crearSesion(nombre?: string): VentaSesion {
    if (this.sesiones.length >= MAX_SESIONES) {
      this.sesiones.shift();
    }
    const id = `v-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const ahora = new Date().toISOString();
    const sesion: VentaSesion = {
      id,
      nombre: nombre || this.generarNombre(),
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
      carrito: [],
      ventas: this.getVentasVacio(),
      detallePago: [],
      cliente: this.getClienteVacio(),
      pagaCon: 0,
      vuelto: 0
    };
    this.sesiones.push(sesion);
    this.sesionActivaId = id;
    this.persist();
    return sesion;
  }

  private getVentasVacio(): Record<string, unknown> {
    return {
      compVenta: '0000-00000000',
      idComprobante: '',
      serie: '0000',
      numero: '00000000',
      idSucursal: '',
      idCliente: '',
      idDocumento: '',
      idMoneda: 1,
      idEstadoPago: 2,
      idMediosPago: '5',
      fEmision: '',
      fechaPago: '',
      fVencimiento: '',
      observacion: '',
      total: 0,
      igv: 0,
      isc: 0,
      impuestosDetalle: [],
      igvPorcentaje: 0,
      igvMonto: 0,
      exonerado: 0,
      gratuito: 0,
      otrosCargos: 0,
      subTotal: 0,
      descuentos: 0
    };
  }

  private getClienteVacio(): Record<string, unknown> {
    return {
      idCliente: '',
      idDocumento: '',
      ruc: '',
      rSocial: '',
      direccion: '',
      correo: '',
      celular: '',
      condicion: 'ACTIVO'
    };
  }

  cargarSesion(id: string): VentaSesion | null {
    const sesion = this.sesiones.find((s) => s.id === id) ?? null;
    if (sesion) {
      this.sesionActivaId = id;
    }
    return sesion;
  }

  actualizarSesionActiva(payload: Partial<Omit<VentaSesion, 'id' | 'nombre' | 'fechaCreacion'>>): void {
    if (!this.sesionActivaId) return;
    const idx = this.sesiones.findIndex((s) => s.id === this.sesionActivaId);
    if (idx === -1) return;
    const ahora = new Date().toISOString();
    this.sesiones[idx] = {
      ...this.sesiones[idx],
      ...payload,
      id: this.sesiones[idx].id,
      nombre: this.sesiones[idx].nombre,
      fechaCreacion: this.sesiones[idx].fechaCreacion,
      fechaActualizacion: ahora
    };
    this.persist();
  }

  eliminarSesionActiva(): void {
    if (!this.sesionActivaId) return;
    this.sesiones = this.sesiones.filter((s) => s.id !== this.sesionActivaId);
    this.sesionActivaId = null;
    this.persist();
  }

  eliminarSesion(id: string): void {
    this.sesiones = this.sesiones.filter((s) => s.id !== id);
    if (this.sesionActivaId === id) {
      this.sesionActivaId = null;
    }
    this.persist();
  }

  descartarTodas(): void {
    this.sesiones = [];
    this.sesionActivaId = null;
    try {
      localStorage.removeItem(this.getStorageKey());
    } catch {
      /* ignore */
    }
  }

  setSesionActivaId(id: string | null): void {
    this.sesionActivaId = id;
  }

  obtenerOCrearSesionActiva(): VentaSesion {
    if (this.sesionActivaId) {
      const s = this.sesiones.find((x) => x.id === this.sesionActivaId);
      if (s) return s;
    }
    return this.crearSesion();
  }
}
