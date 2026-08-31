import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormulaMatizado, MatizadoLineaPayload, MatizadoTinteLinea } from '../../../models/formula-matizado.model';
import { FormulaMatizadoService } from '../../../services/formula-matizado.service';

@Component({
  selector: 'app-matizado-pintura-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './matizado-pintura-modal.component.html',
  styleUrl: './matizado-pintura-modal.component.css'
})
export class MatizadoPinturaModalComponent implements OnInit, OnDestroy {
  @Input() descripcionBase = '';
  @Input() idProductoBase = '';
  @Input() factorEscala = 1;
  @Input() presentacionCompra = 'galón';
  @Input() cargoMatizado = 0;
  @Input() idSucursal = '';

  busquedaFormula = '';
  formulasHalladas: FormulaMatizado[] = [];
  buscandoFormulas = false;
  cargandoDetalle = false;

  idFormula = '';
  nombreColor = '';
  marcaVehiculo = '';
  modeloVehiculo = '';
  placa = '';
  tintes: MatizadoTinteLinea[] = [];
  aviso = '';

  private readonly formula$ = new Subject<string>();
  private subs = new Subscription();

  constructor(
    public activeModal: NgbActiveModal,
    private formulaApi: FormulaMatizadoService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.formula$.pipe(debounceTime(280), distinctUntilChanged()).subscribe((q) => this.buscarFormulas(q))
    );
    this.buscarFormulas('');
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get totalGramos(): number {
    return this.tintes.reduce((acc, t) => acc + (Number(t.gramos) || 0), 0);
  }

  onFormulaInput(): void {
    this.formula$.next(this.busquedaFormula.trim());
  }

  private buscarFormulas(q: string): void {
    this.buscandoFormulas = true;
    this.formulaApi.listar({ q: q || undefined }).subscribe({
      next: (lista) => {
        this.formulasHalladas = lista;
        this.buscandoFormulas = false;
      },
      error: () => {
        this.buscandoFormulas = false;
        this.formulasHalladas = [];
      }
    });
  }

  cargarFormula(f: FormulaMatizado): void {
    this.cargandoDetalle = true;
    this.aviso = '';
    this.formulaApi.obtener(f.idFormula).subscribe({
      next: (full) => {
        const escala = Number(this.factorEscala) || 1;
        this.idFormula = full.idFormula;
        this.nombreColor = full.nombre || '';
        this.marcaVehiculo = full.marcaVehiculo || '';
        this.modeloVehiculo = full.modeloVehiculo || '';
        this.placa = full.placa || '';
        this.tintes = (full.tintes || []).map((t) => ({
          idProductoTinte: t.idProductoTinte,
          codigo: t.codigo || undefined,
          descripcion: t.descripcion || undefined,
          gramos: Math.round(Number(t.gramosPorGalon) * escala * 1e6) / 1e6
        }));
        this.busquedaFormula = '';
        this.formulasHalladas = [];
        this.cargandoDetalle = false;
      },
      error: () => {
        this.cargandoDetalle = false;
        this.aviso = 'No se pudo cargar la fórmula';
      }
    });
  }

  confirmar(): void {
    if (!this.idFormula || !this.tintes.some((t) => Number(t.gramos) > 0)) {
      this.aviso = 'Elija una fórmula del matizador';
      return;
    }
    const result: MatizadoLineaPayload = {
      nombreColor: this.nombreColor.trim() || undefined,
      marcaVehiculo: this.marcaVehiculo.trim() || undefined,
      modeloVehiculo: this.modeloVehiculo.trim() || undefined,
      placa: this.placa.trim() || undefined,
      idFormula: this.idFormula,
      guardarFormula: false,
      cargoMatizado: Number(this.cargoMatizado) || 0,
      factorEscala: Number(this.factorEscala) || 1,
      tintes: this.tintes
        .filter((t) => Number(t.gramos) > 0)
        .map((t) => ({
          idProductoTinte: t.idProductoTinte,
          descripcion: t.descripcion,
          gramos: Number(t.gramos)
        }))
    };
    this.activeModal.close(result);
  }

  irAlMatizador(): void {
    this.activeModal.dismiss();
    void this.router.navigate(['/matizado']);
  }

  cancelar(): void {
    this.activeModal.dismiss();
  }
}
