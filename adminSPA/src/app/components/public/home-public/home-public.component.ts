import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SaasPublicService } from '../../../services/saas-public.service';
import { PlanCatalogoItem } from '../../../models/saas-public.model';
import { resumirLimitesPlan } from '../../../utils/saas-plan-resumen.util';

interface PublicVideo {
  id: string;
  titulo: string;
  reproduciendo: boolean;
  embedUrl: SafeResourceUrl | null;
}

interface PublicReferido {
  nombre: string;
  negocio: string;
  comentario: string;
}

interface PublicRecurso {
  slug: string;
  titulo: string;
  descripcion: string;
  tag: string;
  url: string;
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

  readonly recursos: PublicRecurso[] = [
    {
      slug: 'inventario',
      titulo: 'Control de inventario',
      descripcion: 'Evita vender a ciegas y recupera el control de tu stock.',
      tag: 'Inventario',
      url: '/flayers/inventario.html'
    },
    {
      slug: 'robos-internos',
      titulo: 'Robos internos',
      descripcion: 'Señales de alerta y cómo detectar mermas sin explicación.',
      tag: 'Seguridad',
      url: '/flayers/robos-internos.html'
    },
    {
      slug: 'utilidad-producto',
      titulo: 'Utilidad por producto',
      descripcion: 'Vender mucho no es lo mismo que ganar mucho.',
      tag: 'Finanzas',
      url: '/flayers/utilidad-producto.html'
    },
    {
      slug: 'cobranzas',
      titulo: 'Cobranzas',
      descripcion: 'Reglas simples para cobrar a tiempo y no quedarte sin capital.',
      tag: 'Créditos',
      url: '/flayers/cobranzas.html'
    },
    {
      slug: 'fiestas-patrias',
      titulo: 'Fiestas Patrias',
      descripcion: 'Celebra el 28 de julio controlando tu negocio como corresponde.',
      tag: 'Perú',
      url: '/flayers/fiestas-patrias.html'
    }
  ];

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

  readonly whatsappDisplay = '993 289 440';
  readonly whatsappUrl =
    'https://wa.me/51993289440?text=' +
    encodeURIComponent(
      'Hola, quiero información sobre EFAFERP y el acompañamiento para configurar SUNAT.'
    );

  constructor(
    private sanitizer: DomSanitizer,
    private saasPublic: SaasPublicService
  ) {}

  ngOnInit(): void {
    this.videos = [
      this.crearVideo('pNDpE6WNHko', 'Presentación y Crear cuenta'),
      this.crearVideo('RsibE0r07Bk', 'Pasos iniciales de configuración'),
      this.crearVideo('vNkwHwWK3Hw', 'Gestión de cajas')
    ];
    this.cargarPlanes();
  }

  miniaturaUrl(videoId: string): string {
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }

  reproducirVideo(video: PublicVideo): void {
    if (video.reproduciendo) return;
    video.embedUrl = this.safeUrl(
      `https://www.youtube.com/embed/${video.id}?autoplay=1&start=0&rel=0`
    );
    video.reproduciendo = true;
  }

  private crearVideo(id: string, titulo: string): PublicVideo {
    return { id, titulo, reproduciendo: false, embedUrl: null };
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
