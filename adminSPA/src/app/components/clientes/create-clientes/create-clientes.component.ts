import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { DocumentoService } from '../../../services/documento.service';
import { ApiperuService } from '../../../services/apiperu.service';
import { ClienteService } from '../../../services/cliente.service';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';

declare var iziToast: any;
declare var $: any;

@Component({
  selector: 'app-create-clientes',
  imports: [FormsModule,RouterModule, CommonModule, TopnavComponent, SidebarComponent],
  templateUrl: './create-clientes.component.html',
  styleUrl: './create-clientes.component.css'
})
export class CreateClientesComponent implements OnInit, OnChanges {
  public sidebarState = inject(SidebarStateService);
  /** Cuando se abre desde nueva venta: tipo de documento pre-seleccionado. */
  @Input() idDocumentoPre?: string;
  /** Cuando se abre desde nueva venta: RUC o DNI pre-cargado. */
  @Input() rucPre?: string;
  /** Contador desde create-ventas: al incrementarse, se vuelven a aplicar idDocumentoPre y rucPre (ngOnInit solo corre una vez). */
  @Input() preCargarSerial = 0;
  /** Si es true, al registrar no navega a /cliente sino emite clienteCreado. */
  @Input() desdeVenta = false;
  @Output() clienteCreado = new EventEmitter<any>();

  public busqueda = false;
  public filtro: any = "";
  public clientes: any = {
    correo: '',
    celular: '',
    condicion:'ACTIVO',
    idDocumento: '',
    sujetoCredito: false,
    lineaCredito: 0,
  };
  public clienteruc: any = [];
  // public direccionClientes:any=[];
  public documento: any = [];
  public regiones: any = [];
  public provincias: any = [];
  public distritos: any = [];
  /** Listas completas para resolver nombre→ID al guardar establecimientos (provincias/distritos se filtran por región). */
  public fullProvincias: any[] = [];
  public fullDistritos: any[] = [];
  public token: any = "";
  public contBuscar = 0;
  public btn_registrar = false;
  public mostrarDireccion = false;

  public str_pais = '';
  public direccionClientes: any = {

    ubigeo: '',
    codpais: 'PEN',
    region: '',
    provincia: '',
    distrito: '',
    principal: true,
    codLocal: '0000',
    urbanizacion: '',
  };
  public data: any = {};
  /** Establecimientos RUC (Factiliza): lista mostrada en modal */
  public listEstablecimientos: any[] = [];
  public showModalEstablecimientos = false;
  public loadingEstablecimientos = false;
  /** Índices seleccionados en el modal (para guardar en DireccionClientes) */
  public selectedEstablecimientoIndices: Set<number> = new Set();
  /** Establecimientos elegidos en modal que se guardarán tras crear el cliente (resto además del primero que rellena el form) */
  public establecimientosPendientes: any[] = [];

  constructor(
    private _adminService: AdminService,
    private _documentosService: DocumentoService,
    private _apiperuService: ApiperuService,
    private _clientesService: ClienteService,
    private _router: Router,
    
  ) {
    //this.token = this._cookieService.get('token');

    this.direccionClientes.codpais = 'PEN';


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

      }

