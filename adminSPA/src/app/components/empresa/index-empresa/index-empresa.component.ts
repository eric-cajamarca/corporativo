import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { EmpresaService } from '../../../services/empresa.service';
import { GestoresService, EmpresaGestionada, GestorInfo, BusquedaEmpresaResult, ConfiguracionEmpresa } from '../../../services/gestores.service';
import { EmpresaFactilizaService, EmpresasServiciosData } from '../../../services/empresa-factiliza.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';

declare var iziToast: any;
declare var bootstrap: any;

@Component({
  selector: 'app-index-empresa',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule, TopnavComponent, SidebarComponent, NgbPagination],
  templateUrl: './index-empresa.component.html',
  styleUrl: './index-empresa.component.css'
})
export class IndexEmpresaComponent implements OnInit {
  Math: any = Math;

  // Empresas
  public empresas: any[] = [];
  public empresas_const: any[] = [];
  public load_estado = false;
  /** idEmpresa mientras corre POST reset 2FA, o null. */
  public loadingReset2faId: string | null = null;
  /** idEmpresa mientras guarda política 2FA. */
  public guardandoPolitica2faId: string | null = null;

  // Paginación
  public page = 1;
  public pageSize = 10;
  public maxSize = 5;
  public rotate = true;
  public boundaryLinks = true;

  // Modal de Gestores
  public gestores: GestorInfo[] = [];
  public empresasGestionadas: EmpresaGestionada[] = [];
  public loadingGestores = signal<boolean>(false);
  public mostrarInactivos = signal<boolean>(false);

  // Búsqueda de empresa para agregar como gestor
  public rucBusqueda = '';
  public buscandoEmpresa = signal<boolean>(false);
  public empresaEncontrada: BusquedaEmpresaResult | null = null;
  public asignandoGestor = signal<boolean>(false);

  // Modal de Configuración
  public configuraciones: ConfiguracionEmpresa[] = [];
  public loadingConfiguracion = signal<boolean>(false);
  public guardandoConfiguracion = signal<boolean>(false);

  // Tabs del modal principal
  public activeTab = signal<string>('gestores');

  // Servicios API por empresa (tab en modal)
  public serviciosApiData: EmpresasServiciosData | null = null;
  public asignacionesServiciosApi: Record<string, Record<string, boolean>> = {};
  public loadingServiciosApi = signal<boolean>(false);
  public guardandoServiciosApi = signal<boolean>(false);

  constructor(
    public empresaService: EmpresaService,
    public gestoresService: GestoresService,
    private empresaFactilizaService: EmpresaFactilizaService,
    public sidebarState: SidebarStateService,
    public router: Router,
  ) {}

  ngOnInit(): void {
    this.cargarEmpresas();
  }

  /**
   * Carga las empresas
   */
  cargarEmpresas(): void {
    this.empresaService.getEmpresas().subscribe({
      next: (response) => {
        this.empresas = response.data || [];
        this.empresas_const = response.data || [];
      },
      error: (error) => {
        console.error('Error cargando empresas:', error);
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'Error al cargar las empresas',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Cambia el estado de una empresa
   */
  confirmarReset2fa(empresa: { idEmpresa: string; razon_Social?: string }): void {
    if (this.loadingReset2faId) {
      return;
    }
    this.loadingReset2faId = empresa.idEmpresa;
    this.empresaService.reset2faEmpresa(empresa.idEmpresa).subscribe({
      next: (r) => {
        this.loadingReset2faId = null;
        const el = document.getElementById(`reset2fa-${empresa.idEmpresa}`);
        if (el && typeof bootstrap !== 'undefined') {
          const inst = bootstrap.Modal.getInstance(el);
          inst?.hide();
        }
        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: r.message || '2FA restablecido para la empresa.',
          position: 'topRight'
        });
      },
      error: (error) => {
        this.loadingReset2faId = null;
        const msg =
          (typeof error?.error?.message === 'string' && error.error.message) ||
          'No se pudo restablecer el 2FA.';
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: msg,
          position: 'topRight'
        });
      }
    });
  }

