import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DomSanitizer, Meta, SafeResourceUrl, Title } from '@angular/platform-browser';
import { SaasPublicService } from '../../../services/saas-public.service';
import { PlanCatalogoItem } from '../../../models/saas-public.model';
import { mesesGratisAnual, resumirLimitesPlan } from '../../../utils/saas-plan-resumen.util';
import { ChatComercialPublicoUiService } from '../../../services/chat-comercial-publico-ui.service';

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

interface ValorAgregadoSlide {
  titulo: string;
  descripcion: string;
  nota?: string;
  imagen: string;
}

@Component({
  selector: 'app-home-public',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home-public.component.html',
  styleUrl: './home-public.component.css'
})
export class HomePublicComponent implements OnInit, OnDestroy {
  readonly planes = signal<PlanCatalogoItem[]>([]);
  readonly cargandoPlanes = signal(true);
  readonly errorPlanes = signal<string | null>(null);

  videos: PublicVideo[] = [];
  /** Si el JPEG no carga (archivo borrado), se oculta la tarjeta. */
  readonly logosOcultos = signal<ReadonlySet<string>>(new Set());

  readonly valorAgregado: ValorAgregadoSlide[] = [
    {
      titulo: 'WhatsApp te avisa los lotes por vencer',
      descripcion: 'Cada día te llega qué ya venció y qué caduca en 7, 15 o 30 días. Ofertas a tiempo o das de baja, sin revisar el almacén a ciegas.',
      imagen: 'assets/img/valor-agregado/flayer-lotes-vencidos-whatsapp.webp'
    },
    {
      titulo: 'La factura de compra se carga desde SUNAT',
      descripcion: 'Escribes RUC, serie y número. Llegan todos los ítems. Confirmas y el stock sube. No tecleas dieciocho productos uno por uno.',
      imagen: 'assets/img/valor-agregado/flayer-compra-factura-sunat.webp'
    },
    {
      titulo: 'En el matizado controlas hasta la última gota',
      descripcion: 'La receta está en gramos. Si piden 1/4, se escala sola. El kardex resta solo lo que usaste, no el pote entero.',
      imagen: 'assets/img/valor-agregado/flayer-pintura-matizado-ultima-gota.webp'
    },
    {
      titulo: 'El arqueo te dice dónde está el dinero',
      descripcion: 'Efectivo en el cajón, Yape en el celular, cuenta corriente en el banco. El fiado no se mezcla con lo que sí entró.',
      imagen: 'assets/img/valor-agregado/flayer-cierre-caja.webp'
    },
    {
      titulo: 'El WhatsApp de tu tienda cotiza y cobra',
      descripcion: 'El cliente pregunta precio, arma el pedido y, si debe, le responde el saldo. Sin llamar al mostrador.',
      nota: 'Bot de pedidos: planes Emprendedor y Profesional.',
      imagen: 'assets/img/valor-agregado/flayer-pedidos-whatsapp.webp'
    }
  ];
  readonly valorIndice = signal(0);
  private valorTimer: ReturnType<typeof setInterval> | null = null;
  private valorPausado = false;

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
      nombre: 'Carlos P.',
      negocio: 'Comercializadora Perales',
      rubro: 'Ferretería',
      comentario: 'Controlamos más de 3,500 productos y reducimos el tiempo de facturación y cuadre de caja de 2 horas a 15 minutos.'
    }
  ];

  readonly resumirLimitesPlan = resumirLimitesPlan;
  readonly mesesGratisAnual = mesesGratisAnual;

  readonly whatsappDisplay = '993 289 440';
  readonly chatUi = inject(ChatComercialPublicoUiService);

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
    this.iniciarCarruselValor();
  }

  ngOnDestroy(): void {
    this.detenerCarruselValor();
  }

  slideValor(): ValorAgregadoSlide {
    return this.valorAgregado[this.valorIndice()];
  }

  irAValor(indice: number): void {
    const n = this.valorAgregado.length;
    if (!n) return;
    this.valorIndice.set(((indice % n) + n) % n);
  }

  siguienteValor(): void {
    this.irAValor(this.valorIndice() + 1);
  }

  anteriorValor(): void {
    this.irAValor(this.valorIndice() - 1);
  }

  pausarCarruselValor(): void {
    this.valorPausado = true;
  }

  reanudarCarruselValor(): void {
    this.valorPausado = false;
  }

  private iniciarCarruselValor(): void {
    this.detenerCarruselValor();
    this.valorTimer = setInterval(() => {
      if (!this.valorPausado) {
        this.siguienteValor();
      }
    }, 5500);
  }

  private detenerCarruselValor(): void {
    if (this.valorTimer != null) {
      clearInterval(this.valorTimer);
      this.valorTimer = null;
    }
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
    return planCode === 'basico';
  }

  cotizarEnterprise(): void {
    this.chatUi.abrir('Hola, deseo cotizar el plan Enterprise para mi empresa.');
  }

  private safeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
