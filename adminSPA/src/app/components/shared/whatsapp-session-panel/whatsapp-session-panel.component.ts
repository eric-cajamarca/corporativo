import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WhatsappService } from '../../../services/whatsapp.service';
import {
  WhatsappProveedor,
  WhatsappSessionData
} from '../../../interfaces/whatsapp-interface';

@Component({
  selector: 'app-whatsapp-session-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './whatsapp-session-panel.component.html',
  styleUrl: './whatsapp-session-panel.component.css'
})
export class WhatsappSessionPanelComponent implements OnInit, OnDestroy {
  @Input() compact = false;
  @Output() sessionChange = new EventEmitter<WhatsappSessionData | null>();

  session: WhatsappSessionData | null = null;
  cargando = false;
  iniciando = false;
  desvinculando = false;
  errorMsg: string | null = null;
  proveedorSeleccionado: WhatsappProveedor = 'baileys';

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private whatsappService: WhatsappService) {}

  ngOnInit(): void {
    this.refrescarEstado(false);
  }

  ngOnDestroy(): void {
    this.detenerPolling();
  }

  get conectado(): boolean {
    return this.whatsappService.puedeEnviar(this.session);
  }

  get usaBaileys(): boolean {
    return (
      this.proveedorSeleccionado === 'baileys' ||
      String(this.session?.proveedor || '').toLowerCase() === 'baileys'
    );
  }

  get muestraQr(): boolean {
    return this.usaBaileys && !!this.session?.qrDataUrl && !this.conectado;
  }

  get esperandoQr(): boolean {
    const st = String(this.session?.estadoSesion || '').toLowerCase();
    return this.usaBaileys && !this.conectado && (st === 'conectando' || st === 'qr_pendiente' || st === 'reconectando');
  }

  claseBadgeEstado(): string {
    const st = String(this.session?.estadoSesion || '').toLowerCase();
    if (st === 'conectado') return 'bg-success';
    if (st === 'qr_pendiente') return 'bg-primary';
    if (st === 'error') return 'bg-danger';
    if (st === 'conectando' || st === 'reconectando') return 'bg-warning text-dark';
    return 'bg-secondary';
  }

  refrescarEstado(silent = true): void {
    if (!silent) this.cargando = true;
    this.errorMsg = null;
    this.whatsappService.getSessionStatus().subscribe({
      next: (res) => {
        this.cargando = false;
        if (res.success && res.data) {
          this.aplicarSesion(res.data);
        } else {
          this.errorMsg = res.message || 'No se pudo obtener el estado de WhatsApp';
        }
      },
      error: (err) => {
        this.cargando = false;
        this.errorMsg = err?.error?.message || err?.message || 'Error al consultar sesión';
      }
    });
  }

  cambiarProveedor(): void {
    this.cargando = true;
    this.errorMsg = null;
    this.whatsappService.setProveedor(this.proveedorSeleccionado).subscribe({
      next: (res) => {
        this.cargando = false;
        if (res.success) {
          this.refrescarEstado(true);
        } else {
          this.errorMsg = res.message || 'No se pudo cambiar el proveedor';
        }
      },
      error: (err) => {
        this.cargando = false;
        this.errorMsg = err?.error?.message || err?.message || 'Error al cambiar proveedor';
      }
    });
  }

  conectarBaileys(): void {
    if (this.proveedorSeleccionado !== 'baileys') {
      this.proveedorSeleccionado = 'baileys';
      this.whatsappService.setProveedor('baileys').subscribe({
        next: () => this.iniciarSesion(),
        error: (err) => {
          this.errorMsg = err?.error?.message || err?.message || 'Error al activar Baileys';
        }
      });
      return;
    }
    this.iniciarSesion();
  }

  iniciarSesion(): void {
    this.iniciando = true;
    this.errorMsg = null;
    this.whatsappService.startSession().subscribe({
      next: (res) => {
        this.iniciando = false;
        if (res.success && res.data) {
          this.aplicarSesion({
            ...res.data,
            proveedor: res.data.proveedor || 'baileys'
          });
          if (res.data.mensaje && !res.data.qrDataUrl && !this.conectado) {
            this.errorMsg = res.data.mensaje;
          }
        } else {
          this.errorMsg = res.message || 'No se pudo iniciar la sesión';
        }
      },
      error: (err) => {
        this.iniciando = false;
        this.errorMsg = err?.error?.message || err?.message || 'Error al iniciar sesión';
      }
    });
  }

  desvincular(): void {
    if (!confirm('¿Cerrar la sesión de WhatsApp en este equipo?')) return;
    this.desvinculando = true;
    this.whatsappService.logoutSession().subscribe({
      next: () => {
        this.desvinculando = false;
        this.refrescarEstado(true);
      },
      error: (err) => {
        this.desvinculando = false;
        this.errorMsg = err?.error?.message || err?.message || 'Error al desvincular';
      }
    });
  }

  etiquetaEstado(estado: string | undefined): string {
    const map: Record<string, string> = {
      desconectado: 'Desconectado',
      conectando: 'Conectando…',
      qr_pendiente: 'Escanee el código QR',
      conectado: 'Conectado',
      reconectando: 'Reconectando…',
      error: 'Error de conexión'
    };
    return map[String(estado || '').toLowerCase()] || estado || '—';
  }

  private ajustarPolling(): void {
    const prov = String(this.session?.proveedor || '').toLowerCase();
    const st = String(this.session?.estadoSesion || '').toLowerCase();
    if (prov === 'baileys' && (st === 'qr_pendiente' || st === 'conectando' || st === 'reconectando')) {
      this.iniciarPolling();
    } else {
      this.detenerPolling();
    }
  }

  private iniciarPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.refrescarEstado(true), 3000);
  }

  private detenerPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private aplicarSesion(data: WhatsappSessionData): void {
    this.session = data;
    this.proveedorSeleccionado =
      String(data.proveedor).toLowerCase() === 'baileys' ? 'baileys' : 'factiliza';
    if (data.lastError && !this.conectado && !data.qrDataUrl) {
      this.errorMsg = data.mensaje || data.lastError;
    } else if (data.mensaje && !this.conectado && !data.qrDataUrl) {
      this.errorMsg = data.mensaje;
    } else if (this.conectado || data.qrDataUrl) {
      this.errorMsg = null;
    }
    this.sessionChange.emit(this.session);
    this.ajustarPolling();
  }
}
