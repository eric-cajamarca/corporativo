import { Component, signal } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { Router, RouterModule } from '@angular/router';
import { ComprasService } from '../../../services/compras.service';
import { SucursalService } from '../../../services/sucursal.service';
import { CategoriaService } from '../../../services/categoria.service';
import { ProductoService } from '../../../services/producto.service';
import { PresentacionService } from '../../../services/presentacion.service';
import { variosService } from '../../../services/varios.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { PdfService } from '../../../services/pdf.service';
import { numeroALetras } from '../../../utils/numeroALetras';
import { ExcelService } from '../../../services/excel.service';
import { EmpresaService } from '../../../services/empresa.service';
import { Empresa } from '../../../models/empresa.model';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { InventarioModalService } from '../../../services/inventario-modal.service';







declare var iziToast: any;
declare var bootstrap: any;

// export interface Empresa {
//   logo: string;
//   nombre: string;
//   ruc: string;
//   direccion: string;
//   telefono: string;
// }

export interface Cliente {
  razonSocial: string;
  ruc: string;
  direccion: string;
  telefono?: string;
  email?: string;
}

export interface Item {
  cant: number;
  desc: string;
  pUnit: number;
  importe: number;
}

export interface Totales {
  gravado: number;
  inafecto: number;
  exonerado: number;
  exportacion: number;
  descuentos: number;
  gratuitos: number;
  igv: number;
  isc: number;
  icbper: number;
  total: number;
}

export interface DatosPdf {
  comprobante: string;
  emp: Empresa;
  cli: Cliente;
  items: Item[];
  cantidadLetras: string;
  totales: Totales;
  resumenDigital: string;
  observaciones: string[];
}

// export interface HeaderPdf {
//   logo: string;
//   titulo: string;
//   colIzq?: string;   // HTML libre
//   colCen?: string;   // normalmente vacío o "<span class='pageNumber'></span> / <span class='totalPages'></span>"
//   colDer?: string;   // HTML libre
// }

@Component({
  selector: 'app-index-compras',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule, TopnavComponent, NgbPagination, SidebarComponent],
  templateUrl: './index-compras.component.html',
  styleUrl: './index-compras.component.css'
})
export class IndexComprasComponent {

  empresa!: Empresa;

  public clientes: Array<any> = [];
  public clientes_const: Array<any> = [];
  public token: any = "";

  // Configuración de paginación
  public page = 1;
  public pageSize = 10;
  public maxSize = 10;
  public rotate = true;
  public boundaryLinks = true;


  public compras: Array<any> = [];
  public compras_const: Array<any> = [];

  filtroFecha = 'all';
  fechaDesde = '';
  fechaHasta = '';
  filtroNumero = '';
  filtroRuc = '';
  filtroProveedor = '';
  filtroTipoComprobante = '';
  public load_compras = true;
  public detCompras: Array<any> = [];
  public marcas: any = [];

  public load_estado = false;
  public categoria: any = [];
  public presentacion: any = [];
  public sucursales: any = [];
  public productos: any = {};
  public productos_const: any = {};
  public detalleCompras: any = [];
  public detalleCompras_const: any = [];
  public loadDetalleCompras = false;
  

  
  constructor(
    private _adminService: AdminService,
    private _router: Router,
    private _comprasService: ComprasService,
    private _sucursalService: SucursalService,
    private _productoService: ProductoService,
    private _categoriaService: CategoriaService,
    private _presentacionService: PresentacionService,
    private _marcaService: variosService,
    private pdfService: PdfService,
    private excelService: ExcelService,
    private empresaService: EmpresaService,
    private inventarioModal: InventarioModalService,
    public sidebarState: SidebarStateService
  ) { }

