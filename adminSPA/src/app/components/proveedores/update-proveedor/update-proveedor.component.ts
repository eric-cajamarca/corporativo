import { Component } from '@angular/core';
import { ProveedoresService } from '../../../services/proveedores.service';
import { AdminService } from '../../../services/admin.service';
import { ApiperuService } from '../../../services/apiperu.service';
import { DocumentoService } from '../../../services/documento.service';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FactilizaService } from '../../../services/factiliza.service';

declare var iziToast: any;

@Component({
  selector: 'app-update-proveedor',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './update-proveedor.component.html',
  styleUrl: './update-proveedor.component.css'
})
export class UpdateProveedorComponent {
  public filtro: any = "";
  public proveedores: any = {
    correo: '',
    celular: '',
    condicion: 'ACTIVO',
  };
  public proveedorruc: any = [];
  // public direccionClientes:any=[];
  public documento: any = [];
  public regiones: any = [];
  public provincias: any = [];
  public distritos: any = [];
  public fullProvincias: any[] = [];
  public fullDistritos: any[] = [];
  public token: any = "";
  public contBuscar = 0;
  public btn_registrar = false;
  public mostrarDireccion = false;

  public str_pais = '';
  public direccionProveedores: any = {};
  public direccionProveedores_const: any = [];
  public data: any = {};
  public mostrarFormNuevaDireccion = false;
  public guardandoDireccion = false;
  public nuevaDireccion: any = {
    ubigeo: '', codPais: 'PEN', region: '', provincia: '', distrito: '', urbanizacion: '',
    direccion: '', referencia: '', codLocal: '', principal: false
  };
  public listEstablecimientos: any[] = [];
  public showModalEstablecimientos = false;
  public loadingEstablecimientos = false;
  public selectedEstablecimientoIndices: Set<number> = new Set();
  /** Id del proveedor en edición (igual a params['id']). */
  public idProveedor: string | number | null = null;

  constructor(
    private _adminService: AdminService,
    private _documentosService: DocumentoService,
    private _apiperuService: ApiperuService,
    private _proveedorService: ProveedoresService,
    private _router: Router,
    private _route: ActivatedRoute,
    private factilizaSvc: FactilizaService

  ) {
    //this.token = this._cookieService.get('token');



    this._adminService.get_Regiones().subscribe(
      response => {
        this.regiones = response;
              }
    );

    this._adminService.get_Procincias().subscribe(
      response => {
        this.provincias = response;
        this.fullProvincias = response || [];
      }
    );

    this._adminService.get_Distritos().subscribe(
      response => {
        this.distritos = response;
        this.fullDistritos = response || [];
      }
    );

    this._documentosService.obtener_documento().subscribe(
      response => {
        this.documento = response.data;
              }
    );


  }

  ngOnInit() {
    this._route.params.subscribe(
      params => {
        this.idProveedor = params['id'];
        this.proveedores.idCliente = params['id'];

        this._proveedorService.obtener_proveedor_id(this.proveedores.idCliente).subscribe(
          response => {
                        if (response.data != undefined) {


              // Modificar el campo 'password' dentro del array 'data'
              response.data.forEach((item: any) => {
                this.proveedores.idCliente = item.idCliente;
                this.proveedores.ruc = item.ruc;
                this.proveedores.idDocumento = item.idDocumento;
                this.proveedores.rSocial = item.rSocial;
                this.proveedores.correo = item.correo;
                this.proveedores.celular = item.celular;
                this.proveedores.condicion = item.condicion;
                // this.proveedores.fregistro = item.fregistro;
              });
                          }
          }
        );

        this._proveedorService.obtener_direccionesProveedor_idProveedor(this.proveedores.idCliente).subscribe(
          response => {
            const data = response?.data;
            this.direccionProveedores_const = Array.isArray(data) ? data : [];
            const allProv = this.fullProvincias.length ? this.fullProvincias : this.provincias;
            const allDist = this.fullDistritos.length ? this.fullDistritos : this.distritos;
            this.direccionProveedores_const.forEach((d: any) => {
              const reg = this.regiones.find((r: any) => Number(r.id) === Number(d.region));
              const prov = allProv.find((p: any) => Number(p.id) === Number(d.provincia));
              const dist = allDist.find((x: any) => Number(x.id) === Number(d.distrito));
              d.nregion = reg?.name ?? '';
              d.nprovincia = prov?.name ?? '';
              d.ndistrito = dist?.name ?? '';
            });
          }
        )
      }

    );



    // this.select_pais();
  }

