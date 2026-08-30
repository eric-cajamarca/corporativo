import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatComercialMensaje } from '../../../models/chat-comercial-publico.model';
import { ChatComercialPublicoService } from '../../../services/chat-comercial-publico.service';
import { ChatComercialPublicoUiService } from '../../../services/chat-comercial-publico-ui.service';

const SESSION_KEY = 'efaferp.chatComercial.sessionId';
const SALUDO: ChatComercialMensaje = {
  role: 'model',
  text: 'Hola. Soy el asesor comercial de EFAFERP. Cuéntame a qué se dedica tu negocio y te digo si te encaja. Si quieres la demo o pagar un plan, dímelo y te acompaño paso a paso. Si prefieres que te llamemos, deja tu nombre, celular y horario (lun–vie 9:00 a 18:00).'
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
