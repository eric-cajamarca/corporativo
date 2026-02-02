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

  /** Estado del sidebar (para layout con topnav) */
  sidebarCollapsed = signal<boolean>(false);

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


  public filtro = '';
  public compras: Array<any> = [];
  public compras_const: Array<any> = [];
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
  

  
  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
  }

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
    private empresaService: EmpresaService
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


  initData() {
    this._comprasService.obtener_compras_todos().subscribe(
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
          this._router.navigate(['/']);
        } else {
          this.compras = response.data;
          this.compras_const = response.data;
        }
      },
      error => {
        console.log(error);
      }
    );
  }

  filtrar() {
    
    if (this.filtro) {
      // this.load_compras = false;
      var term = new RegExp(this.filtro, 'i');
      this.compras = this.compras_const.filter(item => term.test(item.compCompra) || term.test(item.rSocial) || term.test(item.total) || term.test(item.fEmision) || term.test(item.descripcion));
      console.log('this.compras', this.compras);
      // this.load_compras = true;
    } else {
      this.compras = this.compras_const;
      // this.load_compras = true;
    }
  }

  consultaCompCompra(id: any,) {
    // this.load_estado = true;
    this.loadDetalleCompras = true;

    //codigo para retrazar la ejecucion de la funcion
    setTimeout(() => {
      this.loadDetalleCompras = false;
    }, 3000);

    console.log('aqui consultaCompCompra', id);
    this._comprasService.obtener_detalle_compras_idcompra(id).subscribe(
      response => {
        console.log('response.data');
        console.log(response.data);
        if (response.data != undefined) {

          response.data.forEach((element: any) => {
            //buscar en this.productos el codigo y traer todo el objeto del codigo
            const selectedObject = this.productos.find((item: any) => item.idProducto == element.idProducto);
            element.producto = selectedObject;

            //buscar en this.sucursales el idSucursal y traer todo el objeto del idSucursal
            const selectedObjectSucursal = this.sucursales.find((item: any) => item.idSucursal == element.idSucursal);
            element.sucursal = selectedObjectSucursal;

            //buscar en this.categoria el idCategoria y traer todo el objeto del idCategoria
            const selectedObjectCategoria = this.categoria.find((item: any) => item.idCategoria == element.producto.idCategoria);
            element.categoria = selectedObjectCategoria;

            //buscar en this.presentacion el idPresentacion y traer todo el objeto del idPresentacion

            const selectedObjectPresentacion = this.presentacion.find((item: any) => item.idPresentacion == element.producto.idPresentacion);
            element.presentacion = selectedObjectPresentacion;
            
            //buscar en this.marcas el idMarca y traer todo el objeto del idMarca
            const selectedObjectMarca = this.marcas.find((item: any) => item.idMarca == element.producto.idMarca);
            element.marca = selectedObjectMarca;

          }
          );
          this.detalleCompras = response.data;
          this.detalleCompras_const = this.detalleCompras;


          //quiero recorrer detallecompras y modificar algunos campos
          this.detalleCompras.forEach((element: any) => {
            element.idPresentacion = element.producto.idPresentacion;
            element.idCategoria = element.producto.idCategoria;
            element.idSucursal = element.sucursal.idSucursal;
            element.cUnitario = element.pUnitario;
            element.subtotal = element.total;
            element.descripcion = element.producto.descripcion;
            element.codigo = element.producto.Codigo;
            element.fProduccion = element.producto.fProduccion;
            element.fVencimiento = element.producto.fVencimiento;
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

  //detalle compras
  descargarPDF(item: any, detalleCompras: any[]): void {
    const cantidadALetras = numeroALetras(item.total);
    console.log('Cantidad en letras:', cantidadALetras);
    // const empresa: Empresa = {
    //   nombre: 'Mi Empresa S.A.C.',
    //   ruc: '20123456789',
    //   direccion: 'Av. Principal 123, Lima',
    //   telefono: '(01) 456-7890',
    //   logo: 'http://localhost:3000/api/obtener_logo/logo-1746675338771-466791498.png'
    // };
    //this.empresa.logo = 'http://localhost:3000/api/obtener_logo/' + this.empresa.logo
   
    console.log('Empresa para PDF:', this.empresa);
    

    const cliente: Cliente = {
      razonSocial: item.rSocial || 'N/A',
      ruc: item.ruc || 'N/A',
      direccion: item.direccion || 'N/A',
      telefono: item.telefono || '',
      email: item.email || ''
    };

    const datos: DatosPdf = {
      comprobante: item.compCompra,
      emp: this.empresa,
      cli: cliente,
      items: detalleCompras.map(d => ({
        cant: d.cantidad,
        desc: d.descripcion,
        pUnit: d.cUnitario,
        importe: d.cantidad * d.cUnitario
      })),
      cantidadLetras: cantidadALetras,
      totales: {
        gravado: item.subTotal || 0,
        inafecto: 0,
        exonerado: item.exonerado || 0,
        exportacion: 0,
        descuentos: item.descuentos || 0,
        gratuitos: item.gratuito || 0,
        igv: item.igv || 0,
        isc: 0,
        icbper: 0,
        total: item.total || 0
      },
      resumenDigital: 'KAUIjq+FfOy0r9cs+WhJRhmLWsc=',
      observaciones: [
        'SOMOS AGENTE DE RETENCION DE IGV R.S. 000229-2024 A PARTIR 01/01/2025',
        'Representación impresa de la Factura Electrónica, consulte en www.rscloud.com.pe',
        'Autorizado mediante ...'
      ]
    };


    
    this.pdfService.generarPdfDinamico(datos, 'factura', 9).subscribe({
      next: blob => this.pdfService.previsualizar(blob),
      error: err => console.error('Error PDF', err)
    });

  }






  // ===== EXPORTAR PDF DINÁMICO =====
  exportarPDF(): void {
    const datos = {
      empresa: this.empresa,
      titulo: 'Lista de Compras',
      columnas: ['#', 'N° Factura', 'Proveedor', 'F. Emisión', 'Total', 'Estado'],
      filas: this.compras.map((c, i) => [
        i + 1,
        c.compCompra,
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
      columns: ['#', 'N° Factura', 'Proveedor', 'F. Emisión', 'Total', 'Estado'],
      rows: this.compras.map((c, i) => [
        i + 1,
        c.compCompra,
        c.rSocial,
        c.fEmision,
        Number(c.total), // Número para formato correcto en Excel
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

}

