import { CotizacionParaVentaResponse } from '../services/cotizaciones.service';

declare const iziToast: { warning: (o: object) => void; success: (o: object) => void };

export interface LineaCarritoDesdeCotizacion {
  idProducto: string;
  idEmpresa?: string;
  codigo: string;
  descripcion: string;
  descripcionOriginal: string;
  permiteDescripcionEnVenta: boolean;
  codigoPresentacion: string;
  cantidad: number;
  pVenta: number;
  idSucursal?: string;
  sucursal?: string;
  aliasEmpresa?: string;
  marca?: string;
  nombreMarca?: string;
}

export interface CotizacionCarritoMapeado {
  carrito: LineaCarritoDesdeCotizacion[];
  idSucursal?: string;
  cliente: { idCliente?: number | string; rSocial?: string; ruc?: string };
}

export function validarCotizacionParaCarrito(data: CotizacionParaVentaResponse | null | undefined): boolean {
  if (!data?.cabecera || !data?.detalles?.length) {
    if (typeof iziToast !== 'undefined') {
      iziToast.warning({ title: 'Aviso', message: 'Cotización sin detalle válido.', position: 'topRight' });
    }
    return false;
  }
  const conProducto = data.detalles.filter((d) => d.idProducto != null);
  if (conProducto.length === 0) {
    if (typeof iziToast !== 'undefined') {
      iziToast.warning({
        title: 'Aviso',
        message: 'No se encontraron productos por código en esta cotización.',
        position: 'topRight'
      });
    }
    return false;
  }
  return true;
}

export function mapearCotizacionACarrito(data: CotizacionParaVentaResponse): CotizacionCarritoMapeado {
  const lineas = data.detalles.filter((d) => d.idProducto != null) as Array<{
    idProducto: string;
    idEmpresaProducto?: string | null;
    aliasEmpresa?: string;
    codigo: string;
    descripcion: string;
    codigoPresentacion: string;
    cantidad: number;
    pVenta: number;
    idSucursal?: string;
    nombreSucursal?: string;
    marca?: string;
  }>;

  const carrito: LineaCarritoDesdeCotizacion[] = lineas.map((d) => {
    const marca = (d.marca ?? '').toString().trim();
    return {
      idProducto: d.idProducto,
      idEmpresa: d.idEmpresaProducto != null ? String(d.idEmpresaProducto) : undefined,
      codigo: d.codigo,
      descripcion: d.descripcion,
      descripcionOriginal: (d.descripcion ?? '').toString().trim(),
      permiteDescripcionEnVenta: false,
      codigoPresentacion: d.codigoPresentacion ?? '',
      cantidad: Number(d.cantidad) || 0,
      pVenta: Number(d.pVenta) || 0,
      idSucursal: d.idSucursal,
      sucursal: (d.nombreSucursal ?? '').trim() || undefined,
      aliasEmpresa: (d.aliasEmpresa ?? '').trim() || undefined,
      marca: marca || undefined,
      nombreMarca: marca || undefined
    };
  });

  const cab = data.cabecera;
  const cliente: CotizacionCarritoMapeado['cliente'] = {};
  if (cab.idCliente != null) {
    cliente.idCliente = cab.idCliente;
    cliente.rSocial = cab.clienteRazonSocial ?? '';
    cliente.ruc = cab.clienteRuc ?? '';
  }

  return {
    carrito,
    idSucursal: lineas[0]?.idSucursal,
    cliente
  };
}

export function cerrarModalCotizacionSiCorresponde(cerrarModal: boolean): void {
  if (!cerrarModal || typeof document === 'undefined') return;
  const modalEl = document.getElementById('modalCotizacion');
  if (!modalEl) return;
  const bootstrapRef = (window as { bootstrap?: { Modal?: { getInstance: (el: Element) => { hide: () => void } | null } } }).bootstrap;
  bootstrapRef?.Modal?.getInstance(modalEl)?.hide();
}

const MAX_DESCRIPCION_LINEA = 500;

/** Snapshot de lo mostrado en el carrito; se persiste en DetalleVenta.descripcionLinea. */
export function snapshotDescripcionLineaVenta(item: {
  descripcion?: string;
  producto?: { descripcion?: string };
}): string | undefined {
  const cur = String(item.descripcion ?? item.producto?.descripcion ?? '').trim();
  if (!cur) return undefined;
  return cur.length > MAX_DESCRIPCION_LINEA ? cur.slice(0, MAX_DESCRIPCION_LINEA) : cur;
}

export function notificarCotizacionCargada(cerrarModal: boolean): void {
  if (!cerrarModal || typeof iziToast === 'undefined') return;
  iziToast.success({ title: 'Éxito', message: 'Cotización cargada en la venta.' });
}
