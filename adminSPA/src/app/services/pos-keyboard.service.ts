import { Injectable, NgZone } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

export type PosAtajoAccion =
  | 'buscar'
  | 'comprobante'
  | 'cobrar'
  | 'cliente'
  | 'limpiarBusqueda'
  | 'cerrarModal'
  | 'ayuda';

export interface PosAtajoOpciones {
  /** Sobrescribe tecla por acción; `null` desactiva la tecla por defecto. */
  teclas?: Partial<Record<PosAtajoAccion, string | null>>;
}

declare var bootstrap: { Modal: { getInstance: (el: HTMLElement) => { hide: () => void } | null } };

const TECLAS_POR_DEFECTO: Record<PosAtajoAccion, string | null> = {
  buscar: 'F2',
  comprobante: 'F3',
  cobrar: 'F4',
  cliente: 'F8',
  limpiarBusqueda: 'Escape',
  cerrarModal: null,
  ayuda: 'F1'
};

/** Atajos de teclado para pantallas POS (venta rápida / nueva venta). */
@Injectable({ providedIn: 'root' })
export class PosKeyboardService {
  private activo = false;
  private bindings = new Map<string, () => void>();
  private readonly onKeyDownBound: (ev: KeyboardEvent) => void;

  constructor(
    private ngZone: NgZone,
    private ngbModal: NgbModal
  ) {
    this.onKeyDownBound = (ev) => this.onKeyDown(ev);
  }

  activar(bindings: Partial<Record<PosAtajoAccion, () => void>>, opciones?: PosAtajoOpciones): void {
    this.desactivar();
    const mapa: Record<PosAtajoAccion, string | null> = { ...TECLAS_POR_DEFECTO };
    const overrides = opciones?.teclas ?? {};
    for (const accion of Object.keys(overrides) as PosAtajoAccion[]) {
      if (Object.prototype.hasOwnProperty.call(overrides, accion)) {
        mapa[accion] = overrides[accion] ?? null;
      }
    }
    for (const [accion, handler] of Object.entries(bindings) as [PosAtajoAccion, (() => void) | undefined][]) {
      if (!handler) {
        continue;
      }
      const tecla = mapa[accion as PosAtajoAccion];
      if (tecla) {
        this.bindings.set(tecla, handler);
      }
    }
    document.addEventListener('keydown', this.onKeyDownBound, true);
    this.activo = true;
  }

  desactivar(): void {
    if (!this.activo) {
      return;
    }
    document.removeEventListener('keydown', this.onKeyDownBound, true);
    this.bindings.clear();
    this.activo = false;
  }

  /** Cierra el modal visible (Ngb o Bootstrap). Devuelve true si cerró alguno. */
  cerrarModalesVisibles(): boolean {
    if (this.ngbModal.hasOpenModals()) {
      this.ngbModal.dismissAll();
      return true;
    }
    if (typeof bootstrap === 'undefined') {
      return false;
    }
    const modals = Array.from(document.querySelectorAll<HTMLElement>('.modal.show'));
    if (!modals.length) {
      return false;
    }
    let topModal = modals[0];
    let topZ = 0;
    for (const m of modals) {
      const z = Number.parseInt(getComputedStyle(m).zIndex || '0', 10) || 0;
      if (z >= topZ) {
        topZ = z;
        topModal = m;
      }
    }
    const inst = bootstrap.Modal.getInstance(topModal);
    if (inst) {
      inst.hide();
      return true;
    }
    return false;
  }

  private onKeyDown(ev: KeyboardEvent): void {
    const tecla = ev.key;
    const fn = this.bindings.get(tecla);
    if (!fn) {
      return;
    }
    const target = ev.target as HTMLElement | null;
    const enInput =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);
    if (enInput && !tecla.startsWith('F') && tecla !== 'Escape') {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    this.ngZone.run(() => fn());
  }
}