  ngOnInit(): void {
    this._documentosService.obtener_documento().subscribe(
      response => {
        this.documento = response.data;
        this.aplicarPrecargaDesdeVentaInputs();
      }
    );
    this.aplicarPrecargaDesdeVentaInputs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.desdeVenta) return;
    if (changes['idDocumentoPre'] || changes['rucPre'] || changes['preCargarSerial']) {
      this.aplicarPrecargaDesdeVentaInputs();
    }
  }

  /** Rellena tipo y número en el formulario cuando el modal se abre desde nueva venta. */
  private aplicarPrecargaDesdeVentaInputs(): void {
    if (!this.desdeVenta) return;
    const id = this.idDocumentoPre;
    const r = this.rucPre;
    if (id != null && String(id).trim() !== '') {
      this.clientes.idDocumento = String(id).trim();
    }
    if (r != null && String(r).trim() !== '') {
      this.clientes.ruc = String(r).trim();
    }
  }


  removeAccents(str: string) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  
  // Endpoint legacy: https://dniruc.apisperu.com/api/v1/dni/<DNI>?token=<TOKEN_FROM_BACKEND>
  // El token vive en el backend (env APISPERU_TOKEN); el frontend nunca debe llevarlo.

  // buscar() {
  //   this.contBuscar = 1;
  //   console.log('veo que cod comprobante', this.clientes.idDocumento)

  //   console.log('filtro', this.clientes.ruc);
  //   this.filtro = this.clientes.ruc;

  //   try {

  //     if (this.clientes.ruc.length === 11 && this.clientes.idDocumento === '6') {
  //       this._apiperuService.getRucInfo(this.filtro).subscribe(
  //         response => {
  //           this.clienteruc = response;
  //           //divido los datos de la despuesta
  //           this.clientes.rSocial = response.razonSocial;
  //           this.clientes.condicion = response.estado
  
  
  //           ///////////
  //           this.direccionClientes.codpais = "PEN";
  //           this.direccionClientes.ubigeo = response.ubigeo;
            
  //           this.direccionClientes.direccion = response.direccion;

  //           //encuentro el id de la region
  //           const regionEncontrada = this.regiones.find((element: any) => this.removeAccents(element.name).toUpperCase() === response.departamento.toUpperCase());

  //           if (regionEncontrada) {
  //            this.direccionClientes.region = regionEncontrada.id;
  //            console.log('this.direccionClientes.region', this.direccionClientes.region);
  //          } else {
  //            console.log('No se encontró la región correspondiente para el departamento:', response.departamento);
  //          }

  //          //encuentro el id de la provincia
  //          const provinciaEncontrada = this.provincias.find((element: any) => this.removeAccents(element.name).toUpperCase() === response.provincia.toUpperCase());

  //          if (provinciaEncontrada) {
  //            this.direccionClientes.provincia = provinciaEncontrada.id;
  //            console.log('this.direccionClientes.provincia', this.direccionClientes.provincia);
  //          } else {
  //            console.log('No se encontró la provincia correspondiente para el departamento:', response.provincia);
  //          }

  //          //encuentro el id del distrito
  //          const distritoEncontrado = this.distritos.find((element: any) => this.removeAccents(element.name).toUpperCase() === response.distrito.toUpperCase());

  //          if (distritoEncontrado) {
  //            this.direccionClientes.distrito = distritoEncontrado.id;
  //            console.log('this.direccionClientes.distrito', this.direccionClientes.distrito);
  //          } else {
  //            console.log('No se encontró el distrito correspondiente para el departamento:', response.distrito);
  //          }

  
  //           console.log('this.clienteruc: ', this.clienteruc);
  //         },error => {
  //           iziToast.show({
  //             title: 'ERROR',
  //             titleColor: '#FF0000',
  //             color: '#FFF',
  //             class: 'text-danger',
  //             position: 'topRight',
  //             message: error.error.message || 'Error al realizar la consulta por falta de datos '
  //           });
  //         });

  //     }
      




  //     if (this.clientes.ruc.length === 8 && this.clientes.idDocumento === '1') {
  //       this._apiperuService.getDniInfo(this.filtro).subscribe(
  //         response => {
  //           this.clienteruc = response;
  //           //divido los datos de la despuesta
  //           this.clientes.rSocial = response.apellidoPaterno + ' ' + response.apellidoMaterno + ', ' + response.nombres;


  //           console.log('this.clienteruc: ', this.clienteruc);
  //         },
  //         error => {
  //           iziToast.show({
  //             title: 'ERROR',
  //             titleColor: '#FF0000',
  //             color: '#FFF',
  //             class: 'text-danger',
  //             position: 'topRight',
  //             message: 'Error al realizar la consulta por falta de datos '
  //           });
  //         });

  //     }
  //   } catch (error) {
  //     iziToast.show({
  //       title: 'ERROR',
  //       titleColor: '#FF0000',
  //       color: '#FFF',
  //       class: 'text-danger',
  //       position: 'topRight',
  //       message: 'Ingrese un número de DNI o Ruc'
  //     });
  //   }





  // }

  async buscar() {
    this.busqueda=true;
  this.contBuscar = 1;
      
  this.filtro = this.clientes.ruc;

  // Validación básica
  if (!this.filtro || !this.clientes.idDocumento) {
    this.showError('Ingrese un número de documento y seleccione un tipo');
    return;
  }

  try {
    if (this.clientes.ruc.length === 11 && this.clientes.idDocumento === '6') {
      await this.handleRucSearch();
      this.busqueda = false;
    } else if (this.clientes.ruc.length === 8 && this.clientes.idDocumento === '1') {
      await this.handleDniSearch();
      this.busqueda = false;
    } else if ((this.clientes.idDocumento === '4') && this.filtro.length >= 8 && this.filtro.length <= 15) {
      await this.handleCeeSearch();
      this.busqueda = false;
    } else {
      this.busqueda = false;
      this.showError('Formato de documento incorrecto (RUC 11 dígitos, DNI 8 dígitos, CEE 8-15 caracteres)');
    }
  } catch (error) {
    console.error('Error en búsqueda:', error);
    this.showError(error instanceof Error ? error.message : 'Error desconocido');
    this.busqueda=false;
  }
}

