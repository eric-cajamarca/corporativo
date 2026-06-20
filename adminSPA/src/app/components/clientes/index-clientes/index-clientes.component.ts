import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { ClienteService } from '../../../services/cliente.service';
import { ClienteEditarModalService } from '../../../services/cliente-editar-modal.service';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { filtrarClientesCatalogo } from '../../../utils/cliente-busqueda.util';

declare var iziToast: any;

type ModoBusquedaClientes = 'inicial' | 'redis' | 'sql';

@Component({
  selector: 'app-index-clientes',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule, NgbPagination, TopnavComponent, SidebarComponent],
  templateUrl: './index-clientes.component.html',
  styleUrl: './index-clientes.component.css'
})
export class IndexClientesComponent implements OnDestroy {
  @Input() modoSelector = false;
  @Output() clienteElegido: EventEmitter<any> = new EventEmitter<any>();

  public clientes: Array<any> = [];
  /** Catálogo completo cargado desde índice Redis (GET /clientes). */
  private clientesCatalogo: Array<any> = [];
  public token: any = '';

  public page = 1;
  public pageSize = 10;
  totalClientes = 0;
  public maxSize = 10;
  public rotate = true;
  public boundaryLinks = true;

  public filtro = '';
  public load_estado = false;
  public cargandoCatalogo = false;
  public modoBusqueda: ModoBusquedaClientes = 'inicial';

  private readonly minCharsRedis = 3;
  private filtroDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private cargaSeq = 0;

  constructor(
    private _adminService: AdminService,
    private _clientesService: ClienteService,
    private clienteEditarModal: ClienteEditarModalService,
    public sidebarState: SidebarStateService
  ) {}

  abrirEditarClienteModal(idCliente: string | number): void {
    this.clienteEditarModal.abrir(idCliente).then(() => this.recargarListado());
  }

  ngOnInit(): void {
    this.cargarCatalogoRedis(() => {
      const term = (this.filtro || '').trim();
      if (term.length >= this.minCharsRedis) {
        return;
      }
      if (this.modoSelector) {
        this.mostrarVistaInicialCatalogo();
      } else {
        this.init_data(1);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.filtroDebounceTimer != null) {
      clearTimeout(this.filtroDebounceTimer);
    }
  }

  private recargarListado(): void {
    this._clientesService.invalidarCacheClientes();
    this.cargarCatalogoRedis(() => {
      const term = (this.filtro || '').trim();
      if (term.length >= this.minCharsRedis && this.modoBusqueda === 'redis') {
        this.aplicarFiltroRedis(term);
      } else if (this.modoBusqueda === 'sql') {
        this.init_data(this.page, { evitarCache: true, forzar: true });
      } else if (this.modoSelector) {
        this.mostrarVistaInicialCatalogo();
      } else {
        this.init_data(this.page);
      }
    });
  }

  /** Carga índice completo de clientes (backend Redis → SQL si miss). */
  private cargarCatalogoRedis(alFinalizar?: () => void): void {
    this.cargandoCatalogo = true;
    this._clientesService.obtener_clientes().subscribe({
      next: (response) => {
        this.clientesCatalogo = Array.isArray(response?.data) ? response.data : [];
        this.cargandoCatalogo = false;
        const term = (this.filtro || '').trim();
        if (term.length >= this.minCharsRedis) {
          this.aplicarFiltroRedis(term);
        }
        alFinalizar?.();
      },
      error: () => {
        this.clientesCatalogo = [];
        this.cargandoCatalogo = false;
        alFinalizar?.();
      }
    });
  }

  private mostrarVistaInicialCatalogo(): void {
    this.modoBusqueda = 'inicial';
    this.page = 1;
    this.clientes = this.clientesCatalogo.slice(0, this.pageSize);
    this.totalClientes = this.clientesCatalogo.length;
  }

  /** Carga paginada directa en SQL Server (botón Buscar o paginación). */
  init_data(pagina = 1, opciones?: { evitarCache?: boolean; forzar?: boolean }) {
    const term = (this.filtro || '').trim();
    if (!opciones?.forzar && term.length >= this.minCharsRedis && this.modoBusqueda === 'redis') {
      return;
    }

    const seq = ++this.cargaSeq;
    this.load_estado = true;
    this.modoBusqueda = 'sql';
    this.page = pagina;
    this._clientesService.obtenerClientesPaginado({
      pagina,
      porPagina: this.pageSize,
      buscar: term || undefined,
      evitarCache: opciones?.evitarCache === true
    }).subscribe({
      next: (response) => {
        if (seq !== this.cargaSeq) {
          return;
        }
        if (response.data == undefined) {
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: 'Usted no tiene acceso a clientes'
          });
          this.load_estado = false;
        } else {
          this.clientes = response.data;
          this.totalClientes = response.total ?? 0;
          this.load_estado = false;
        }
      },
      error: () => {
        if (seq === this.cargaSeq) {
          this.load_estado = false;
        }
      }
    });
  }

