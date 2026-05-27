import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { WhatsappBotService } from '../../../services/whatsapp-bot.service';
import {
  WhatsappBotCatalogoStatus,
  WhatsappBotConfig,
  WhatsappBotEscalada,
  WhatsappBotLogEntry,
  WhatsappBotSinonimo
} from '../../../interfaces/whatsapp-bot-interface';

@Component({
  selector: 'app-whatsapp-bot',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SidebarComponent, TopnavComponent],
  templateUrl: './whatsapp-bot.component.html',
  styleUrl: './whatsapp-bot.component.css'
})
export class WhatsappBotComponent implements OnInit {
  sidebarState = inject(SidebarStateService);
  private fb = inject(FormBuilder);
  private botService = inject(WhatsappBotService);

  pestaniaActiva: 'general' | 'catalogo' | 'sinonimos' | 'logs' | 'escaladas' = 'general';
  cargando = false;
  mensaje = '';
  error = '';
  /** Servicio Factiliza WHATSAPP BOT habilitado en plataforma para esta empresa. */
  servicioAutorizado = true;
  catalogoStatus: WhatsappBotCatalogoStatus | null = null;
  sinonimos: WhatsappBotSinonimo[] = [];
  logs: WhatsappBotLogEntry[] = [];
  escaladas: WhatsappBotEscalada[] = [];

  configForm = this.fb.group({
    activoBot: [true],
    mensajeBienvenida: ['', [Validators.required, Validators.maxLength(500)]],
    mensajeNoRegistrado: ['', [Validators.required, Validators.maxLength(500)]],
    humanizar: [true],
    tonoFormal: [false],
    usarEmojis: [true],
    delayMaxMs: [3000, [Validators.min(0), Validators.max(15000)]],
    mensajeDespedida: ['', [Validators.maxLength(500)]],
    escalamientoActivo: [true],
    numeroEscalamiento: ['', [Validators.maxLength(20)]],
    escalamientoTimeoutMin: [60, [Validators.min(1), Validators.max(1440)]],
    umbralNoEntiendoEscalar: [3, [Validators.min(0), Validators.max(20)]]
  });

  sinonimoForm = this.fb.group({
    terminoEntrada: ['', [Validators.required, Validators.maxLength(120)]],
    terminoBusqueda: ['', [Validators.required, Validators.maxLength(120)]]
  });

  ngOnInit(): void {
    this.configForm.get('escalamientoActivo')?.valueChanges.subscribe(() => {
      this.aplicarEstadoCamposEscalamiento();
    });
    this.cargarTodo();
  }

