import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { PasoOnboarding } from '../../../interfaces/onboarding.interface';
import { EmpresaService } from '../../../services/empresa.service';

declare var iziToast: { success: (o: object) => void; error: (o: object) => void };

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

  private empresaService = inject(EmpresaService);
  guardandoZona = false;

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

  responderZonaExonerada(exonerada: boolean): void {
    if (this.guardandoZona) return;
    this.guardandoZona = true;
    this.empresaService.aplicarZonaExonerada(exonerada).subscribe({
      next: (res) => {
        this.guardandoZona = false;
        iziToast.success({
          title: 'Listo',
          message: res?.message || (exonerada ? 'Zona exonerada configurada.' : 'IGV 18% activo.')
        });
        this.refrescar.emit();
      },
      error: (err) => {
        this.guardandoZona = false;
        iziToast.error({
          title: 'Error',
          message: err?.error?.message || err?.message || 'No se pudo guardar la opción fiscal.'
        });
      }
    });
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
