import { Injectable } from '@angular/core';
import { global } from './global';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Empresa } from '../models/empresa.model';

@Injectable({
  providedIn: 'root'
})
export class EmpresaService {

  private empresaSubject = new BehaviorSubject<Empresa>(new Empresa());

  public url: any;
  private _router: any;
  public idUser:any;
  private empresa = new Empresa(
    'http://localhost:3000/api/obtener_logo/logo-1746675338771-466791498.png',
    'Mi Empresa S.A.C.',
    '00000000000',
    '',
    null,
    null,
    '',
    'Av. Principal 123, Lima',
    '(01) 456-7890'
  );

    constructor(
    private _http: HttpClient,
    
  ) {
    this.url = global.url;
    // this.cargarEmpresa();
  }
  // Obtén la instancia (referencia compartida)
//  private cargarEmpresa(): void {
//     this.getEmpresasPdf().subscribe(response => {
//       if (response.data?.[0]) {
//         this.empresaSubject.next(response.data[0]);
//         console.log('Empresa cargada en el servicio:', response.data[0]);
//       }
//     });
//   }
  private cargarEmpresa(): void {
  this.getEmpresasPdf().subscribe(response => {
    if (response.data?.[0]) {
      const empresaData = response.data[0];
      console.log('Datos de la empresa obtenidos en servicio:', empresaData);
      // Construye URL completa del logo usando el nombre del archivo
      empresaData.logo = `http://localhost:3000/api/obtener_logo/${empresaData.logo}`;
      this.empresaSubject.next(empresaData);
      console.log('Empresa cargada en el servicio:', empresaData);
    }
  });
  }

  // El componente se suscribe
  getEmpresa$(): Observable<Empresa> {
    return this.empresaSubject.asObservable();
  }

  // Para obtener valor actual síncrono
  getEmpresaActual(): Empresa {
    return this.empresaSubject.value;
  }

  /** Refresca la empresa desde la API (empresas_id) y actualiza el subject. Útil para tener idRubro/codigoRubro al día. */
  refreshEmpresaFromApi(): Observable<Empresa | null> {
    return new Observable(observer => {
      this.getEmpresasPdf().subscribe({
        next: (response) => {
          const empresaData = response?.data?.[0];
          if (empresaData) {
            if (empresaData.logo && !String(empresaData.logo).startsWith('http')) {
              empresaData.logo = this.url + 'obtener_logo/' + empresaData.logo;
            }
            this.empresaSubject.next(empresaData);
            observer.next(empresaData);
          } else {
            observer.next(null);
          }
          observer.complete();
        },
        error: (err) => {
          observer.error(err);
        }
      });
    });
  }

 

