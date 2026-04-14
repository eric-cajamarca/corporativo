import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProductosImagenService, ImagenProducto } from '../../../services/productos-imagen.service';
import { GestoresService } from '../../../services/gestores.service';

declare var iziToast: any;

@Component({
  selector: 'app-producto-galeria-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './producto-galeria-modal.component.html',
  styleUrl: './producto-galeria-modal.component.css'
})
export class ProductoGaleriaModalComponent implements OnInit {
  @Input() idProducto!: string;
  @Input() etiquetaProducto = '';

  imagenesProducto: ImagenProducto[] = [];
  archivosSeleccionados: File[] = [];
  subiendoImagenes = false;
  marcandoPortadaId: string | null = null;
  cargando = true;
  productosConImagenes = false;

  constructor(
    public activeModal: NgbActiveModal,
    private productosImagenService: ProductosImagenService,
    private gestoresService: GestoresService
  ) {}

  ngOnInit(): void {
    this.gestoresService.obtenerConfiguracion().subscribe({
      next: (res) => {
        const item = (res?.data ?? []).find((c: { clave: string }) => c.clave === 'PRODUCTOS_CON_IMAGENES');
        this.productosConImagenes = item ? String(item.valor).toLowerCase() === 'true' : false;
        if (this.productosConImagenes && this.idProducto) {
          this.cargarImagenes();
        } else {
          this.cargando = false;
        }
      },
      error: () => {
        this.cargando = false;
      }
    });
  }

  get imagenesOrdenadas(): ImagenProducto[] {
    return [...this.imagenesProducto].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }

  esPortada(img: ImagenProducto): boolean {
    const sorted = this.imagenesOrdenadas;
    return sorted.length > 0 && sorted[0].idImagen === img.idImagen;
  }

  cargarImagenes(): void {
    if (!this.idProducto) return;
    this.cargando = true;
    this.productosImagenService.listar(this.idProducto).subscribe({
      next: (res) => {
        this.imagenesProducto = res.data || [];
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        iziToast.error({ title: 'Error', message: 'No se pudieron cargar las imágenes', position: 'topRight' });
      }
    });
  }

  onArchivosChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const max = 5 - this.imagenesProducto.length;
      this.archivosSeleccionados = Array.from(input.files).slice(0, Math.max(0, max));
    }
  }

  subirImagenes(): void {
    if (!this.idProducto || this.archivosSeleccionados.length === 0) return;
    this.subiendoImagenes = true;
    this.productosImagenService.subir(this.idProducto, this.archivosSeleccionados).subscribe({
      next: () => {
        this.subiendoImagenes = false;
        this.archivosSeleccionados = [];
        this.cargarImagenes();
        iziToast.success({ title: 'Imágenes subidas', position: 'topRight' });
      },
      error: () => {
        this.subiendoImagenes = false;
        iziToast.error({ title: 'Error', message: 'No se pudieron subir las imágenes', position: 'topRight' });
      }
    });
  }

  eliminarImagen(idImagen: string): void {
    this.productosImagenService.eliminar(idImagen).subscribe({
      next: () => {
        this.imagenesProducto = this.imagenesProducto.filter((i) => i.idImagen !== idImagen);
        iziToast.success({ title: 'Imagen eliminada', position: 'topRight' });
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'No se pudo eliminar', position: 'topRight' });
      }
    });
  }

  marcarComoPortada(idImagen: string): void {
    if (!this.idProducto) return;
    const primero = this.imagenesOrdenadas[0];
    if (primero && primero.idImagen === idImagen) return;

    this.marcandoPortadaId = idImagen;
    this.productosImagenService.marcarPortada(this.idProducto, idImagen).subscribe({
      next: () => {
        this.marcandoPortadaId = null;
        this.cargarImagenes();
        iziToast.success({ title: 'Portada actualizada', position: 'topRight' });
      },
      error: () => {
        this.marcandoPortadaId = null;
        iziToast.error({ title: 'Error', message: 'No se pudo actualizar la portada', position: 'topRight' });
      }
    });
  }

  cerrar(): void {
    this.activeModal.close(true);
  }
}
