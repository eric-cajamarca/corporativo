import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { LotesService } from '../../../services/lotes.service';
import { InventarioModalService } from '../../../services/inventario-modal.service';
import { Lote } from '../../../models/inventario.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

declare var iziToast: any;

@Component({
  selector: 'app-lote-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lote-list.component.html',
  styleUrl: './lote-list.component.css'
})
export class LoteListComponent implements OnInit {
  // Array que almacena todos los lotes obtenidos del backend
  lotes: Lote[] = [];
  lotesFiltrados: Lote[] = [];
  
  // Filtros
  filtrosIniciales: any = {};
  filtroProducto = '';
  filtroSucursal = '';
  filtroFechaDesde = '';
  filtroFechaHasta = '';
  
  // Bandera para mostrar/ocultar spinner de carga
  isLoading = true;
  
  // Mensaje de error si falla la consulta
  errorMessage = '';

  constructor(
    public activeModal: NgbActiveModal,
    private loteService: LotesService,
    private inventarioModal: InventarioModalService
  ) {}

  ngOnInit(): void {
    this.cargarLotes();
  }

  /**
   * Carga todos los lotes de la empresa
   */
  cargarLotes(): void {
    this.isLoading = true;
    this.loteService.obtener_lotes_todos().subscribe({
      next: (response: any) => {
        this.lotes = response.data || [];
        this.aplicarFiltros();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar lotes', error);
        this.errorMessage = 'No se pudieron cargar los lotes';
        this.isLoading = false;
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'Error al cargar los lotes',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Aplica filtros a la lista de lotes.
   * Si filtrosIniciales.idLotes está definido (ej. abierto desde compras sin asignar por defecto), solo se muestran esos lotes.
   */
  aplicarFiltros(): void {
    let filtrados = [...this.lotes];

    const idLotesFiltro = this.filtrosIniciales?.idLotes;
    if (Array.isArray(idLotesFiltro) && idLotesFiltro.length > 0) {
      const setIds = new Set(idLotesFiltro);
      filtrados = filtrados.filter(l => l.idLote && setIds.has(l.idLote));
    }

    if (this.filtroProducto) {
      const term = new RegExp(this.filtroProducto, 'i');
      filtrados = filtrados.filter(l => 
        term.test(l.nombreProducto || '') || 
        term.test(l.idProducto || '')
      );
    }

    if (this.filtroSucursal) {
      const term = new RegExp(this.filtroSucursal, 'i');
      filtrados = filtrados.filter(l => 
        term.test(l.nombreSucursal || '') || 
        term.test(l.idSucursal || '')
      );
    }

    this.lotesFiltrados = filtrados;
  }

  /**
   * Abre modal para crear nuevo lote
   */
  crearLote(): void {
    this.inventarioModal.abrirLoteForm().then(result => {
      if (result?.success) {
        this.cargarLotes();
      }
    }).catch(() => {});
  }

  /**
   * Abre modal para editar lote
   */
  editarLote(idLote: string): void {
    this.inventarioModal.abrirLoteForm(idLote).then(result => {
      if (result?.success) {
        this.cargarLotes();
      }
    }).catch(() => {});
  }

  /**
   * Abre modal para asignar ubicaciones a un lote.
   * Si el modal se abrió con idLotes (solo lotes de una compra), al asignar se quita el lote de la lista.
   */
  asignarUbicaciones(lote: Lote): void {
    const cantidadTotal = lote.cantidadDisponible || lote.cantidadIngresada || 0;
    this.inventarioModal.abrirAsignarUbicaciones(lote.idLote!, cantidadTotal).then(result => {
      if (result?.success) {
        if (Array.isArray(this.filtrosIniciales?.idLotes) && this.filtrosIniciales.idLotes.length > 0) {
          this.quitarLoteDeLista(lote.idLote!);
        } else {
          this.cargarLotes();
        }
      }
    }).catch(() => {});
  }

  /**
   * Quita un lote de la lista local (usado cuando se abre solo con idLotes y el usuario ya asignó ese lote).
   */
  private quitarLoteDeLista(idLote: string): void {
    this.lotes = this.lotes.filter(l => l.idLote !== idLote);
    this.lotesFiltrados = this.lotesFiltrados.filter(l => l.idLote !== idLote);
  }

  /**
   * Abre modal para movimiento de ubicaciones
   */
  moverUbicacion(idLote: string): void {
    this.inventarioModal.abrirMovimientoUbicacion(idLote).then(result => {
      if (result?.success) {
        this.cargarLotes();
      }
    }).catch(() => {});
  }

  /**
   * Elimina un lote (solo si no tiene movimientos)
   */
  eliminarLote(idLote: string): void {
    if (confirm('¿Está seguro de eliminar este lote? Esto solo funciona si no tiene movimientos.')) {
      this.loteService.eliminar_lote(idLote).subscribe({
        next: () => {
          iziToast.show({
            title: 'Éxito',
            titleColor: '#28a745',
            message: 'Lote eliminado correctamente',
            position: 'topRight'
          });
          this.cargarLotes();
        },
        error: (error) => {
          iziToast.show({
            title: 'Error',
            titleColor: '#dc3545',
            message: error.error?.message || 'Error al eliminar el lote',
            position: 'topRight'
          });
        }
      });
    }
  }

  /**
   * Limpia todos los filtros
   */
  limpiarFiltros(): void {
    this.filtroProducto = '';
    this.filtroSucursal = '';
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.aplicarFiltros();
  }

  /**
   * Recarga la lista desde el servidor (sin cerrar el modal).
   */
  actualizarLista(): void {
    if (this.isLoading) {
      return;
    }
    this.errorMessage = '';
    this.cargarLotes();
  }

  /**
   * Cierra el modal
   */
  cerrar(): void {
    this.activeModal.dismiss();
  }

}