  // Endpoint legacy: https://dniruc.apisperu.com/api/v1/dni/<DNI>?token=<TOKEN_FROM_BACKEND>
  // El token vive en el backend (env APISPERU_TOKEN); el frontend nunca debe llevarlo.

  buscar() {
    this.contBuscar = 1;
        this.filtro = this.proveedores.ruc;

    try {

      if (this.proveedores.ruc.length === 11 && this.proveedores.idDocumento === '6') {
        this._apiperuService.getRucInfo(this.filtro).subscribe({
          next: (response) => {
            const data = response?.data ?? response;
            if (response?.error) {
              iziToast.show({ title: 'ERROR', titleColor: '#FF0000', color: '#FFF', class: 'text-danger', position: 'topRight', message: response.error });
              return;
            }
            this.proveedorruc = data;
            this.proveedores.rSocial = data.razonSocial ?? '';
            this.proveedores.condicion = data.estado ?? 'ACTIVO';
            this.direccionProveedores.codpais = 'PEN';
            this.direccionProveedores.ubigeo = data.ubigeo ?? '';
            this.direccionProveedores.direccion = data.direccion ?? '';
            this.direccionProveedores.region = data.departamento ?? '';
            this.direccionProveedores.provincia = data.provincia ?? '';
            this.direccionProveedores.distrito = data.distrito ?? '';
          },
          error: () => {
            iziToast.show({ title: 'ERROR', titleColor: '#FF0000', color: '#FFF', class: 'text-danger', position: 'topRight', message: 'Error al realizar la consulta por falta de datos' });
          }
        });
      }





      if (this.proveedores.ruc.length === 8 && this.proveedores.idDocumento === '1') {
        this._apiperuService.getDniInfo(this.filtro).subscribe({
          next: (response) => {
            const data = response?.data ?? response;
            if (response?.error) {
              iziToast.show({ title: 'ERROR', titleColor: '#FF0000', color: '#FFF', class: 'text-danger', position: 'topRight', message: response.error });
              return;
            }
            this.proveedorruc = data;
            const ap = (data.apellidoPaterno ?? '').trim();
            const am = (data.apellidoMaterno ?? '').trim();
            const nom = (data.nombres ?? '').trim();
            const partes = [ap, am, nom].filter(Boolean);
            this.proveedores.rSocial = partes.length ? partes.join(' ').replace(/\s+/g, ' ') : ((data.nombreCompleto ?? '').trim() || '');
          },
          error: () => {
            iziToast.show({ title: 'ERROR', titleColor: '#FF0000', color: '#FFF', class: 'text-danger', position: 'topRight', message: 'Error al realizar la consulta por falta de datos' });
          }
        });

      }
    } catch (error) {
      iziToast.show({
        title: 'ERROR',
        titleColor: '#FF0000',
        color: '#FFF',
        class: 'text-danger',
        position: 'topRight',
        message: 'Ingrese un número de DNI o Ruc'
      });
    }





  }


  select_pais() {


    let pais = 'Perú';
    // this.direccionClientes.pais = pais;


    if (this.direccionProveedores.codpais == 'PEN') {
      setTimeout(() => {
        //$('#sl-region').prop('disabled', false);
      }, 50);
      this._adminService.get_Regiones().subscribe(
        response => {
                    response.forEach((element: any) => {
            this.regiones.push({
              id: element.id,
              name: element.name
            });
          });

        }
      );
    } else {
      setTimeout(() => {
        // $('#sl-region').prop('disabled', true);
        // $('#sl-provincia').prop('disabled', true);
        // $('#sl-distrito').prop('disabled', true);
      }, 50);
      this.regiones = [];
      this.provincias = [];
      this.distritos = [];

      this.direccionProveedores.region = '';
      this.direccionProveedores.provincia = '';
      this.direccionProveedores.distrito = '';

    }
  }


  select_region() {

    this.provincias = [];
    setTimeout(() => {
      // $('#sl-provincia').prop('disabled', false);
      // $('#sl-distrito').prop('disabled', true);
    }, 50);
    this.direccionProveedores.provincia = '';
    this.direccionProveedores.distrito = '';
    this._adminService.get_Procincias().subscribe(
      response => {
        response.forEach((element: any) => {
          if (element.department_id == this.direccionProveedores.region) {
            this.provincias.push(
              element
            );
          }
        });
        

      }
    );
  }

