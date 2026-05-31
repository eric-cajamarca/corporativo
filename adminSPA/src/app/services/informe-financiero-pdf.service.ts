import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AnalisisService } from './analisis.service';
import { PdfDatosDinamicos } from './pdf.service';

export interface FiltrosInformeFinanciero {
  periodo?: string;
  fechaDesde: string;
  fechaHasta: string;
}

export interface RangoInformeFinanciero {
  fechaInicio: string;
  fechaFin: string;
  periodoLabel: string;
}

export interface PackInformeFinanciero {
  dashboard: unknown;
  balanceList: unknown[];
  flujoCaja: unknown;
  estadoResultadosList: unknown[];
  ratios: unknown;
  diagnostico: unknown;
  gastos: unknown[];
  flujoSerie: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class InformeFinancieroPdfService {
  constructor(private analisisService: AnalisisService) {}

  /** Etiqueta y rango para el PDF según fechas del filtro. */
  resolverRango(filtros: FiltrosInformeFinanciero): RangoInformeFinanciero {
    return {
      fechaInicio: filtros.fechaDesde,
      fechaFin: filtros.fechaHasta,
      periodoLabel: `${filtros.fechaDesde} — ${filtros.fechaHasta}`
    };
  }

  /** Carga todos los bloques del informe (misma fuente que Análisis financiero). */
  cargarPackInforme(
    filtros: FiltrosInformeFinanciero,
    opciones?: { incluirFlujoSerie?: boolean }
  ): Observable<PackInformeFinanciero> {
    const filtrosApi = {
      periodo: filtros.periodo,
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta
    };
    const rango = this.resolverRango(filtros);
    const incluirSerie =
      opciones?.incluirFlujoSerie ??
      (filtros.periodo === 'ANO_ACTUAL' || this.rangoAbarcaVariosMeses(filtros.fechaDesde, filtros.fechaHasta));

    return forkJoin({
      dashboard: this.analisisService.obtenerDashboardEjecutivo(filtrosApi).pipe(
        map((r) => r.data),
        catchError(() => of(null))
      ),
      balanceList: this.analisisService.obtenerBalanceGeneral(filtrosApi).pipe(
        map((r) => (Array.isArray(r.data) ? r.data : r.data ? [r.data] : [])),
        catchError(() => of([]))
      ),
      flujoCaja: this.analisisService.obtenerFlujoCaja(filtrosApi).pipe(
        map((r) => r.data),
        catchError(() => of(null))
      ),
      estadoResultadosList: this.analisisService
        .obtenerEstadoResultados({
          fechaDesde: rango.fechaInicio,
          fechaHasta: rango.fechaFin,
          agruparPor: 'MES'
        })
        .pipe(
          map((r) => (Array.isArray(r.data) ? r.data : r.data ? [r.data] : [])),
          catchError(() => of([]))
        ),
      ratios: this.analisisService.obtenerRatiosFinancieros().pipe(
        map((r) => r.data),
        catchError(() => of(null))
      ),
      diagnostico: this.analisisService.obtenerDiagnosticoFinanciero().pipe(
        map((r) => r.data),
        catchError(() => of(null))
      ),
      gastos: this.analisisService.listarGastos(rango.fechaInicio, rango.fechaFin).pipe(
        map((r) => (Array.isArray(r.data) ? r.data : [])),
        catchError(() => of([]))
      ),
      flujoSerie: incluirSerie
        ? this.analisisService.obtenerFlujoCajaSerie(filtrosApi).pipe(
            map((r) => r.data),
            catchError(() => of(null))
          )
        : of(null)
    });
  }

  armarDatosPdf(
    pack: PackInformeFinanciero,
    empresa: PdfDatosDinamicos['empresa'] | null | undefined,
    periodoLabel: string
  ): PdfDatosDinamicos {
    return {
      empresa: empresa ?? {
        logo: '',
        nombre: '',
        ruc: '',
        direccion: '',
        telefono: ''
      },
      periodoLabel,
      ...pack
    };
  }

  private rangoAbarcaVariosMeses(desde: string, hasta: string): boolean {
    if (!desde || !hasta) return false;
    const [y1, m1] = desde.split('-').map(Number);
    const [y2, m2] = hasta.split('-').map(Number);
    return y1 !== y2 || m1 !== m2;
  }
}