  getEmpresas():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    //let headers = new HttpHeaders().set('Content-Type','application/json');
    console.log('url',this.url +'empresa');
     console.log('headers',headers);
    return this._http.get(this.url +'empresa',{
      headers:headers,
      withCredentials: true
    });
  }

  getEmpresasPdf():Observable<any>{
    
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'empresas_id',{
      headers: headers,
      withCredentials: true
    });
  }

  getEmpresas_id():Observable<any>{
    
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'empresaid',{
      headers: headers,
      withCredentials: true
    });
  }

  // api.post('/empresa',auth.auth, empresasController.createEmpresa);
  // api.put('/empresa/:id',auth.auth, empresasController.updateEmpresa);

  createEmpresa(empresa:any):Observable<any>{
    let params = JSON.stringify(empresa);
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'empresa',params,{
      headers: headers,
      withCredentials: true
    });
  }

  /** Verificar empresa con código enviado por WhatsApp (ruta pública). */
  verificarEmpresa(idEmpresa: string, codigo: string): Observable<{ data?: { ok: boolean }; message?: string }> {
    const body = JSON.stringify({ idEmpresa, codigo });
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this._http.post<{ data?: { ok: boolean }; message?: string }>(
      this.url + 'empresa/verificar',
      body,
      { headers, withCredentials: true }
    );
  }

  /** Envía o reenvía el código de activación por WhatsApp (ruta pública /api/activacion, sin sesión). */
  enviarCodigoActivacion(idEmpresa: string, celular?: string): Observable<{ message?: string }> {
    const body = celular ? { idEmpresa, celular } : { idEmpresa };
    return this._http.post<{ message?: string }>(
      this.url + 'activacion/enviar-codigo',
      body,
      { withCredentials: true }
    );
  }

  // updateEmpresa(empresa:any):Observable<any>{
  //   let params = JSON.stringify(empresa);
  //   let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':token});
  //   return this._http.put(this.url+'empresa/'+empresa._id,params,{
    //   headers: headers,
    //   withCredentials: true
    // });
  // }

  // uploadLogo(file: File, token: string): Observable<any> {
  //   const formData = new FormData();
  //   formData.append('logo', file);

  //   return this._http.post(`${this.url}/upload-logo`, formData, {
  //     headers: {
  //       Authorization: `Bearer ${token}`
  //     }
  //   });
  // }


  // updateEmpresa(id: any,data:any):Observable<any>{
  //   console.log('data en el servicio',data);
  //   if(data.logo){
  //     let headers = new HttpHeaders({'Authorization':token});

  //     const fd = new FormData();
  //     fd.append('ruc',data.ruc);
  //     fd.append('correo',data.correo);
  //     fd.append('celular',data.celular);
  //     fd.append('nombreComercial',data.nombreComercial);
  //     fd.append('alias',data.alias);
  //     fd.append('rubro',data.rubro);
  //     fd.append('logo',data.logo);

  //     return this._http.put(this.url+'empresa/'+id,fd,{
    //   headers: headers,
    //   withCredentials: true
    // });
  //   }else{
  //     let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':token});
  //   return this._http.put(this.url+'empresa/'+id,data,{
    //   headers: headers,
    //   withCredentials: true
    // });
  //   }

    
  // }

  updateEmpresa(id: any, data: any): Observable<any> {
    console.log('Datos para actualizar:', data);
    
    // Configuración común
    const options = {
        withCredentials: true,
        headers: new HttpHeaders({ 
            'Authorization': '' // Asume que tienes un método para obtener el token
        })
    };

    // Si hay un logo para subir
    if (data.logo instanceof File) {
        const fd = new FormData();
        
        // Agrega todos los campos al FormData
        Object.keys(data).forEach(key => {
            if (key === 'logoAnterior' && data[key] === null) {
                fd.append(key, ''); // Envía cadena vacía si es null
            } else if (data[key] !== null && data[key] !== undefined) {
                fd.append(key, data[key]);
            }
        });

        console.log('FormData contenido:');
        fd.forEach((value, key) => {
            console.log(key, value);
        });

        return this._http.put(`${this.url}empresa/${id}`, fd, options);
    } 
    // Sin logo (envío como JSON)
    else {
        options.headers = options.headers.set('Content-Type', 'application/json');
        
        // Limpia el objeto data antes de enviar
        const cleanData = {...data};
        delete cleanData.logo; // Elimina el logo si no es un archivo
        if (!cleanData.logoAnterior) cleanData.logoAnterior = '';
        
        return this._http.put(`${this.url}empresa/${id}`, cleanData, options);
    }
}

//   updateEmpresa(id: any, data: any): Observable<any> {
//     console.log('data en el servicio', data);
//     if (data.logo) {
//         let headers = new HttpHeaders({ 'Authorization': '' });

//         const fd = new FormData();
//         fd.append('ruc', data.ruc);
//         fd.append('correo', data.correo);
//         fd.append('celular', data.celular);
//         fd.append('nombreComercial', data.nombreComercial);
//         fd.append('alias', data.alias);
//         fd.append('rubro', data.rubro);
//         fd.append('logo', data.logo);
//         fd.append('logoAnterior', data.logoAnterior);

