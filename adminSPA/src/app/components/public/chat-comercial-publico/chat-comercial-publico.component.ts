import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { ChatComercialMensaje, QuickChip, EnlaceAccionChat } from '../../../models/chat-comercial-publico.model';
import { ChatComercialPublicoService } from '../../../services/chat-comercial-publico.service';
import { ChatComercialPublicoUiService } from '../../../services/chat-comercial-publico-ui.service';

const SESSION_KEY = 'efaferp.chatComercial.sessionId';
const SALUDO: ChatComercialMensaje = {
  role: 'model',
  text: '¡Hola! Qué gusto saludarte 👋 Soy tu asesor comercial en EFAFERP (BUSINESS SOFT).\n\nEstoy aquí para orientarte y ayudarte a encontrar la mejor opción para tu negocio, con total transparencia.\n\nCuéntame, ¿cómo te llamas y qué tipo de tienda o negocio tienes? (O si tienes alguna consulta puntual sobre precios, stock o facturación SUNAT, dime con toda confianza).'
};

const CHIPS_RUBROS_INICIALES: QuickChip[] = [
  { id: 'avicola', label: '🍗 Avícola', textToSend: 'Tengo una avícola' },
  { id: 'ferreteria', label: '🔧 Ferretería', textToSend: 'Tengo una ferretería' },
  { id: 'abarrotes', label: '📦 Abarrotes / Minimarket', textToSend: 'Tengo un minimarket de abarrotes' },
  { id: 'repuestos', label: '🏍️ Repuestos', textToSend: 'Tengo una tienda de repuestos' },
  { id: 'ropa', label: '👕 Ropa / Calzado', textToSend: 'Tengo una tienda de ropa y calzado' },
  { id: 'botica', label: '💊 Botica / Farmacia', textToSend: 'Tengo una botica o farmacia' },
  { id: 'carniceria', label: '🥩 Carnicería', textToSend: 'Tengo una carnicería' }
];

@Component({
  selector: 'app-chat-comercial-publico',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chat-comercial-publico.component.html',
  styleUrl: './chat-comercial-publico.component.css'
})
export class ChatComercialPublicoComponent {
  readonly ui = inject(ChatComercialPublicoUiService);
  private readonly api = inject(ChatComercialPublicoService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  @ViewChild('listaMensajes') listaMensajes?: ElementRef<HTMLDivElement>;

  mensajes: ChatComercialMensaje[] = [SALUDO];
  chipsActuales: QuickChip[] = [...CHIPS_RUBROS_INICIALES];
  enviando = false;
  error = '';
  sessionId: string | null = null;

  readonly form = this.fb.nonNullable.group({
    mensaje: ['', [Validators.required, Validators.maxLength(800)]]
  });

  constructor() {
    try {
      this.sessionId = sessionStorage.getItem(SESSION_KEY);
    } catch {
      this.sessionId = null;
    }
    this.chipsActuales = this.sessionId ? [] : [...CHIPS_RUBROS_INICIALES];

    effect(() => {
      if (!this.ui.abierto() || this.enviando) return;
      const pending = this.ui.pendingSend();
      if (!pending) return;
      queueMicrotask(() => {
        const msg = this.ui.tomarPending();
        if (msg) this.enviarTexto(msg);
      });
    });
  }

  esImagen(url: string | null | undefined): boolean {
    return /\.(png|jpe?g|webp|gif)(\?|$)/i.test(String(url || ''));
  }

  enlacesMensaje(texto: string): EnlaceAccionChat[] {
    const rawUrls = String(texto || '').match(/https?:\/\/[^\s)]+/g) || [];
    const resultado: EnlaceAccionChat[] = [];
    const etiquetasVistas = new Set<string>();
    const urlsVistas = new Set<string>();

    for (const raw of rawUrls) {
      const url = raw.replace(/[.,;:!]+$/, '').trim();
      if (!url) continue;
      const urlLower = url.toLowerCase();
      if (urlsVistas.has(urlLower)) continue;

      const label = this.etiquetaEnlace(url);
      if (etiquetasVistas.has(label)) continue;

      urlsVistas.add(urlLower);
      etiquetasVistas.add(label);
      resultado.push({ url, label });
    }

    return resultado;
  }

  extraerUrls(texto: string): string[] {
    return this.enlacesMensaje(texto).map(e => e.url);
  }

  /** Demo, planes y registro en la misma pestaña para no perder el hilo del chat. */
  abrirEnlace(ev: Event, url: string): void {
    const spa = this.rutaSpaMismaVentana(url);
    if (!spa) return;
    ev.preventDefault();
    this.ui.cerrar();
    void this.router.navigateByUrl(spa);
  }

  esEnlaceExterno(url: string): boolean {
    return this.rutaSpaMismaVentana(url) == null;
  }

