import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProductoService } from '../../../services/producto.service';

export interface ProductoSeleccionado {
  idProducto: string;
  codigo: string;
  descripcion: string;
  idPresentacion?: number;
  codigoPresentacion?: string;
  pVenta: number;
  categoria?: string;
  sucursal?: string;
  stock?: number;
  idSucursal?: string | number;
  [key: string]: unknown;
}

@Component({
  selector: 'app-buscador-productos-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './buscador-productos-modal.component.html',
  styleUrl: './buscador-productos-modal.component.css'
})
export class BuscadorProductosModalComponent implements OnInit {
  searchTerm = '';
  productosConst: ProductoSeleccionado[] = [];
  productosFiltrados: ProductoSeleccionado[] = [];
  loading = false;
  idSucursal: string | null = null;

  constructor(
    public activeModal: NgbActiveModal,
    private productoService: ProductoService
  ) {}

  ngOnInit(): void {
    this.cargarProductos();
  }

  cargarProductos(): void {
    this.loading = true;
    this.productoService.obtenerProductosTodos().subscribe({
      next: (response: any) => {
        const data = response?.data ?? [];
        this.productosConst = Array.isArray(data) ? data : [];
        this.productosFiltrados = [...this.productosConst];
        this.loading = false;
      },
      error: () => {
        this.productosConst = [];
        this.productosFiltrados = [];
        this.loading = false;
      }
    });
  }

  buscarProductos(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (term === '') {
      this.productosFiltrados = [...this.productosConst];
      return;
    }
    this.productosFiltrados = this.productosConst.filter((item: any) => {
      const descripcion = (item.descripcion ?? '').toString().toLowerCase();
      const codigo = (item.codigo ?? '').toString().toLowerCase();
      const marca = (item.nombre ?? '').toString().toLowerCase();
      const categoria = (item.categoria ?? '').toString().toLowerCase();
      return (
        descripcion.includes(term) ||
        codigo.includes(term) ||
        marca.includes(term) ||
        categoria.includes(term)
      );
    });
  }

  seleccionar(p: ProductoSeleccionado): void {
    this.activeModal.close(p);
  }

  cerrar(): void {
    this.activeModal.dismiss();
  }
}