  cambiarEstado(id: string, estadoActual: boolean): void {
    this.load_estado = true;
    this.empresaService.cambiar_estado_empresa(id, estadoActual).subscribe({
      next: (response) => {
        this.load_estado = false;
        if (response.data) {
          iziToast.show({
            title: 'Éxito',
            titleColor: '#28a745',
            message: 'Estado cambiado correctamente',
            position: 'topRight'
          });
          this.cargarEmpresas();
        }
      },
      error: (error) => {
        this.load_estado = false;
        console.error('Error:', error);
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'Error al cambiar el estado',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Cambia la página de la tabla
   */
  onPageChange(newPage: number): void {
    this.page = newPage;
  }

  // =============================================
  // GESTORES DE EMPRESAS
  // =============================================

  /**
   * Abre el modal de gestores
   */
  abrirModalGestores(): void {
    this.cargarGestores();
    this.activeTab.set('gestores');
    const modal = new bootstrap.Modal(document.getElementById('modalGestores'));
    modal.show();
  }

  /** true = la empresa exige TOTP a administradores (planes estándar). */
  esAdmin2faActivo(emp: { adminRequiere2FA?: boolean | number }): boolean {
    const v = emp.adminRequiere2FA;
    if (v === false || v === 0) return false;
    return true;
  }

  cambiarPolitica2faAdmin(
    empresa: { idEmpresa: string; razon_Social?: string; adminRequiere2FA?: boolean | number },
    activar: boolean
  ): void {
    if (this.guardandoPolitica2faId) return;
    this.guardandoPolitica2faId = empresa.idEmpresa;
    this.empresaService.putPolitica2faAdmin(empresa.idEmpresa, activar).subscribe({
      next: (r) => {
        this.guardandoPolitica2faId = null;
        empresa.adminRequiere2FA = r.data?.adminRequiere2FA ?? activar;
        iziToast.show({
          title: 'Guardado',
          titleColor: '#28a745',
          message: r.message || 'Política actualizada.',
          position: 'topRight'
        });
      },
      error: (err) => {
        this.guardandoPolitica2faId = null;
        const msg =
          (typeof err?.error?.message === 'string' && err.error.message) || 'No se pudo guardar la política.';
        iziToast.show({ title: 'Error', titleColor: '#dc3545', message: msg, position: 'topRight' });
        this.cargarEmpresas();
      }
    });
  }

  /**
   * Carga los gestores
   */
  cargarGestores(): void {
    this.loadingGestores.set(true);
    this.gestoresService.obtenerTodosGestores().subscribe({
      next: (response) => {
        this.gestores = response.data || [];
        this.loadingGestores.set(false);
      },
      error: (error) => {
        console.error('Error cargando gestores:', error);
        this.loadingGestores.set(false);
      }
    });
  }

  /**
   * Filtra gestores por estado
   */
  getGestoresFiltrados(): GestorInfo[] {
    if (this.mostrarInactivos()) {
      return this.gestores;
    }
    return this.gestores.filter(g => g.estado);
  }

  /**
   * Busca una empresa por RUC
   */
  buscarEmpresa(): void {
    if (!this.rucBusqueda || this.rucBusqueda.length !== 11) {
      iziToast.show({
        title: 'Advertencia',
        titleColor: '#ffc107',
        message: 'Ingrese un RUC válido de 11 dígitos',
        position: 'topRight'
      });
      return;
    }

    this.buscandoEmpresa.set(true);
    this.empresaEncontrada = null;

    this.gestoresService.buscarEmpresaPorRuc(this.rucBusqueda).subscribe({
      next: (response) => {
        this.buscandoEmpresa.set(false);
        this.empresaEncontrada = response.data;
      },
      error: (error) => {
        this.buscandoEmpresa.set(false);
        console.error('Error:', error);
        
        let mensaje = 'Error al buscar la empresa';
        if (error.error?.message) {
          mensaje = error.error.message;
        }
        
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: mensaje,
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Asigna una empresa como gestionada
   */
  asignarGestor(): void {
    if (!this.empresaEncontrada?.empresa) {
      return;
    }

    this.asignandoGestor.set(true);

    this.gestoresService.asignarEmpresaGestionada(this.empresaEncontrada.empresa.idEmpresa).subscribe({
      next: (response) => {
        this.asignandoGestor.set(false);
        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: 'Empresa asignada correctamente',
          position: 'topRight'
        });
        
        // Limpiar búsqueda y recargar
        this.rucBusqueda = '';
        this.empresaEncontrada = null;
        this.cargarGestores();
      },
      error: (error) => {
        this.asignandoGestor.set(false);
        console.error('Error:', error);
        
        let mensaje = 'Error al asignar la empresa';
        if (error.error?.message) {
          mensaje = error.error.message;
        }
        
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: mensaje,
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Activa un gestor
   */
  activarGestor(idGestor: number): void {
    this.gestoresService.activarEmpresaGestionada(idGestor).subscribe({
      next: () => {
        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: 'Gestor activado correctamente',
          position: 'topRight'
        });
        this.cargarGestores();
      },
      error: (error) => {
        console.error('Error:', error);
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'Error al activar el gestor',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Desactiva un gestor
   */
  desactivarGestor(idGestor: number): void {
    this.gestoresService.removerEmpresaGestionada(idGestor).subscribe({
      next: () => {
        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: 'Gestor desactivado correctamente',
          position: 'topRight'
        });
        this.cargarGestores();
      },
      error: (error) => {
        console.error('Error:', error);
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'Error al desactivar el gestor',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Elimina permanentemente un gestor
   */
  eliminarGestor(idGestor: number): void {
    if (!confirm('¿Está seguro de eliminar permanentemente este gestor?')) {
      return;
    }

    this.gestoresService.eliminarEmpresaGestionada(idGestor).subscribe({
      next: () => {
        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: 'Gestor eliminado correctamente',
          position: 'topRight'
        });
        this.cargarGestores();
      },
      error: (error) => {
        console.error('Error:', error);
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'Error al eliminar el gestor',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Limpia la búsqueda
   */
  limpiarBusqueda(): void {
    this.rucBusqueda = '';
    this.empresaEncontrada = null;
  }

  // =============================================
  // CONFIGURACIÓN DE EMPRESA
  // =============================================

  /**
   * Cambia al tab de configuración o servicios API
   */
  cambiarTab(tab: string): void {
    this.activeTab.set(tab);
    if (tab === 'configuracion') {
      this.cargarConfiguracion();
    } else if (tab === 'servicios-api') {
      this.cargarServiciosApi();
    } else if (tab === 'seguridad-admin') {
      this.cargarEmpresas();
    }
  }

  /**
   * Carga empresas, servicios y asignaciones para el tab Servicios API (solo superAdmin plataforma).
   */
  cargarServiciosApi(): void {
    this.loadingServiciosApi.set(true);
    this.empresaFactilizaService.getEmpresasServicios().subscribe({
      next: (res) => {
        this.serviciosApiData = res.data ?? null;
        this.asignacionesServiciosApi = res.data?.asignaciones ? JSON.parse(JSON.stringify(res.data.asignaciones)) : {};
        this.loadingServiciosApi.set(false);
      },
      error: (err) => {
        this.loadingServiciosApi.set(false);
        console.error('Error cargando servicios API:', err);
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: err?.error?.message || 'Error al cargar servicios por empresa',
          position: 'topRight'
        });
      }
    });
  }

  getPuedeUsarServicio(idEmpresa: string, nombreServicio: string): boolean {
    return !!this.asignacionesServiciosApi[idEmpresa]?.[nombreServicio];
  }

  setPuedeUsarServicio(idEmpresa: string, nombreServicio: string, value: boolean): void {
    if (!this.asignacionesServiciosApi[idEmpresa]) {
      this.asignacionesServiciosApi[idEmpresa] = {};
    }
    this.asignacionesServiciosApi[idEmpresa][nombreServicio] = value;
  }

  guardarServiciosApi(): void {
    if (!this.serviciosApiData) return;
    const asignaciones: Array<{ idEmpresa: string; nombreServicio: string; puedeUsar: boolean }> = [];
    for (const emp of this.serviciosApiData.empresas) {
      for (const servicio of this.serviciosApiData.servicios) {
        asignaciones.push({
          idEmpresa: emp.idEmpresa,
          nombreServicio: servicio,
          puedeUsar: this.getPuedeUsarServicio(emp.idEmpresa, servicio)
        });
      }
    }
    this.guardandoServiciosApi.set(true);
    this.empresaFactilizaService.guardarEmpresasServicios(asignaciones).subscribe({
      next: () => {
        this.guardandoServiciosApi.set(false);
        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: 'Asignaciones de servicios API guardadas correctamente',
          position: 'topRight'
        });
      },
      error: (err) => {
        this.guardandoServiciosApi.set(false);
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: err?.error?.message || 'Error al guardar',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Carga la configuración de la empresa
   */
  cargarConfiguracion(): void {
    this.loadingConfiguracion.set(true);
    this.gestoresService.obtenerConfiguracion().subscribe({
      next: (response) => {
        this.configuraciones = response.data || [];
        this.loadingConfiguracion.set(false);
        
        // Agregar configuraciones por defecto si no existen
        this.agregarConfiguracionesPorDefecto();
      },
      error: (error) => {
        console.error('Error cargando configuración:', error);
        this.loadingConfiguracion.set(false);
      }
    });
  }

  /**
   * Agrega configuraciones por defecto
   */
  private agregarConfiguracionesPorDefecto(): void {
    const configuracionesDefecto = [
      { clave: 'MONEDA_PRINCIPAL', valor: 'PEN', descripcion: 'Moneda principal del sistema', tipoDato: 'STRING' },
      { clave: 'IGV_PORCENTAJE', valor: '18', descripcion: 'Porcentaje de IGV', tipoDato: 'NUMBER' },
      { clave: 'DIAS_CREDITO_DEFECTO', valor: '30', descripcion: 'Días de crédito por defecto', tipoDato: 'NUMBER' },
      { clave: 'MOSTRAR_STOCK_AGOTADO', valor: 'true', descripcion: 'Mostrar productos sin stock', tipoDato: 'BOOLEAN' },
      { clave: 'ALERTA_STOCK_MINIMO', valor: '10', descripcion: 'Cantidad mínima para alerta de stock', tipoDato: 'NUMBER' },
    ];

    configuracionesDefecto.forEach(defecto => {
      if (!this.configuraciones.find(c => c.clave === defecto.clave)) {
        this.configuraciones.push(defecto);
      }
    });
  }

  /**
   * Guarda la configuración
   */
  guardarConfiguracion(): void {
    this.guardandoConfiguracion.set(true);
    
    this.gestoresService.guardarConfiguracion(this.configuraciones).subscribe({
      next: () => {
        this.guardandoConfiguracion.set(false);
        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: 'Configuración guardada correctamente',
          position: 'topRight'
        });
      },
      error: (error) => {
        this.guardandoConfiguracion.set(false);
        console.error('Error:', error);
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'Error al guardar la configuración',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Actualiza el valor de una configuración
   */
  actualizarConfiguracion(clave: string, valor: string): void {
    const config = this.configuraciones.find(c => c.clave === clave);
    if (config) {
      config.valor = valor;
    }
  }

  /**
   * Obtiene el valor de una configuración
   */
  getConfiguracionValor(clave: string): string {
    const config = this.configuraciones.find(c => c.clave === clave);
    return config?.valor || '';
  }
}
