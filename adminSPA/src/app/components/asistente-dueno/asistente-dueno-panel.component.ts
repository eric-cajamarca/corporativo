import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AsistenteDuenoService } from '../../services/asistente-dueno.service';
import { AsistenteDuenoUiService } from '../../services/asistente-dueno-ui.service';
import { AsistenteEnlace, AsistenteMensaje } from '../../models/asistente-dueno.model';

@Component({
  selector: 'app-asistente-dueno-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './asistente-dueno-panel.component.html',
  styleUrl: './asistente-dueno-panel.component.css'
})
export class AsistenteDuenoPanelComponent {
  readonly ui = inject(AsistenteDuenoUiService);
  private readonly api = inject(AsistenteDuenoService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly fb = inject(FormBuilder);

  @ViewChild('listaMensajes') listaMensajes?: ElementRef<HTMLDivElement>;

  mensajes: AsistenteMensaje[] = [
    {
      role: 'model',
      text: 'Soy el asistente de la plataforma. Pregúntame cómo configurar SUNAT, agregar productos o qué te está faltando. Te guiaré paso a paso.'
    }
  ];
  enviando = false;
  error = '';
  gemini = true;

  readonly form = this.fb.nonNullable.group({
    mensaje: ['', [Validators.required, Validators.maxLength(2000)]]
  });

  constructor() {
    this.api.estado().subscribe({
      next: (r) => {
        if (typeof r.data?.gemini === 'boolean') {
          this.gemini = r.data.gemini;
        } else {
          this.gemini = r.data?.configurado !== false;
        }
      },
      error: () => {
        this.gemini = false;
      }
    });
  }

  extraerEnlaces(texto: string): AsistenteEnlace[] {
    const out: AsistenteEnlace[] = [];
    const re = /\[([^\]]+)\]\((\/[a-zA-Z0-9/?=&_-]*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) != null) {
      out.push({ etiqueta: m[1], ruta: m[2] });
    }
    return out;
  }

  textoVisible(texto: string): string {
    return texto.replace(/\[([^\]]+)\]\((\/[a-zA-Z0-9/?=&_-]*)\)/g, '$1');
  }

  irA(ruta: string): void {
    void this.router.navigateByUrl(ruta);
  }

  enviar(): void {
    if (this.enviando) return;
    const mensaje = this.form.controls.mensaje.value.trim();
    if (!mensaje) return;
    this.error = '';
    this.form.controls.mensaje.setValue('');
    this.mensajes = [...this.mensajes, { role: 'user', text: mensaje }];
    this.enviando = true;
    this.scrollAlFinal();

    const historial = this.mensajes.slice(0, -1).filter((x, i) => i > 0);
    this.api
      .chat({
        mensaje,
        historial,
        rutaActual: this.router.url || '/',
        tituloPagina: this.title.getTitle() || ''
      })
      .subscribe({
        next: (r) => {
          const respuesta = r.data?.respuesta || 'No hubo respuesta.';
          this.mensajes = [...this.mensajes, { role: 'model', text: respuesta }];
          this.enviando = false;
          this.scrollAlFinal();
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.error = err?.error?.message || err?.message || 'No se pudo consultar el asistente.';
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
