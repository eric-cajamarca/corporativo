import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  MovimientoInventarioService,
  TipoMovimientoItem
} from '../../../services/movimiento-inventario.service';
import { SucursalService } from '../../../services/sucursal.service';
import { PdfService } from '../../../services/pdf.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { formatFechaLocal, getFechaHoyLocal } from '../../../utils/fecha-local.util';
import {
  MovimientoInventarioCabecera,
  MovimientoInventarioLineaDetalle,
  etiquetaTipoMovimiento
} from '../../../models/movimientos-inventario-resumen.model';

declare const iziToast: { success: (o: object) => void; error: (o: object) => void };

@Component({
  selector: 'app-lista-movimientos-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TopnavComponent, SidebarComponent],
  templateUrl: './lista-movimientos-inventario.component.html',
  styleUrl: './lista-movimientos-inventario.component.css'
})
export class ListaMovimientosInventarioComponent implements OnInit {
  sidebarState = inject(SidebarStateService);
  private movimientoService = inject(MovimientoInventarioService);
  private sucursalService = inject(SucursalService);
  private pdfService = inject(PdfService);

  fechaDesde = '';
  fechaHasta = '';
  idSucursal = '';
  codigoTipo = '';
  buscar = '';

  tiposMovimiento: TipoMovimientoItem[] = [];
  sucursales: { idSucursal?: string; nombre?: string }[] = [];
  items: MovimientoInventarioCabecera[] = [];
  /** Total de grupos que cumplen el filtro (todas las páginas). */
  totalRegistros = 0;
  paginaActual = 1;
  readonly tamPagina = 10;
  cargando = false;
  cargandoLineas = false;

  modalAbierto = false;
  cabeceraModal: MovimientoInventarioCabecera | null = null;
  lineasModal: MovimientoInventarioLineaDetalle[] = [];

  private buscarSubject = new Subject<string>();

  ngOnInit(): void {
    const hoy = new Date();
    const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
    this.fechaDesde = formatFechaLocal(inicioAnio);
    this.fechaHasta = getFechaHoyLocal();

    this.buscarSubject.pipe(debounceTime(400), distinctUntilChanged()).subscribe(() => this.cargar());

    this.movimientoService.obtenerTiposMovimiento().subscribe({
      next: (t) => {
        this.tiposMovimiento = t || [];
      },
      error: () => {
        this.tiposMovimiento = [];
      }
    });

    this.sucursalService.obtener_sucursal_todos().subscribe({
      next: (res) => {
        this.sucursales = res?.data || [];
      },
      error: () => {
        this.sucursales = [];
      }
    });

    this.cargar();
  }

  onBuscarInput(): void {
    this.buscarSubject.next(this.buscar);
  }

  get totalPaginas(): number {
    if (this.totalRegistros <= 0) {
      return 1;
    }
    return Math.ceil(this.totalRegistros / this.tamPagina);
  }

  /**
   * @param reiniciarPagina - true al cambiar filtros o búsqueda; false al ir a otra página o refrescar sin perder página.
   */
  cargar(reiniciarPagina = true): void {
    if (!this.fechaDesde || !this.fechaHasta) {
      iziToast.error({ title: 'Fechas', message: 'Indique periodo desde y hasta', position: 'topRight' });
      return;
    }
    if (reiniciarPagina) {
      this.paginaActual = 1;
    }
    this.cargando = true;
    this.movimientoService
      .listarMovimientosResumen({
        fechaDesde: this.fechaDesde,
        fechaHasta: this.fechaHasta,
        idSucursal: this.idSucursal || null,
        codigoTipo: this.codigoTipo || null,
        buscar: this.buscar || null,
        page: this.paginaActual,
        pageSize: this.tamPagina
      })
      .subscribe({
        next: (res) => {
          this.items = res?.items ?? [];
          this.totalRegistros = res?.total ?? 0;
          this.cargando = false;
        },
        error: (err) => {
          this.cargando = false;
          const msg = err?.error?.message || 'No se pudo cargar el listado';
          iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
          this.items = [];
          this.totalRegistros = 0;
        }
      });
  }

  irPaginaAnterior(): void {
    if (this.paginaActual <= 1) {
      return;
    }
    this.paginaActual--;
    this.cargar(false);
  }

  irPaginaSiguiente(): void {
    if (this.paginaActual >= this.totalPaginas) {
      return;
    }
    this.paginaActual++;
    this.cargar(false);
  }

  etiquetaTipo(c: MovimientoInventarioCabecera): string {
    return etiquetaTipoMovimiento(c.codigoTipoMovimiento, c.tipoMovimiento);
  }

