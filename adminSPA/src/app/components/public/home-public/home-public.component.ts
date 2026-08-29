import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DomSanitizer, Meta, SafeResourceUrl, Title } from '@angular/platform-browser';
import { SaasPublicService } from '../../../services/saas-public.service';
import { PlanCatalogoItem } from '../../../models/saas-public.model';
import { resumirLimitesPlan } from '../../../utils/saas-plan-resumen.util';

const SEO_TITLE = 'EFAFERP | Controla ventas, stock y créditos de tu negocio';
const SEO_DESCRIPTION =
  'Controla ventas, inventario y créditos en ferreterías, repuestos, pinturas, ropa deportiva y librerías. Facturación electrónica SUNAT incluida. Prueba 14 días gratis.';
const SEO_URL = 'https://businesssoft.net/';

interface PublicVideo {
  id: string;
  titulo: string;
  reproduciendo: boolean;
  embedUrl: SafeResourceUrl | null;
}

interface PublicReferido {
  nombre: string;
  negocio: string;
  rubro: string;
  comentario: string;
}

interface ClientePublico {
  nombre: string;
  rubro: string;
  iniciales: string;
  logo: string | null;
  fondoOscuro?: boolean;
}

interface RubroPublico {
  nombre: string;
  icono: string;
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
  /** Si el JPEG no carga (archivo borrado), se oculta la tarjeta. */
  readonly logosOcultos = signal<ReadonlySet<string>>(new Set());

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
    }
  ];

  readonly rubros: RubroPublico[] = [
    { nombre: 'Ferreterías', icono: 'bi bi-tools' },
    { nombre: 'Repuestos de motos y carros', icono: 'bi bi-gear-wide-connected' },
    { nombre: 'Tiendas de pintura', icono: 'bi bi-palette' },
    { nombre: 'Zapatillas y ropa deportiva', icono: 'bi bi-bag-check' },
    { nombre: 'Librerías', icono: 'bi bi-book' }
  ];

  readonly clientes: ClientePublico[] = [
    {
      nombre: 'Ferretería Itzel',
      rubro: 'Ferretería',
      iniciales: 'FI',
      logo: 'assets/img/clientes/itzel-ferreteria.jpeg'
    },
    {
      nombre: 'Mejia Racing Oil',
      rubro: 'Repuestos y lubricantes',
      iniciales: 'MR',
      logo: 'assets/img/clientes/mejia-racing-repuestos.jpeg'
    },
    {
      nombre: 'Drakko Nutrition',
      rubro: 'Nutrición',
      iniciales: 'DN',
      logo: 'assets/img/clientes/drako-nutrition.jpeg',
      fondoOscuro: true
    },
    {
      nombre: 'ACU E.I.R.L.',
      rubro: 'Repuestos de carros',
      iniciales: 'AC',
      logo: 'assets/img/clientes/acu-eirl-repuestos.jpeg'
    },
    {
      nombre: 'Ave Fenix San Juan Bautista',
      rubro: 'Ferretería',
      iniciales: 'AF',
      logo: 'assets/img/clientes/san-juan-bautista-ferreteria.jpeg'
    },
    {
      nombre: 'Ocupa Agroferretería',
      rubro: 'Agroferretería',
      iniciales: 'OA',
      logo: 'assets/img/clientes/ocupa-agroferreteria.jpeg'
    },
    {
      nombre: 'Comercializadora Perales',
      rubro: 'Ferretería',
      iniciales: 'CP',
      logo: 'assets/img/clientes/perales-ferreteria.jpeg'
    },
    {
      nombre: 'Shisel & Aron',
      rubro: 'Ferretería',
      iniciales: 'SA',
      logo: 'assets/img/clientes/shisel-y-aron-ferreteria.jpeg'
    }
  ];

  readonly referidos: PublicReferido[] = [
    {
      nombre: 'Nelver Q.',
      negocio: 'Ferretería Itzel',
      rubro: 'Ferretería',
      comentario: 'En una semana ya teníamos todo el stock ordenado y ventas claras.'
    },
    {
      nombre: 'Lucila T.',
      negocio: 'Ave Fenix San Juan Bautista',
      rubro: 'Ferretería',
      comentario: 'El control por sucursal nos ayudó a reducir pérdidas y tiempos.'
    },
    {
      nombre: 'Yeisi F.',
      negocio: 'Minimarket Fernandez',
      rubro: 'Minimarket',
      comentario: 'El sistema es simple de usar y el soporte responde rápido.'
    }
  ];

  readonly resumirLimitesPlan = resumirLimitesPlan;

  readonly whatsappDisplay = '993 289 440';
  readonly whatsappUrl =
    'https://wa.me/51993289440?text=' +
    encodeURIComponent(
      'Hola, quiero ver si EFAFERP me sirve. Tengo un negocio (ferretería, repuestos, pinturas, ropa deportiva o librería).'
    );

  constructor(
    private sanitizer: DomSanitizer,
    private saasPublic: SaasPublicService,
    private title: Title,
    private meta: Meta
  ) {}

  ngOnInit(): void {
    this.aplicarSeoPublico();
    this.videos = [
      this.crearVideo('pNDpE6WNHko', 'Presentación y Crear cuenta'),
      this.crearVideo('RsibE0r07Bk', 'Pasos iniciales de configuración'),
      this.crearVideo('vNkwHwWK3Hw', 'Gestión de cajas')
    ];
    this.cargarPlanes();
  }

  logoClienteVisible(cli: ClientePublico): boolean {
    return !this.logosOcultos().has(cli.nombre);
  }

  ocultarClienteSinLogo(cli: ClientePublico): void {
    this.logosOcultos.update((prev) => new Set(prev).add(cli.nombre));
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

  private aplicarSeoPublico(): void {
    this.title.setTitle(SEO_TITLE);
    this.meta.updateTag({ name: 'description', content: SEO_DESCRIPTION });
    this.meta.updateTag({ name: 'robots', content: 'index, follow' });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:locale', content: 'es_PE' });
    this.meta.updateTag({ property: 'og:site_name', content: 'EFAFERP' });
    this.meta.updateTag({ property: 'og:url', content: SEO_URL });
    this.meta.updateTag({ property: 'og:title', content: SEO_TITLE });
    this.meta.updateTag({ property: 'og:description', content: SEO_DESCRIPTION });
    this.meta.updateTag({ property: 'og:image', content: `${SEO_URL}assets/img/logo-efaferp.png` });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: SEO_TITLE });
    this.meta.updateTag({ name: 'twitter:description', content: SEO_DESCRIPTION });
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
