import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormulaMatizado, FormulaMatizadoTinte, MatizadoTinteLinea } from '../../../models/formula-matizado.model';
import { FormulaMatizadoService } from '../../../services/formula-matizado.service';
import { ProductoService } from '../../../services/producto.service';
import { ProductoUnidadVentaService } from '../../../services/producto-unidad-venta.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';

declare const iziToast: {
  success: (opts: { title?: string; message: string; position?: string }) => void;
  error: (opts: { title?: string; message: string; position?: string }) => void;
  warning: (opts: { title?: string; message: string; position?: string }) => void;
};

type ProductoMini = { idProducto: string; codigo?: string; descripcion?: string };

@Component({
  selector: 'app-index-matizado',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './index-matizado.component.html',
  styleUrl: './index-matizado.component.css'
})
export class IndexMatizadoComponent implements OnInit, OnDestroy {
  readonly sidebarState = inject(SidebarStateService);

  filtro = '';
  cargandoLista = false;
  formulas: FormulaMatizado[] = [];

  editando = false;
  guardando = false;
  idFormula = '';
  nombreColor = '';
  marcaVehiculo = '';
  modeloVehiculo = '';
  placa = '';
  idProductoBase = '';
  productoBaseEtiqueta = '';
  busquedaBase = '';
  basesHalladas: ProductoMini[] = [];
  buscandoBase = false;

  busquedaTinte = '';
  tintesHallados: ProductoMini[] = [];
  buscandoTintes = false;
  tintes: MatizadoTinteLinea[] = [];

  private readonly tinte$ = new Subject<string>();
  private readonly base$ = new Subject<string>();
  private readonly filtro$ = new Subject<string>();
  private subs = new Subscription();

  constructor(
    private formulaApi: FormulaMatizadoService,
    private productoService: ProductoService,
    private unidadApi: ProductoUnidadVentaService
  ) {}