  /** Botón Buscar: consulta SQL Server (sin caché Redis). */
  filtrar(): void {
    this.cargaSeq++;
    this.init_data(1, { evitarCache: true, forzar: true });
  }

  /** Al escribir: desde la 3.ª letra filtra el catálogo Redis en memoria. */
  onFiltroInput(): void {
    if (this.filtroDebounceTimer != null) {
      clearTimeout(this.filtroDebounceTimer);
    }
    const term = (this.filtro || '').trim();
    if (term.length < this.minCharsRedis) {
      if (!term) {
        this.cargaSeq++;
        if (this.modoSelector) {
          this.mostrarVistaInicialCatalogo();
        } else {
          this.init_data(1);
        }
      }
      return;
    }
    this.filtroDebounceTimer = setTimeout(() => this.aplicarFiltroRedis(term), 250);
  }

  private aplicarFiltroRedis(term: string): void {
    this.cargaSeq++;
    this.modoBusqueda = 'redis';
    this.page = 1;
    const filtrados = filtrarClientesCatalogo(this.clientesCatalogo, term, 50) as Array<any>;
    this.clientes = filtrados;
    this.totalClientes = filtrados.length;
  }

  onPageChange(pagina: number): void {
    if (this.modoBusqueda === 'sql') {
      this.init_data(pagina, { evitarCache: true, forzar: true });
    }
  }

  get mostrarPaginacion(): boolean {
    return this.modoBusqueda === 'sql' && this.totalClientes > this.pageSize;
  }

  get mostrarAvisoRedis(): boolean {
    const term = (this.filtro || '').trim();
    return term.length > 0 && term.length < this.minCharsRedis;
  }

  get mostrarSinResultadosRedis(): boolean {
    const term = (this.filtro || '').trim();
    return (
      this.modoBusqueda === 'redis' &&
      term.length >= this.minCharsRedis &&
      !this.cargandoCatalogo &&
      this.clientes.length === 0
    );
  }

  get tablaConOpacidad(): boolean {
    return this.load_estado || this.cargandoCatalogo;
  }

  set_state(id: any, estado: any) {
    this.load_estado = true;
    this._clientesService.cambiar_estado_clientes(id, { estado: estado }).subscribe({
      next: (response) => {
        if (response.data != undefined) {
          this.load_estado = false;
          this.recargarListado();
        }
      },
      error: () => {}
    });
  }

  eliminar(id: any) {
    this.load_estado = true;
    this._clientesService.eliminar_direccionCliente(id).subscribe({
      next: () => {}
    });

    this._clientesService.eliminar_cliente(id).subscribe({
      next: (response) => {
        this.load_estado = false;
        if (response.data != undefined) {
          iziToast.show({
            title: 'success',
            titleColor: '#00FF00',
            color: '#FFF',
            class: 'text-success',
            position: 'topRight',
            message: 'Cliente eliminado correctamente'
          });
          this.recargarListado();
        }
      }
    });
  }

  elegir(cliente: any): void {
    this.clienteElegido.emit(cliente);
  }
}
