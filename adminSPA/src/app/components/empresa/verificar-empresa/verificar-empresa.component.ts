import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmpresaService } from '../../../services/empresa.service';
import { ChatComercialPublicoUiService } from '../../../services/chat-comercial-publico-ui.service';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

declare var iziToast: any;

@Component({
  selector: 'app-verificar-empresa',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './verificar-empresa.component.html',
  styleUrl: './verificar-empresa.component.css'
})
export class VerificarEmpresaComponent implements OnInit, OnDestroy {
  idEmpresa = signal('');
  codigo = signal('');
  enviando = signal(false);
  reenviando = signal(false);

  constructor(
    private empresaService: EmpresaService,
    private router: Router,
    private route: ActivatedRoute,
    private chatUi: ChatComercialPublicoUiService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.queryParamMap.get('idEmpresa');
    if (id) this.idEmpresa.set(id);
    this.chatUi.setPagina({
      ruta: this.router.url || '/verificar-empresa',
      paso: 'codigo',
      errorPantalla: ''
    });
  }

  ngOnDestroy(): void {
    this.chatUi.limpiarPagina();
  }

  verificar(): void {
    const id = this.idEmpresa().trim();
    const cod = this.codigo().trim();
    if (!id) {
      iziToast.warning({ title: 'Falta ID de empresa', message: 'Ingresa el ID de empresa.' });
      return;
    }
    if (!cod || cod.length !== 6) {
      iziToast.warning({ title: 'Código inválido', message: 'El código debe tener 6 dígitos.' });
      return;
    }
    this.enviando.set(true);
    this.empresaService.verificarEmpresa(id, cod).subscribe({
      next: (res) => {
        this.enviando.set(false);
        iziToast.success({ title: 'Cuenta activada', message: res.message || 'Ya puedes iniciar sesión.' });
        this.router.navigate(['/login-empresa']);
      },
      error: (err) => {
        this.enviando.set(false);
        const msg = err?.error?.message || 'No se pudo verificar. Revisa el código.';
        iziToast.error({ title: 'Error', message: msg });
      }
    });
  }

  reenviarCodigo(): void {
    const id = this.idEmpresa().trim();
    if (!id) {
      iziToast.warning({ title: 'Falta ID de empresa', message: 'Ingresa el ID de empresa para reenviar el código.' });
      return;
    }
    this.reenviando.set(true);
    this.empresaService.enviarCodigoActivacion(id).subscribe({
      next: (res) => {
        this.reenviando.set(false);
        iziToast.success({ title: 'Código enviado', message: res.message || 'Revisa tu WhatsApp y correo.' });
      },
      error: (err) => {
        this.reenviando.set(false);
        const msg = err?.error?.message || err?.message || 'No se pudo enviar el código.';
        iziToast.error({ title: 'Error', message: msg });
      }
    });
  }

  /** Muestra solo los últimos 8 caracteres del idEmpresa; el resto como puntos. */
  idEmpresaMasked(): string {
    const id = this.idEmpresa().trim();
    if (!id) return '';
    const visible = 8;
    if (id.length <= visible) return id;
    return '•'.repeat(id.length - visible) + id.slice(-visible);
  }

  irALogin(): void {
    this.router.navigate(['/login-empresa']);
  }
}
