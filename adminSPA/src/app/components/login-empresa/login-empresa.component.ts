import { Component, OnInit } from '@angular/core';
import { AdminService, AdminLoginUserData } from '../../services/admin.service';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { EmpresaService } from '../../services/empresa.service';

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

  /** null = formulario normal; setup/verify = 2FA obligatorio para admin/superAdmin. */
  public twoFaMode: null | 'setup' | 'verify' = null;
  public pendingToken = '';
  public qrDataUrl = '';
  public twoFaCode = '';
  public loading2faQr = false;

  // Control de pasos del wizard
  public currentStep: number = 1; // 1: Empresa, 2: Usuario, 3: Acceso (resumen)
  public maxStepReached: number = 1; // Para controlar navegación hacia adelante

  // Información de empresa recordada
  public empresaRecordada: any = null;

  /** Tras pago público: vincular suscripción en “Mi suscripción”. */
  private postLoginCheckout: string | null = null;

  constructor(
    private _adminService: AdminService,
    private _router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private empresaService: EmpresaService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadEmpresaRecordada();
    this.route.queryParamMap.subscribe((q) => {
      const c = (q.get('checkout') || '').trim();
      this.postLoginCheckout = c || null;
    });
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
    this.twoFaMode = null;
    this.pendingToken = '';
    this.qrDataUrl = '';
    this.twoFaCode = '';
    this.loading2faQr = false;
  }

  loadEmpresaRecordada(): void {
    // Cargar empresa recordada del localStorage
    const empresaRecordadaStr = localStorage.getItem('empresaRecordada');
    const ultimoPosStr = localStorage.getItem('ultimoAccesoPos');
    if (empresaRecordadaStr) {
      try {
        this.empresaRecordada = JSON.parse(empresaRecordadaStr);
        this.user.ruc = this.empresaRecordada.ruc;
        this.user.email = this.empresaRecordada.email;
      } catch {
        localStorage.removeItem('empresaRecordada');
      }
    } else if (ultimoPosStr) {
      try {
        const ultimo = JSON.parse(ultimoPosStr);
        this.user.ruc = ultimo.ruc || '';
        this.user.email = ultimo.email || '';
      } catch {
        localStorage.removeItem('ultimoAccesoPos');
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
    this.twoFaMode = null;

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

        const d = response.data;
        if (d.requiresTwoFactorSetup) {
          this.pendingToken = d.pendingToken || '';
          this.twoFaMode = 'setup';
          this.twoFaCode = '';
          this.qrDataUrl = '';
          if (!this.pendingToken) {
            this.showLoginError('No se recibió token de configuración 2FA.');
            this.twoFaMode = null;
            return;
          }
          this.initQr2fa();
          return;
        }
        if (d.requiresTwoFactor) {
          this.pendingToken = d.pendingToken || '';
          this.twoFaMode = 'verify';
          this.twoFaCode = '';
          if (!this.pendingToken) {
            this.showLoginError('No se recibió token de verificación 2FA.');
            this.twoFaMode = null;
            return;
          }
          return;
        }

        this.usuario = d.idUsuario;
        this.handleLoginSuccess(d);

        iziToast.success({
          title: '¡Bienvenido!',
          message: 'Acceso concedido al sistema CRM',
          position: 'topRight'
        });
      },
      error: (error) => {
        this.loading = false;
        const body = error?.error;
        const msg =
          (typeof body?.message === 'string' && body.message) ||
          (typeof error?.message === 'string' && error.message) ||
          'Error de conexión con el servidor';
        this.showLoginError(msg);
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

  initQr2fa(): void {
    this.loading2faQr = true;
    this._adminService.admin2faSetupInit(this.pendingToken).subscribe({
      next: (res) => {
        this.loading2faQr = false;
        this.qrDataUrl = res.data?.qrDataUrl || '';
        if (!this.qrDataUrl) {
          this.showLoginError('No se pudo generar el código QR. Intente de nuevo.');
        }
      },
      error: (error) => {
        this.loading2faQr = false;
        const body = error?.error;
        const msg =
          (typeof body?.message === 'string' && body.message) ||
          'No se pudo iniciar la configuración 2FA';
        this.showLoginError(msg);
        this.cancelTwoFactor();
      }
    });
  }

  submitTwoFaStep(): void {
    const code = (this.twoFaCode || '').trim();
    if (!code || !this.pendingToken) {
      return;
    }
    this.loading = true;
    const obs =
      this.twoFaMode === 'setup'
        ? this._adminService.admin2faSetupConfirm(this.pendingToken, code)
        : this._adminService.admin2faVerify(this.pendingToken, code);

    obs.subscribe({
      next: (response) => {
        this.loading = false;
        if (!response.data) {
          this.showLoginError(response.message || 'Error al validar el código');
          return;
        }
        const d = response.data;
        if (d.requiresTwoFactorSetup || d.requiresTwoFactor) {
          this.showLoginError('Respuesta inesperada del servidor.');
          return;
        }
        this.twoFaMode = null;
        this.pendingToken = '';
        this.usuario = d.idUsuario;
        this.handleLoginSuccess(d);
        iziToast.success({
          title: '¡Bienvenido!',
          message: 'Acceso concedido al sistema CRM',
          position: 'topRight'
        });
      },
      error: (error) => {
        this.loading = false;
        const body = error?.error;
        const msg =
          (typeof body?.message === 'string' && body.message) ||
          (typeof error?.message === 'string' && error.message) ||
          'Código incorrecto o sesión expirada';
        this.showLoginError(msg);
      }
    });
  }

  cancelTwoFactor(): void {
    this.twoFaMode = null;
    this.pendingToken = '';
    this.qrDataUrl = '';
    this.twoFaCode = '';
    this.loading2faQr = false;
  }

  private handleLoginSuccess(userData: AdminLoginUserData): void {
    localStorage.setItem(
      'ultimoAccesoPos',
      JSON.stringify({ ruc: this.user.ruc, email: this.user.email, ts: Date.now() })
    );

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

    // Navegar al dashboard o a vincular pago (checkout CHK-… tras suscripción pública)
    setTimeout(() => {
      const chk = (this.postLoginCheckout || '').trim();
      if (chk) {
        void this._router.navigate(['/cuenta', 'suscripcion'], { queryParams: { checkout: chk } });
        return;
      }
      const modoPos =
        this.route.snapshot.queryParamMap.get('modo') === 'pos' ||
        localStorage.getItem('redirectPosTrasLogin') === '1';
      if (modoPos) {
        localStorage.removeItem('redirectPosTrasLogin');
        this.empresaService.getEstadoConfiguracion().subscribe({
          next: (res) => {
            const esGestora = res?.data?.esGestora === true;
            void this._router.navigate([esGestora ? '/ventas' : '/ventas/rapida']);
          },
          error: () => {
            void this._router.navigate(['/ventas/rapida']);
          }
        });
        return;
      }
      void this._router.navigate(['/home']);
    }, 0);
  }

  /** Acceso rápido: salta al paso de contraseña con RUC/email recordados. */
  irAccesoRapidoPos(): void {
    if (!this.user.ruc || !this.user.email) {
      iziToast.info({
        title: 'Acceso rápido',
        message: 'Complete RUC y usuario al menos una vez para usar acceso rápido POS.',
        position: 'topRight'
      });
      return;
    }
    localStorage.setItem('redirectPosTrasLogin', '1');
    this.currentStep = 3;
    this.maxStepReached = 3;
  }

  irPlanes(): void {
    void this._router.navigate(['/planes']);
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
