import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="nf-wrap">
      <p class="nf-code">404</p>
      <h1>Página no encontrada</h1>
      <p>La dirección no existe o ya no está disponible.</p>
      <div class="nf-actions">
        <a routerLink="/home" class="btn btn-primary">Ir al inicio</a>
        <a routerLink="/ventas" class="btn btn-outline-secondary">Ver ventas</a>
      </div>
    </div>
  `,
  styles: [`
    .nf-wrap { max-width: 32rem; margin: 4rem auto; padding: 1.5rem; text-align: center; }
    .nf-code { font-size: 3rem; font-weight: 700; color: #0d6efd; margin-bottom: 0; }
    .nf-actions { display: flex; gap: .75rem; justify-content: center; flex-wrap: wrap; margin-top: 1.25rem; }
  `]
})
export class NotFoundComponent {}
