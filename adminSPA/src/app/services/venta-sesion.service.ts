import { Injectable } from '@angular/core';
import { VentaSesion, VentasProvisionalStorage } from '../interfaces/venta-sesion.interface';

const STORAGE_KEY = 'ventasProvisional';
const MAX_SESIONES = 10;

@Injectable({
  providedIn: 'root'
})
export class VentaSesionService {
  private sesiones: VentaSesion[] = [];
  private sesionActivaId: string | null = null;

  constructor() {
    this.cargarDesdeStorage();
  }

  private cargarDesdeStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('VentaSesionService persist:', e);
    }
  }

  /** Devuelve las sesiones guardadas (para mostrar en modal de recuperación). */
  getSesionesGuardadas(): VentaSesion[] {
    return [...this.sesiones];
  }

  /** Indica si hay sesiones guardadas. */
  tieneSesionesGuardadas(): boolean {
    return this.sesiones.length > 0;
  }

  /** ID de la sesión activa (la que se está editando), o null. */
  getSesionActivaId(): string | null {
    return this.sesionActivaId;
  }

  /** Genera un nombre por defecto para una nueva sesión. */
  private generarNombre(): string {
    const n = this.sesiones.length + 1;
    return `Venta ${n}`;
  }

  /** Crea una nueva sesión vacía y la devuelve. */
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

  private getVentasVacio(): any {
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

  private getClienteVacio(): any {
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

  /** Carga una sesión por id como activa y la devuelve (o null). */
  cargarSesion(id: string): VentaSesion | null {
    const sesion = this.sesiones.find(s => s.id === id) ?? null;
    if (sesion) {
      this.sesionActivaId = id;
    }
    return sesion;
  }

  /** Actualiza la sesión activa con el estado actual del componente. */
  actualizarSesionActiva(payload: Partial<Omit<VentaSesion, 'id' | 'nombre' | 'fechaCreacion'>>): void {
    if (!this.sesionActivaId) return;
    const idx = this.sesiones.findIndex(s => s.id === this.sesionActivaId);
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

  /** Elimina la sesión activa del almacenamiento. */
  eliminarSesionActiva(): void {
    if (!this.sesionActivaId) return;
    this.sesiones = this.sesiones.filter(s => s.id !== this.sesionActivaId);
    this.sesionActivaId = null;
    this.persist();
  }

  /** Elimina una sesión por id. */
  eliminarSesion(id: string): void {
    this.sesiones = this.sesiones.filter(s => s.id !== id);
    if (this.sesionActivaId === id) {
      this.sesionActivaId = null;
    }
    this.persist();
  }

  /** Descarta todas las sesiones guardadas. */
  descartarTodas(): void {
    this.sesiones = [];
    this.sesionActivaId = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  /** Marca que estamos editando esta sesión (sin crear una nueva). */
  setSesionActivaId(id: string | null): void {
    this.sesionActivaId = id;
  }

  /** Asegura que hay una sesión activa; si no, crea una. Devuelve la sesión activa. */
  obtenerOCrearSesionActiva(): VentaSesion {
    if (this.sesionActivaId) {
      const s = this.sesiones.find(x => x.id === this.sesionActivaId);
      if (s) return s;
    }
    return this.crearSesion();
  }
}