  textoDocumento(c: MovimientoInventarioCabecera): string {
    const cod = (c.compCodigo || '').trim();
    const doc = (c.docRelacionado || '').trim();
    const partes = [cod, doc].filter(Boolean);
    return partes.length ? partes.join(' ') : '—';
  }

  /** Resumen bajo el título del modal (transferencias involucran más de una sucursal). */
  textoResumenModalCabecera(c: MovimientoInventarioCabecera): string {
    const tipo = this.etiquetaTipo(c);
    const doc = this.textoDocumento(c);
    const fecha = c.fecha || '—';
    const n = c.totalLineas ?? 0;
    if (c.codigoTipoMovimiento === 'TRANSFERENCIA') {
      return `${tipo} · ${doc} · ${fecha} · ${n} línea(s) — use las columnas «Sentido» y «Sucursal» (origen = salidas, destino = entradas).`;
    }
    return `${tipo} · ${doc} · ${fecha} · ${(c.sucursal || '').trim() || '—'} · ${(c.usuario || '').trim() || '—'} · ${n} línea(s)`;
  }

  /**
   * Etiqueta humana del tipo de fila en BD (EN/SA/AJ).
   */
  etiquetaSentidoLinea(tipoBd: string | null | undefined): string {
    const t = String(tipoBd || '').toUpperCase();
    if (t === 'SA') return 'Salida';
    if (t === 'EN') return 'Entrada';
    if (t === 'AJ') return 'Ajuste';
    return t || '—';
  }

  claseFilaPorSentido(tipoBd: string | null | undefined): string {
    const t = String(tipoBd || '').toUpperCase();
    if (t === 'SA') return 'table-danger-subtle';
    if (t === 'EN') return 'table-success-subtle';
    return '';
  }

  textoReferencia(c: MovimientoInventarioCabecera): string {
    return (c.sucursal || '').trim() || '—';
  }

  textoCondicionPago(c: MovimientoInventarioCabecera): string {
    const o = (c.observaciones || '').trim();
    if (!o) return '—';
    return o.length > 48 ? o.slice(0, 45) + '…' : o;
  }

  abrirDetalle(c: MovimientoInventarioCabecera): void {
    this.cabeceraModal = c;
    this.lineasModal = [];
    this.modalAbierto = true;
    this.cargandoLineas = true;
    this.movimientoService.listarLineasMovimientoCabecera(c.idMovimiento).subscribe({
      next: (lineas) => {
        this.lineasModal = lineas || [];
        this.cargandoLineas = false;
      },
      error: () => {
        this.cargandoLineas = false;
        iziToast.error({ title: 'Error', message: 'No se pudo cargar el detalle', position: 'topRight' });
      }
    });
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.cabeceraModal = null;
    this.lineasModal = [];
  }

  imprimirDetalle(): void {
    if (!this.cabeceraModal || !this.lineasModal.length) {
      iziToast.error({ title: 'PDF', message: 'No hay líneas para imprimir', position: 'topRight' });
      return;
    }
    const c = this.cabeceraModal;
    const columnas = ['Sentido', 'Sucursal', 'Producto', 'Cantidad', 'Costo u.', 'Importe'];
    const filas = this.lineasModal.map((l) => {
      const prod = [l.productoCodigo, l.productoDescripcion].filter(Boolean).join(' ').trim() || '—';
      const imp = (Number(l.cantidad) || 0) * (Number(l.costoUnitario) || 0);
      return [
        this.etiquetaSentidoLinea(l.tipoMovimiento),
        (l.sucursal || '—').trim(),
        prod,
        l.cantidad,
        l.costoUnitario ?? 0,
        imp
      ];
    });
    this.pdfService
      .generarPdfDinamico(
        {
          titulo: `Movimiento ${this.etiquetaTipo(c)} — ${this.textoDocumento(c)}`,
          columnas,
          filas
        },
        'lista-compras',
        8
      )
      .subscribe({
        next: (blob) => {
          this.pdfService.descargar(blob, `movimiento_inv_${c.idMovimiento}_${Date.now()}.pdf`);
          iziToast.success({ title: 'PDF', message: 'Generado correctamente', position: 'topRight' });
        },
        error: () => {
          iziToast.error({ title: 'Error', message: 'No se pudo generar el PDF', position: 'topRight' });
        }
      });
  }

  limpiarFiltros(): void {
    const hoy = new Date();
    const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
    this.fechaDesde = formatFechaLocal(inicioAnio);
    this.fechaHasta = getFechaHoyLocal();
    this.idSucursal = '';
    this.codigoTipo = '';
    this.buscar = '';
    this.cargar();
  }
}
