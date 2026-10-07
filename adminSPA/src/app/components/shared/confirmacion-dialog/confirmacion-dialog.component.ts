import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ConfirmacionDialogData {
  titulo?: string;
  mensaje: string;
  confirmarTexto?: string;
  cancelarTexto?: string;
  peligro?: boolean;
}

@Component({
  selector: 'app-confirmacion-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cd-backdrop" (click)="cancelar()"></div>
    <div class="cd-dialog" role="dialog" aria-modal="true" [attr.aria-labelledby]="'cd-title'">
      <h2 id="cd-title" class="cd-title">{{ data.titulo || 'Confirmar' }}</h2>
      <p class="cd-msg">{{ data.mensaje }}</p>
      <div class="cd-actions">
        <button type="button" class="btn btn-outline-secondary" (click)="cancelar()">
          {{ data.cancelarTexto || 'Cancelar' }}
        </button>
        <button
          type="button"
          class="btn"
          [class.btn-danger]="data.peligro"
          [class.btn-primary]="!data.peligro"
          (click)="aceptar()">
          {{ data.confirmarTexto || 'Sí, continuar' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      z-index: 1080;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .cd-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
    }
    .cd-dialog {
      position: relative;
      width: min(28rem, 100%);
      background: #fff;
      border-radius: 12px;
      padding: 1.25rem 1.35rem;
      box-shadow: 0 16px 40px rgba(0,0,0,.2);
    }
    .cd-title { font-size: 1.15rem; margin: 0 0 .5rem; }
    .cd-msg { margin: 0 0 1.15rem; color: #334155; white-space: pre-line; }
    .cd-actions {
      display: flex;
      justify-content: flex-end;
      gap: .6rem;
      flex-wrap: wrap;
    }
    .cd-actions .btn {
      min-height: 2.75rem;
      min-width: 7.5rem;
      padding: 0.55rem 1rem;
      font-size: 1rem;
      touch-action: manipulation;
    }
    @media (max-width: 575.98px) {
      .cd-actions { flex-direction: column-reverse; }
      .cd-actions .btn { width: 100%; min-width: 0; }
    }
  `]
})
export class ConfirmacionDialogComponent {
  data: ConfirmacionDialogData = { mensaje: '' };
  private resolver?: (ok: boolean) => void;

  setResolver(fn: (ok: boolean) => void): void {
    this.resolver = fn;
  }

  aceptar(): void {
    this.resolver?.(true);
  }

  cancelar(): void {
    this.resolver?.(false);
  }
}