  select_provincia() {
    this.distritos = [];
    setTimeout(() => {
     // $('#sl-distrito').prop('disabled', false);
    }, 50);

    this.direccionProveedores.distrito = '';

    this._adminService.get_Distritos().subscribe(
      response => {
        response.forEach((element: any) => {
          if (element.province_id == this.direccionProveedores.provincia) {
            this.distritos.push(element);
            // this.direccion.zip = this.distritos.forEach(element.id);
          }
        });
        


      }
    );
  }

  select_distrito(event: any) {
    const selectedId = event.target.value;
    this.direccionProveedores.ubigeo = selectedId;
      }


  private findLocationId(items: any[], name: string, _type: string): string | undefined {
    if (!items?.length || !name) return undefined;
    const normalize = (t: string) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const n = normalize(name);
    let found = items.find((i: any) => normalize(i.name) === n);
    if (!found) found = items.find((i: any) => normalize(i.name).includes(n));
    if (!found) found = items.find((i: any) => n.includes(normalize(i.name)));
    return found ? found.id : undefined;
  }

  /** Recarga la lista de direcciones del proveedor. */
  cargarDireccionesProveedor(): void {
    if (!this.idProveedor) return;
    this._proveedorService.obtener_direccionesProveedor_idProveedor(this.idProveedor).subscribe({
      next: (response) => {
        const data = response?.data;
        this.direccionProveedores_const = Array.isArray(data) ? data : [];
        const allProv = this.fullProvincias.length ? this.fullProvincias : this.provincias;
        const allDist = this.fullDistritos.length ? this.fullDistritos : this.distritos;
        this.direccionProveedores_const.forEach((d: any) => {
          const reg = this.regiones.find((r: any) => Number(r.id) === Number(d.region));
          const prov = allProv.find((p: any) => Number(p.id) === Number(d.provincia));
          const dist = allDist.find((x: any) => Number(x.id) === Number(d.distrito));
          d.nregion = reg?.name ?? '';
          d.nprovincia = prov?.name ?? '';
          d.ndistrito = dist?.name ?? '';
        });
      },
      error: () => { this.direccionProveedores_const = []; }
    });
  }

  editarDireccionProveedor(id: string | number): void {
    const item = this.direccionProveedores_const.find((d: any) => Number(d.idDireccionProveedor) === Number(id));
    if (item) {
      this.direccionProveedores = { ...item };
      this.select_region();
      this.select_provincia();
    }
  }

