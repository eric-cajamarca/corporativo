import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root'
})
export class ClienteService {
  public url: any;
  private _router: any;
  public idUser:any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }


  //Metodo para obtener todos los clientes
  obtener_clientes():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'clientes',{
      headers: headers,
      withCredentials: true
    });
  }

   //Metodo para obtener un cliente por ruc
   obtener_cliente_ruc(id:any):Observable<any>{
    console.log('obtener_cliente_id - id',id);
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'clientesruc/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  //Metodo para obtener un cliente por id
  obtener_cliente_id(id:any):Observable<any>{
    console.log('obtener_cliente_id - id',id);
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'clientes/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  //Metodo para crear un cliente
  crear_cliente(data:any):Observable<any>{
    
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url + 'clientes', data,{
      headers: headers,
      withCredentials: true
    });
    
  }

  //Metodo para editar un cliente
  editar_cliente(id:any,cliente:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'clientes/'+id,cliente,{
      headers: headers,
      withCredentials: true
    });
  }

  //Metodo para eliminar un cliente
  eliminar_cliente(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'clientes/'+id,{
      headers: headers,
      withCredentials: true
    });
  }


  cambiar_estado_clientes(id: any, data: any): Observable<any> {
    console.log('cambiar_estado_clientes - id', id, data);
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.put(this.url + 'cambiar_estado_clientes/' + id, data, { headers: headers });
  }
  ////////////////////////////////////////////////////////////////////////////////////////////
  //metodo para obtener direccionCliente
  obtener_direccionCliente_id(id:any):Observable<any>{
    
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'direccionClientes/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  //metodo para obtener direccionCliente idCLiente
  obtener_direccionesCliente_idCliente(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'direccionesClientes/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  //metodo para crear direccionCliente
  crear_direccionCliente(data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'direccionClientes',data,{
      headers: headers,
      withCredentials: true
    });
  }

  //metodo para editar direccionCliente
  editar_direccionCliente(id:any,direccionCliente:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'direccionClientes/'+id,direccionCliente,{
      headers: headers,
      withCredentials: true
    });
  }

  //metodo para eliminar direccionCliente 
  eliminar_direccionCliente(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'direccionClientes/'+id,{
      headers: headers,
      withCredentials: true
    });
  }



}
