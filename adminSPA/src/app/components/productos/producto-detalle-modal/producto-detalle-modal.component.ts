import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProductoService } from '../../../services/producto.service';
import { Producto } from '../../../models/producto.models';

declare var iziToast: any;

@Component({
  selector: 'app-producto-detalle-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './producto-detalle-modal.component.html',
  styleUrl: './producto-detalle-modal.component.css'
})
export class ProductoDetalleModalComponent implements OnInit {
  @Input() idProducto!: string;

  producto: Producto | null = null;
  cargando = true;
  guardando = false;
  modoEdicion = false;

  /** Campos editables (los que no se muestran en la tabla listado) */
  alertaMinimo = 0;
  alertaMaximo = 0;
  estado = true;

  constructor(
    public activeModal: NgbActiveModal,
    private productoService: ProductoService
  ) {}

  ngOnInit(): void {
    if (this.idProducto) {
      this.cargarProducto();
    }
  }

  private cargarProducto(): void {
    this.cargando = true;
    this.productoService.obtenerProductoPorId(this.idProducto).subscribe({
      next: (response) => {
        const data = response.data;
        if (data && !Array.isArray(data)) {
          this.producto = data as Producto;
          this.alertaMinimo = this.producto.alertaMinimo ?? 0;
          this.alertaMaximo = this.producto.alertaMaximo ?? 0;
          this.estado = !!this.producto.estado;
        }
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar producto:', error);
        iziToast.error({
          title: 'Error',
          message: 'No se pudo cargar el producto',
          position: 'topRight'
        });
        this.cargando = false;
      }
    });
  }

  toggleEdicion(): void {
    this.modoEdicion = !this.modoEdicion;
    if (!this.modoEdicion && this.producto) {
      this.alertaMinimo = this.producto.alertaMinimo ?? 0;
      this.alertaMaximo = this.producto.alertaMaximo ?? 0;
      this.estado = !!this.producto.estado;
    }
  }

  guardar(): void {
    if (!this.producto) return;
    if (this.alertaMinimo < 0 || this.alertaMaximo < 0) {
      iziToast.warning({
        title: 'Validación',
        message: 'Alertas no pueden ser negativas',
        position: 'topRight'
      });
      return;
    }

    this.guardando = true;
    const payload = {
      Codigo: this.producto.Codigo ?? this.producto.codigo ?? '',
      idCategoria: this.producto.idCategoria ?? 0,
      idMarca: this.producto.idMarca ?? 0,
      descripcion: this.producto.descripcion,
      idPresentacion: this.producto.idPresentacion ?? 0,
      cUnitario: this.producto.cUnitario,
      fProduccion: this.producto.fProduccion ?? '',
      fVencimiento: this.producto.fVencimiento ?? '',
      alertaMinimo: this.alertaMinimo,
      alertaMaximo: this.alertaMaximo,
      estado: this.estado
    };

    this.productoService.actualizarProducto(this.producto.idProducto, payload).subscribe({
      next: () => {
        iziToast.success({
          title: 'Guardado',
          message: 'Cambios guardados correctamente',
          position: 'topRight'
        });
        this.producto = { ...this.producto!, alertaMinimo: this.alertaMinimo, alertaMaximo: this.alertaMaximo, estado: this.estado ? 1 : 0 };
        this.modoEdicion = false;
        this.guardando = false;
        this.activeModal.close(true);
      },
      error: (error) => {
        console.error('Error al actualizar producto:', error);
        iziToast.error({
          title: 'Error',
          message: error?.error?.message || 'No se pudieron guardar los cambios',
          position: 'topRight'
        });
        this.guardando = false;
      }
    });
  }

  cerrar(): void {
    this.activeModal.dismiss();
  }

  get tipoProductoLabel(): string {
    if (!this.producto?.tipoProducto) return '—';
    return this.producto.tipoProducto === 'S' ? 'Simple' : this.producto.tipoProducto === 'C' ? 'Compuesto (Kit)' : this.producto.tipoProducto;
  }
}