private async handleRucSearch(): Promise<void> {
  try {
    const response = await firstValueFrom(this._apiperuService.getRucInfo(this.filtro));
    if (!response) throw new Error('No se recibieron datos del servicio');
    const data = response.data ?? response;
    if (response.error) {
      this.showError(response.error);
      this.busqueda = false;
      return;
    }
    this.clienteruc = data;
    this.clientes.rSocial = data.razonSocial ?? '';
    this.clientes.condicion = data.estado ?? 'ACTIVO';
    this.direccionClientes.codpais = 'PEN';
    this.direccionClientes.ubigeo = data.ubigeo ?? '';
    this.direccionClientes.direccion = data.direccion ?? '';
    const dep = (data.departamento ?? '').trim();
    const prov = (data.provincia ?? '').trim();
    const dist = (data.distrito ?? '').trim();
    this.direccionClientes.region = dep ? this.findLocationId(this.regiones, dep, 'departamento') : undefined;
    this.direccionClientes.provincia = prov ? this.findLocationId(this.provincias, prov, 'provincia') : undefined;
    this.direccionClientes.distrito = dist ? this.findLocationId(this.distritos, dist, 'distrito') : undefined;
    this.direccionClientes.principal = true;
    this.direccionClientes.codLocal = '0000';
  } catch (error) {
    console.error('Error en búsqueda RUC:', error);
    this.showError(error instanceof Error ? error.message : 'Error al consultar RUC');
  } finally {
    this.busqueda = false;
  }
}

private async handleDniSearch(): Promise<void> {
  try {
    const response = await firstValueFrom(this._apiperuService.getDniInfo(this.filtro));
    if (!response) throw new Error('No se recibieron datos del servicio');
    const data = response.data ?? response;
    if (response.error) {
      this.showError(response.error);
      this.busqueda = false;
      return;
    }
    this.clienteruc = data;
    const ap = (data.apellidoPaterno ?? '').trim();
    const am = (data.apellidoMaterno ?? '').trim();
    const nom = (data.nombres ?? '').trim();
    const partes = [ap, am, nom].filter(Boolean);
    this.clientes.rSocial = partes.length ? partes.join(' ').replace(/\s+/g, ' ') : ((data.nombreCompleto ?? '').trim() || '');
  } catch (error) {
    console.error('Error en búsqueda DNI:', error);
    this.showError(error instanceof Error ? error.message : 'Error al consultar DNI');
  } finally {
    this.busqueda = false;
  }
}

