import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ChatComercialPublicoUiService {
  readonly abierto = signal(false);
  readonly pendingSend = signal<string | null>(null);

  abrir(mensaje?: string): void {
    this.abierto.set(true);
    if (mensaje) this.pendingSend.set(mensaje);
  }

  cerrar(): void {
    this.abierto.set(false);
  }

  toggle(): void {
    this.abierto.update((v) => !v);
  }

  tomarPending(): string | null {
    const v = this.pendingSend();
    this.pendingSend.set(null);
    return v;
  }
}