  actualizarDireccionProveedor(): void {
    if (!this.direccionProveedores?.idDireccionProveedor) return;
    const payload = {
      idProveedor: this.direccionProveedores.idProveedor,
      ubigeo: this.direccionProveedores.ubigeo ?? '',
      codPais: this.direccionProveedores.codPais ?? 'PEN',
      region: this.direccionProveedores.region ?? '',
      provincia: this.direccionProveedores.provincia ?? '',
      distrito: this.direccionProveedores.distrito ?? '',
      urbanizacion: this.direccionProveedores.urbanizacion ?? '',
      direccion: this.direccionProveedores.direccion ?? '',
      referencia: this.direccionProveedores.referencia ?? '',
      codLocal: this.direccionProveedores.codLocal ?? '',
      principal: this.direccionProveedores.principal === true || this.direccionProveedores.principal === 1
    };
    this._proveedorService.editar_direccionProveedor(this.direccionProveedores.idDireccionProveedor, payload).subscribe({
      next: () => {
        this.cargarDireccionesProveedor();
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'OK', message: 'Dirección actualizada.', position: 'topRight' });
        }
      },
      error: () => {
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudo actualizar la dirección.', position: 'topRight' });
        }
      }
    });
  }

  eliminarDireccionProveedor(id: string | number): void {
    if (typeof window !== 'undefined' && !window.confirm('¿Eliminar esta dirección?')) return;
    this._proveedorService.eliminar_direccionProveedor(id).subscribe({
      next: () => {
        this.cargarDireccionesProveedor();
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'OK', message: 'Dirección eliminada.', position: 'topRight' });
        }
      },
      error: () => {
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudo eliminar la dirección.', position: 'topRight' });
        }
      }
    });
  }

  /** Al hacer clic en Crear dirección: si es RUC y hay establecimientos, modal; si no, form. */
  onCrearDireccion(): void {
    const ruc = (this.proveedores.ruc || '').trim();
    if (ruc.length === 11 && this.proveedores.idDocumento === '6') {
      this.loadingEstablecimientos = true;
      this._apiperuService.getRucAnexo(ruc).subscribe({
        next: (res) => {
          this.loadingEstablecimientos = false;
          if (res && res.error) {
            this.mostrarFormNuevaDireccion = true;
            return;
          }
          const data = Array.isArray(res?.data) ? res.data : [];
          if (data.length > 0) {
            this.listEstablecimientos = data;
            this.selectedEstablecimientoIndices = new Set();
            this.showModalEstablecimientos = true;
          } else {
            this.mostrarFormNuevaDireccion = true;
          }
        },
        error: () => {
          this.loadingEstablecimientos = false;
          this.mostrarFormNuevaDireccion = true;
        }
      });
    } else {
      this.mostrarFormNuevaDireccion = true;
    }
  }

  closeModalEstablecimientos(): void {
    this.showModalEstablecimientos = false;
    this.listEstablecimientos = [];
    this.selectedEstablecimientoIndices = new Set();
  }

  toggleEstablecimiento(i: number): void {
    if (this.selectedEstablecimientoIndices.has(i)) {
      this.selectedEstablecimientoIndices.delete(i);
    } else {
      this.selectedEstablecimientoIndices.add(i);
    }
    this.selectedEstablecimientoIndices = new Set(this.selectedEstablecimientoIndices);
  }

  toggleAllEstablecimientos(checked: boolean): void {
    if (checked) {
      this.listEstablecimientos.forEach((_, i) => this.selectedEstablecimientoIndices.add(i));
    } else {
      this.selectedEstablecimientoIndices.clear();
    }
    this.selectedEstablecimientoIndices = new Set(this.selectedEstablecimientoIndices);
  }

  applyEstablecimientosEditar(): void {
    const selected = Array.from(this.selectedEstablecimientoIndices)
      .sort((a, b) => a - b)
      .map(i => this.listEstablecimientos[i]);
    if (selected.length === 0) {
      if (typeof iziToast !== 'undefined') {
        iziToast.show({ title: 'ERROR', titleColor: '#FF0000', color: '#FFF', position: 'topRight', message: 'Seleccione al menos un establecimiento' });
      }
      return;
    }
    const idProveedor = this.idProveedor ?? this.proveedores.idCliente;
    if (idProveedor == null) return;
    let idx = 0;
    const crearSiguiente = () => {
      if (idx >= selected.length) {
        this.closeModalEstablecimientos();
        this.cargarDireccionesProveedor();
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'OK', message: 'Direcciones agregadas.', position: 'topRight' });
        }
        return;
      }
      const e = selected[idx++];
      const dep = (e.departamento ?? '').trim();
      const prov = (e.provincia ?? '').trim();
      const dist = (e.distrito ?? '').trim();
      const payload = {
        idProveedor,
        ubigeo: e.ubigeo ?? '',
        codpais: 'PEN',
        region: dep ? (this.findLocationId(this.regiones, dep, 'd') ?? '') : '',
        provincia: prov ? (this.findLocationId(this.fullProvincias.length ? this.fullProvincias : this.provincias, prov, 'p') ?? '') : '',
        distrito: dist ? (this.findLocationId(this.fullDistritos.length ? this.fullDistritos : this.distritos, dist, 'd') ?? '') : '',
        urbanizacion: '',
        direccion: e.direccion ?? e.direccionCompleta ?? '',
        referencia: e.tipoEstablecimiento ?? '',
        codLocal: e.codigo ?? '0',
        principal: false
      };
      this._proveedorService.crear_direccionProveedor(payload).subscribe({
        next: () => crearSiguiente(),
        error: () => crearSiguiente()
      });
    };
    crearSiguiente();
  }

  guardarNuevaDireccionProveedor(): void {
    const dir = (this.nuevaDireccion.direccion || '').toString().trim();
    if (!dir) return;
    const idProveedor = this.idProveedor ?? this.proveedores.idCliente;
    if (idProveedor == null) return;
    const payload = {
      idProveedor,
      ubigeo: (this.nuevaDireccion.ubigeo ?? '').toString().trim(),
      codpais: (this.nuevaDireccion.codPais ?? 'PEN').toString(),
      region: (this.nuevaDireccion.region ?? '').toString().trim(),
      provincia: (this.nuevaDireccion.provincia ?? '').toString().trim(),
      distrito: (this.nuevaDireccion.distrito ?? '').toString().trim(),
      urbanizacion: (this.nuevaDireccion.urbanizacion ?? '').toString().trim(),
      direccion: dir,
      referencia: (this.nuevaDireccion.referencia ?? '').toString().trim(),
      codLocal: (this.nuevaDireccion.codLocal ?? '').toString().trim(),
      principal: false
    };
    this.guardandoDireccion = true;
    this._proveedorService.crear_direccionProveedor(payload).subscribe({
      next: () => {
        this.guardandoDireccion = false;
        this.mostrarFormNuevaDireccion = false;
        this.nuevaDireccion = { ubigeo: '', codPais: 'PEN', region: '', provincia: '', distrito: '', urbanizacion: '', direccion: '', referencia: '', codLocal: '', principal: false };
        this.cargarDireccionesProveedor();
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'OK', message: 'Dirección registrada.', position: 'topRight' });
        }
      },
      error: () => {
        this.guardandoDireccion = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudo registrar la dirección.', position: 'topRight' });
        }
      }
    });
  }


  registrar(registroForm: any) {

        
    // if (registroForm.valid) {
    this.btn_registrar = true;
    this.data = this.proveedores;
        //convertir array this.clientes a un objeto para pasarlo a mi servicio
    //  this.data.forEach((element: { id: string | number; name: any; }) => {
    //   this.data[element.id] = element.id;
    //  });

    //  console.log('this.data como objeto', this.data);
    this._proveedorService.crear_proveedor(this.data).subscribe(
      response => {
        if (response.data != undefined) {
          this._proveedorService.obtener_proveedor_id(this.proveedores.ruc).subscribe(
            response => {
                            this.direccionProveedores.idCliente = response.data[0].idCliente;
                            if (response.data != undefined) {
                // this._clientesService.crear_direccionCliente(this.token, this.direccionClientes).subscribe(
                //   response => {
                //     if (response.data != undefined) {
                //       iziToast.show({
                //         title: 'SUCCESS',
                //         titleColor: '#006064',
                //         color: '#FFF',
                //         class: 'text-success',
                //         position: 'topRight',
                //         message: 'Cliente creado correctamente'
                //       });
                //       this.btn_registrar = false;
                //       //quiero redirigir a la pagina de index-clientes
                //       this._router.navigate(['/cliente']);
                //     }

                //   },
                //   error => {
                //     console.log(<any>error);
                //     console.error('Error al crear el cliente:', error);
                //     this.btn_registrar = false;
                //   }
                // )
              }

            }
          )
        } else {
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: response.message,
          });
          this.btn_registrar = false;
        }
                this.btn_registrar = false;
      },
      error => {
                console.error('Error al crear el cliente:', error);
        this.btn_registrar = false;
      }

    )

  }

  onCheckboxChange() {
    if (this.mostrarDireccion) {
      this.mostrarDireccion = true;
      
      // Realiza acciones cuando el checkbox está marcado
    } else {
      // this.mostrarDireccion = false;
      
      // Realiza acciones cuando el checkbox está desmarcado
    }

  }

  /**
   * Consulta anexo SUNAT vía Factiliza para el RUC del proveedor en edición.
   * (El RUC fijo anterior era solo prueba; el dato viene de `proveedores` tras cargar el proveedor.)
   */
  consultar(): void {
    const ruc = (this.proveedores?.ruc ?? '').toString().trim();
    if (!ruc || ruc.length !== 11) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({
          title: 'Aviso',
          message: 'El proveedor debe tener un RUC de 11 dígitos para consultar el anexo.',
          position: 'topRight'
        });
      }
      return;
    }
    this.factilizaSvc.getAnexoByRUC(ruc).subscribe({
      next: () => {
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'OK', message: 'Consulta de anexo completada.', position: 'topRight' });
        }
      },
      error: () => {
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudo consultar el anexo.', position: 'topRight' });
        }
      }
    });
  }
}