  cargarTodo(): void {
    this.cargando = true;
    this.error = '';
    this.botService.getConfig().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.servicioAutorizado = res.data.servicioAutorizado !== false;
          this.configForm.patchValue({
            activoBot: !!res.data.activoBot,
            mensajeBienvenida: res.data.mensajeBienvenida,
            mensajeNoRegistrado: res.data.mensajeNoRegistrado,
            humanizar: res.data.humanizar !== false,
            tonoFormal: !!res.data.tonoFormal,
            usarEmojis: res.data.usarEmojis !== false,
            delayMaxMs: res.data.delayMaxMs ?? 3000,
            mensajeDespedida: res.data.mensajeDespedida || '',
            escalamientoActivo: res.data.escalamientoActivo !== false,
            numeroEscalamiento: res.data.numeroEscalamiento || '',
            escalamientoTimeoutMin: res.data.escalamientoTimeoutMin ?? 60,
            umbralNoEntiendoEscalar: res.data.umbralNoEntiendoEscalar ?? 3
          });
          this.aplicarEstadoControlActivoBot();
          this.aplicarEstadoCamposEscalamiento();
        }
        if (this.servicioAutorizado) {
          this.cargarCatalogoStatus();
          this.cargarSinonimos();
          this.cargarLogs();
          this.cargarEscaladas();
        } else {
          this.catalogoStatus = null;
          this.sinonimos = [];
          this.logs = [];
          this.cargando = false;
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al cargar configuracion';
        this.cargando = false;
      }
    });
  }

  private aplicarEstadoControlActivoBot(): void {
    const ctrl = this.configForm.get('activoBot');
    if (!ctrl) return;
    if (!this.servicioAutorizado) {
      ctrl.setValue(false, { emitEvent: false });
      ctrl.disable({ emitEvent: false });
    } else {
      ctrl.enable({ emitEvent: false });
    }
  }

  private aplicarEstadoCamposEscalamiento(): void {
    const activo = this.configForm.get('escalamientoActivo')?.value === true;
    const campos = ['numeroEscalamiento', 'escalamientoTimeoutMin', 'umbralNoEntiendoEscalar'];
    for (const nombre of campos) {
      const c = this.configForm.get(nombre);
      if (!c) continue;
      if (activo) c.enable({ emitEvent: false });
      else c.disable({ emitEvent: false });
    }
  }

  /** Solo digitos; vacio = null (backend usa telefono vinculado del bot). */
  private normalizarNumeroEscalamiento(valor: string | null | undefined): string | null {
    const digits = String(valor || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length < 9 || digits.length > 15) {
      throw new Error('Numero de escalamiento invalido: use 9 a 15 digitos (ej. 51999999999)');
    }
    return digits;
  }

  private armarPayloadConfig(): Partial<WhatsappBotConfig> {
    const raw = this.configForm.getRawValue();
    let numeroEscalamiento: string | null = null;
    try {
      numeroEscalamiento = this.normalizarNumeroEscalamiento(raw.numeroEscalamiento);
    } catch (e) {
      throw e;
    }
    const mensajeDespedida = String(raw.mensajeDespedida || '').trim();
    return {
      activoBot: !!raw.activoBot,
      mensajeBienvenida: raw.mensajeBienvenida || '',
      mensajeNoRegistrado: raw.mensajeNoRegistrado || '',
      humanizar: !!raw.humanizar,
      tonoFormal: !!raw.tonoFormal,
      usarEmojis: !!raw.usarEmojis,
      delayMaxMs: Number(raw.delayMaxMs) || 3000,
      mensajeDespedida: mensajeDespedida || null,
      escalamientoActivo: !!raw.escalamientoActivo,
      numeroEscalamiento,
      escalamientoTimeoutMin: Number(raw.escalamientoTimeoutMin) || 60,
      umbralNoEntiendoEscalar: Number(raw.umbralNoEntiendoEscalar) ?? 3
    };
  }

  cargarCatalogoStatus(): void {
    this.botService.catalogoStatus().subscribe({
      next: (res) => {
        this.catalogoStatus = res.data || null;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      }
    });
  }

  cargarSinonimos(): void {
    this.botService.listarSinonimos().subscribe({
      next: (res) => {
        this.sinonimos = res.data || [];
      }
    });
  }

  cargarLogs(): void {
    this.botService.listarLogs(50).subscribe({
      next: (res) => {
        this.logs = res.data || [];
      }
    });
  }

  guardarConfig(): void {
    if (this.configForm.invalid) return;
    let payload: Partial<WhatsappBotConfig>;
    try {
      payload = this.armarPayloadConfig();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Numero de escalamiento invalido';
      return;
    }
    if (!this.servicioAutorizado) {
      payload.activoBot = false;
    }
    this.error = '';
    this.botService.updateConfig(payload).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.servicioAutorizado = res.data.servicioAutorizado !== false;
          this.configForm.patchValue({
            activoBot: !!res.data.activoBot,
            numeroEscalamiento: res.data.numeroEscalamiento || ''
          }, { emitEvent: false });
          this.aplicarEstadoControlActivoBot();
        }
        this.mensaje = 'Configuracion guardada';
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al guardar';
      }
    });
  }

  cargarEscaladas(): void {
    this.botService.listarEscaladas().subscribe({
      next: (res) => {
        this.escaladas = res.data || [];
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al cargar escaladas';
      }
    });
  }

  desescalar(telefonoCliente: string): void {
    const tel = String(telefonoCliente || '').replace(/\D/g, '');
    if (!tel) return;
    this.botService.desescalarManual(tel).subscribe({
      next: () => {
        this.mensaje = 'Conversacion liberada; el bot puede responder de nuevo';
        this.cargarEscaladas();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al desescalar';
      }
    });
  }

  etiquetaMotivoEscalada(motivo: string | null): string {
    if (motivo === 'umbral') return 'Bot no entendio varias veces';
    if (motivo === 'admin') return 'Liberado por admin';
    if (motivo === 'cliente') return 'Cliente lo pidio';
    return motivo || '—';
  }

  sincronizarCatalogo(): void {
    this.cargando = true;
    this.botService.syncCatalogo().subscribe({
      next: (res) => {
        this.mensaje = `Catalogo sincronizado: ${res.data?.productos || 0} productos`;
        this.cargarCatalogoStatus();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al sincronizar catalogo';
        this.cargando = false;
      }
    });
  }

  agregarSinonimo(): void {
    if (this.sinonimoForm.invalid) return;
    const v = this.sinonimoForm.getRawValue();
    this.botService.crearSinonimo(v.terminoEntrada || '', v.terminoBusqueda || '').subscribe({
      next: (res) => {
        this.sinonimos = res.data || [];
        this.sinonimoForm.reset();
        this.mensaje = 'Sinonimo agregado';
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al agregar sinonimo';
      }
    });
  }

  quitarSinonimo(id: string): void {
    this.botService.eliminarSinonimo(id).subscribe({
      next: (res) => {
        this.sinonimos = res.data || [];
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al eliminar sinonimo';
      }
    });
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