//         return this._http.put(this.url + 'empresa/' + id, fd, {
//       headers: headers,
//       withCredentials: true
//     });
//     } else {
//         let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
//         return this._http.put(this.url + 'empresa/' + id, data, {
//       headers: headers,
//       withCredentials: true
//     });
//     }
// }



  //api.put('/cambiar_estado_empresa/:id',auth.auth, empresasController.cambiar_estado_empresa);
  cambiar_estado_empresa(id:any,estado:any):Observable<any>{
    let params = JSON.stringify({estado:estado});
    let headers = new HttpHeaders({'Content-Type':'application/json'});
    return this._http.put(this.url+'cambiar_estado_empresa/'+id,params,{
      headers:headers,
      withCredentials: true
    });
  }

  // api.get('/direccion_empresa/:id',auth.auth, empresasController.getDireccionEmpresa_id);
  // api.post('/direccion_empresa',auth.auth, empresasController.createDireccionEmpresa);
  // api.put('/direccion_empresa/:id',auth.auth, empresasController.updateDireccionEmpresa);

  getDireccionEmpresa_id():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'direccionempresa',{
      headers: headers,
      withCredentials: true
    });
  }

  createDireccionEmpresa(direccion: any): Observable<any> {
    const params = JSON.stringify(direccion);
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.post(this.url + 'direccion_empresa', params, {
      headers,
      withCredentials: true
    });
  }

  /**
   * Crea una sucursal (nombre obligatorio, dirección opcional).
   * Usar cuando se quiera agregar una sucursal con nombre sin pasar por crear dirección.
   */
  createSucursal(payload: { nombre: string; direccion?: string }): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.post(this.url + 'sucursal', payload, {
      headers,
      withCredentials: true
    });
  }

  updateDireccionEmpresa(direccion:any):Observable<any>{
    let params = JSON.stringify(direccion);
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'direccion_empresa/'+direccion._id,params,{
      headers: headers,
      withCredentials: true
    });
  }
  
  //api.put('/cambiar_principal/:id',auth.auth, empresasController.cambiar_principal_direccion);

  cambiar_principal_direccion(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'cambiar_principal/'+id,{},{
      headers: headers,
      withCredentials: true
    });
  }
  
  // EliminarDirecion_id
  eliminarDireccion_id(id:any):Observable<any>{
    console.log('id en el servicio',id);
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'direccion_empresa/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener estado de configuración de la empresa
  getEstadoConfiguracion():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'estado_configuracion',{
      headers: headers,
      withCredentials: true
    });
  }

  /** Integraciones y APIs de pago: flags + credenciales por proveedor */
  getIntegraciones(): Observable<{ data: { integraciones: any; credenciales: Record<string, { idCredencial: string; clave: string; valor: string }[]> } }> {
    return this._http.get(this.url + 'empresa/integraciones', { withCredentials: true }) as Observable<{ data: { integraciones: any; credenciales: Record<string, { idCredencial: string; clave: string; valor: string }[]> } }>;
  }

  /** Actualizar flags de integraciones (twilio, izipay, culqi, etc.) */
  putIntegraciones(flags: { twilioHabilitado?: boolean; izipayHabilitado?: boolean; culqiHabilitado?: boolean; apisPeruHabilitado?: boolean; factilizaHabilitado?: boolean }): Observable<{ data: { ok: boolean }; message?: string }> {
    return this._http.put(this.url + 'empresa/integraciones', flags, { withCredentials: true }) as Observable<{ data: { ok: boolean }; message?: string }>;
  }

  /** Guardar credenciales de un proveedor (reemplaza las existentes para ese proveedor) */
  putCredencialesProveedor(proveedor: string, credenciales: { clave: string; valor: string }[]): Observable<{ data: { ok: boolean }; message?: string }> {
    return this._http.put(this.url + 'empresa/integraciones/credenciales', { proveedor, credenciales }, { withCredentials: true }) as Observable<{ data: { ok: boolean }; message?: string }>;
  }

}
