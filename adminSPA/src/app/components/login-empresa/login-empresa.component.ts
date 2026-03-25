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
  styleUrls: ['./login-empresa.component.css', './login-empresa-wizard.css']
})
export class LoginEmpresaComponent implements OnInit {

  public user: any = {};
  public usuario: any = {};

  // Estados de validación
  public rucInvalid: boolean = false;
  public emailInvalid: boolean = false;
  public showPassword: boolean = false;
  public loading: boolean = false;

  // Control de pasos del wizard
  public currentStep: number = 1; // 1: Empresa, 2: Usuario, 3: Acceso (resumen)
  public maxStepReached: number = 1; // Para controlar navegación hacia adelante

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
    this.currentStep = 1;
    this.maxStepReached = 1;
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
    this._router.navigate(['/recuperar-password']);
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

    // Establecer usuario en AuthService desde la respuesta del login (evita verificar token en el mismo tick)
    this.authService.setUserDataFromLogin(userData);

    // Navegar al dashboard; el AuthGuard verificará el token en la siguiente petición (cookie ya disponible)
    setTimeout(() => {
      this._router.navigate(['/home']).then(() => {
              });
    }, 0);
  }

  // Método público para acceso desde template
  onRememberChange(event: any): void {
    if (!event.target.checked) {
      localStorage.removeItem('empresaRecordada');
    }
  }

  // ============================================
  // FUNCIONES DEL WIZARD DE PASOS
  // ============================================

  /**
   * Navega al paso especificado
   */
  goToStep(step: number): void {
    // Solo permitir navegar a pasos ya visitados o al siguiente paso si es válido
    if (step <= this.maxStepReached || (step === this.currentStep + 1 && this.canProceedToNextStep())) {
      this.currentStep = step;
      if (step > this.maxStepReached) {
        this.maxStepReached = step;
      }
    }
  }

  /**
   * Avanza al siguiente paso si la validación es correcta
   */
  nextStep(): void {
    if (this.canProceedToNextStep()) {
      this.currentStep++;
      if (this.currentStep > this.maxStepReached) {
        this.maxStepReached = this.currentStep;
      }
    } else {
      this.showStepValidationError();
    }
  }

  /**
   * Retrocede al paso anterior
   */
  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  /**
   * Verifica si se puede avanzar al siguiente paso
   */
  canProceedToNextStep(): boolean {
    switch (this.currentStep) {
      case 1: // Paso Empresa: validar RUC
        this.validateRuc();
        return this.user.ruc && this.user.ruc.length === 11 && !this.rucInvalid;
      
      case 2: // Paso Usuario: validar email
        this.validateEmail();
        return this.user.email && !this.emailInvalid;
      
      case 3: // Paso Acceso: ya está en el último paso
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Muestra errores de validación según el paso actual
   */
  private showStepValidationError(): void {
    let message = '';
    
    switch (this.currentStep) {
      case 1:
        if (!this.user.ruc) {
          message = 'Por favor, ingrese el RUC de la empresa';
        } else if (this.rucInvalid) {
          message = 'El RUC ingresado no es válido. Debe tener 11 dígitos y comenzar con 1 o 2';
        }
        break;
      
      case 2:
        if (!this.user.email) {
          message = 'Por favor, ingrese el correo electrónico';
        } else if (this.emailInvalid) {
          message = 'El correo electrónico ingresado no es válido';
        }
        break;
    }

    if (message) {
      iziToast.warning({
        title: 'Validación',
        message: message,
        position: 'topRight'
      });
    }
  }

  /**
   * Verifica si un paso está activo
   */
  isStepActive(step: number): boolean {
    return this.currentStep === step;
  }

  /**
   * Verifica si un paso está completado
   */
  isStepCompleted(step: number): boolean {
    return step < this.currentStep;
  }

  /**
   * Verifica si un paso es accesible (clickeable)
   */
  isStepAccessible(step: number): boolean {
    return step <= this.maxStepReached;
  }
}
