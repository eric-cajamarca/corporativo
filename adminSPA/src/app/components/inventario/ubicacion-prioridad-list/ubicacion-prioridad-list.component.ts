import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UbicacionPrioridad } from '../../../models/ubicacion-prioridad.model';
import { UbicacionPrioridadService } from '../../../services/ubicacion-prioridad.service';
import { SucursalService } from '../../../services/sucursal.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

declare var iziToast: any;

@Component({
  selector: 'app-ubicacion-prioridad-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './ubicacion-prioridad-list.component.html',
  styleUrl: './ubicacion-prioridad-list.component.css'
})
export class UbicacionPrioridadListComponent implements OnInit {
  // Input opcional para filtrar por sucursal
  @Input() sucursalFiltro: string | null = null;
  
  // Lista de ubicaciones
  ubicaciones: UbicacionPrioridad[] = [];
  
  // Agrupadas por sucursal para mejor visualización
  ubicacionesPorSucursal: { [key: string]: UbicacionPrioridad[] } = {};
  
  // Lista de sucursales
  sucursales: any[] = [];
  
  // Formulario para nueva ubicación
  nuevaUbicacionForm: FormGroup;
  mostrandoFormNuevo = false;
  
  // Modo edición
  editandoId: number | null = null;
  editandoSucursalId: string | null = null;
  formEdicion: FormGroup;
  
  // Bandera de carga
  isLoading = true;
  guardando = false;

  /** Expone Object para usar Object.keys en el template */
  readonly objectRef = Object;

  constructor(
    public activeModal: NgbActiveModal,
    private ubicacionService: UbicacionPrioridadService,
    private sucursalService: SucursalService,
    private fb: FormBuilder
  ) {
    this.nuevaUbicacionForm = this.fb.group({
      idSucursal: ['', Validators.required],
      idUbicacionPadre: [null as number | null],
      codigoUbicacion: ['', [Validators.required, Validators.maxLength(20)]],
      prioridad: [999, [Validators.required, Validators.min(1)]]
    });

    this.formEdicion = this.fb.group({
      codigoUbicacion: ['', [Validators.required, Validators.maxLength(20)]],
      prioridad: [999, [Validators.required, Validators.min(1)]],
      idUbicacionPadre: [null as number | null]
    });
  }

  ngOnInit(): void {
    this.cargarSucursales();
    this.cargarUbicaciones();
  }

  /**
   * Carga las sucursales para el select
   */
  cargarSucursales(): void {
    this.sucursalService.obtener_sucursal_todos().subscribe({
      next: (response: any) => {
        this.sucursales = response.data || [];
        if (this.sucursalFiltro) {
          this.nuevaUbicacionForm.patchValue({ idSucursal: this.sucursalFiltro });
        } else {
          const principal = this.sucursales.find((s: any) => s.esPrincipal === true || s.esPrincipal === 1);
          if (principal?.idSucursal) {
            this.nuevaUbicacionForm.patchValue({ idSucursal: principal.idSucursal });
          }
        }
      },
      error: (error) => {
      }
    });
  }

