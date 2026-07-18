import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CatalogoProductoSunatItem,
  Producto,
  ProductoCodigoSunatPendiente,
  ProductoCreate
} from '../../../models/producto.models';
import { ProductoService } from '../../../services/producto.service';

@Component({
  selector: 'app-codigos-sunat-productos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './codigos-sunat-productos.component.html',
  styleUrl: './codigos-sunat-productos.component.css'
})
export class CodigosSunatProductosComponent implements OnInit {
  private readonly productoService = inject(ProductoService);

  readonly cargando = signal(false);
  readonly guardandoId = signal<string | null>(null);
  readonly mensaje = signal('');
  readonly error = signal('');

  productos: ProductoCodigoSunatPendiente[] = [];
  filtro = 'pendientes';
  anexo = '';
  q = '';

  catalogoBusqueda: CatalogoProductoSunatItem[] = [];
  productoAsignando: ProductoCodigoSunatPendiente | null = null;
  qCatalogo = '';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.productoService
      .listarProductosCodigoSunatPendientes({
        filtro: this.filtro,
        anexo: this.anexo || undefined,
        q: this.q || undefined,
        limite: 200
      })
      .subscribe({
        next: (res) => {
          this.productos = Array.isArray(res?.data) ? res.data : [];
          this.cargando.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'No se pudo cargar la lista');
          this.cargando.set(false);
        }
      });
  }

  ejecutarSugerenciaBatch(): void {
    this.cargando.set(true);
    this.mensaje.set('');
    this.productoService.sugerirCodigoSunatBatch(200).subscribe({
      next: (res) => {
        const d = res?.data;
        this.mensaje.set(
          `Sugerencia masiva: ${d?.actualizados ?? 0} actualizados de ${d?.revisados ?? 0} revisados.`
        );
        this.cargar();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Error en sugerencia masiva');
        this.cargando.set(false);
      }
    });
  }

  abrirAsignar(p: ProductoCodigoSunatPendiente): void {
    this.productoAsignando = p;
    this.qCatalogo = p.descripcion || '';
    this.buscarCatalogo();
  }

  cerrarAsignar(): void {
    this.productoAsignando = null;
    this.catalogoBusqueda = [];
  }

  buscarCatalogo(): void {
    this.productoService
      .listarCatalogoProductoSunat({
        q: this.qCatalogo || undefined,
        anexo: this.anexo || undefined,
        limite: 40
      })
      .subscribe({
        next: (res) => {
          this.catalogoBusqueda = Array.isArray(res?.data) ? res.data : [];
        },
        error: () => {
          this.catalogoBusqueda = [];
        }
      });
  }

  asignarCodigo(p: ProductoCodigoSunatPendiente, item: CatalogoProductoSunatItem): void {
    this.guardarCampos(p, {
      codigoProductoSunat: item.codigo,
      requiereCodigoSunat: true,
      revisadoSunat: true,
      anexoSunatSugerido: item.anexo,
      codigoSunatSugerido: item.codigo
    });
  }

  aplicarSugerido(p: ProductoCodigoSunatPendiente): void {
    if (!p.codigoSunatSugerido) return;
    this.guardarCampos(p, {
      codigoProductoSunat: p.codigoSunatSugerido,
      requiereCodigoSunat: true,
      revisadoSunat: true,
      anexoSunatSugerido: p.anexoSunatSugerido || null,
      codigoSunatSugerido: p.codigoSunatSugerido
    });
  }

  marcarNoAplica(p: ProductoCodigoSunatPendiente): void {
    this.guardarCampos(p, {
      codigoProductoSunat: null,
      requiereCodigoSunat: false,
      revisadoSunat: true
    });
  }

  marcarSiAplica(p: ProductoCodigoSunatPendiente): void {
    this.guardarCampos(p, {
      requiereCodigoSunat: true,
      revisadoSunat: true
    });
  }

  private guardarCampos(
    p: ProductoCodigoSunatPendiente,
    campos: Partial<ProductoCreate>
  ): void {
    this.guardandoId.set(p.idProducto);
    this.error.set('');
    this.productoService.obtenerProductoPorId(p.idProducto).subscribe({
      next: (res) => {
        const data = res?.data;
        if (!data || Array.isArray(data)) {
          this.guardandoId.set(null);
          this.error.set('No se pudo cargar el producto');
          return;
        }
        const full = data as Producto;
        const payload: ProductoCreate = {
          Codigo: String(full.Codigo || full.codigo || p.codigo || ''),
          idCategoria: Number(full.idCategoria),
          idMarca: Number(full.idMarca),
          descripcion: String(full.descripcion || p.descripcion || ''),
          idPresentacion: Number(full.idPresentacion),
          cUnitario: Number(full.cUnitario || 0),
          fProduccion: full.fProduccion || undefined,
          fVencimiento: full.fVencimiento || undefined,
          alertaMinimo: Number(full.alertaMinimo ?? 0),
          alertaMaximo: Number(full.alertaMaximo ?? 0),
          estado: !!full.estado,
          tipoProducto: String(full.tipoProducto || 'S'),
          permiteDescripcionEnVenta: !!full.permiteDescripcionEnVenta,
          codigoProductoSunat:
            campos.codigoProductoSunat !== undefined
              ? campos.codigoProductoSunat
              : full.codigoProductoSunat || null,
          requiereCodigoSunat:
            campos.requiereCodigoSunat !== undefined
              ? campos.requiereCodigoSunat
              : full.requiereCodigoSunat ?? null,
          revisadoSunat:
            campos.revisadoSunat !== undefined ? campos.revisadoSunat : !!full.revisadoSunat,
          anexoSunatSugerido:
            campos.anexoSunatSugerido !== undefined
              ? campos.anexoSunatSugerido
              : full.anexoSunatSugerido || null,
          codigoSunatSugerido:
            campos.codigoSunatSugerido !== undefined
              ? campos.codigoSunatSugerido
              : full.codigoSunatSugerido || null
        };
        this.productoService.actualizarProducto(p.idProducto, payload).subscribe({
          next: () => {
            this.guardandoId.set(null);
            this.cerrarAsignar();
            this.mensaje.set(`Actualizado: ${p.descripcion}`);
            this.cargar();
          },
          error: (err) => {
            this.guardandoId.set(null);
            this.error.set(err?.error?.message || 'No se pudo guardar');
          }
        });
      },
      error: (err) => {
        this.guardandoId.set(null);
        this.error.set(err?.error?.message || 'No se pudo cargar el producto');
      }
    });
  }

  etiquetaAnexo(anexo?: string | null): string {
    if (anexo === '25.1') return 'Regulado';
    if (anexo === '25.2') return 'Detracción';
    if (anexo === '25.3') return 'Percepción';
    return anexo || '-';
  }
}
