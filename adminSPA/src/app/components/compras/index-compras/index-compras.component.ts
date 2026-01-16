import { Component } from '@angular/core';
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






declare var iziToast: any;
declare var bootstrap: any;

export interface Empresa {
  logo: string;
  nombre: string;
  ruc: string;
  direccion: string;
  telefono: string;
}

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
  imports: [FormsModule, RouterModule, CommonModule, TopnavComponent, NgbPagination],
  templateUrl: './index-compras.component.html',
  styleUrl: './index-compras.component.css'
})
export class IndexComprasComponent {
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
  ) {
    //this.token = this._cookieService.get('token');
  }

  ngOnInit(): void {

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

    this._productoService.obtener_productos_todos().subscribe(
      response => {
        console.log('response productos', response.data);
        if (response.data != undefined) {

          this.productos = response.data;

          // this.productos = response.data;
          // console.log('this.productos como objeto',this.productos);

        }
        this.productos_const = this.productos;
        console.log('this.productos', this.productos);
      },
      error => {
        console.log(error);
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

  //aqui obtengo el detalle de compra por idCompra
  // this._comprasService.obtener_detalle_compras_idcompra(this.idCompra, this.token).subscribe(
  //   response => {
  //     console.log('response detalle compras', response);
  //     if (response.data != undefined) {

  //       response.data.forEach((element: any) => {
  //         //buscar en this.productos el codigo y traer todo el objeto del codigo
  //         const selectedObject = this.productos.find((item: any) => item.idProducto == element.idProducto);
  //         element.producto = selectedObject;

  //         //buscar en this.sucursales el idSucursal y traer todo el objeto del idSucursal
  //         const selectedObjectSucursal = this.sucursales.find((item: any) => item.idSucursal == element.idSucursal);
  //         element.sucursal = selectedObjectSucursal;

  //         //buscar en this.categoria el idCategoria y traer todo el objeto del idCategoria
  //         const selectedObjectCategoria = this.categoria.find((item: any) => item.idCategoria == element.producto.idCategoria);
  //         element.categoria = selectedObjectCategoria;

  //         //buscar en this.presentacion el idPresentacion y traer todo el objeto del idPresentacion

  //         const selectedObjectPresentacion = this.presentacion.find((item: any) => item.idPresentacion == element.producto.idPresentacion);
  //         element.presentacion = selectedObjectPresentacion;



  //       }
  //       );
  //       this.detalleCompras = response.data;
  //       this.detalleCompras_const = this.detalleCompras;


  //       //quiero recorrer detallecompras y modificar algunos campos
  //       this.detalleCompras.forEach((element: any) => {
  //         element.idPresentacion = element.producto.idPresentacion;
  //         element.idCategoria = element.producto.idCategoria;
  //         element.idSucursal = element.sucursal.idSucursal;
  //         element.cUnitario = element.pUnitario;
  //         element.subtotal = element.total;
  //         element.descripcion = element.producto.descripcion;
  //         element.codigo = element.producto.Codigo;
  //         element.fProduccion = element.producto.fProduccion;
  //         element.fVencimiento = element.producto.fVencimiento;
  //       });




  //       this.loadDetalleCompras = false;
  //       console.log('this.detalleCompras', this.detalleCompras);
  //     }
  //   },
  //   error => {
  //     console.log(error);
  //   }
  // );
  // });



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


  descargarPDF(item: any, detalleCompras: any[]): void {
    const cantidadALetras = numeroALetras(item.total);
    console.log('Cantidad en letras:', cantidadALetras);
    const empresa: Empresa = {
      nombre: 'Mi Empresa S.A.C.',
      ruc: '20123456789',
      direccion: 'Av. Principal 123, Lima',
      telefono: '(01) 456-7890',
      logo: 'http://localhost:3000/api/obtener_logo/logo-1746675338771-466791498.png'
    };

   

    

    const cliente: Cliente = {
      razonSocial: item.rSocial || 'N/A',
      ruc: item.ruc || 'N/A',
      direccion: item.direccion || 'N/A',
      telefono: item.telefono || '',
      email: item.email || ''
    };

    const datos: DatosPdf = {
      comprobante: item.compCompra,
      emp: empresa,
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


    
    // this.pdfService.generarFactura(datos, 9).subscribe({
    //   next: blob =>
    //     this.pdfService.descargar(blob, `factura-${item.compCompra}.pdf`),
    //   error: err => console.error('Error al generar PDF', err)
    // });

    this.pdfService.generarFactura(datos, 9).subscribe({
      next: blob => {
        // En lugar de descargar, abre vista previa
        this.pdfService.previsualizar(blob);
      },
      error: err => console.error('Error al generar PDF', err)
    });
  }


  generarListaCompras(): void {
    const empresa: Empresa = {
      nombre: 'Mi Empresa S.A.C.',
      ruc: '20123456789',
      direccion: 'Av. Principal 123, Lima http://localhost:3000/api/obtener_logo/logo-1746675338771-466791498.png',
      telefono: '(01) 456-7890',
      logo: 'http://localhost:3000/api/obtener_logo/logo-1746675338771-466791498.png'
    };

    

    // 1. Construir filas de la tabla (solo datos visibles)
    const filas = this.compras.map((c, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${c.compCompra}</td>
        <td>${c.rSocial}</td>
        <td>${c.fEmision}</td>
        <td style="text-align:right">S/ ${Number(c.total).toFixed(2)}</td>
        <td>${c.descripcion}</td>
      </tr>
    `).join('');

    // 2. HTML completo
    const html = `
    <html>
    <head>
      <meta charset="utf-8">
      <title>Lista de Compras</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; }
        .header { border-bottom: 5px solid #0056b3; padding-bottom: 5px; margin-bottom: 5px; }
        .logo { max-width: 100px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ccc; padding: 6px; }
        th { background-color: #f2f2f2; text-align: center; }
        .text-end { text-align: right; }
      </style>
    </head>
    <body>
      <div class="header">
        <table style="width: 100%; border: none;">
          <tr>
            <td style="border: none; width: 30%;"><img src="${empresa.logo}" alt="Logo" class="logo"></td>
            <td style="border: none; width: 70%; color:black; padding-left: 10px;">
              <h3>${empresa.nombre}</h3>
              <p>RUC: ${empresa.ruc}<br>${empresa.direccion}<br>Tel: ${empresa.telefono}</p>
            </td>
          </tr>
        </table>
      </div>

      <h2>Lista de Compras</h2>
      <p>Fecha de reporte: ${new Date().toLocaleDateString('es-PE')}</p>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>N° Factura</th>
            <th>Proveedor</th>
            <th>F. Emisión</th>
            <th>Total</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${filas}
        </tbody>
      </table>
    </body>
    </html>`;


    // const html = this.armarHtmlListaCompras(...); // tu HTML de tabla

    // this.pdfService.generarPdfConHeader(html, 9, header).subscribe({
    //   next: blob => this.pdfService.previsualizar(blob),
    //   error: err => console.error(err)
    // });

    // 3. Generar y previsualizar
    this.pdfService.generarPdf(html, 9).subscribe({
      next: blob => this.pdfService.previsualizar(blob),
      error: err => console.error('Error al generar reporte', err)
    });
  }


}