  ngOnInit(): void {

    this.empresaService.getEmpresa$().subscribe(emp => {
      this.empresa = emp;
      
      console.log('Empresa en IndexComprasComponent:', this.empresa);
    });
        

    this._categoriaService.obtener_categorias().subscribe(
      response => {
        this.categoria = response.data;
        console.log('this.categoria', this.categoria);
      },
      error => {
        console.log(error);
      }
    );

    this._presentacionService.obtener_presentaciones().subscribe(
      response => {
        this.presentacion = response.data;
        console.log('this.presentacion', this.presentacion);
      },
      error => {
        console.log(error);
      }
    );

    this._sucursalService.obtener_sucursal_idempresa().subscribe(
      response => {
        this.sucursales = response.data;
        console.log('this.sucursales', this.sucursales);
      },
      error => {
        console.log(error);
      }
    );

    this._marcaService.obtenerMarcas().subscribe(
      response => {
        this.marcas = response.data;
        this.marcas.sort((a: { nombre: string; }, b: { nombre: any; }) => a.nombre.localeCompare(b.nombre));
        console.log('this.marcas', this.marcas);
      },
      error => {
        console.log(error);
      }
    );

    this._productoService.obtenerProductosTodos().subscribe(
      (response: any) => {
        if (response.data != undefined) {

          this.productos = response.data;

          // this.productos = response.data;
          // console.log('this.productos como objeto',this.productos);

        }
        this.productos_const = this.productos;
      },
      (error: any) => {
        console.error('Error al cargar productos:', error);
      }
    );

    this.initData();

  }


