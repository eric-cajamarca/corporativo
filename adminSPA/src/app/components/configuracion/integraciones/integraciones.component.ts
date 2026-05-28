import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmpresaService } from '../../../services/empresa.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { RouterModule } from '@angular/router';

declare var iziToast: any;

interface CredencialForm {
  clave: string;
  valor: string;
}

interface IntegracionesFlags {
  twilioHabilitado: boolean;
  izipayHabilitado: boolean;
  culqiHabilitado: boolean;
  apisPeruHabilitado: boolean;
  factilizaHabilitado: boolean;
}

const PROVEEDORES = [
  { id: 'twilio', nombre: 'Twilio (WhatsApp)', keys: ['accountSid', 'authToken', 'whatsappFrom'], flag: 'twilioHabilitado' },
  { id: 'izipay', nombre: 'Izipay (Pagos)', keys: ['merchantId', 'publicKey', 'secretKey', 'hmacSha256'], flag: 'izipayHabilitado' },
  { id: 'culqi', nombre: 'Culqi (Pagos)', keys: ['publicKey', 'secretKey'], flag: 'culqiHabilitado' },
] as const;

@Component({
  selector: 'app-integraciones',
  standalone: true,
  imports: [CommonModule, FormsModule, TopnavComponent, SidebarComponent, RouterModule],
  templateUrl: './integraciones.component.html',
  styleUrl: './integraciones.component.css'
})
export class IntegracionesComponent implements OnInit {
  integraciones: IntegracionesFlags = {
    twilioHabilitado: false,
    izipayHabilitado: false,
    culqiHabilitado: false,
    apisPeruHabilitado: false,
    factilizaHabilitado: false
  };
  credenciales: Record<string, CredencialForm[]> = {};
  cargando = signal(true);
  guardandoFlags = signal(false);
  guardandoCreds = signal<string | null>(null);

  constructor(
    private empresaService: EmpresaService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargar();
    PROVEEDORES.forEach(p => {
      this.credenciales[p.id] = p.keys.map(k => ({ clave: k, valor: '' }));
    });
  }

  cargar(): void {
    this.cargando.set(true);
    this.empresaService.getIntegraciones().subscribe({
      next: (res) => {
        const data = res.data;
        if (data?.integraciones) {
          this.integraciones = {
            twilioHabilitado: !!data.integraciones.twilioHabilitado,
            izipayHabilitado: !!data.integraciones.izipayHabilitado,
            culqiHabilitado: !!data.integraciones.culqiHabilitado,
            apisPeruHabilitado: !!data.integraciones.apisPeruHabilitado,
            factilizaHabilitado: !!data.integraciones.factilizaHabilitado
          };
        }
        if (data?.credenciales) {
          PROVEEDORES.forEach(p => {
            const list = data.credenciales[p.id] as { clave: string; valor: string }[] | undefined;
            if (list?.length) {
              const keySet = new Set(p.keys);
              this.credenciales[p.id] = p.keys.map(k => {
                const found = list.find(c => c.clave === k);
                return { clave: k, valor: found?.valor ?? '' };
              });
            }
          });
        }
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        iziToast.error({ title: 'Error', message: 'No se pudieron cargar las integraciones.' });
      }
    });
  }

  guardarFlags(): void {
    this.guardandoFlags.set(true);
    this.empresaService.putIntegraciones(this.integraciones).subscribe({
      next: () => {
        this.guardandoFlags.set(false);
        iziToast.success({ title: 'Guardado', message: 'Opciones de integración actualizadas.' });
      },
      error: () => {
        this.guardandoFlags.set(false);
        iziToast.error({ title: 'Error', message: 'No se pudieron guardar las opciones.' });
      }
    });
  }

  guardarCredenciales(proveedorId: string): void {
    this.guardandoCreds.set(proveedorId);
    const list = this.credenciales[proveedorId]?.filter(c => c.clave.trim()) ?? [];
    const credenciales = list.map(c => ({ clave: c.clave.trim(), valor: c.valor.trim() }));
    this.empresaService.putCredencialesProveedor(proveedorId, credenciales).subscribe({
      next: () => {
        this.guardandoCreds.set(null);
        iziToast.success({ title: 'Guardado', message: 'Credenciales guardadas.' });
      },
      error: () => {
        this.guardandoCreds.set(null);
        iziToast.error({ title: 'Error', message: 'No se pudieron guardar las credenciales.' });
      }
    });
  }

  getProveedores(): typeof PROVEEDORES {
    return PROVEEDORES;
  }

  labelClave(clave: string): string {
    const labels: Record<string, string> = {
      accountSid: 'Account SID',
      authToken: 'Auth Token',
      whatsappFrom: 'WhatsApp From (ej. whatsapp:+14155238886)',
      merchantId: 'Merchant ID',
      publicKey: 'Public Key',
      secretKey: 'Secret Key'
    };
    return labels[clave] || clave;
  }
}
