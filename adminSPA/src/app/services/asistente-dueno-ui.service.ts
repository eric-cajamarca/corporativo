import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AsistenteDuenoUiService {
  readonly abierto = signal(false);

  toggle(): void {
    this.abierto.update((v) => !v);
  }

  abrir(): void {
    this.abierto.set(true);
  }

  cerrar(): void {
    this.abierto.set(false);
  }
}
