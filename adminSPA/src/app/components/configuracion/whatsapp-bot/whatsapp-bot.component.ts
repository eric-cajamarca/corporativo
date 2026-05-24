import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { WhatsappBotService } from '../../../services/whatsapp-bot.service';
import { WhatsappBotCatalogoStatus, WhatsappBotLogEntry, WhatsappBotSinonimo } from '../../../interfaces/whatsapp-bot-interface';

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

  pestaniaActiva: 'general' | 'catalogo' | 'sinonimos' | 'logs' = 'general';
  cargando = false;
  mensaje = '';
  error = '';
  /** Servicio Factiliza WHATSAPP BOT habilitado en plataforma para esta empresa. */
  servicioAutorizado = true;
  catalogoStatus: WhatsappBotCatalogoStatus | null = null;
  sinonimos: WhatsappBotSinonimo[] = [];
  logs: WhatsappBotLogEntry[] = [];

  configForm = this.fb.group({
    activoBot: [true],
    mensajeBienvenida: ['', [Validators.required, Validators.maxLength(500)]],
    mensajeNoRegistrado: ['', [Validators.required, Validators.maxLength(500)]]
  });

  sinonimoForm = this.fb.group({
    terminoEntrada: ['', [Validators.required, Validators.maxLength(120)]],
    terminoBusqueda: ['', [Validators.required, Validators.maxLength(120)]]
  });

  ngOnInit(): void {
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
            mensajeNoRegistrado: res.data.mensajeNoRegistrado
          });
          this.aplicarEstadoControlActivoBot();
        }
        if (this.servicioAutorizado) {
          this.cargarCatalogoStatus();
          this.cargarSinonimos();
          this.cargarLogs();
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
    const raw = this.configForm.getRawValue();
    if (!this.servicioAutorizado) {
      raw.activoBot = false;
    }
    this.botService.updateConfig(raw as { activoBot: boolean; mensajeBienvenida: string; mensajeNoRegistrado: string }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.servicioAutorizado = res.data.servicioAutorizado !== false;
          this.configForm.patchValue({ activoBot: !!res.data.activoBot }, { emitEvent: false });
          this.aplicarEstadoControlActivoBot();
        }
        this.mensaje = 'Configuracion guardada';
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al guardar';
      }
    });
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
