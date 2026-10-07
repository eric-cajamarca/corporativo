import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AsistenteDuenoService } from '../../services/asistente-dueno.service';
import { AsistenteDuenoUiService } from '../../services/asistente-dueno-ui.service';
import { PermisosService } from '../../services/permisos.service';
import { AsistenteEnlace, AsistenteMensaje } from '../../models/asistente-dueno.model';
import {
  capturarFotoPantalla,
  redactarMensajeUsuario
} from '../../utils/asistente-pantalla-snapshot.util';

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
  private readonly permisos = inject(PermisosService);

  @ViewChild('listaMensajes') listaMensajes?: ElementRef<HTMLDivElement>;

  mensajes: AsistenteMensaje[] = [
    {
      role: 'model',
      text: 'Soy el asistente de la plataforma. Pregúntame cómo emitir una boleta, registrar una compra, abrir caja o crear un producto. Te digo primero el menú y luego el siguiente clic.'
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
      const ruta = m[2];
      if (this.permisos.puedeAccederRutaPlan(ruta)) {
        out.push({ etiqueta: m[1], ruta });
      }
    }
    return out;
  }

  textoHtml(texto: string): string {
    const esc = String(texto || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return esc
      .replace(/\[([^\]]+)\]\((\/[a-zA-Z0-9/?=&_-]*)\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
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
    const rutaActual = this.router.url || '/';
    const tituloPagina = this.title.getTitle() || '';
    this.api
      .chat({
        mensaje: redactarMensajeUsuario(mensaje),
        historial,
        rutaActual,
        tituloPagina,
        fotoPantalla: capturarFotoPantalla(rutaActual, tituloPagina)
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
