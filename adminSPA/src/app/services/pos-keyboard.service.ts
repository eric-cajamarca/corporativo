import { Injectable, NgZone } from '@angular/core';

export type PosAtajoAccion = 'buscar' | 'cobrar' | 'cliente' | 'limpiarBusqueda' | 'ayuda';

export interface PosAtajoBinding {
  accion: PosAtajoAccion;
  handler: () => void;
}

/** Atajos de teclado para pantallas POS (venta rápida / completa). */
@Injectable({ providedIn: 'root' })
export class PosKeyboardService {
  private activo = false;
  private bindings = new Map<string, PosAtajoBinding['handler']>();
  private readonly onKeyDownBound: (ev: KeyboardEvent) => void;

  readonly leyendaAtajos: ReadonlyArray<{ tecla: string; descripcion: string }> = [
    { tecla: 'F2', descripcion: 'Enfocar búsqueda / escáner' },
    { tecla: 'F4', descripcion: 'Cobrar venta' },
    { tecla: 'F8', descripcion: 'Buscar cliente' },
    { tecla: 'Esc', descripcion: 'Limpiar búsqueda' },
    { tecla: 'F1', descripcion: 'Ver atajos' }
  ];

  constructor(private ngZone: NgZone) {
    this.onKeyDownBound = (ev) => this.onKeyDown(ev);
  }

  activar(bindings: Partial<Record<PosAtajoAccion, () => void>>): void {
    this.desactivar();
    const mapa: Record<PosAtajoAccion, string> = {
      buscar: 'F2',
      cobrar: 'F4',
      cliente: 'F8',
      limpiarBusqueda: 'Escape',
      ayuda: 'F1'
    };
    for (const [accion, handler] of Object.entries(bindings) as [PosAtajoAccion, (() => void) | undefined][]) {
      if (handler) {
        this.bindings.set(mapa[accion], handler);
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
    if (enInput && !tecla.startsWith('F')) {
      return;
    }
    ev.preventDefault();
    this.ngZone.run(() => fn());
  }
}
