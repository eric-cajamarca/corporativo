import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { ValesDespachoService } from '../../../services/vales-despacho.service';
import { ClienteService } from '../../../services/cliente.service';
import { SucursalService } from '../../../services/sucursal.service';
import { BuscadorProductosModalService } from '../../../services/buscador-productos-modal.service';
import { ProductoSeleccionado } from '../../shared/buscador-productos-modal/buscador-productos-modal.component';
import { IndexClientesComponent } from '../../clientes/index-clientes/index-clientes.component';

interface SucursalItem {
  idSucursal: string;
  codigo?: string;
  nombre?: string;
  direccion?: string;
}

interface ProductoValeItem {
  idProducto: string;
  codigo: string;
  descripcion: string;
  pVenta?: number;
  codigoPresentacion?: string;
  idPresentacion?: number;
}

interface LineaVale {
  idProducto: string;
  codigo: string;
  descripcion: string;
  codigoPresentacion?: string;
  idPresentacion: number;
  cantidad: number;
  pUnitario: number;
  total: number;
}

@Component({
  selector: 'app-create-vale-despacho',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SidebarComponent, TopnavComponent, IndexClientesComponent],
  templateUrl: './create-vale-despacho.component.html',
  styleUrl: './create-vale-despacho.component.css'
})
export class CreateValeDespachoComponent implements OnInit {
  private valesDespachoService = inject(ValesDespachoService);
  private clienteService = inject(ClienteService);
  private sucursalService = inject(SucursalService);
  private buscadorProductosModal = inject(BuscadorProductosModalService);
  private router = inject(Router);
  sidebarState = inject(SidebarStateService);

  sucursales: SucursalItem[] = [];
  clientes: { idCliente: number; rSocial?: string; nombre?: string; ruc?: string }[] = [];
  /** Cliente seleccionado para mostrar en el modal de información */
  clienteSeleccionado: { idCliente: number; rSocial?: string; nombre?: string; ruc?: string; direccion?: string } | null = null;

  form = {
    idSucursal: '',
    idCliente: null as number | null,
    observaciones: ''
  };
  lineas: LineaVale[] = [];
  showModalCliente = false;
  guardando = false;
  errorMessage = '';

  ngOnInit(): void {
    this.sucursalService.obtener_sucursal_idempresa().subscribe({
      next: (r: { data?: SucursalItem[] }) => {
        this.sucursales = (r.data || []).map((s) => ({
          idSucursal: s.idSucursal,
          codigo: s.codigo,
          nombre: s.nombre,
          direccion: s.direccion
        }));
        if (this.sucursales.length && !this.form.idSucursal) {
          this.form.idSucursal = this.sucursales[0].idSucursal;
        }
      }
    });
    this.clienteService.obtener_clientes().subscribe({
      next: (r: { data?: any[] }) => {
        const list = r.data || r || [];
        this.clientes = Array.isArray(list) ? list : [];
      }
    });
  }

  abrirModalCliente(): void {
    this.showModalCliente = true;
  }

  cerrarModalCliente(): void {
    this.showModalCliente = false;
  }

  onClienteElegido(cliente: any): void {
    if (!cliente || cliente.idCliente == null) return;
    this.form.idCliente = cliente.idCliente;
    this.clienteSeleccionado = { idCliente: cliente.idCliente, rSocial: cliente.rSocial, nombre: cliente.nombre, ruc: cliente.ruc, direccion: cliente.direccion };
    this.cerrarModalCliente();
  }

  /** Al cambiar el cliente desde el select, actualizar clienteSeleccionado para mostrarlo en el modal. */
  onIdClienteChange(idCliente: number | null): void {
    if (idCliente == null) {
      this.clienteSeleccionado = null;
      return;
    }
    const c = this.clientes.find((x) => x.idCliente === idCliente);
    this.clienteSeleccionado = c ? { idCliente: c.idCliente, rSocial: c.rSocial, nombre: c.nombre, ruc: c.ruc } : null;
  }

  /** Abre el modal de búsqueda de productos (el mismo que usa crear nueva venta). */
  abrirModalProducto(): void {
    this.buscadorProductosModal.abrir().then((p: ProductoSeleccionado | null) => {
      if (p) this.agregarProductoDesdeModal(p);
    });
  }

  agregarProductoDesdeModal(p: ProductoSeleccionado): void {
    const idPres = p.idPresentacion ?? 1;
    const pUnit = p.pVenta ?? 0;
    const cantidad = 1;
    this.lineas.push({
      idProducto: p.idProducto,
      codigo: p.codigo ?? '',
      descripcion: p.descripcion ?? '',
      codigoPresentacion: p.codigoPresentacion,
      idPresentacion: idPres,
      cantidad,
      pUnitario: pUnit,
      total: cantidad * pUnit
    });
  }

  quitarLinea(i: number): void {
    this.lineas.splice(i, 1);
  }

  actualizarTotal(linea: LineaVale): void {
    linea.total = (linea.cantidad || 0) * (linea.pUnitario || 0);
  }

  totalGeneral(): number {
    return this.lineas.reduce((s, l) => s + (l.total || 0), 0);
  }

  guardar(): void {
    this.errorMessage = '';
    if (!this.form.idSucursal) {
      this.errorMessage = 'Seleccione sucursal.';
      return;
    }
    if (this.form.idCliente == null || this.form.idCliente === 0) {
      this.errorMessage = 'Seleccione cliente.';
      return;
    }
    if (this.lineas.length === 0) {
      this.errorMessage = 'Agregue al menos un producto al detalle.';
      return;
    }
    const detalle = this.lineas.map(l => ({
      idProducto: l.idProducto,
      idPresentacion: l.idPresentacion,
      cantidad: l.cantidad,
      pUnitario: l.pUnitario,
      total: Math.round(l.total * 100) / 100
    }));
    this.guardando = true;
    this.valesDespachoService.crear({
      idSucursal: this.form.idSucursal,
      idCliente: this.form.idCliente,
      observaciones: this.form.observaciones || undefined,
      detalle
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.router.navigate(['/vales-despacho']);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Error al crear el vale';
        this.guardando = false;
      }
    });
  }

  cancelar(): void {
    this.router.navigate(['/vales-despacho']);
  }
}
