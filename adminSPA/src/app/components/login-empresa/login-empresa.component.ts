import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

declare var iziToast: any;

@Component({
  selector: 'app-login-empresa',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login-empresa.component.html',
  styleUrl: './login-empresa.component.css'
})
export class LoginEmpresaComponent implements OnInit {

  public user: any = {};
  public usuario: any = {};

  // Estados de validación
  public rucInvalid: boolean = false;
  public emailInvalid: boolean = false;
  public showPassword: boolean = false;
  public loading: boolean = false;

  // Información de empresa recordada
  public empresaRecordada: any = null;

  constructor(
    private _adminService: AdminService,
    private _router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadEmpresaRecordada();
  }

  initializeForm(): void {
    this.user = {
      email: '',
      password: '',
      ruc: ''
    };

    this.usuario = {};
    this.rucInvalid = false;
    this.emailInvalid = false;
    this.showPassword = false;
    this.loading = false;
  }

  loadEmpresaRecordada(): void {
    // Cargar empresa recordada del localStorage
    const empresaRecordadaStr = localStorage.getItem('empresaRecordada');
    if (empresaRecordadaStr) {
      try {
        this.empresaRecordada = JSON.parse(empresaRecordadaStr);
        this.user.ruc = this.empresaRecordada.ruc;
        this.user.email = this.empresaRecordada.email;
      } catch (error) {
        console.error('Error parsing empresa recordada:', error);
        localStorage.removeItem('empresaRecordada');
      }
    }
  }

  // Validaciones
  validateRuc(): void {
    const ruc = this.user.ruc || '';
    // Validación básica de RUC (11 dígitos, empieza con 1, 2 o 3)
    const rucRegex = /^[12][0-9]{10}$/;
    this.rucInvalid = ruc.length > 0 && !rucRegex.test(ruc);
  }

  validateEmail(): void {
    const email = this.user.email || '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.emailInvalid = email.length > 0 && !emailRegex.test(email);
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  // Funciones adicionales
  recuperarPassword(event: Event): void {
    event.preventDefault();
    iziToast.info({
      title: 'Recuperar Contraseña',
      message: 'Funcionalidad próximamente disponible. Contacte al administrador del sistema.',
      position: 'topRight'
    });
  }

  contactarSoporte(event: Event): void {
    event.preventDefault();
    iziToast.info({
      title: 'Soporte Técnico',
      message: 'Para registrarse, contacte al equipo de soporte: soporte@crm.com',
      position: 'topRight'
    });
  }

  login(loginForm: any): void {
    // Validar todos los campos antes de enviar
    this.validateRuc();
    this.validateEmail();

    if (loginForm.invalid || this.rucInvalid || this.emailInvalid) {
      this.showValidationErrors();
      return;
    }

    this.loading = true;

    const data = {
      email: this.user.email.trim(),
      password: this.user.password,
      ruc: this.user.ruc.trim()
    };

    console.log('Intentando login:', { ...data, password: '***' });

    this._adminService.admin_login(data).subscribe({
      next: (response) => {
        this.loading = false;

        if (!response.data) {
          this.showLoginError(response.message || 'Credenciales inválidas');
          return;
        }

        // Login exitoso
        this.usuario = response.data.idUsuario;
        this.handleLoginSuccess(response.data);

        iziToast.success({
          title: '¡Bienvenido!',
          message: 'Acceso concedido al sistema CRM',
          position: 'topRight'
        });

        console.log('Usuario autenticado:', this.usuario);
      },
      error: (error) => {
        this.loading = false;
        console.error('Login error:', error);
        this.showLoginError('Error de conexión con el servidor');
      }
    });
  }

  private showValidationErrors(): void {
    let errors: string[] = [];

    if (!this.user.ruc) errors.push('RUC es requerido');
    if (this.rucInvalid) errors.push('RUC inválido');
    if (!this.user.email) errors.push('Email es requerido');
    if (this.emailInvalid) errors.push('Email inválido');
    if (!this.user.password) errors.push('Contraseña es requerida');

    if (errors.length > 0) {
      iziToast.error({
        title: 'Campos requeridos',
        message: errors.join('<br>'),
        position: 'topRight'
      });
    }
  }

  private showLoginError(message: string): void {
    iziToast.error({
      title: 'Error de autenticación',
      message: message,
      position: 'topRight'
    });
  }

  private handleLoginSuccess(userData: any): void {
    // Guardar empresa recordada si está marcado el checkbox
    const rememberCheckbox = document.getElementById('remember') as HTMLInputElement;
    if (rememberCheckbox?.checked) {
      const empresaRecordada = {
        ruc: this.user.ruc,
        email: this.user.email,
        razonSocial: userData.razonSocial || 'Empresa'
      };
      localStorage.setItem('empresaRecordada', JSON.stringify(empresaRecordada));
    }

    // Inicializar servicios de autenticación
    this.authService.initialize();

    // Redirigir al dashboard principal
    this._router.navigate(['/home']);
  }

  // Método público para acceso desde template
  onRememberChange(event: any): void {
    if (!event.target.checked) {
      localStorage.removeItem('empresaRecordada');
    }
  }
}
