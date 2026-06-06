import { Injectable } from '@angular/core';
import { VentaSesion } from '../interfaces/venta-sesion.interface';
import { VentaSesionService, VentaSesionModo } from './venta-sesion.service';

declare const bootstrap: { Modal: { getOrCreateInstance: (el: Element) => { show: () => void }; getInstance: (el: Element) => { hide: () => void } | null } };

export interface VentaEstadoProvisional {
  carrito: unknown[];
  ventas: Record<string, unknown>;
  detallePago: unknown[];
  cliente: Record<string, unknown>;
  pagaCon: number;
  vuelto: number;
}

@Injectable({ providedIn: 'root' })
export class VentaProvisionalUiService {
  readonly modalRecuperarId = 'modalRecuperar';

  constructor(private ventaSesionService: VentaSesionService) {}

  configurarModo(modo: VentaSesionModo): void {
    this.ventaSesionService.setModo(modo);
  }

  tieneSesionesGuardadas(): boolean {
    return this.ventaSesionService.tieneSesionesGuardadas();
  }

  listarSesionesGuardadas(): VentaSesion[] {
    return this.ventaSesionService.getSesionesGuardadas();
  }

  abrirModalRecuperar(): void {
    setTimeout(() => {
      const el = document.getElementById(this.modalRecuperarId);
      if (el) bootstrap.Modal.getOrCreateInstance(el).show();
    }, 300);
  }

  cerrarModalRecuperar(): void {
    const el = document.getElementById(this.modalRecuperarId);
    if (el) bootstrap.Modal.getInstance(el)?.hide();
  }

  prepararRecuperacion(sesion: VentaSesion): VentaSesion | null {
    this.cerrarModalRecuperar();
    return this.ventaSesionService.cargarSesion(sesion.id);
  }

  descartarTodasLasSesiones(): void {
    this.cerrarModalRecuperar();
    this.ventaSesionService.descartarTodas();
  }

  guardarEstadoActual(estado: VentaEstadoProvisional): void {
    const tieneDatos =
      estado.carrito.length > 0 ||
      !!estado.ventas['idComprobante'] ||
      !!(estado.cliente?.['idCliente'] && estado.cliente['idCliente'] !== '');
    if (!tieneDatos) return;
    if (!this.ventaSesionService.getSesionActivaId()) {
      this.ventaSesionService.obtenerOCrearSesionActiva();
    }
    this.ventaSesionService.actualizarSesionActiva({
      carrito: estado.carrito.map((x) => ({ ...(x as object) })),
      ventas: { ...estado.ventas },
      detallePago: estado.detallePago.map((x) => ({ ...(x as object) })),
      cliente: { ...estado.cliente },
      pagaCon: estado.pagaCon,
      vuelto: estado.vuelto
    });
  }

  eliminarSesionActiva(): void {
    this.ventaSesionService.eliminarSesionActiva();
  }
}
