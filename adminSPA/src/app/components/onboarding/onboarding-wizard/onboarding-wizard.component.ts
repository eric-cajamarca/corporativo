import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { PasoOnboarding } from '../../../interfaces/onboarding.interface';

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './onboarding-wizard.component.html',
  styleUrl: './onboarding-wizard.component.css'
})
export class OnboardingWizardComponent implements OnChanges {
  @Input() pasos: PasoOnboarding[] = [];
  @Input() progreso = 0;
  @Input() visible = false;
  @Input() storageKey = 'onboarding_oculto';
  @Output() refrescar = new EventEmitter<void>();

  ocultoTemporal = false;
  pasoActual: PasoOnboarding | null = null;

  constructor(private router: Router) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pasos'] || changes['visible']) {
      this.ocultoTemporal = this.leerOcultoStorage();
      this.pasoActual = this.pasos.find((p) => !p.completo) ?? null;
    }
  }

  get mostrarPanel(): boolean {
    return this.visible && !this.ocultoTemporal && this.pasos.length > 0 && this.progreso < 100;
  }

  irAlPaso(paso: PasoOnboarding): void {
    const ruta = (paso.ruta || '').split('?')[0];
    const query = (paso.ruta || '').includes('?') ? paso.ruta.split('?')[1] : '';
    if (query) {
      const params: Record<string, string> = {};
      query.split('&').forEach((part) => {
        const [k, v] = part.split('=');
        if (k) params[k] = v ?? '';
      });
      void this.router.navigate([ruta], { queryParams: params });
      return;
    }
    void this.router.navigate([ruta]);
  }

  ocultarPorAhora(): void {
    this.ocultoTemporal = true;
    try {
      sessionStorage.setItem(this.storageKey, '1');
    } catch {
      /* ignore */
    }
  }

  reactivar(): void {
    this.ocultoTemporal = false;
    try {
      sessionStorage.removeItem(this.storageKey);
    } catch {
      /* ignore */
    }
  }

  private leerOcultoStorage(): boolean {
    try {
      return sessionStorage.getItem(this.storageKey) === '1';
    } catch {
      return false;
    }
  }
}