  /**
   * Carga todas las ubicaciones y las agrupa por sucursal
   */
  cargarUbicaciones(): void {
    this.isLoading = true;
    this.ubicacionService.obtener_ubicacionesPrioridad_todos().subscribe({
      next: (response: any) => {
        const raw = response?.data ?? response;
        const arr = Array.isArray(raw) ? raw : [];
        this.ubicaciones = arr.map((u: any) => ({
          idUbicacion: u.idUbicacion != null ? Number(u.idUbicacion) : undefined,
          idSucursal: u.idSucursal,
          codigoUbicacion: u.codigoUbicacion ?? '',
          prioridad: u.prioridad != null ? Number(u.prioridad) : 999,
          idUbicacionPadre: u.idUbicacionPadre != null && u.idUbicacionPadre !== '' ? Number(u.idUbicacionPadre) : null
        })).filter((u: any) => u.idUbicacion != null && !isNaN(u.idUbicacion));
        if (this.sucursalFiltro) {
          this.ubicaciones = this.ubicaciones.filter((u: any) => u.idSucursal === this.sucursalFiltro);
        }
        this.agruparPorSucursal();
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'Error al cargar las ubicaciones',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Agrupa las ubicaciones por sucursal para mostrar en secciones
   */
  agruparPorSucursal(): void {
    this.ubicacionesPorSucursal = {};
    for (const ubicacion of this.ubicaciones) {
      const key = ubicacion.idSucursal;
      if (!this.ubicacionesPorSucursal[key]) {
        this.ubicacionesPorSucursal[key] = [];
      }
      this.ubicacionesPorSucursal[key].push(ubicacion);
    }
    
    // Ordenar por prioridad dentro de cada sucursal
    Object.keys(this.ubicacionesPorSucursal).forEach(key => {
      this.ubicacionesPorSucursal[key].sort((a, b) => 
        (a.prioridad || 999) - (b.prioridad || 999)
      );
    });
  }

  /**
   * Muestra formulario para crear nueva ubicación
   */
  mostrarFormNuevo(): void {
    this.mostrandoFormNuevo = true;
    this.nuevaUbicacionForm.reset({
      idSucursal: this.sucursalFiltro || '',
      idUbicacionPadre: null,
      codigoUbicacion: '',
      prioridad: 999
    });
  }

  /** Ubicaciones de la sucursal seleccionada para usar como padre (misma sucursal). */
  get ubicacionesParaPadre(): UbicacionPrioridad[] {
    const idSuc = this.nuevaUbicacionForm.get('idSucursal')?.value;
    if (!idSuc) return [];
    return this.ubicaciones.filter(u => u.idSucursal === idSuc);
  }

  /** Para edición: ubicaciones de la misma sucursal que la fila editada (excluye la propia). */
  get ubicacionesParaPadreEdicion(): UbicacionPrioridad[] {
    if (!this.editandoSucursalId) return [];
    return this.ubicaciones.filter(u =>
      u.idSucursal === this.editandoSucursalId && u.idUbicacion !== this.editandoId
    );
  }

  /**
   * Cancela creación de nueva ubicación
   */
  cancelarNuevo(): void {
    this.mostrandoFormNuevo = false;
    this.nuevaUbicacionForm.reset();
  }

  /**
   * Crea nueva ubicación
   */
  crearUbicacion(): void {
    if (this.nuevaUbicacionForm.invalid) {
      iziToast.show({
        title: 'Validación',
        titleColor: '#ffc107',
        message: 'Complete todos los campos requeridos',
        position: 'topRight'
      });
      return;
    }

    this.guardando = true;
    const datos = { ...this.nuevaUbicacionForm.value };
    if (datos.idUbicacionPadre == null || datos.idUbicacionPadre === '') {
      (datos as any).idUbicacionPadre = null;
    }
    this.ubicacionService.crear_ubicacionPrioridad(datos).subscribe({
      next: () => {
        this.guardando = false;
        this.mostrandoFormNuevo = false;
        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: 'Ubicación creada correctamente',
          position: 'topRight'
        });
        this.cargarUbicaciones();
      },
      error: (error) => {
        this.guardando = false;
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: error.error?.message || 'Error al crear la ubicación',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Inicia edición de una ubicación
   */
  iniciarEdicion(ubicacion: UbicacionPrioridad): void {
    this.editandoId = ubicacion.idUbicacion!;
    this.editandoSucursalId = ubicacion.idSucursal;
    this.formEdicion.patchValue({
      codigoUbicacion: ubicacion.codigoUbicacion,
      prioridad: ubicacion.prioridad,
      idUbicacionPadre: ubicacion.idUbicacionPadre ?? null
    });
  }

  /**
   * Cancela edición
   */
  cancelarEdicion(): void {
    this.editandoId = null;
    this.editandoSucursalId = null;
    this.formEdicion.reset({ codigoUbicacion: '', prioridad: 999, idUbicacionPadre: null });
  }

  /**
   * Guarda cambios de edición
   */
  guardarEdicion(idUbicacion: number): void {
    if (this.formEdicion.invalid) {
      iziToast.show({
        title: 'Validación',
        titleColor: '#ffc107',
        message: 'Complete todos los campos requeridos',
        position: 'topRight'
      });
      return;
    }

    this.guardando = true;
    const datos = { ...this.formEdicion.value } as any;
    if (datos.idUbicacionPadre == null || datos.idUbicacionPadre === '') {
      datos.idUbicacionPadre = null;
    }
    this.ubicacionService.actualizar_ubicacionPrioridad(idUbicacion, datos).subscribe({
      next: () => {
        this.guardando = false;
        this.editandoId = null;
        this.editandoSucursalId = null;
        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: 'Ubicación actualizada correctamente',
          position: 'topRight'
        });
        this.cargarUbicaciones();
      },
      error: (error) => {
        this.guardando = false;
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: error.error?.message || 'Error al actualizar la ubicación',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Cambia prioridad de una ubicación directamente
   */
  actualizarPrioridad(idUbicacion: number, nuevaPrioridad: number): void {
    if (nuevaPrioridad < 1) {
      iziToast.show({
        title: 'Validación',
        titleColor: '#ffc107',
        message: 'La prioridad debe ser mayor a 0',
        position: 'topRight'
      });
      return;
    }

    this.ubicacionService.actualizar_ubicacionPrioridad(idUbicacion, { prioridad: nuevaPrioridad }).subscribe({
      next: () => {
        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: 'Prioridad actualizada',
          position: 'topRight'
        });
        this.cargarUbicaciones();
      },
      error: (error) => {
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: error.error?.message || 'Error al actualizar la prioridad',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Elimina ubicación
   */
  eliminarUbicacion(idUbicacion: number, codigoUbicacion: string): void {
    if (confirm(`¿Está seguro de eliminar la ubicación "${codigoUbicacion}"?\n\nSe perderán las asignaciones de stock asociadas.`)) {
      this.ubicacionService.eliminar_ubicacionPrioridad(idUbicacion).subscribe({
        next: () => {
          iziToast.show({
            title: 'Éxito',
            titleColor: '#28a745',
            message: 'Ubicación eliminada correctamente',
            position: 'topRight'
          });
          this.cargarUbicaciones();
        },
        error: (error) => {
          iziToast.show({
            title: 'Error',
            titleColor: '#dc3545',
            message: error.error?.message || 'Error al eliminar la ubicación',
            position: 'topRight'
          });
        }
      });
    }
  }

  /**
   * Obtiene nombre de sucursal
   */
  getNombreSucursal(idSucursal: string): string {
    const sucursal = this.sucursales.find(s => s.idSucursal === idSucursal);
    if (!sucursal) return (idSucursal || '').toString().slice(0, 8) + '...';
    const nombre = sucursal.nombre || sucursal.codigo || 'Sucursal';
    const direccion = sucursal.direccion || 'Sin dirección';
    return `${nombre} - ${direccion}`;
  }

  getCodigoPadre(idUbicacionPadre: number | null | undefined): string {
    if (idUbicacionPadre == null) return '—';
    const u = this.ubicaciones.find(x => x.idUbicacion === idUbicacionPadre);
    return u?.codigoUbicacion ?? '—';
  }

  /**
   * Cierra el modal
   */
  cerrar(): void {
    this.activeModal.close({ success: true });
  }
}
