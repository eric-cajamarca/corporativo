import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { DocumentoService } from '../../../services/documento.service';
import { ApiperuService } from '../../../services/apiperu.service';
import { ClienteService } from '../../../services/cliente.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var iziToast: any;
declare var bootstrap: any;

@Component({
  selector: 'app-update-clientes',
  imports: [FormsModule,RouterModule,CommonModule,TopnavComponent],
  templateUrl: './update-clientes.component.html',
  styleUrl: './update-clientes.component.css'
})
export class UpdateClientesComponent {
  /** Si true, se usa dentro de un modal: no se muestra topnav y se puede cerrar con emit. */
  @Input() modoModal = false;
  /** Cuando se usa como modal, el id del cliente a editar (si no se usa la ruta). */
  @Input() idClienteModal: string | number | null = null;
  @Output() cerrar = new EventEmitter<void>();
  /** Emite tras guardar correctamente en modo modal (p. ej. para refrescar datos en “Nueva venta”). */
  @Output() clienteActualizado = new EventEmitter<void>();

  public filtro: any = "";
  public clientes: any = {
    correo: '',
    celular: '',
    condicion: 'ACTIVO',
    sujetoCredito: false,
    lineaCredito: 0,
  };
  public clienteruc: any = [];
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
  public direccionClientes: any = {};
  public direccionClientes_const: any[] = [];
  public data: any = {};
  public guardandoDireccion = false;
  public mostrarFormNuevaDireccion = false;
  public listEstablecimientos: any[] = [];
  public showModalEstablecimientos = false;
  public loadingEstablecimientos = false;
  public selectedEstablecimientoIndices: Set<number> = new Set();
  /** Modal editar dirección (controlado por variable para que funcione dentro de otro modal). */
  public showModalEditarDireccion = false;
  public nuevaDireccion: any = {
    ubigeo: '',
    codPais: 'PEN',
    region: '',
    provincia: '',
    distrito: '',
    urbanizacion: '',
    direccion: '',
    referencia: '',
    codLocal: '',
    principal: true
  };

