import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatizadoLineaPayload } from '../models/formula-matizado.model';
import { ProductoUnidadVentaItem } from '../models/producto-unidad-venta.model';
import { cantidadEnUnidadCompra, tieneUnidadesVenta } from '../utils/unidad-venta.util';
import { descripcionConColorMatizado } from '../utils/matizado-venta.util';
import { ProductoUnidadVentaService } from './producto-unidad-venta.service';
import { SeleccionarUnidadVentaModalService } from './seleccionar-unidad-venta-modal.service';
import { MatizadoPinturaModalService } from './matizado-pintura-modal.service';

export interface ParcheLineaUnidadMatizado {
  _sinConversion?: boolean;
  idUnidadVenta?: string;
  nombreUnidadVenta?: string;
  factorAInterna?: number;
  factorCompraAInterna?: number;
  cantidadSeleccionada?: number;
  pVentaSeleccionada?: number;
  pVenta?: number;
  matizado?: MatizadoLineaPayload;
  descripcion?: string;
}

@Injectable({
  providedIn: 'root'
})
export class VentaUnidadMatizadoFlowService {
  constructor(
    private unidadApi: ProductoUnidadVentaService,
    private unidadModal: SeleccionarUnidadVentaModalService,
    private matizadoModal: MatizadoPinturaModalService
  ) {}

  async prepararLinea(params: {
    producto: {
      idProducto: string;
      descripcion?: string;
      codigo?: string;
      pVenta?: number;
      presentacion?: string;
      codigoPresentacion?: string;
      unidadInternaNombre?: string;
      factorCompraAInterna?: number;
      unidadesVenta?: ProductoUnidadVentaItem[];
    };
    stockCompra: number | null;
    usarConversionUnidades: boolean;
    usarMatizado: boolean;
    cargoMatizado: number;
    idSucursal?: string;
  }): Promise<ParcheLineaUnidadMatizado | null> {
    const prod = { ...params.producto };
    if (!tieneUnidadesVenta(prod)) {
      try {
        const data = await firstValueFrom(this.unidadApi.obtener(prod.idProducto));
        if (data?.conversion?.activo && (data.unidades || []).length) {
          prod.unidadInternaNombre = data.conversion.unidadInternaNombre;
          prod.factorCompraAInterna = data.conversion.factorCompraAInterna;
          prod.unidadesVenta = (data.unidades || []).filter((u) => u.visibleEnPos !== false);
        }
      } catch {
        /* sin tablas o sin unidades */
      }
    }

    if (!tieneUnidadesVenta(prod)) {
      return { _sinConversion: true };
    }

    if (!params.usarConversionUnidades && !params.usarMatizado) {
      return { _sinConversion: true };
    }

    const presentacion = String(prod.presentacion || prod.codigoPresentacion || 'envase');
    const sel = await this.unidadModal.abrir({
      descripcion: String(prod.descripcion || prod.codigo || ''),
      stockCompra: params.stockCompra,
      presentacionCompra: presentacion,
      factorCompraAInterna: Number(prod.factorCompraAInterna) || 1,
      unidadInternaNombre: String(prod.unidadInternaNombre || ''),
      unidades: prod.unidadesVenta || [],
      usarMatizado: params.usarMatizado,
      precioPrincipal: Number(prod.pVenta) || 0
    });
    if (!sel) return null;

    let matizado: MatizadoLineaPayload | undefined;
    if (params.usarMatizado && sel.matizadoPedido) {
      const factorEscala = cantidadEnUnidadCompra(
        { factorAInterna: sel.factorAInterna, factorCompraAInterna: sel.factorCompraAInterna },
        sel.cantidad
      );
      const mix = await this.matizadoModal.abrir({
        descripcionBase: String(prod.descripcion || prod.codigo || ''),
        idProductoBase: prod.idProducto,
        factorEscala: factorEscala || 1,
        presentacionCompra: presentacion,
        cargoMatizado: params.cargoMatizado,
        idSucursal: params.idSucursal
      });
      if (!mix) return null;
      matizado = mix;
    }

    const cargo = matizado ? Number(matizado.cargoMatizado) || 0 : 0;
    const pVenta = (Number(sel.pVenta) || Number(prod.pVenta) || 0) + cargo;
    const desc = descripcionConColorMatizado(String(prod.descripcion || ''), matizado?.nombreColor);

    return {
      idUnidadVenta: sel.idUnidadVenta,
      nombreUnidadVenta: sel.nombreUnidadVenta,
      factorAInterna: sel.factorAInterna,
      factorCompraAInterna: sel.factorCompraAInterna,
      cantidadSeleccionada: sel.cantidad,
      pVentaSeleccionada: pVenta,
      pVenta,
      matizado,
      descripcion: desc || prod.descripcion
    };
  }
}
