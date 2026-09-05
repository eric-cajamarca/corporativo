import { Injectable } from '@angular/core';
import { VentaSesion } from '../interfaces/venta-sesion.interface';
import { VentaSesionService, VentaSesionModo } from './venta-sesion.service';

declare const bootstrap: {
  Modal: {
    getOrCreateInstance: (
      el: Element,
      config?: { backdrop?: boolean | 'static'; keyboard?: boolean; focus?: boolean }
    ) => { show: () => void; hide: () => void };
    getInstance: (el: Element) => { hide: () => void } | null;
  };
};

export interface VentaEstadoProvisional {
  carrito: unknown[];
  ventas: Record<string, unknown>;
  detallePago: unknown[];
  cliente: Record<string, unknown>;
  pagaCon: number;
  vuelto: number;
}

type ModalRecuperarEl = HTMLElement & {
  __vrParent?: Node | null;
  __vrNext?: ChildNode | null;
  __vrHiddenBound?: ((ev: Event) => void) | null;
};

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

  /**
   * Abre el modal de recuperación.
   * En iOS/Safari el stacking context del host + sticky topbar hace que el backdrop
   * intercepte los toques; se mueve el modal a document.body mientras está abierto.
   */
  abrirModalRecuperar(): void {
    setTimeout(() => {
      const el = document.getElementById(this.modalRecuperarId) as ModalRecuperarEl | null;
      if (!el) return;

      this.moverModalABody(el);

      if (el.__vrHiddenBound) {
        el.removeEventListener('hidden.bs.modal', el.__vrHiddenBound);
      }
      el.__vrHiddenBound = () => {
        this.restaurarModalEnHost(el);
        el.__vrHiddenBound = null;
      };
      el.addEventListener('hidden.bs.modal', el.__vrHiddenBound);

      const instance = bootstrap.Modal.getOrCreateInstance(el, {
        backdrop: 'static',
        keyboard: true,
        focus: true
      });
      instance.show();
      // Asegura capas por encima del backdrop (Safari iOS)
      this.asegurarCapasModal(el);
    }, 300);
  }

  cerrarModalRecuperar(): void {
    const el = document.getElementById(this.modalRecuperarId) as ModalRecuperarEl | null;
    if (!el) return;
    const inst = bootstrap.Modal.getInstance(el);
    if (inst) {
      inst.hide();
    } else {
      this.restaurarModalEnHost(el);
    }
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

  /** Cierra y restaura el modal si quedó en body al salir de la pantalla. */
  limpiarAlDestruirComponente(): void {
    const el = document.getElementById(this.modalRecuperarId) as ModalRecuperarEl | null;
    if (!el) return;
    try {
      bootstrap.Modal.getInstance(el)?.hide();
    } catch {
      /* ignore */
    }
    if (el.__vrHiddenBound) {
      el.removeEventListener('hidden.bs.modal', el.__vrHiddenBound);
      el.__vrHiddenBound = null;
    }
    this.restaurarModalEnHost(el);
    // Si el host ya no existe, quitar residual en body
    if (el.parentElement === document.body && !el.__vrParent) {
      el.remove();
    }
  }

  private moverModalABody(el: ModalRecuperarEl): void {
    if (el.parentElement === document.body) return;
    el.__vrParent = el.parentElement;
    el.__vrNext = el.nextSibling;
    document.body.appendChild(el);
  }

  private restaurarModalEnHost(el: ModalRecuperarEl): void {
    const parent = el.__vrParent;
    const next = el.__vrNext ?? null;
    if (parent && el.parentElement === document.body) {
      try {
        parent.insertBefore(el, next);
      } catch {
        parent.appendChild(el);
      }
    }
    el.__vrParent = null;
    el.__vrNext = null;
    el.style.zIndex = '';
    el.style.pointerEvents = '';
  }

  private asegurarCapasModal(el: HTMLElement): void {
    el.style.zIndex = '1065';
    el.style.pointerEvents = 'auto';
    const dialog = el.querySelector('.modal-dialog') as HTMLElement | null;
    if (dialog) {
      dialog.style.pointerEvents = 'auto';
      dialog.style.zIndex = '1066';
    }
    // Backdrop de Bootstrap en body: por debajo del diálogo
    requestAnimationFrame(() => {
      document.querySelectorAll('.modal-backdrop').forEach((b) => {
        const node = b as HTMLElement;
        node.style.zIndex = '1060';
      });
    });
  }
}
