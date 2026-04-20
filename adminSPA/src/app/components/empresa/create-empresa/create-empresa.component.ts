import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../services/admin.service';
import { DocumentoService } from '../../../services/documento.service';
import { ApiperuService } from '../../../services/apiperu.service';
import { EmpresaService } from '../../../services/empresa.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DeploymentContextService } from '../../../services/deployment-context.service';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

declare var iziToast: any;

const LS_CHECKOUT_PENDIENTE = 'efaf_checkout_pendiente';

@Component({
  selector: 'app-create-empresa',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterModule, CommonModule],
  templateUrl: './create-empresa.component.html',
  styleUrl: './create-empresa.component.css'
})
export class CreateEmpresaComponent implements OnInit {
  // Estado del formulario
  empresaForm!: FormGroup;
  
  // Estados de la UI
  encontrado = signal<boolean>(false);
  buscando = signal<boolean>(false);
  registrando = signal<boolean>(false);
  loadCreate = signal<boolean>(false);
  showPassword = signal<boolean>(false);
  showConfirmPassword = signal<boolean>(false);
  currentStep = signal<number>(1);
  idEmpresaCreada = signal<string | null>(null);

  /** Número de orden Culqi (CHK-...) si el usuario pagó desde /planes. */
  checkoutOrderNumber = '';
  /** Mostrar opción demo solo en modo SaaS. */
  mostrarOpcionDemo = false;

  // Datos de la empresa encontrada
  empresaEncontrada: any = null;
  
  // Datos de ubicación
  regiones: any[] = [];
  provincias: any[] = [];
  distritos: any[] = [];
  provinciasFiltradas: any[] = [];
  distritosFiltrados: any[] = [];
  
  // Validación de contraseña
  passwordStrength = signal<number>(0);
  passwordRequirements = signal<{
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  }>({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private documentoService: DocumentoService,
    private apiperuService: ApiperuService,
    private empresaService: EmpresaService,
    private router: Router,
    private route: ActivatedRoute,
    private deploymentContext: DeploymentContextService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.cargarUbicaciones();
    this.route.queryParamMap.subscribe((q) => {
      let co = (q.get('checkout') || '').trim();
      if (!co) {
        try {
          const raw = localStorage.getItem(LS_CHECKOUT_PENDIENTE);
          if (raw) {
            const parsed = JSON.parse(raw) as { orderNumber?: string };
            co = (parsed?.orderNumber || '').trim();
          }
        } catch {
          /* ignore */
        }
      }
      this.checkoutOrderNumber = co;
    });
    this.deploymentContext.cargarSiNecesario().subscribe((cfg) => {
      this.mostrarOpcionDemo = !!cfg?.mostrarPlanesPublicos;
    });
  }

  /**
   * Inicializa el formulario reactivo
   */
  private initForm(): void {
    this.empresaForm = this.fb.group({
      // Paso 1: Verificación de RUC
      ruc: ['', [Validators.required, Validators.minLength(11), Validators.maxLength(11), Validators.pattern(/^[0-9]{11}$/)]],
      
      // Paso 2: Datos de empresa (llenados automáticamente)
      razonSocial: ['', Validators.required],
      nombreComercial: [''],
      condicion: [''],
      estado: [''],
      direccion: [''],
      
      // Ubicación
      region: [''],
      provincia: [''],
      distrito: [''],
      ubigeo: [''],
      
      // Paso 3: Credenciales
      email: ['', [Validators.required, Validators.email]],
      celular: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{9,15}$/)]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        // Permite caracteres especiales comunes: @$!%*?&_\-#.+=^
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#.+=^])[A-Za-z\d@$!%*?&_\-#.+=^]{8,}$/)
      ]],
      confirmPassword: ['', Validators.required],
      