private async handleCeeSearch(): Promise<void> {
  try {
    const response = await firstValueFrom(this._apiperuService.getCeeInfo(this.filtro));
    if (!response) throw new Error('No se recibieron datos del servicio');
    const data = response.data ?? response;
    if (response.error) {
      this.showError(response.error);
      this.busqueda = false;
      return;
    }
    this.clienteruc = data;
    const ap = (data.apellidoPaterno ?? '').trim();
    const am = (data.apellidoMaterno ?? '').trim();
    const nom = (data.nombres ?? '').trim();
    const partes = [ap, am, nom].filter(Boolean);
    this.clientes.rSocial = partes.length ? partes.join(' ').replace(/\s+/g, ' ') : ((data.nombreCompleto ?? '').trim() || '');
  } catch (error) {
    console.error('Error en búsqueda CEE:', error);
    this.showError(error instanceof Error ? error.message : 'Error al consultar Carnet de extranjería');
  } finally {
    this.busqueda = false;
  }
}

  private findLocationId(items: any[], name: string, type: string): string | undefined {
    if (!items || items.length === 0) {
      console.warn(`No hay ${type}s cargados para buscar`);
      return undefined;
    }

    if (!name) {
      console.warn(`El nombre del ${type} es inválido o vacío`);
      return undefined;
    }

    // 🔤 Normalizar texto: elimina tildes, espacios y pasa a minúsculas
    const normalize = (text: string) =>
      text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // elimina tildes
        .replace(/\s+/g, ' ') // normaliza espacios
        .trim()
        .toLowerCase();

    const normalizedName = normalize(name);

    // 🔍 1️⃣ Búsqueda exacta (ya sin tildes ni mayúsculas)
    let foundItem = items.find(item => normalize(item.name) === normalizedName);

    // 🔍 2️⃣ Si no encuentra, busca coincidencia parcial (ej. "lima" dentro de "lima metropolitana")
    if (!foundItem) {
      foundItem = items.find(item => normalize(item.name).includes(normalizedName));
    }

    // 🔍 3️⃣ Si aún no encuentra, intenta coincidencia inversa
    if (!foundItem) {
      foundItem = items.find(item => normalizedName.includes(normalize(item.name)));
    }

    if (!foundItem) {
      console.warn(`No se encontró ${type} correspondiente para: ${name}`);
            return undefined;
    }

        return foundItem.id;
  }

