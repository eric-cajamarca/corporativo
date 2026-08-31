import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProductoUnidadVentaService } from '../../../services/producto-unidad-venta.service';
import { ProductoService } from '../../../services/producto.service';
import { ProductoUnidadVentaItem } from '../../../models/producto-unidad-venta.model';
import { precioUnidadDesdePrincipal, redondearPrecio2 } from '../../../utils/unidad-venta.util';

declare var iziToast: any;

type FilaUnidad = {
  nombre: string;
  factorAInterna: number;
  precio: number | null;
  visibleEnPos: boolean;
  precioManual: boolean;
};

const UNIDADES_SUGERIDAS: Array<{ nombre: string; denom?: number; factorFijo?: number }> = [
  { nombre: 'Galón', denom: 1 },
  { nombre: 'Galón (lata cerrada)', denom: 1 },
  { nombre: '1/2 galón', denom: 2 },
  { nombre: '1/4 de galón', denom: 4 },
  { nombre: '1/8 de galón', denom: 8 },
  { nombre: '1/16 de galón', denom: 16 },
  { nombre: '1/32 de galón', denom: 32 },
  { nombre: '1 gramo', factorFijo: 1 }
];

@Component({
  selector: 'app-producto-unidades-medida-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './producto-unidades-medida-modal.component.html'
})
export class ProductoUnidadesMedidaModalComponent implements OnInit {
  @Input() idProducto = '';
  @Input() etiquetaProducto = '';
  @Input() nombrePresentacion = 'envase de compra';
  @Input() precioPrincipal = 0;

  readonly sugeridas = UNIDADES_SUGERIDAS;

  cargando = true;
  usaConversionProducto = false;
  guardandoUnidades = false;
  unidadInternaNombre = '1/32 de galón';
  factorCompraAInterna = 32;
  filasUnidad: FilaUnidad[] = [];
  sugeridaElegida = '';

  constructor(
    public activeModal: NgbActiveModal,
    private productoUnidadVentaService: ProductoUnidadVentaService,
    private productoService: ProductoService
  ) {}

  ngOnInit(): void {
    if (!this.idProducto) {
      this.cargando = false;
      this.filasUnidad = [this.filaEnvase()];
      return;
    }
    this.cargarUnidadesProducto();
  }

  private cargarUnidadesProducto(): void {
    this.productoUnidadVentaService.obtener(this.idProducto, true).subscribe({
      next: (data) => {
        const conv = data?.conversion;
        const unidades = data?.unidades || [];
        const deLista = Number(data?.precioPrincipal);
        if (Number.isFinite(deLista) && deLista > 0) {
          this.precioPrincipal = deLista;
        }
        this.usaConversionProducto = !!(conv?.activo && unidades.length);
        if (conv) {
          this.unidadInternaNombre = conv.unidadInternaNombre || this.unidadInternaNombre;
          this.factorCompraAInterna = Number(conv.factorCompraAInterna) || this.factorCompraAInterna;
        }
        if (unidades.length) {
          this.filasUnidad = unidades.map((u: ProductoUnidadVentaItem) => this.filaDesdeGuardada(u));
        } else {
          this.filasUnidad = [this.filaEnvase()];
        }
        this.cargando = false;
      },
      error: () => {
        this.filasUnidad = [this.filaEnvase()];
        this.cargando = false;
      }
    });
  }

  private etiquetaEnvase(): string {
    const p = String(this.nombrePresentacion || '').trim();
    if (!p || /^niu$/i.test(p)) return 'Envase de compra';
    return p;
  }

  private filaEnvase(): FilaUnidad {
    const f = Number(this.factorCompraAInterna) || 32;
    return {
      nombre: this.etiquetaEnvase(),
      factorAInterna: f,
      precio: this.precioDeFactor(f),
      visibleEnPos: true,
      precioManual: false
    };
  }

  private filaDesdeGuardada(u: ProductoUnidadVentaItem): FilaUnidad {
    const factor = Number(u.factorAInterna) || 1;
    const calc = this.precioDeFactor(factor);
    const guardado = u.precio != null ? Number(u.precio) : null;
    const manual = guardado != null && calc != null && Math.abs(guardado - calc) > 0.009;
    return {
      nombre: u.nombre,
      factorAInterna: factor,
      precio: manual ? guardado : calc,
      visibleEnPos: u.visibleEnPos !== false,
      precioManual: manual
    };
  }

  private precioDeFactor(factorAInterna: number): number | null {
    const p = precioUnidadDesdePrincipal(
      { factorAInterna, precio: null },
      this.precioPrincipal,
      this.factorCompraAInterna
    );
    return p > 0 ? p : null;
  }

  onToggleConversionProducto(): void {
    if (this.usaConversionProducto && this.filasUnidad.length === 0) {
      this.filasUnidad = [this.filaEnvase()];
    }
  }

  onFactorCompraChange(): void {
    for (const fila of this.filasUnidad) {
      if (!fila.precioManual) {
        fila.precio = this.precioDeFactor(fila.factorAInterna);
      }
    }
  }

  onFactorFilaChange(fila: FilaUnidad): void {
    if (!fila.precioManual) {
      fila.precio = this.precioDeFactor(fila.factorAInterna);
    }
  }

  onPrecioFilaChange(fila: FilaUnidad): void {
    fila.precioManual = true;
  }