  ngOnInit(): void {
    this.subs.add(this.tinte$.pipe(debounceTime(280), distinctUntilChanged()).subscribe((q) => this.buscarTintes(q)));
    this.subs.add(this.base$.pipe(debounceTime(280), distinctUntilChanged()).subscribe((q) => this.buscarBases(q)));
    this.subs.add(this.filtro$.pipe(debounceTime(280), distinctUntilChanged()).subscribe(() => this.cargarLista()));
    this.cargarLista();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get totalGramos(): number {
    return this.tintes.reduce((acc, t) => acc + (Number(t.gramos) || 0), 0);
  }

  onFiltroChange(): void {
    this.filtro$.next(this.filtro.trim());
  }

  onTinteInput(): void {
    this.tinte$.next(this.busquedaTinte.trim());
  }

  onBaseInput(): void {
    this.base$.next(this.busquedaBase.trim());
  }

  cargarLista(): void {
    this.cargandoLista = true;
    this.formulaApi.listar({ q: this.filtro.trim() || undefined, limite: 80 }).subscribe({
      next: (lista) => {
        this.formulas = lista;
        this.cargandoLista = false;
      },
      error: (err) => {
        this.cargandoLista = false;
        this.toastError(err?.error?.message || 'No se pudieron cargar las fórmulas');
      }
    });
  }

  nuevaFormula(): void {
    this.editando = true;
    this.idFormula = '';
    this.nombreColor = '';
    this.marcaVehiculo = '';
    this.modeloVehiculo = '';
    this.placa = '';
    this.idProductoBase = '';
    this.productoBaseEtiqueta = '';
    this.busquedaBase = '';
    this.basesHalladas = [];
    this.busquedaTinte = '';
    this.tintesHallados = [];
    this.tintes = [];
  }

  cancelarFormulario(): void {
    this.editando = false;
  }

  editar(f: FormulaMatizado): void {
    this.formulaApi.obtener(f.idFormula).subscribe({
      next: (full) => {
        this.editando = true;
        this.idFormula = full.idFormula;
        this.nombreColor = full.nombre || '';
        this.marcaVehiculo = full.marcaVehiculo || '';
        this.modeloVehiculo = full.modeloVehiculo || '';
        this.placa = full.placa || '';
        this.idProductoBase = full.idProductoBase || '';
        this.productoBaseEtiqueta = full.productoBase || '';
        this.tintes = (full.tintes || []).map((t: FormulaMatizadoTinte) => ({
          idProductoTinte: t.idProductoTinte,
          codigo: t.codigo || undefined,
          descripcion: t.descripcion || undefined,
          gramos: Number(t.gramosPorGalon) || 0
        }));
      },
      error: (err) => this.toastError(err?.error?.message || 'No se pudo abrir la fórmula')
    });
  }

  elegirBase(p: ProductoMini): void {
    this.idProductoBase = p.idProducto;
    this.productoBaseEtiqueta = [p.codigo, p.descripcion].filter(Boolean).join(' — ');
    this.busquedaBase = '';
    this.basesHalladas = [];
  }

  quitarBase(): void {
    this.idProductoBase = '';
    this.productoBaseEtiqueta = '';
  }

  agregarTinte(p: ProductoMini): void {
    if (this.tintes.some((t) => String(t.idProductoTinte) === String(p.idProducto))) {
      this.toastWarn('Ese tinte ya está en la fórmula');
      return;
    }
    if (this.idProductoBase && String(p.idProducto) === String(this.idProductoBase)) {
      this.toastWarn('La pintura base no es un tinte');
      return;
    }
    this.unidadApi.obtener(p.idProducto).subscribe({
      next: (data) => {
        if (!data?.conversion?.activo || !data.conversion.factorCompraAInterna) {
          this.toastWarn(`Configure en "${p.descripcion || p.codigo}" 1 pote = N gramos`);
        }
        this.tintes.push({
          idProductoTinte: p.idProducto,
          codigo: p.codigo,
          descripcion: p.descripcion,
          gramos: 0
        });
        this.busquedaTinte = '';
        this.tintesHallados = [];
      },
      error: () => {
        this.tintes.push({
          idProductoTinte: p.idProducto,
          codigo: p.codigo,
          descripcion: p.descripcion,
          gramos: 0
        });
        this.busquedaTinte = '';
        this.tintesHallados = [];
      }
    });
  }

  quitarTinte(i: number): void {
    this.tintes.splice(i, 1);
  }

  guardar(): void {
    if (!this.nombreColor.trim()) {
      this.toastWarn('Indique el nombre del color');
      return;
    }
    const tintesOk = this.tintes.filter((t) => Number(t.gramos) > 0);
    if (!tintesOk.length) {
      this.toastWarn('Agregue al menos un tinte con gramos (receta por 1 galón)');
      return;
    }
    this.guardando = true;
    this.formulaApi
      .guardar({
        idFormula: this.idFormula || undefined,
        nombre: this.nombreColor.trim(),
        marcaVehiculo: this.marcaVehiculo,
        modeloVehiculo: this.modeloVehiculo,
        placa: this.placa,
        idProductoBase: this.idProductoBase || undefined,
        factorEscala: 1,
        tintes: tintesOk
      })
      .subscribe({
        next: (id) => {
          this.guardando = false;
          this.idFormula = id;
          iziToast.success({ title: 'Guardado', message: 'Fórmula lista para jalarla en la venta', position: 'topRight' });
          this.cargarLista();
          this.editando = false;
        },
        error: (err) => {
          this.guardando = false;
          this.toastError(err?.error?.message || 'No se pudo guardar la fórmula');
        }
      });
  }

  eliminar(f: FormulaMatizado): void {
    if (!confirm(`¿Eliminar la fórmula «${f.nombre}»? En la venta ya no se podrá jalar.`)) return;
    this.formulaApi.eliminar(f.idFormula).subscribe({
      next: () => {
        iziToast.success({ title: 'Eliminada', message: 'La fórmula ya no aparece en ventas', position: 'topRight' });
        if (this.idFormula === f.idFormula) this.cancelarFormulario();
        this.cargarLista();
      },
      error: (err) => this.toastError(err?.error?.message || 'No se pudo eliminar')
    });
  }

  private buscarTintes(q: string): void {
    if (q.length < 2) {
      this.tintesHallados = [];
      return;
    }
    this.buscandoTintes = true;
    this.productoService.buscarProductosVenta({ q, limit: 12 }).subscribe({
      next: (res) => {
        this.tintesHallados = this.mapProductos(res);
        this.buscandoTintes = false;
      },
      error: () => {
        this.buscandoTintes = false;
        this.tintesHallados = [];
      }
    });
  }

  private buscarBases(q: string): void {
    if (q.length < 2) {
      this.basesHalladas = [];
      return;
    }
    this.buscandoBase = true;
    this.productoService.buscarProductosVenta({ q, limit: 12 }).subscribe({
      next: (res) => {
        this.basesHalladas = this.mapProductos(res);
        this.buscandoBase = false;
      },
      error: () => {
        this.buscandoBase = false;
        this.basesHalladas = [];
      }
    });
  }

  private mapProductos(res: { data?: unknown }): ProductoMini[] {
    const rows = Array.isArray(res?.data) ? res.data : [];
    return rows.map((p: { idProducto: string; codigo?: string; Codigo?: string; descripcion?: string }) => ({
      idProducto: p.idProducto,
      codigo: p.codigo || p.Codigo,
      descripcion: p.descripcion
    }));
  }

  private toastError(message: string): void {
    iziToast.error({ title: 'Error', message, position: 'topRight' });
  }

  private toastWarn(message: string): void {
    iziToast.warning({ title: 'Matizador', message, position: 'topRight' });
  }
}