  etiquetaEnlace(url: string): string {
    const u = String(url || '').toLowerCase();
    if (u.includes('/suscribirse/demo') || u.includes('demo')) {
      return '🚀 Probar demo 14 días gratis';
    }
    if (u.includes('/planes')) {
      return '📋 Ver planes y precios';
    }
    if (u.includes('/suscribirse/')) {
      return '💳 Contratar plan';
    }
    if (u.includes('/flayers') || u.includes('guia') || u.includes('guías')) {
      return '📖 Ver guía práctica';
    }
    if (u.includes('libro-reclamaciones')) {
      return '📄 Libro de reclamaciones';
    }
    return '🔗 Ir a la página';
  }

  private rutaSpaMismaVentana(raw: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(String(raw || '').trim(), window.location.origin);
    } catch {
      return null;
    }
    if (/\.[a-z0-9]{2,4}$/i.test(parsed.pathname)) return null;
    const ruta = `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
    const path = ruta.startsWith('/') ? ruta : `/${ruta}`;
    if (this.esRutaPublicaConocida(parsed.pathname)) return path;
    if (!this.esHostDeEstaApp(parsed.hostname)) return null;
    return path;
  }

  private esRutaPublicaConocida(pathname: string): boolean {
    const p = (pathname || '/').toLowerCase();
    return (
      p === '/planes' ||
      p.startsWith('/planes/') ||
      p.startsWith('/suscribirse') ||
      p.startsWith('/cuenta/planes') ||
      p.startsWith('/cuenta/pagar') ||
      p.startsWith('/crear-empresa') ||
      p.startsWith('/verificar-empresa') ||
      p.startsWith('/politicas') ||
      p.startsWith('/publico')
    );
  }

  private esHostDeEstaApp(hostname: string): boolean {
    const host = hostname.replace(/^www\./i, '').toLowerCase();
    const actual = window.location.hostname.replace(/^www\./i, '').toLowerCase();
    if (host === actual) return true;
    try {
      const front = new URL(environment.FRONTEND_URL).hostname.replace(/^www\./i, '').toLowerCase();
      return host === front;
    } catch {
      return false;
    }
  }

  textoVisible(texto: string): string {
    return String(texto || '')
      .replace(/(?:1\.\s*Abre:?\s*)https?:\/\/[^\s)]+/gi, '1. Ingresa a la demo desde el botón de abajo:')
      .replace(/(?:Demo:?\s*)https?:\/\/[^\s)]+/gi, 'Puedes probar la demo desde el botón de abajo:')
      .replace(/(?:Precios vigentes y transparentes en:?\s*)https?:\/\/[^\s)]+/gi, 'Puedes consultar los planes y precios desde el botón de abajo:')
      .replace(/(?:👉\s*\*?Ver planes y pagar:\*?\s*)https?:\/\/[^\s)]+/gi, 'Accede a los planes y opciones de pago con el botón de abajo:')
      .replace(/👉\s*https?:\/\/[^\s)]+/gi, '')
      .replace(/https?:\/\/[^\s)]+/g, '')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  reiniciarChat(): void {
    this.mensajes = [SALUDO];
    this.chipsActuales = [...CHIPS_RUBROS_INICIALES];
    this.sessionId = null;
    this.error = '';
    this.enviando = false;
    this.form.reset();
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  enviar(): void {
    const mensaje = this.form.controls.mensaje.value.trim();
    if (!mensaje) return;
    this.chipsActuales = [];
    this.form.controls.mensaje.setValue('');
    this.enviarTexto(mensaje);
  }

  chipsDisponibles(): QuickChip[] {
    if (this.enviando) return [];
    return this.chipsActuales;
  }

  onSelectChip(chip: QuickChip): void {
    if (this.enviando) return;
    this.chipsActuales = [];
    this.enviarTexto(chip.textToSend);
  }

  private enviarTexto(mensaje: string): void {
    const texto = String(mensaje || '').trim();
    if (!texto || this.enviando) return;
    this.chipsActuales = [];
    this.error = '';
    this.mensajes = [...this.mensajes, { role: 'user', text: texto }];
    this.enviando = true;
    this.scrollAlFinal();

    const pagina = this.ui.pagina();
    this.api.chatear({
      mensaje: texto,
      sessionId: this.sessionId,
      rutaActual: pagina.ruta || this.router.url || '/',
      pasoRegistro: pagina.paso || undefined,
      errorPantalla: pagina.errorPantalla || undefined
    }).subscribe({
      next: (data) => {
        if (data?.sessionId) {
          this.sessionId = data.sessionId;
          try {
            sessionStorage.setItem(SESSION_KEY, data.sessionId);
          } catch {
            /* sessionStorage puede estar bloqueado */
          }
        }
        this.mensajes = [
          ...this.mensajes,
          {
            role: 'model',
            text: data?.respuesta || 'No hubo respuesta.',
            imagenUrl: data?.imagenUrl || null
          }
        ];
        this.chipsActuales = Array.isArray(data?.chips) ? data.chips : [];
        this.enviando = false;
        this.scrollAlFinal();
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.error = err?.error?.message || err?.message || 'No se pudo enviar el mensaje.';
        this.chipsActuales = [];
        this.enviando = false;
        this.scrollAlFinal();
      }
    });
  }

  private scrollAlFinal(): void {
    setTimeout(() => {
      const el = this.listaMensajes?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 40);
  }
}
