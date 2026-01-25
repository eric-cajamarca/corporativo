import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { EmpresaService } from '../../../services/empresa.service';
import { GestoresService, EmpresaGestionada, GestorInfo, BusquedaEmpresaResult, ConfiguracionEmpresa } from '../../../services/gestores.service';
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
  // Estado del sidebar
  sidebarCollapsed = signal<boolean>(false);

  // Empresas
  public empresas: any[] = [];
  public empresas_const: any[] = [];
  public load_estado = false;

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

  constructor(
    public empresaService: EmpresaService,
    public gestoresService: GestoresService,
    public router: Router,
  ) {}

  ngOnInit(): void {
    this.cargarEmpresas();
    
    // Verificar preferencia de sidebar
    const collapsed = localStorage.getItem('sidebarCollapsed');
    if (collapsed === 'true') {
      this.sidebarCollapsed.set(true);
    }
  }

  /**
   * Maneja el toggle del sidebar
   */
  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
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
   * Cambia al tab de configuración
   */
  cambiarTab(tab: string): void {
    this.activeTab.set(tab);
    if (tab === 'configuracion') {
      this.cargarConfiguracion();
    }
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
