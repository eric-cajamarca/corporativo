import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { ChatComercialMensaje } from '../../../models/chat-comercial-publico.model';
import { ChatComercialPublicoService } from '../../../services/chat-comercial-publico.service';
import { ChatComercialPublicoUiService } from '../../../services/chat-comercial-publico-ui.service';

const SESSION_KEY = 'efaferp.chatComercial.sessionId';
const SALUDO: ChatComercialMensaje = {
  role: 'model',
  text: 'Hola. Soy el asesor comercial de EFAFERP. Cuéntame a qué se dedica tu negocio y tus dudas: te respondo con lo que está publicado, sin inventar. No creo cuentas ni cobro; si quieres demo o un plan, te guío en la web. Si algo no lo tengo claro, agendamos una llamada con soporte.'
};

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

  extraerUrls(texto: string): string[] {
    return String(texto || '').match(/https?:\/\/[^\s)]+/g) || [];
  }

  /** Demo, planes y registro en la misma pestaña para no perder el hilo del chat. */
  abrirEnlace(ev: Event, url: string): void {
    const spa = this.rutaSpaMismaVentana(url);
    if (!spa) return;
    ev.preventDefault();
    this.ui.abrir();
    void this.router.navigateByUrl(spa);
  }

  esEnlaceExterno(url: string): boolean {
    return this.rutaSpaMismaVentana(url) == null;
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
    return String(texto || '').replace(/\*([^*]+)\*/g, '$1');
  }

  enviar(): void {
    const mensaje = this.form.controls.mensaje.value.trim();
    if (!mensaje) return;
    this.form.controls.mensaje.setValue('');
    this.enviarTexto(mensaje);
  }

  private enviarTexto(mensaje: string): void {
    const texto = String(mensaje || '').trim();
    if (!texto || this.enviando) return;
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
        this.enviando = false;
        this.scrollAlFinal();
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.error = err?.error?.message || err?.message || 'No se pudo enviar el mensaje.';
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