private showError(message: string): void {
  iziToast.show({
    title: 'ERROR',
    titleColor: '#FF0000',
    color: '#FFF',
    class: 'text-danger',
    position: 'topRight',
    message: message
  });
}

  /** Abre modal de establecimientos RUC (solo Factiliza). RUC debe tener 11 dígitos. */
  openModalEstablecimientos(): void {
    const ruc = (this.clientes.ruc || '').trim();
    if (ruc.length !== 11) {
      this.showError('Ingrese un RUC de 11 dígitos antes de consultar establecimientos');
      return;
    }
    this.loadingEstablecimientos = true;
    this._apiperuService.getRucAnexo(ruc).subscribe({
      next: (res) => {
        this.loadingEstablecimientos = false;
        if (res && res.error) {
          this.showError(res.error);
          return;
        }
        this.listEstablecimientos = Array.isArray(res?.data) ? res.data : [];
        this.selectedEstablecimientoIndices = new Set();
        this.showModalEstablecimientos = true;
        if (this.listEstablecimientos.length === 0) {
          this.showError('No se encontraron establecimientos para este RUC');
        }
      },
      error: (err) => {
        this.loadingEstablecimientos = false;
        this.showError(err?.error?.message || 'Error al obtener establecimientos');
      }
    });
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

  /** Aplica la selección: primero rellena el formulario de dirección, el resto a establecimientosPendientes. */
  applyEstablecimientos(): void {
    const selected = Array.from(this.selectedEstablecimientoIndices)
      .sort((a, b) => a - b)
      .map(i => this.listEstablecimientos[i]);
    if (selected.length === 0) {
      this.showError('Seleccione al menos un establecimiento');
      return;
    }
    const [first, ...rest] = selected;
    this.establecimientosPendientes = rest;
    this.direccionClientes.codpais = 'PEN';
    this.direccionClientes.ubigeo = first.ubigeo ?? '';
    this.direccionClientes.direccion = first.direccion ?? first.direccionCompleta ?? '';
    this.direccionClientes.referencia = first.tipoEstablecimiento ?? '';
    this.direccionClientes.codLocal = first.codigo ?? '0';
    const dep = (first.departamento ?? '').trim();
    const prov = (first.provincia ?? '').trim();
    const dist = (first.distrito ?? '').trim();
    this.direccionClientes.region = dep ? this.findLocationId(this.regiones, dep, 'departamento') : '';
    this.direccionClientes.provincia = prov ? this.findLocationId(this.provincias, prov, 'provincia') : '';
    this.direccionClientes.distrito = dist ? this.findLocationId(this.distritos, dist, 'distrito') : '';
    this.closeModalEstablecimientos();
  }

  /**
   * Primera dirección al crear cliente (DNI/RUC): siempre principal y código de local domicilio SUNAT.
   * Los establecimientos adicionales del modal conservan su codigo y principal = false.
   */
  private prepararPrimeraDireccionAltaCliente(): void {
    this.direccionClientes.principal = true;
    this.direccionClientes.codLocal = '0000';
  }

  /** Construye payload para POST direccionClientes a partir de un establecimiento normalizado (region/provincia/distrito como IDs). */
  private buildDireccionFromEstablecimiento(e: any, idCliente: number): any {
    const dep = (e.departamento ?? '').trim();
    const prov = (e.provincia ?? '').trim();
    const dist = (e.distrito ?? '').trim();
    return {
      idCliente,
      ubigeo: e.ubigeo ?? '',
      codpais: 'PEN',
      region: dep ? (this.findLocationId(this.regiones, dep, 'departamento') ?? '') : '',
      provincia: prov ? (this.findLocationId(this.fullProvincias.length ? this.fullProvincias : this.provincias, prov, 'provincia') ?? '') : '',
      distrito: dist ? (this.findLocationId(this.fullDistritos.length ? this.fullDistritos : this.distritos, dist, 'distrito') ?? '') : '',
      urbanizacion: '',
      direccion: e.direccion ?? e.direccionCompleta ?? '',
      referencia: e.tipoEstablecimiento ?? '',
      codLocal: e.codigo ?? '0',
      principal: false
    };
  }

  
  private setSelectDisabled(elementId: string, disabled: boolean): void {
    const el = document.getElementById(elementId) as HTMLSelectElement | null;
    if (el) {
      el.disabled = disabled;
    }
  }

  select_pais() {
  if (this.direccionClientes.codpais == 'PEN') {
    this.setSelectDisabled('sl-region', false);
    
    this._adminService.get_Regiones().subscribe(
      response => {
        this.regiones = response.map((element: any) => ({
          id: element.id,
          name: element.name
        }));
      }
    );
  } else {
    this.setSelectDisabled('sl-region', true);
    this.setSelectDisabled('sl-provincia', true);
    this.setSelectDisabled('sl-distrito', true);
    
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
  this.direccionClientes.provincia = '';
  this.direccionClientes.distrito = '';

  this.setSelectDisabled('sl-provincia', false);
  this.setSelectDisabled('sl-distrito', true);

  this._adminService.get_Procincias().subscribe(
    response => {
      this.provincias = response.filter((element: any) => 
        element.department_id == this.direccionClientes.region
      );
          }
  );
  }

  

  select_provincia() {
  this.distritos = [];
  this.direccionClientes.distrito = '';

  this.setSelectDisabled('sl-distrito', false);

  this._adminService.get_Distritos().subscribe(
    response => {
      // Versión optimizada con filter
      this.distritos = response.filter((element: any) => 
        element.province_id == this.direccionClientes.provincia
      );
          }
  );
}

  select_distrito(event: any) {
    const selectedId = event.target.value;
    this.direccionClientes.ubigeo = selectedId;
      }

  registrar(registroForm: any){

        
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
          if(response.data != undefined){
            this._clientesService.obtener_cliente_ruc(this.clientes.ruc).subscribe(
              resCliente => {
                const row = resCliente?.data?.[0];
                if (!row) {
                  this.btn_registrar = false;
                  return;
                }
                this.direccionClientes.idCliente = row.idCliente;
                const idCliente = row.idCliente;
                this.prepararPrimeraDireccionAltaCliente();
                const pendientes = this.establecimientosPendientes || [];
                const crearSiguienteDireccion = (idx: number) => {
                  if (idx === 0) {
                    this._clientesService.crear_direccionCliente(this.direccionClientes).subscribe({
                      next: () => { crearSiguienteDireccion(1); },
                      error: () => { crearSiguienteDireccion(1); }
                    });
                    return;
                  }
                  if (idx > pendientes.length) {
                    if (this.desdeVenta) {
                      const payload = {
                        idCliente,
                        idDocumento: row.idDocumento ?? this.clientes.idDocumento,
                        ruc: row.ruc ?? this.clientes.ruc,
                        rSocial: (row.rSocial ?? row.r_Social ?? row.rsocial ?? this.clientes.rSocial ?? '').toString().trim(),
                        direccion: (this.direccionClientes.direccion ?? '').toString().trim(),
                        correo: row.correo ?? this.clientes.correo ?? '',
                        celular: row.celular ?? this.clientes.celular ?? '',
                        condicion: row.condicion ?? this.clientes.condicion ?? 'ACTIVO'
                      };
                      this.btn_registrar = false;
                      if (typeof iziToast !== 'undefined') {
                        iziToast.success({ title: 'OK', message: 'Cliente registrado.', position: 'topRight' });
                      }
                      this.clienteCreado.emit(payload);
                    } else {
                      this.btn_registrar = false;
                      if (typeof iziToast !== 'undefined') {
                        iziToast.success({ title: 'OK', message: 'Cliente creado correctamente', position: 'topRight' });
                      }
                      this._router.navigate(['/cliente']);
                    }
                    return;
                  }
                  const e = pendientes[idx - 1];
                  const body = this.buildDireccionFromEstablecimiento(e, idCliente);
                  this._clientesService.crear_direccionCliente(body).subscribe({
                    next: () => { crearSiguienteDireccion(idx + 1); },
                    error: () => { crearSiguienteDireccion(idx + 1); }
                  });
                };
                if (this.desdeVenta) {
                  this._clientesService.crear_direccionCliente(this.direccionClientes).subscribe({
                    next: () => {
                      crearSiguienteDireccion(1);
                    },
                    error: () => {
                      const payload = {
                        idCliente,
                        idDocumento: row.idDocumento ?? this.clientes.idDocumento,
                        ruc: row.ruc ?? this.clientes.ruc,
                        rSocial: (row.rSocial ?? row.r_Social ?? row.rsocial ?? this.clientes.rSocial ?? '').toString().trim(),
                        direccion: (this.direccionClientes.direccion ?? '').toString().trim(),
                        correo: row.correo ?? this.clientes.correo ?? '',
                        celular: row.celular ?? this.clientes.celular ?? '',
                        condicion: row.condicion ?? this.clientes.condicion ?? 'ACTIVO'
                      };
                      this.btn_registrar = false;
                      this.clienteCreado.emit(payload);
                    }
                  });
                  return;
                }
                crearSiguienteDireccion(0);
              },
              () => { this.btn_registrar = false; }
            );
          }else{
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

  onCheckboxChange(){
    if (this.mostrarDireccion) {
      this.mostrarDireccion = true;
            
      // Realiza acciones cuando el checkbox está marcado
    } else {
      // this.mostrarDireccion = false;
            
      // Realiza acciones cuando el checkbox está desmarcado
    }
    
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
