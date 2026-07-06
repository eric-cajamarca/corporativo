import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SaasPublicService } from '../../../services/saas-public.service';
import { PlanCatalogoItem } from '../../../models/saas-public.model';
import { resumirLimitesPlan } from '../../../utils/saas-plan-resumen.util';

interface PublicVideo {
  titulo: string;
  url: SafeResourceUrl;
}

interface PublicReferido {
  nombre: string;
  negocio: string;
  comentario: string;
}

@Component({
  selector: 'app-home-public',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home-public.component.html',
  styleUrl: './home-public.component.css'
})
export class HomePublicComponent implements OnInit {
  readonly planes = signal<PlanCatalogoItem[]>([]);
  readonly cargandoPlanes = signal(true);
  readonly errorPlanes = signal<string | null>(null);

  videos: PublicVideo[] = [];

  readonly referidos: PublicReferido[] = [
    {
      nombre: 'Nelver Q.',
      negocio: 'Ferretería Itzel',
      comentario: 'En una semana ya teníamos todo el stock ordenado y ventas claras.'
    },
    {
      nombre: 'Lucila T.',
      negocio: 'Ferretería San Juan',
      comentario: 'El control por sucursal nos ayudó a reducir pérdidas y tiempos.'
    },
    {
      nombre: 'Yeisi F.',
      negocio: 'Minimarket Fernandez',
      comentario: 'El sistema es simple de usar y el soporte responde rápido.'
    }
  ];

  readonly resumirLimitesPlan = resumirLimitesPlan;

  constructor(
    private sanitizer: DomSanitizer,
    private saasPublic: SaasPublicService
  ) {}

  ngOnInit(): void {
    this.videos = [
      { titulo: 'Tour rápido del sistema', url: this.safeUrl('https://www.youtube.com/embed/ysz5S6PUM-U') },
      { titulo: 'Cómo registrar una venta', url: this.safeUrl('https://www.youtube.com/embed/jfKfPfyJRdk') },
      { titulo: 'Reportes y análisis en minutos', url: this.safeUrl('https://www.youtube.com/embed/5qap5aO4i9A') }
    ];
    this.cargarPlanes();
  }

  private cargarPlanes(): void {
    this.cargandoPlanes.set(true);
    this.errorPlanes.set(null);
    this.saasPublic.listarPlanes().subscribe({
      next: (data) => {
        this.planes.set(data);
        this.cargandoPlanes.set(false);
      },
      error: () => {
        this.errorPlanes.set('No se pudieron cargar los planes desde el catálogo.');
        this.cargandoPlanes.set(false);
      }
    });
  }

  esPlanDestacado(planCode: string): boolean {
    return planCode === 'emprendedor';
  }

  private safeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