      // Términos
      acceptTerms: [false, Validators.requiredTrue],
      solicitudDemo: [false]
    }, {
      validators: this.passwordMatchValidator
    });

    // Observar cambios en la contraseña
    this.empresaForm.get('password')?.valueChanges.subscribe(password => {
      this.evaluatePasswordStrength(password);
    });

    // Observar cambios en región para filtrar provincias
    this.empresaForm.get('region')?.valueChanges.subscribe(regionId => {
      this.filtrarProvincias(regionId);
    });

    // Observar cambios en provincia para filtrar distritos
    this.empresaForm.get('provincia')?.valueChanges.subscribe(provinciaId => {
      this.filtrarDistritos(provinciaId);
    });
  }

  /**
   * Validador personalizado para confirmar contraseña
   */
  private passwordMatchValidator(group: FormGroup): { [key: string]: boolean } | null {
    const password = group.get('password')?.value ?? '';
    const confirmPassword = group.get('confirmPassword')?.value ?? '';
    
    if (password !== confirmPassword) {
      group.get('confirmPassword')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    // Limpiar error si coinciden
    const confirmControl = group.get('confirmPassword');
    if (confirmControl?.hasError('passwordMismatch')) {
      confirmControl.setErrors(null);
    }
    
    return null;
  }

  /**
   * Carga las ubicaciones (regiones, provincias, distritos)
   */
  private cargarUbicaciones(): void {
    this.adminService.get_Regiones().subscribe({
      next: (response) => this.regiones = response,
      error: (error) => console.error('Error cargando regiones:', error)
    });

    this.adminService.get_Procincias().subscribe({
      next: (response) => this.provincias = response,
      error: (error) => console.error('Error cargando provincias:', error)
    });

    this.adminService.get_Distritos().subscribe({
      next: (response) => this.distritos = response,
      error: (error) => console.error('Error cargando distritos:', error)
    });
  }

  /**
   * Filtra provincias por región
   */
  private filtrarProvincias(regionId: string): void {
    if (regionId) {
      this.provinciasFiltradas = this.provincias.filter(
        (p: any) => p.department_id === regionId
      );
    } else {
      this.provinciasFiltradas = [];
    }
    this.empresaForm.patchValue({ provincia: '', distrito: '' });
    this.distritosFiltrados = [];
  }

  /**
   * Filtra distritos por provincia
   */
  private filtrarDistritos(provinciaId: string): void {
    if (provinciaId) {
      this.distritosFiltrados = this.distritos.filter(
        (d: any) => d.province_id === provinciaId
      );
    } else {
      this.distritosFiltrados = [];
    }
    this.empresaForm.patchValue({ distrito: '' });
  }

  /**
   * Evalúa la fortaleza de la contraseña
   */
  private evaluatePasswordStrength(password: string): void {
    if (!password) {
      this.passwordStrength.set(0);
      this.passwordRequirements.set({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false
      });
      return;
    }

    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[@$!%*?&_\-#.+=^]/.test(password)
    };

    this.passwordRequirements.set(requirements);

    const metRequirements = Object.values(requirements).filter(Boolean).length;
    this.passwordStrength.set((metRequirements / 5) * 100);
  }

  /**
   * Quita acentos de un string
   */
  private removeAccents(str: string): string {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  /**
   * Busca empresa por RUC
   */
  buscarRuc(): void {
    const ruc = this.empresaForm.get('ruc')?.value;
    
    if (!ruc || ruc.length !== 11) {
      iziToast.show({
        title: 'Advertencia',
        titleColor: '#ffc107',
        color: '#FFF',
        class: 'text-warning',
        position: 'topRight',
        message: 'Ingrese un RUC válido de 11 dígitos'
      });
      return;
    }

    this.buscando.set(true);
    
    this.apiperuService.getRucInfoPublic(ruc).subscribe({
      next: (response) => {
        this.buscando.set(false);
        const data = response?.data ?? response;
        if (response?.error || response?.success === false) {
          iziToast.show({
            title: 'Error',
            titleColor: '#dc3545',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: response?.error || 'No se encontró información para el RUC ingresado'
          });
          this.encontrado.set(false);
          return;
        }

        this.empresaEncontrada = data;
                this.encontrado.set(true);
        this.empresaForm.patchValue({
          razonSocial: data.razonSocial || '',
          nombreComercial: data.nombreComercial || '',
          condicion: data.condicion || '',
          estado: data.estado || '',
          direccion: data.direccion || '',
          ubigeo: data.ubigeo || ''
        });
        this.seleccionarUbicacion(data);
        
        // Avanzar al siguiente paso
        this.currentStep.set(2);
        
        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          color: '#FFF',
          class: 'text-success',
          position: 'topRight',
          message: 'Empresa verificada correctamente'
        });
      },
      error: (error) => {
        this.buscando.set(false);
        console.error('Error buscando RUC:', error);
        // #region agent log
        const errBody = error?.error && typeof error.error === 'object' ? (error.error as Record<string, unknown>) : (error?.error ?? null);
        fetch('http://127.0.0.1:7243/ingest/4cdb12f7-f0e0-45f1-8edf-c7587f720407',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e8165b'},body:JSON.stringify({sessionId:'e8165b',location:'create-empresa.component.ts:buscarRuc',message:'getRucInfoPublic error',data:{status:error?.status,statusText:error?.statusText,url:error?.url,errorMsg:error?.message,bodyError:errBody?.error ?? errBody},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          color: '#FFF',
          class: 'text-danger',
          position: 'topRight',
          message: 'Error al conectar con el servicio de validación'
        });
      }
    });
  }

  /**
   * Selecciona automáticamente la ubicación basada en la respuesta
   */
  private seleccionarUbicacion(response: any): void {
    try {
      // Encontrar región
      const regionEncontrada = this.regiones.find(
        (r: any) => this.removeAccents(r.name).toUpperCase() === response.departamento?.toUpperCase()
      );
      
      if (regionEncontrada) {
        this.empresaForm.patchValue({ region: regionEncontrada.id });
        
        // Filtrar provincias
        setTimeout(() => {
          const provinciaEncontrada = this.provincias.find(
            (p: any) => this.removeAccents(p.name).toUpperCase() === response.provincia?.toUpperCase()
          );
          
          if (provinciaEncontrada) {
            this.empresaForm.patchValue({ provincia: provinciaEncontrada.id });
            
            // Filtrar distritos
            setTimeout(() => {
              const distritoEncontrado = this.distritos.find(
                (d: any) => this.removeAccents(d.name).toUpperCase() === response.distrito?.toUpperCase()
              );
              
              if (distritoEncontrado) {
                this.empresaForm.patchValue({ distrito: distritoEncontrado.id });
              }
            }, 100);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error seleccionando ubicación:', error);
    }
  }

  /**
   * Navega al paso anterior
   */
  previousStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(step => step - 1);
    }
  }

  /**
   * Navega al siguiente paso
   */
  nextStep(): void {
                
    if (this.currentStep() < 3) {
      // Validar paso 1: RUC verificado
      if (this.currentStep() === 1 && !this.encontrado()) {
        iziToast.show({
          title: 'Advertencia',
          titleColor: '#ffc107',
          color: '#FFF',
          class: 'text-warning',
          position: 'topRight',
          message: 'Primero debe verificar el RUC'
        });
        return;
      }
      
      // Validar paso 2: Datos de empresa completados
      if (this.currentStep() === 2) {
        const razonSocial = this.empresaForm.get('razonSocial')?.value;
        if (!razonSocial) {
          iziToast.show({
            title: 'Advertencia',
            titleColor: '#ffc107',
            color: '#FFF',
            class: 'text-warning',
            position: 'topRight',
            message: 'La razón social es requerida'
          });
          return;
        }
      }
      
      this.currentStep.update(step => step + 1);
          }
  }

  /**
   * Alterna visibilidad de contraseña
   */
  togglePassword(): void {
    this.showPassword.update(show => !show);
  }

  /**
   * Alterna visibilidad de confirmar contraseña
   */
  toggleConfirmPassword(): void {
    this.showConfirmPassword.update(show => !show);
  }

  /**
   * Registra la empresa
   */
  registrar(): void {
                    
    const camposInvalidos = this.getCamposInvalidos();
        
    if (this.empresaForm.invalid) {
      // Marcar todos los campos como touched para mostrar errores
      Object.keys(this.empresaForm.controls).forEach(key => {
        const control = this.empresaForm.get(key);
        control?.markAsTouched();
        if (control?.invalid) {
          console.error(`Campo ${key} inválido:`, control.errors, 'Valor:', control.value);
        }
      });
      
      const mensajeError = `Complete todos los campos requeridos. Campos inválidos: ${camposInvalidos.join(', ')}`;
      
      iziToast.show({
        title: 'Error',
        titleColor: '#dc3545',
        color: '#FFF',
        class: 'text-danger',
        position: 'topRight',
        message: mensajeError
      });
      return;
    }

    if (!this.empresaForm.get('acceptTerms')?.value) {
      iziToast.show({
        title: 'Advertencia',
        titleColor: '#ffc107',
        color: '#FFF',
        class: 'text-warning',
        position: 'topRight',
        message: 'Debe aceptar los términos y condiciones'
      });
      return;
    }

    this.registrando.set(true);

    const formData = this.empresaForm.value;
    
    const empresaData: Record<string, unknown> = {
      idDocumento: '6',
      ruc: formData.ruc,
      razon_Social: formData.razonSocial,
      nombre_Comercial: formData.nombreComercial || '',
      correo: formData.email,
      celular: (formData.celular || '').trim(),
      password: formData.password,
      condicion: formData.condicion || '',
      estSunat: formData.estado || '',
      direccion: (formData.direccion || '').trim(),
      solicitudDemo: !!formData.solicitudDemo,
      checkoutOrderNumber: this.checkoutOrderNumber || undefined
    };

    this.empresaService.createEmpresa(empresaData).subscribe({
      next: (response) => {
        if (response.data) {
          this.idEmpresaCreada.set(response.data);
          // Crear dirección
          const direccionData = {
            idEmpresa: response.data,
            ubigeo: formData.ubigeo || '',
            codpais: 'PEN',
            region: formData.region || '',
            provincia: formData.provincia || '',
            distrito: formData.distrito || '',
            direccion: formData.direccion || '',
            principal: true,
            codLocal: '0000',
            crearSucursal: false
          };

          this.empresaService.createDireccionEmpresa(direccionData).subscribe({
            next: () => {
              this.registrando.set(false);
              this.loadCreate.set(true);
              try {
                localStorage.removeItem(LS_CHECKOUT_PENDIENTE);
              } catch {
                /* ignore */
              }
              const msg = (response as any).mensaje || (response as any).message;
              iziToast.show({
                title: 'Empresa creada',
                titleColor: '#28a745',
                color: '#FFF',
                class: 'text-success',
                position: 'topRight',
                message: msg || 'Revisa tu WhatsApp: te enviamos un código para activar tu cuenta. Luego inicia sesión.'
              });
            },
            error: (error) => {
              console.error('Error creando dirección:', error);
              this.registrando.set(false);
              // La empresa se creó pero falló la dirección
              this.loadCreate.set(true);
            }
          });
        } else {
          this.registrando.set(false);
          iziToast.show({
            title: 'Error',
            titleColor: '#dc3545',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: response.message || 'Error al crear la empresa'
          });
        }
      },
      error: (error) => {
        console.error('Error creando empresa:', error);
        this.registrando.set(false);
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          color: '#FFF',
          class: 'text-danger',
          position: 'topRight',
          message: 'Error al crear la empresa'
        });
      }
    });
  }

  /**
   * Obtiene la clase CSS para la barra de fortaleza
   */
  getStrengthClass(): string {
    const strength = this.passwordStrength();
    if (strength < 40) return 'bg-danger';
    if (strength < 80) return 'bg-warning';
    return 'bg-success';
  }

  /**
   * Obtiene el texto de la fortaleza
   */
  getStrengthText(): string {
    const strength = this.passwordStrength();
    if (strength < 40) return 'Débil';
    if (strength < 80) return 'Media';
    return 'Fuerte';
  }

  /**
   * Verifica si un campo tiene error
   */
  hasError(field: string): boolean {
    const control = this.empresaForm.get(field);
    return !!(control?.invalid && control?.touched);
  }

  /**
   * Obtiene el mensaje de error de un campo
   */
  getError(field: string): string {
    const control = this.empresaForm.get(field);
    if (!control?.errors) return '';

    if (control.errors['required']) return 'Este campo es requerido';
    if (control.errors['requiredTrue']) return 'Debe aceptar este campo';
    if (control.errors['email']) return 'Ingrese un email válido';
    if (control.errors['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    if (control.errors['maxlength']) return `Máximo ${control.errors['maxlength'].requiredLength} caracteres`;
    if (control.errors['pattern']) return 'Formato inválido';
    
    return 'Error de validación';
  }

  /**
   * Obtiene lista de campos inválidos
   */
  getCamposInvalidos(): string[] {
    const invalidos: string[] = [];
    Object.keys(this.empresaForm.controls).forEach(key => {
      const control = this.empresaForm.get(key);
      if (control?.invalid) {
        invalidos.push(key);
      }
    });
    return invalidos;
  }

  /**
   * Navega a login
   */
  irALogin(): void {
    this.router.navigate(['/login-empresa']);
  }
}