  /** Carga solo las compras de la empresa del usuario logueado (GET /api/compras-por-empresa). */
  initData() {
    this._comprasService.obtener_compras_todos_idEmpresa().subscribe({
      next: (response) => {
        if (response.data == undefined) {
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: 'Usted no tiene acceso a compras'
          });
          this._router.navigate(['/']);
        } else {
          this.compras = response.data;
          this.compras_const = response.data;
          console.log('this.compras', this.compras);
        }
      },
      error: (err) => {
        console.error('initData compras:', err);
      }
    });
  }

  aplicarFiltros(): void {
    this.page = 1;
    let list = [...this.compras_const];

    if (this.filtroFecha === 'today') {
      const hoy = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })();
      list = list.filter((c: any) => (c.fEmision || '').toString().slice(0, 10) === hoy);
    } else if (this.filtroFecha === 'month') {
      const now = new Date();
      const mes = String(now.getMonth() + 1).padStart(2, '0');
      const anio = now.getFullYear();
      list = list.filter((c: any) => {
        const f = (c.fEmision || '').toString().slice(0, 10);
        return f.startsWith(`${anio}-${mes}`);
      });
    } else if (this.filtroFecha === 'range' && (this.fechaDesde || this.fechaHasta)) {
      if (this.fechaDesde) list = list.filter((c: any) => (c.fEmision || '').toString().slice(0, 10) >= this.fechaDesde);
      if (this.fechaHasta) list = list.filter((c: any) => (c.fEmision || '').toString().slice(0, 10) <= this.fechaHasta);
    }

    const num = (this.filtroNumero || '').trim();
    if (num) list = list.filter((c: any) => (c.compCompra || '').toLowerCase().includes(num.toLowerCase()));

    const ruc = (this.filtroRuc || '').toLowerCase().trim();
    if (ruc) list = list.filter((c: any) => (c.ruc || '').toLowerCase().includes(ruc));

    const proveedor = (this.filtroProveedor || '').toLowerCase().trim();
    if (proveedor) list = list.filter((c: any) => (c.rSocial || '').toLowerCase().includes(proveedor));

    const tipo = (this.filtroTipoComprobante || '').trim();
    if (tipo) list = list.filter((c: any) => (c.compCompra || '').toLowerCase().includes(tipo.toLowerCase()) || (c.serie || '').toLowerCase().includes(tipo.toLowerCase()));

    this.compras = list;
  }

  limpiarFiltros(): void {
    this.page = 1;
    this.filtroFecha = 'all';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.filtroNumero = '';
    this.filtroRuc = '';
    this.filtroProveedor = '';
    this.filtroTipoComprobante = '';
    this.compras = [...this.compras_const];
  }

  consultaCompCompra(id: any) {
    if (id == null || id === '') {
      console.error('consultaCompCompra: idCompra no disponible');
      return;
    }
    this.loadDetalleCompras = true;

    setTimeout(() => {
      this.loadDetalleCompras = false;
    }, 3000);

    this._comprasService.obtener_detalle_compras_idcompra(id).subscribe(
      response => {
        console.log('response.data');
        console.log(response.data);
        if (response.data != undefined) {

          response.data.forEach((element: any) => {
            const selectedObject = this.productos.find((item: any) => item.idProducto == element.idProducto);
            element.producto = selectedObject;

            const selectedObjectSucursal = this.sucursales.find((item: any) => item.idSucursal == element.idSucursal);
            element.sucursal = selectedObjectSucursal;

            if (element.producto) {
              const p = element.producto;
              // El API de productos devuelve categoria y marca como nombres (string), no como IDs
              const selectedObjectCategoria = this.categoria.find((c: any) =>
                (c.nombre || '').trim() === (p.categoria || '').trim()
              ) ?? this.categoria.find((c: any) => c.idCategoria == p.idCategoria);
              element.categoria = selectedObjectCategoria;

              const selectedObjectMarca = this.marcas.find((m: any) =>
                (m.nombre || '').trim() === (p.marca || '').trim()
              ) ?? this.marcas.find((m: any) => m.idMarca == p.idMarca);
              element.marca = selectedObjectMarca;

              // Presentación: el API devuelve descripcionPres y codigoPresentacion
              const selectedObjectPresentacion = this.presentacion.find((pr: any) =>
                (pr.Descripcion || pr.descripcion || '').trim() === (p.descripcionPres || '').trim() ||
                (pr.codigo || '').trim() === (p.codigoPresentacion || '').trim()
              ) ?? this.presentacion.find((pr: any) => pr.idPresentacion == p.idPresentacion);
              element.presentacion = selectedObjectPresentacion;
            } else {
              element.categoria = undefined;
              element.presentacion = undefined;
              element.marca = undefined;
            }
          });
          this.detalleCompras = response.data;
          this.detalleCompras_const = this.detalleCompras;

          this.detalleCompras.forEach((element: any) => {
            element.cUnitario = element.pUnitario;
            element.subtotal = element.total;
            if (element.producto) {
              element.idPresentacion = element.producto.idPresentacion;
              element.idCategoria = element.producto.idCategoria;
              element.descripcion = element.producto.descripcion;
              element.codigo = element.producto.Codigo ?? element.producto.codigo;
              element.fProduccion = element.producto.fProduccion;
              element.fVencimiento = element.producto.fVencimiento;
            }
            if (element.sucursal) {
              element.idSucursal = element.sucursal.idSucursal;
            }
          });




          this.loadDetalleCompras = false;
          console.log('this.detalleCompras', this.detalleCompras);
        }
      },
      error => {
        console.log(error);
      }
    );



  }

  
  set_eliminar(id: any) {
    console.log('aqui set_eliminar', id);
    this._comprasService.eliminar_idcompra_empresa(id).subscribe(
      response => {
        console.log('response.data');
        console.log(response.data);
        if (response.data == undefined) {
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: 'Usted no tiene acceso a compras'
          });

        } else {
          this.initData();
          iziToast.show({
            title: 'OK',
            titleColor: '#008000',
            color: '#FFF',
            class: 'text-success',
            position: 'topRight',
            message: 'Se elimino correctamente'
          });

          // Cierra el modal correctamente
          const modalElement = document.getElementById('delete-' + id);
          if (modalElement) {
            const modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modalInstance.hide();
          }

        }


      },
      error => {
        console.log(error);
      }
    );




  }

  onPageChange(newPage: number) {
    this.page = newPage;
    // Puedes agregar lógica adicional aquí si necesitas
    // cargar más datos cuando cambia la página
  }

  /** Genera el PDF de la compra: primero consulta el detalle del comprobante y luego genera el PDF. */
  descargarPDF(item: any): void {
    const idCompra = item.idCompra || item.idcompra;
    if (!idCompra) {
      iziToast?.warning?.({ title: 'Aviso', message: 'No hay comprobante asociado', position: 'topRight' });
      return;
    }
    this._comprasService.obtener_detalle_compras_idcompra(idCompra).subscribe({
      next: (response) => {
        const raw = response?.data ?? [];
        const detalle = Array.isArray(raw) ? raw : [];
        const cantidadALetras = numeroALetras(item.total ?? 0);
        const columnas = ['Cant.', 'Descripción', 'P. Unit.', 'Importe'];
        const filas = detalle.map((d: any) => {
          const cant = Number(d.cantidad) || 0;
          const pUnit = Number(d.pUnitario) || 0;
          const importe = Number(d.total) ?? cant * pUnit;
          const desc = d.descripcion ?? this.productos?.find((p: any) => p.idProducto === d.idProducto)?.descripcion ?? 'Producto';
          return [cant, desc, pUnit.toFixed(2), importe.toFixed(2)];
        });
        const datos = {
          empresa: this.empresa,
          titulo: 'Comprobante de Compra',
          proveedor: {
            razonSocial: item.rSocial ?? item.razonSocial ?? '—',
            ruc: item.ruc ?? item.rucProveedor ?? '—',
            direccion: item.direccion ?? '—',
            telefono: item.telefono ?? '—'
          },
          comprobante: {
            numero: item.compCompra ?? (item.serie != null && item.numero != null ? item.serie + '-' + item.numero : '—'),
            serie: item.serie ?? '—',
            numeroDoc: item.numero ?? '—',
            fEmision: item.fEmision ?? '—',
            fVencimiento: item.fVencimiento ?? '—',
            tipo: item.nombreComprobante ?? item.tipoComprobante ?? 'Comprobante de compra'
          },
          totales: {
            subTotal: item.subTotal ?? 0,
            igv: item.igv ?? 0,
            total: item.total ?? 0
          },
          columnas,
          filas,
          cantidadLetras: cantidadALetras,
          resumenDigital: 'Representación impresa del comprobante de compra.'
        };
        this.pdfService.generarPdfDinamico(datos, 'factura', 9).subscribe({
          next: blob => this.pdfService.previsualizar(blob),
          error: err => {
            console.error('Error al generar el PDF', err);
            iziToast?.error?.({ title: 'Error', message: 'Error al generar el PDF', position: 'topRight' });
          }
        });
      },
      error: (err) => {
        console.error('Error al obtener detalle de compra', err);
        iziToast?.error?.({ title: 'Error', message: 'No se pudo cargar el detalle del comprobante', position: 'topRight' });
      }
    });
  }






  // ===== EXPORTAR PDF DINÁMICO =====
  exportarPDF(): void {
    const datos = {
      empresa: this.empresa,
      titulo: 'Lista de Compras',
      columnas: ['#', 'N° Factura', 'RUC Proveedor', 'Proveedor', 'F. Emisión', 'Total', 'Estado'],
      filas: this.compras.map((c, i) => [
        i + 1,
        c.compCompra,
        c.ruc ?? '—',
        c.rSocial,
        c.fEmision,
        `S/ ${Number(c.total).toFixed(2)}`,
        c.descripcion
      ])
    };

    this.pdfService.generarPdfDinamico(datos, 'lista-compras', 9).subscribe({
      next: blob => this.pdfService.previsualizar(blob),
      error: err => console.error('Error PDF', err)
    });
  }

  // ===== EXPORTAR EXCEL DINÁMICO =====
  exportarExcel(): void {
    const datosExcel = {
      title: 'Lista de Compras',
      filename: `compras_${new Date().getTime()}`,
      worksheetName: 'Compras',
      columns: ['#', 'N° Factura', 'RUC Proveedor', 'Proveedor', 'F. Emisión', 'Total', 'Estado'],
      rows: this.compras.map((c, i) => [
        i + 1,
        c.compCompra,
        c.ruc ?? '—',
        c.rSocial,
        c.fEmision,
        Number(c.total),
        c.descripcion
      ])
    };

    this.excelService.generarExcel(datosExcel).subscribe({
      next: blob => this.excelService.descargar(blob, `${datosExcel.filename}.xlsx`),
      error: err => console.error('Error Excel', err)
    });
  }

  // ===== MÉTODO GENÉRICO PARA CUALQUIER TABLA =====
  exportarDataExcel(
    titulo: string,
    columnas: string[],
    data: any[],
    mapper: (item: any, index: number) => any[]
  ): void {
    const datosExcel = {
      title: titulo,
      filename: `${titulo.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
      worksheetName: titulo,
      columns: columnas,
      rows: data.map(mapper)
    };

    this.excelService.generarExcel(datosExcel).subscribe({
      next: blob => this.excelService.descargar(blob, `${datosExcel.filename}.xlsx`),
      error: err => console.error('Error Excel', err)
    });
  }

  /**
   * Abre modal para gestionar lotes e inventario de una compra
   */
  gestionarInventarioCompra(compra: any): void {
    this.inventarioModal.abrirLoteList({ 
      idSucursal: compra.idSucursal,
      idCompra: compra.idCompra || compra.idcompra 
    }).then(() => {
      // Recargar datos si es necesario
    }).catch(() => {});
  }

  /**
   * Abre modal para asignar ubicaciones desde una compra
   */
  asignarUbicacionesCompra(compra: any): void {
    // Primero cargar los lotes de esta compra
    this.inventarioModal.abrirLoteList({ 
      idSucursal: compra.idSucursal 
    }).then(() => {
      // El usuario puede seleccionar lotes desde el modal
    }).catch(() => {});
  }

}

