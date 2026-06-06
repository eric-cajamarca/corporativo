import { Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { CotizacionListado, CotizacionParaVentaResponse, CotizacionesService } from './cotizaciones.service';

declare const iziToast: { error: (o: object) => void };

@Injectable({ providedIn: 'root' })
export class VentaCotizacionUiService {
  constructor(private cotizacionesService: CotizacionesService) {}

  listarParaModal(): Observable<CotizacionListado[]> {
    return this.cotizacionesService.listar().pipe(
      map((res) => res.data ?? []),
      catchError((err) => {
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudieron cargar las cotizaciones.' });
        }
        return throwError(() => err);
      })
    );
  }

  obtenerDetalleParaVenta(idCotizacion: number): Observable<CotizacionParaVentaResponse | null> {
    return this.cotizacionesService.obtenerParaVenta(idCotizacion).pipe(
      map((res) => res.data ?? null),
      catchError((err) => {
        if (typeof iziToast !== 'undefined') {
          iziToast.error({
            title: 'Error',
            message: err?.error?.error || err?.error?.message || 'Error al cargar la cotización.'
          });
        }
        return throwError(() => err);
      })
    );
  }
}
