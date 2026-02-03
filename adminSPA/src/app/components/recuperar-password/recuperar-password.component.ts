import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AdminService } from '../../services/admin.service';

declare var iziToast: any;

@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recuperar-password.component.html',
  styleUrls: ['./recuperar-password.component.css']
})
export class RecuperarPasswordComponent {
  paso: 1 | 2 = 1;
  ruc = '';
  email = '';
  token = '';
  newPassword = '';
  confirmPassword = '';
  loading = false;
  rucInvalid = false;
  emailInvalid = false;

  constructor(
    private adminService: AdminService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const t = params['token'];
      if (t) {
        this.token = t;
        this.paso = 2;
      }
    });
  }

  validateRuc(): void {
    const rucRegex = /^[12][0-9]{10}$/;
    this.rucInvalid = this.ruc.length > 0 && !rucRegex.test(this.ruc);
  }

  validateEmail(): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.emailInvalid = this.email.length > 0 && !emailRegex.test(this.email);
  }

  solicitar(): void {
    this.validateRuc();
    this.validateEmail();
    if (!this.ruc || !this.email || this.rucInvalid || this.emailInvalid) {
      iziToast.warning({ title: 'Datos requeridos', message: 'Ingrese RUC y correo válidos', position: 'topRight' });
      return;
    }
    this.loading = true;
    this.adminService.recuperarPassword(this.ruc.trim(), this.email.trim()).subscribe({
      next: (res: any) => {
        this.loading = false;
        iziToast.success({
          title: 'Solicitud enviada',
          message: res.message || 'Si el correo está registrado, recibirá un enlace en su bandeja. Revise también spam.',
          position: 'topRight',
          timeout: 8000
        });
      },
      error: (err) => {
        this.loading = false;
        const msg = err.error?.message || 'Error al solicitar recuperación';
        iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
      }
    });
  }

  restablecer(): void {
    if (!this.token) {
      iziToast.error({ title: 'Error', message: 'Falta el token. Solicite de nuevo la recuperación.', position: 'topRight' });
      return;
    }
    if (!this.newPassword || this.newPassword.length < 6) {
      iziToast.warning({ title: 'Contraseña', message: 'La contraseña debe tener al menos 6 caracteres', position: 'topRight' });
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      iziToast.warning({ title: 'Contraseña', message: 'Las contraseñas no coinciden', position: 'topRight' });
      return;
    }
    this.loading = true;
    this.adminService.restablecerPassword(this.token, this.newPassword).subscribe({
      next: () => {
        this.loading = false;
        iziToast.success({
          title: 'Contraseña actualizada',
          message: 'Ya puede iniciar sesión con su nueva contraseña.',
          position: 'topRight'
        });
        this.router.navigate(['/login-empresa']);
      },
      error: (err) => {
        this.loading = false;
        const msg = err.error?.message || 'Error al restablecer la contraseña';
        iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
      }
    });
  }

  volverALogin(): void {
    this.router.navigate(['/login-empresa']);
  }
}
