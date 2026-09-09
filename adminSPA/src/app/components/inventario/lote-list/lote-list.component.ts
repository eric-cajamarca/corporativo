import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { LotesService } from '../../../services/lotes.service';
import { InventarioModalService } from '../../../services/inventario-modal.service';
import { GestoresService } from '../../../services/gestores.service';
import { Lote } from '../../../models/inventario.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

declare var iziToast: any;

export type FiltroCaducidadLotes = 'todos' | 'por-vencer' | 'vencidos';

@Component({
  selector: 'app-lote-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lote-list.component.html',
  styleUrl: './lote-list.component.css'
})
export class LoteListComponent implements OnInit {
  lotes: Lote[] = [];
  lotesFiltrados: Lote[] = [];

  filtrosIniciales: any = {};
  filtroProducto = '';
  filtroSucursal = '';
  filtroFechaDesde = '';
  filtroFechaHasta = '';
  filtroCaducidad: FiltroCaducidadLotes = 'todos';
  diasPorVencer = 30;
  conteoPorVencer = 0;
  conteoVencidos = 0;
  esModoGestora = false;

  isLoading = true;
  errorMessage = '';

  constructor(
    public activeModal: NgbActiveModal,
    private loteService: LotesService,
    private inventarioModal: InventarioModalService,
    private gestoresService: GestoresService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.gestoresService.obtenerEmpresasGestionadas().subscribe({
      next: (res) => {
        const arr = Array.isArray(res?.data) ? res.data : [];
        this.esModoGestora = arr.length > 0;
        this.cargarLotes();
      },
      error: () => {
        this.esModoGestora = false;
        this.cargarLotes();
      }
    });
  }

