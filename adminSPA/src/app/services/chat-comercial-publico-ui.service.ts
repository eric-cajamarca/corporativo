import { Injectable, signal } from '@angular/core';

export type ChatPasoRegistro = 'demo' | 'pago' | 'ruc' | 'datos' | 'credenciales' | 'codigo';

export interface ChatPaginaContexto {
  ruta?: string;
  paso?: ChatPasoRegistro | '';
  errorPantalla?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatComercialPublicoUiService {
  readonly abierto = signal(false);
  readonly pendingSend = signal<string | null>(null);
  readonly pagina = signal<ChatPaginaContexto>({});

  setPagina(ctx: ChatPaginaContexto): void {
    this.pagina.set({ ...this.pagina(), ...ctx });
  }

  limpiarPagina(): void {
    this.pagina.set({});
  }

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
