import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CompraProveedorItem {
  proveedor: string;
  numeroCompras: number;
  totalCompras: number;
  totalItems: number;
}

export interface InventarioResumenItem {
  idProducto: string;
  codigo: string;
  nombreProducto: string;
  categoria: string;
  stockTotal: number;
  valorInventario: number;
}

export interface ClienteRentabilidadItem {
  idCliente: number;
  cliente: string;
  comprasTotales: number;
  numeroVentas: number;
  ticketPromedio: number;
  ultimaCompra: string | null;
  deudaPendiente: number;
}

export interface CarteraCreditosResumen {
  totalCreditos: number;
  montoTotalCreditos: number;
  creditosActivos: number;
  montoCreditosActivos: number;
  totalCuotas: number;
  cuotasPagadas: number;
  cuotasVencidas: number;
  cuotasPendientes: number;
  totalCobrado: number;
  saldoPendienteTotal: number;
  tasaInteresPromedio: number;
  totalMontoOtorgado: number;
  totalSaldoPendiente: number;
  totalPagado: number;
  tasaCobro: number;
  eficienciaCobro: number;
}

@Injectable({
  providedIn: 'root',
})
export class ReportesService {
  private readonly baseUrl = environment.API_URL + 'reportes/';

  constructor(private http: HttpClient) {}

  obtenerComprasPorProveedor(
    fechaInicio: string,
    fechaFin: string
  ): Observable<{ message: string; data: CompraProveedorItem[] }> {
    const params = new HttpParams()
      .set('fechaInicio', fechaInicio)
      .set('fechaFin', fechaFin);
    return this.http.get<{ message: string; data: CompraProveedorItem[] }>(
      this.baseUrl + 'compras-proveedor',
      {
        params,
        withCredentials: true,
      }
    );
  }

  obtenerInventarioResumen(): Observable<{ message: string; data: InventarioResumenItem[] }> {
    return this.http.get<{ message: string; data: InventarioResumenItem[] }>(
      this.baseUrl + 'inventario-resumen',
      {
        withCredentials: true,
      }
    );
  }

  obtenerClientesRentabilidad(
    fechaInicio: string,
    fechaFin: string
  ): Observable<{ message: string; data: ClienteRentabilidadItem[] }> {
    const params = new HttpParams()
      .set('fechaInicio', fechaInicio)
      .set('fechaFin', fechaFin);
    return this.http.get<{ message: string; data: ClienteRentabilidadItem[] }>(
      this.baseUrl + 'clientes-rentabilidad',
      {
        params,
        withCredentials: true,
      }
    );
  }

  obtenerCarteraCreditos(): Observable<{ message: string; data: CarteraCreditosResumen }> {
    return this.http.get<{ message: string; data: CarteraCreditosResumen }>(
      this.baseUrl + 'cartera-creditos',
      {
        withCredentials: true,
      }
    );
  }
}

