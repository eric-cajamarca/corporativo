import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProductoUnidadVentaItem } from '../../../models/producto-unidad-venta.model';
import { cantidadEnUnidadCompra, precioUnidadDesdePrincipal, stockAlcanzaEnUnidad } from '../../../utils/unidad-venta.util';

export interface SeleccionUnidadVentaResultado {
  idUnidadVenta: string;
  nombreUnidadVenta: string;
  factorAInterna: number;
  factorCompraAInterna: number;
  unidadInternaNombre: string;
  cantidad: number;
  pVenta: number;
  matizadoPedido?: boolean;
}

@Component({
  selector: 'app-seleccionar-unidad-venta-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './seleccionar-unidad-venta-modal.component.html'
})
export class SeleccionarUnidadVentaModalComponent implements OnInit {
  @Input() descripcion = '';
  @Input() stockCompra: number | null = null;
  @Input() presentacionCompra = 'galón';
  @Input() factorCompraAInterna = 1;
  @Input() unidadInternaNombre = '';
  @Input() unidades: ProductoUnidadVentaItem[] = [];
  @Input() usarMatizado = false;
  @Input() precioPrincipal = 0;

  idUnidadVenta = '';
  cantidad = 1;
  matizadoPedido = false;

  constructor(public activeModal: NgbActiveModal) {}

  ngOnInit(): void {
    const primera = this.unidades[0];
    this.idUnidadVenta = primera?.idUnidadVenta || '';
    this.cantidad = 1;
  }

  get unidadSel(): ProductoUnidadVentaItem | undefined {
    return this.unidades.find((u) => String(u.idUnidadVenta) === String(this.idUnidadVenta));
  }

  stockAlcanza(u: ProductoUnidadVentaItem): number {
    if (!u || this.stockCompra == null) return 0;
    return stockAlcanzaEnUnidad(this.stockCompra, u.factorAInterna, this.factorCompraAInterna);
  }

  get restaCompra(): number {
    const u = this.unidadSel;
    if (!u) return 0;
    return cantidadEnUnidadCompra(
      { factorAInterna: u.factorAInterna, factorCompraAInterna: this.factorCompraAInterna },
      this.cantidad
    );
  }

  precioDe(u: ProductoUnidadVentaItem | undefined): number {
    if (!u) return 0;
    return precioUnidadDesdePrincipal(u, this.precioPrincipal, this.factorCompraAInterna);
  }

  get totalLinea(): number {
    const precio = this.precioDe(this.unidadSel);
    return Math.round((this.cantidad || 0) * precio * 100) / 100;
  }

  get stockRestante(): number {
    if (this.stockCompra == null) return 0;
    return Math.round((this.stockCompra - this.restaCompra) * 1e6) / 1e6;
  }

  confirmar(): void {
    const u = this.unidadSel;
    const cant = Number(this.cantidad) || 0;
    if (!u || cant <= 0) return;
    const result: SeleccionUnidadVentaResultado = {
      idUnidadVenta: u.idUnidadVenta,
      nombreUnidadVenta: u.nombre,
      factorAInterna: u.factorAInterna,
      factorCompraAInterna: this.factorCompraAInterna,
      unidadInternaNombre: this.unidadInternaNombre,
      cantidad: cant,
      pVenta: this.precioDe(u),
      matizadoPedido: this.usarMatizado && this.matizadoPedido
    };
    this.activeModal.close(result);
  }

  cancelar(): void {
    this.activeModal.dismiss();
  }
}
