import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DashboardService, ResumenDashboard } from './dashboard.service';
import { ReportesService } from './reportes.service';
import { UtilidadesService } from './utilidades.service';
import { PdfDatosDinamicos } from './pdf.service';

const MAX_FILAS_INVENTARIO_PDF = 250;

export interface PackReportesNegocio {
  resumenDashboard: ResumenDashboard | null;
  ventas: { periodo: string; ventas: number }[];
  compras: {
    proveedor: string;
    numeroCompras: number;
    totalCompras: number;
    totalItems: number;
  }[];
  totalesCompras: number;
  inventario: {
    codigo: string;
    producto: string;
    categoria: string;
    stockTotal: number;
    valorInventario: number;
  }[];
  inventarioTruncado: boolean;
  inventarioTotalFilas: number;
  totalValorInventario: number;
  clientes: {
    cliente: string;
    comprasTotales: number;
    numeroVentas: number;
    ticketPromedio: number;
    ultimaCompra: string | null;
    deudaPendiente: number;
  }[];
  creditos: Record<string, unknown> | null;
  utilidades: {
    periodo: string;
    ingresos: number;
    costos: number;
    utilidadBruta: number;
  }[];
  productos: {
    nombre: string;
    categoria: string;
    ventas: number;
    monto: number;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class ReportesNegocioPdfService {
  constructor(
    private dashboardService: DashboardService,
    private reportesService: ReportesService,
    private utilidadesService: UtilidadesService
  ) {}

  cargarPack(
    periodoRapido: string,
    fechaInicio: string,
    fechaFin: string
  ): Observable<PackReportesNegocio> {
    const tipoUtil = this.mapPeriodoUtilidades(periodoRapido);

    return forkJoin({
      resumenDashboard: this.dashboardService.obtenerResumen(periodoRapido).pipe(
        map((r) => r.data),
        catchError(() => of(null))
      ),
      compras: this.reportesService.obtenerComprasPorProveedor(fechaInicio, fechaFin).pipe(
        map((r) => r.data || []),
        catchError(() => of([]))
      ),
      inventarioRaw: this.reportesService.obtenerInventarioResumen().pipe(
        map((r) => r.data || []),
        catchError(() => of([]))
      ),
      clientes: this.reportesService.obtenerClientesRentabilidad(fechaInicio, fechaFin).pipe(
        map((r) => r.data || []),
        catchError(() => of([]))
      ),
      creditos: this.reportesService.obtenerCarteraCreditos().pipe(
        map((r) => r.data || null),
        catchError(() => of(null))
      ),
      utilidades: this.utilidadesService.getUtilidades(tipoUtil, fechaInicio, fechaFin).pipe(
        map((r) =>
          (r.data || []).map((row) => ({
            periodo: row.periodo,
            ingresos: row.ingresos,
            costos: row.costos,
            utilidadBruta: row.utilidadBruta
          }))
        ),
        catchError(() => of([]))
      )
    }).pipe(
      map((pack) => {
        const ventas = this.extraerSerieVentas(pack.resumenDashboard, periodoRapido);
        const compras = pack.compras.map((row) => ({
          proveedor: row.proveedor,
          numeroCompras: row.numeroCompras,
          totalCompras: row.totalCompras,
          totalItems: row.totalItems
        }));
        const totalesCompras = compras.reduce((s, c) => s + Number(c.totalCompras || 0), 0);

        const inventarioTotalFilas = pack.inventarioRaw.length;
        const inventarioSlice = pack.inventarioRaw.slice(0, MAX_FILAS_INVENTARIO_PDF);
        const inventario = inventarioSlice.map((row) => ({
          codigo: row.codigo,
          producto: row.nombreProducto,
          categoria: row.categoria,
          stockTotal: row.stockTotal,
          valorInventario: row.valorInventario
        }));
        const totalValorInventario = pack.inventarioRaw.reduce(
          (s, r) => s + Number(r.valorInventario || 0),
          0
        );

        const clientes = pack.clientes.map((row) => ({
          cliente: row.cliente,
          comprasTotales: row.comprasTotales,
          numeroVentas: row.numeroVentas,
          ticketPromedio: row.ticketPromedio,
          ultimaCompra: row.ultimaCompra,
          deudaPendiente: row.deudaPendiente
        }));

        const productos = (pack.resumenDashboard?.productosMasVendidos || []).map((p) => ({
          nombre: p.nombre,
          categoria: p.categoria,
          ventas: p.ventas,
          monto: p.monto
        }));

        return {
          resumenDashboard: pack.resumenDashboard,
          ventas,
          compras,
          totalesCompras,
          inventario,
          inventarioTruncado: inventarioTotalFilas > MAX_FILAS_INVENTARIO_PDF,
          inventarioTotalFilas,
          totalValorInventario,
          clientes,
          creditos: pack.creditos as Record<string, unknown> | null,
          utilidades: pack.utilidades,
          productos
        };
      })
    );
  }

  armarDatosPdf(
    pack: PackReportesNegocio,
    empresa: PdfDatosDinamicos['empresa'] | null | undefined,
    periodoLabel: string,
    periodoRapido: string
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
      periodoRapido,
      ...pack
    };
  }

  private mapPeriodoUtilidades(periodo: string): 'dia' | 'mes' | 'anio' | 'rango' {
    switch (periodo) {
      case 'Hoy':
        return 'dia';
      case 'Este Año':
        return 'anio';
      case 'Esta Semana':
        return 'rango';
      case 'Este Mes':
      default:
        return 'mes';
    }
  }

  private extraerSerieVentas(
    resumen: ResumenDashboard | null,
    periodoRapido: string
  ): { periodo: string; ventas: number }[] {
    const gv = resumen?.graficoVentas;
    if (!gv) {
      const labels = resumen?.ventasMensualesLabels || [];
      const datos = resumen?.ventasMensuales || [];
      return labels.map((label, i) => ({ periodo: label, ventas: datos[i] ?? 0 }));
    }
    let vista = gv.mesPorDia;
    if (periodoRapido === 'Hoy' && gv.porDiaHora?.etiquetas?.length) {
      vista = gv.porDiaHora;
    } else if (periodoRapido === 'Este Año' && gv.doceMeses?.etiquetas?.length) {
      vista = gv.doceMeses;
    } else if (periodoRapido === 'Esta Semana' && gv.seisMeses?.etiquetas?.length) {
      vista = gv.seisMeses;
    }
    const etiquetas = vista?.etiquetas || [];
    const datos = vista?.datos || [];
    return etiquetas.map((label, index) => ({
      periodo: label,
      ventas: datos[index] ?? 0
    }));
  }
}