  constructor(
    private _adminService: AdminService,
    private _documentosService: DocumentoService,
    private _apiperuService: ApiperuService,
    private _clientesService: ClienteService,
    private _router: Router,
    private _route: ActivatedRoute,


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

  /** Carga los datos del cliente por ID. Público para poder llamarlo desde el modal al abrir (ClienteEditarModalService). */
  cargarClientePorId(id: string | number): void {
    if (!id) return;
    this.clientes.idCliente = id;
    this._clientesService.obtener_cliente_id(id).subscribe({
      next: (response) => {
        if (response.data != undefined) {
          const data = Array.isArray(response.data) ? response.data : [response.data];
          data.forEach((item: any) => {
            this.clientes.idCliente = item.idCliente;
            this.clientes.ruc = item.ruc;
            this.clientes.idDocumento = item.idDocumento;
            this.clientes.rSocial = item.rSocial;
            this.clientes.correo = item.correo;
            this.clientes.celular = item.celular;
            this.clientes.condicion = item.condicion;
            this.clientes.sujetoCredito = item.sujetoCredito === true || item.sujetoCredito === 1;
            this.clientes.lineaCredito = item.lineaCredito != null && !isNaN(Number(item.lineaCredito)) ? Number(item.lineaCredito) : 0;
          });
          this.cargarDirecciones();
        }
      },
      error: () => {}
    });
  }

  ngOnInit() {
    if (this.modoModal && this.idClienteModal != null && this.idClienteModal !== '') {
      this.cargarClientePorId(this.idClienteModal);
      return;
    }

    this._route.params.subscribe(
      params => {
        const id = params['id'];
        if (id) this.cargarClientePorId(id);
      }
    );



    // this.select_pais();
  }

  //https://dniruc.apisperu.com/api/v1/dni/45633353?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImVyaWNvcnRpemd1ZXZhcmFAZ21haWwuY29tIn0.-cs9eKiQegcTM0bbaz7O-BT_sS7_BpV_6cndIqCeHfk

  buscar() {
    this.contBuscar = 1;
        this.filtro = this.clientes.ruc;

    try {

      if (this.clientes.ruc.length === 11 && this.clientes.idDocumento === '6') {
        this._apiperuService.getRucInfo(this.filtro).subscribe({
          next: (response) => {
            const data = response?.data ?? response;
            if (response?.error) {
              iziToast.show({ title: 'ERROR', titleColor: '#FF0000', color: '#FFF', class: 'text-danger', position: 'topRight', message: response.error });
              return;
            }
            this.clienteruc = data;
            this.clientes.rSocial = data.razonSocial ?? '';
            this.clientes.condicion = data.estado ?? 'ACTIVO';
            this.direccionClientes.codpais = 'PEN';
            this.direccionClientes.ubigeo = data.ubigeo ?? '';
            this.direccionClientes.direccion = data.direccion ?? '';
            this.direccionClientes.region = data.departamento ?? '';
            this.direccionClientes.provincia = data.provincia ?? '';
            this.direccionClientes.distrito = data.distrito ?? '';
          },
          error: () => {
            iziToast.show({ title: 'ERROR', titleColor: '#FF0000', color: '#FFF', class: 'text-danger', position: 'topRight', message: 'Error al realizar la consulta por falta de datos' });
          }
        });
      }





      if (this.clientes.ruc.length === 8 && this.clientes.idDocumento === '1') {
        this._apiperuService.getDniInfo(this.filtro).subscribe({
          next: (response) => {
            //divido los datos de la despuesta
            const data = response?.data ?? response;
            if (response?.error) {
              iziToast.show({ title: 'ERROR', titleColor: '#FF0000', color: '#FFF', class: 'text-danger', position: 'topRight', message: response.error });
              return;
            }
            this.clienteruc = data;
            const ap = (data.apellidoPaterno ?? '').trim();
            const am = (data.apellidoMaterno ?? '').trim();
            const nom = (data.nombres ?? '').trim();
            const partes = [ap, am, nom].filter(Boolean);
            this.clientes.rSocial = partes.length ? partes.join(' ').replace(/\s+/g, ' ') : ((data.nombreCompleto ?? '').trim() || '');
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


    if (this.direccionClientes.codpais == 'PEN') {
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

      this.direccionClientes.region = '';
      this.direccionClientes.provincia = '';
      this.direccionClientes.distrito = '';

    }
  }


  select_region() {

    this.provincias = [];
    setTimeout(() => {
      // $('#sl-provincia').prop('disabled', false);
      // $('#sl-distrito').prop('disabled', true);
    }, 50);
    this.direccionClientes.provincia = '';
    this.direccionClientes.distrito = '';
    this._adminService.get_Procincias().subscribe(
      response => {
        response.forEach((element: any) => {
          if (element.department_id == this.direccionClientes.region) {
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

    this.direccionClientes.distrito = '';

    this._adminService.get_Distritos().subscribe(
      response => {
        response.forEach((element: any) => {
          if (element.province_id == this.direccionClientes.provincia) {
            this.distritos.push(element);
            // this.direccion.zip = this.distritos.forEach(element.id);
          }
        });
        


      }
    );
  }

  select_distrito(event: any) {
    const selectedId = event.target.value;
    this.direccionClientes.ubigeo = selectedId;
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

  editarDireccion(id: string) {
    const item = this.direccionClientes_const.find((d: any) => Number(d.idDireccionClientes) === Number(id));
    if (item) {
      this.direccionClientes = { ...item };
      this.select_region();
      this.select_provincia();
      this.showModalEditarDireccion = true;
    }
  }

  cerrarModalEditarDireccion(): void {
    this.showModalEditarDireccion = false;
  }

  actualizarDireccion() {
    if (!this.direccionClientes?.idDireccionClientes) return;
    const payload = {
      idCliente: this.direccionClientes.idCliente,
      ubigeo: this.direccionClientes.ubigeo ?? '',
      codPais: this.direccionClientes.codPais ?? 'PEN',
      region: this.direccionClientes.region ?? '',
      provincia: this.direccionClientes.provincia ?? '',
      distrito: this.direccionClientes.distrito ?? '',
      urbanizacion: this.direccionClientes.urbanizacion ?? '',
      direccion: this.direccionClientes.direccion ?? '',
      referencia: this.direccionClientes.referencia ?? '',
      codLocal: this.direccionClientes.codLocal ?? '',
      principal: this.direccionClientes.principal === true || this.direccionClientes.principal === 1
    };
    this._clientesService.editar_direccionCliente(this.direccionClientes.idDireccionClientes, payload).subscribe({
      next: () => {
        this.showModalEditarDireccion = false;
        this.cargarDirecciones();
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

  eliminarDireccion(id: string | number): void {
    if (!window.confirm('¿Eliminar esta dirección?')) return;
    this._clientesService.eliminar_direccionCliente(id).subscribe({
      next: () => {
        this.cargarDirecciones();
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

  cargarDirecciones(): void {
    if (!this.clientes?.idCliente) return;
    this._clientesService.obtener_direccionesCliente_idCliente(this.clientes.idCliente).subscribe({
      next: (response) => {
        const data = response?.data;
        this.direccionClientes_const = Array.isArray(data) ? data : [];
        const allProv = this.fullProvincias?.length ? this.fullProvincias : this.provincias;
        const allDist = this.fullDistritos?.length ? this.fullDistritos : this.distritos;
        this.direccionClientes_const.forEach((d: any) => {
          const reg = this.regiones.find((r: any) => Number(r.id) === Number(d.region));
          const prov = allProv.find((p: any) => Number(p.id) === Number(d.provincia));
          const dist = allDist.find((x: any) => Number(x.id) === Number(d.distrito));
          d.nregion = reg?.name ?? '';
          d.nprovincia = prov?.name ?? '';
          d.ndistrito = dist?.name ?? '';
        });
      },
      error: () => { this.direccionClientes_const = []; }
    });
  }

  /** Al hacer clic en Crear dirección: si es RUC y hay establecimientos, muestra modal; si no, muestra form. */
  onCrearDireccion(): void {
    const ruc = (this.clientes.ruc || '').trim();
    if (ruc.length === 11 && this.clientes.idDocumento === '6') {
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

  /** Crea una dirección por cada establecimiento seleccionado y recarga la lista. */
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
    if (!this.clientes?.idCliente) return;
    const idCliente = this.clientes.idCliente;
    let idx = 0;
    const crearSiguiente = () => {
      if (idx >= selected.length) {
        this.closeModalEstablecimientos();
        this.cargarDirecciones();
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
        idCliente,
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
      this._clientesService.crear_direccionCliente(payload).subscribe({
        next: () => crearSiguiente(),
        error: () => crearSiguiente()
      });
    };
    crearSiguiente();
  }

  guardarNuevaDireccion(): void {
    const dir = (this.nuevaDireccion.direccion || '').toString().trim();
    if (!dir) return;
    if (!this.clientes?.idCliente) return;
    const payload = {
      idCliente: this.clientes.idCliente,
      ubigeo: (this.nuevaDireccion.ubigeo ?? '').toString().trim(),
      codpais: (this.nuevaDireccion.codPais ?? 'PEN').toString(),
      region: (this.nuevaDireccion.region ?? '').toString().trim(),
      provincia: (this.nuevaDireccion.provincia ?? '').toString().trim(),
      distrito: (this.nuevaDireccion.distrito ?? '').toString().trim(),
      urbanizacion: (this.nuevaDireccion.urbanizacion ?? '').toString().trim(),
      direccion: dir,
      referencia: (this.nuevaDireccion.referencia ?? '').toString().trim(),
      codLocal: (this.nuevaDireccion.codLocal ?? '').toString().trim(),
      principal: true
    };
    this.guardandoDireccion = true;
    this._clientesService.crear_direccionCliente(payload).subscribe({
      next: () => {
        this.guardandoDireccion = false;
        this.mostrarFormNuevaDireccion = false;
        this.nuevaDireccion = { ubigeo: '', codPais: 'PEN', region: '', provincia: '', distrito: '', urbanizacion: '', direccion: '', referencia: '', codLocal: '', principal: true };
        this.cargarDirecciones();
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
    this.data = this.clientes;
        //convertir array this.clientes a un objeto para pasarlo a mi servicio
    //  this.data.forEach((element: { id: string | number; name: any; }) => {
    //   this.data[element.id] = element.id;
    //  });

    //  console.log('this.data como objeto', this.data);
    this._clientesService.crear_cliente(this.data).subscribe(
      response => {
        if (response.data != undefined) {
          this._clientesService.obtener_cliente_id(this.clientes.ruc).subscribe(
            response => {
                            this.direccionClientes.idCliente = response.data[0].idCliente;
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

  /** Guardar cambios del cliente (editar). Incluye sujeto a crédito y línea de crédito. */
  actualizarCliente(): void {
    if (!this.clientes?.idCliente) return;
    const payload = {
      idDocumento: this.clientes.idDocumento,
      ruc: this.clientes.ruc,
      rSocial: this.clientes.rSocial,
      correo: this.clientes.correo ?? '',
      celular: this.clientes.celular ?? '',
      condicion: this.clientes.condicion ?? 'ACTIVO',
      sujetoCredito: !!this.clientes.sujetoCredito,
      lineaCredito: this.clientes.lineaCredito != null && !isNaN(Number(this.clientes.lineaCredito)) ? Math.max(0, Number(this.clientes.lineaCredito)) : 0
    };
    this._clientesService.editar_cliente(this.clientes.idCliente, payload).subscribe({
      next: () => {
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'OK', message: 'Cliente actualizado correctamente.', position: 'topRight' });
        }
        if (this.modoModal) {
          this.clienteActualizado.emit();
        }
      },
      error: (err) => {
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo actualizar el cliente.', position: 'topRight' });
        }
      }
    });
  }

  cerrarModal(): void {
    this.cerrar.emit();
  }
}