  /**
   * Carga todos los lotes de la empresa
   */
  cargarLotes(): void {
    this.isLoading = true;
    this.loteService.obtener_lotes_todos({ alcanceGestora: this.esModoGestora }).subscribe({
      next: (response: any) => {
        this.lotes = response.data || [];
        this.aplicarFiltros();
        this.isLoading = false;
      },
      error: (error) => {
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

    this.actualizarConteosCaducidad(filtrados);

    const productoFiltro = this.filtrosIniciales?.producto;
    if (productoFiltro) {
      const term = new RegExp(productoFiltro, 'i');
      filtrados = filtrados.filter(
        l =>
          term.test(l.nombreProducto || '') ||
          term.test(l.codigoProducto || '') ||
          term.test(l.idProducto || '') ||
          term.test(l.numeroLote || '')
      );
    }

    const empresaFiltro = this.filtrosIniciales?.empresa;
    if (empresaFiltro) {
      const term = new RegExp(empresaFiltro, 'i');
      filtrados = filtrados.filter(
        l =>
          term.test(l.aliasEmpresa || '') ||
          term.test(l.idEmpresa || '')
      );
    }

    if (this.filtroProducto) {
      const term = new RegExp(this.filtroProducto, 'i');
      filtrados = filtrados.filter(l =>
        term.test(l.nombreProducto || '') ||
        term.test(l.codigoProducto || '') ||
        term.test(l.idProducto || '') ||
        term.test(l.numeroLote || '')
      );
    }

    if (this.filtroSucursal) {
      const term = new RegExp(this.filtroSucursal, 'i');
      filtrados = filtrados.filter(l => 
        term.test(l.nombreSucursal || '') || 
        term.test(l.idSucursal || '')
      );
    }

    if (this.filtroCaducidad === 'por-vencer') {
      filtrados = filtrados.filter((l) => this.esLotePorVencer(l));
      filtrados = [...filtrados].sort((a, b) => this.fechaVencMs(a) - this.fechaVencMs(b));
    } else if (this.filtroCaducidad === 'vencidos') {
      filtrados = filtrados.filter((l) => this.esLoteVencidoConStock(l));
      filtrados = [...filtrados].sort((a, b) => this.fechaVencMs(a) - this.fechaVencMs(b));
    }

    this.lotesFiltrados = filtrados;
  }

  setFiltroCaducidad(valor: FiltroCaducidadLotes): void {
    this.filtroCaducidad = valor;
    this.aplicarFiltros();
  }

  private actualizarConteosCaducidad(origen: Lote[]): void {
    this.conteoPorVencer = origen.filter((l) => this.esLotePorVencer(l)).length;
    this.conteoVencidos = origen.filter((l) => this.esLoteVencidoConStock(l)).length;
  }

  private stockDisponible(lote: Lote): number {
    return Number(lote.cantidadDisponible) || 0;
  }

  private fechaVencMs(lote: Lote): number {
    const raw = lote.fechaVencimiento != null ? String(lote.fechaVencimiento).slice(0, 10) : '';
    if (!raw) {
      return Number.MAX_SAFE_INTEGER;
    }
    const d = new Date(`${raw}T00:00:00`);
    return Number.isNaN(d.getTime()) ? Number.MAX_SAFE_INTEGER : d.getTime();
  }

  diasHastaVencer(fechaVencimiento: string | Date | null | undefined): number | null {
    if (!fechaVencimiento) {
      return null;
    }
    const raw = String(fechaVencimiento).slice(0, 10);
    if (!raw) {
      return null;
    }
    const venc = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(venc.getTime())) {
      return null;
    }
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  }

  esLotePorVencer(lote: Lote): boolean {
    if (this.stockDisponible(lote) <= 0) {
      return false;
    }
    const dias = this.diasHastaVencer(lote.fechaVencimiento);
    return dias != null && dias >= 0 && dias <= this.diasPorVencer;
  }

  esLoteVencidoConStock(lote: Lote): boolean {
    if (this.stockDisponible(lote) <= 0) {
      return false;
    }
    const dias = this.diasHastaVencer(lote.fechaVencimiento);
    return dias != null && dias < 0;
  }

  textoDiasCaducidad(lote: Lote): string {
    const dias = this.diasHastaVencer(lote.fechaVencimiento);
    if (dias == null) {
      return '';
    }
    if (dias < 0) {
      return `Vencido hace ${Math.abs(dias)} d`;
    }
    if (dias === 0) {
      return 'Vence hoy';
    }
    return `Vence en ${dias} d`;
  }

  mostrarAccionesCaducidad(lote: Lote): boolean {
    return this.esLotePorVencer(lote) || this.esLoteVencidoConStock(lote);
  }

  bajarPrecio(lote: Lote): void {
    const q = String(lote.codigoProducto || lote.nombreProducto || '').trim();
    this.navegarCerrandoModal(['/precios'], {
      q,
      idProducto: lote.idProducto || ''
    });
  }

  darBajaMerma(lote: Lote): void {
    this.navegarCerrandoModal(['/inventario/salidas'], {
      tipo: 'SALIDA_MERMA',
      idProducto: lote.idProducto || '',
      idSucursal: lote.idSucursal || '',
      idLote: lote.idLote || '',
      cantidad: String(this.stockDisponible(lote)),
      codigo: lote.codigoProducto || '',
      descripcion: lote.nombreProducto || '',
      numeroLote: lote.numeroLote || '',
      fechaVencimiento: lote.fechaVencimiento ? String(lote.fechaVencimiento).slice(0, 10) : '',
      costoUnitario: String(lote.costoUnitario ?? '')
    });
  }

  private navegarCerrandoModal(ruta: string[], queryParams: Record<string, string>): void {
    try {
      this.activeModal.dismiss('navigate');
    } catch {
      /* abierto como ruta, no como modal */
    }
    this.router.navigate(ruta, { queryParams });
  }

  loteVencido(fechaVencimiento: string | Date | null | undefined): boolean {
    if (!fechaVencimiento) {
      return false;
    }
    const raw = String(fechaVencimiento).slice(0, 10);
    if (!raw) {
      return false;
    }
    const venc = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(venc.getTime())) {
      return false;
    }
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return venc < hoy;
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
    this.filtroCaducidad = 'todos';
    this.diasPorVencer = 30;
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