  agregarSugerida(): void {
    const sug = UNIDADES_SUGERIDAS.find((s) => s.nombre === this.sugeridaElegida);
    this.sugeridaElegida = '';
    if (!sug) return;
    if (this.filasUnidad.some((f) => f.nombre.toLowerCase() === sug.nombre.toLowerCase())) {
      iziToast.info({ title: 'Unidad', message: `Ya está ${sug.nombre}.`, position: 'topRight' });
      return;
    }
    const f = Number(this.factorCompraAInterna) || 32;
    const factor = sug.factorFijo != null ? sug.factorFijo : f / (sug.denom || 1);
    this.filasUnidad.push({
      nombre: sug.nombre,
      factorAInterna: factor,
      precio: this.precioDeFactor(factor),
      visibleEnPos: true,
      precioManual: false
    });
    if (sug.factorFijo != null && /gramo/i.test(sug.nombre)) {
      if (/1\/32|gal[oó]n/i.test(this.unidadInternaNombre)) {
        this.unidadInternaNombre = 'gramo';
      }
      const maxF = Math.max(0, ...this.filasUnidad.map((f) => Number(f.factorAInterna) || 0));
      if (this.factorCompraAInterna <= 1 && maxF > 1) {
        this.factorCompraAInterna = maxF;
        this.onFactorCompraChange();
      }
    }
  }

  agregarFilaUnidad(): void {
    this.filasUnidad.push({
      nombre: '',
      factorAInterna: 1,
      precio: this.precioDeFactor(1),
      visibleEnPos: true,
      precioManual: false
    });
  }

  quitarFilaUnidad(i: number): void {
    if (this.filasUnidad.length <= 1) {
      iziToast.warning({
        title: 'Unidad',
        message: 'Deja al menos una unidad, o desactiva la conversión.',
        position: 'topRight'
      });
      return;
    }
    this.filasUnidad.splice(i, 1);
  }

  get factorEnvaseEfectivo(): number {
    const fC = Number(this.factorCompraAInterna);
    const maxF = Math.max(0, ...this.filasUnidad.map((f) => Number(f.factorAInterna) || 0));
    const hayGramo = this.filasUnidad.some((f) => /gramo/i.test(f.nombre || ''));
    if (hayGramo && Number.isFinite(fC) && fC <= 1 && maxF > 1) return maxF;
    return fC > 0 ? fC : maxF || 1;
  }

  get textoEjemploGramos(): string {
    const fila = this.filasUnidad.find((f) => /^1\s*gramos?$/i.test(String(f.nombre || '').trim()));
    if (!fila) return '';
    const fC = this.factorEnvaseEfectivo;
    const fV = Number(fila.factorAInterna) || 1;
    if (fC <= 0) return '';
    const baja = Math.round(((5 * fV) / fC) * 10000) / 10000;
    return `Ejemplo: vender 5 de «${fila.nombre}» resta ${baja} envases del kardex, no 5 envases. El kardex cuenta potes, no gramos.`;
  }

  get textoAyudaConversion(): string {
    const f = Number(this.factorCompraAInterna) || 0;
    if (f <= 0) return '';
    const p = redondearPrecio2(this.precioPrincipal);
    return `El precio de lista (S/ ${p.toFixed(2)}) es el del envase completo. “1 envase equivale a” es cuántos gramos (o unidades internas) tiene el pote. “Resta adentro” de 1 gramo debe ser 1: al vender 5 g baja 5 ÷ N envases, no 5 potes.`;
  }

  guardarUnidades(): void {
    if (!this.idProducto) return;
    const filas = this.filasUnidad.filter((u) => String(u.nombre || '').trim());
    if (this.usaConversionProducto && filas.length === 0) {
      iziToast.warning({ title: 'Validación', message: 'Indica al menos una unidad o desactiva la conversión.', position: 'topRight' });
      return;
    }
    this.guardandoUnidades = true;
    if (!this.usaConversionProducto) {
      this.productoUnidadVentaService.guardar(this.idProducto, { activo: false }).subscribe({
        next: () => this.onGuardadoOk('Conversión desactivada en este producto'),
        error: (error) => this.onGuardadoError(error)
      });
      return;
    }
    this.productoUnidadVentaService
      .guardar(this.idProducto, {
        activo: true,
        unidadInternaNombre: this.unidadInternaNombre,
        factorCompraAInterna: Number(this.factorCompraAInterna),
        unidades: filas.map((u, i) => ({
          nombre: u.nombre.trim(),
          factorAInterna: Number(u.factorAInterna),
          precio: u.precio,
          visibleEnPos: u.visibleEnPos,
          orden: i
        }))
      })
      .subscribe({
        next: () => this.onGuardadoOk('Unidades de venta guardadas'),
        error: (error) => this.onGuardadoError(error)
      });
  }

  cerrar(): void {
    this.activeModal.dismiss();
  }

  private onGuardadoOk(message: string): void {
    this.guardandoUnidades = false;
    this.productoService.limpiarCacheListaProductos();
    this.productoUnidadVentaService.invalidar(this.idProducto);
    iziToast.success({ title: 'Guardado', message, position: 'topRight' });
    this.activeModal.close(true);
  }

  private onGuardadoError(error: { error?: { message?: string } }): void {
    this.guardandoUnidades = false;
    iziToast.error({
      title: 'Error',
      message: error?.error?.message || 'No se pudo guardar la conversión',
      position: 'topRight'
    });
  }
}
