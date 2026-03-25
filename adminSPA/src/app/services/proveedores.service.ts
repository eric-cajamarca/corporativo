import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';
import { global } from './global';

@Injectable({
  providedIn: 'root'
})
export class ProveedoresService {
  public url: any;
  private _router: any;
  public idUser:any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }


  //Metodo para obtener todos los proveedores
  obtener_proveedores():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'proveedores',{
      headers: headers,
      withCredentials: true
    });
  }

   //Metodo para obtener un proveedor por ruc
   obtener_proveedor_ruc(id:any):Observable<any>{
        let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'proveedoresruc/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  //Metodo para obtener un proveedor por id
  obtener_proveedor_id(id:any):Observable<any>{
        let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'proveedores/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  //Metodo para crear un cliente
  crear_proveedor(data:any):Observable<any>{
    
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url + 'proveedores', data,{
      headers: headers,
      withCredentials: true
    });
    
  }

  //Metodo para editar un proveedor
  editar_proveedor(id:any,proveedor:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'proveedores/'+id,proveedor,{
      headers: headers,
      withCredentials: true
    });
  }

  //Metodo para eliminar un proveedor
  eliminar_proveedor(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'proveedores/'+id,{
      headers: headers,
      withCredentials: true
    });
  }


  cambiar_estado_proveedores(id: any, data: any): Observable<any> {
        let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.put(this.url + 'cambiar_estado_proveedores/' + id, data, { 
      headers: headers,
      withCredentials: true 
    });
  }
  ////////////////////////////////////////////////////////////////////////////////////////////
  //metodo para obtener direccionproveedor
  obtener_direccionProveedor_id(id:any):Observable<any>{
    
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'direccionProveedores/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  //metodo para obtener direccionProveedor idProveedor
  obtener_direccionesProveedor_idProveedor(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'direccionesProveedores/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  //metodo para crear direccionCliente
  crear_direccionProveedor(data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'direccionProveedores',data,{
      headers: headers,
      withCredentials: true
    });
  }

  //metodo para editar direccionProveedor
  editar_direccionProveedor(id:any,direccionProveedor:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'direccionProveedores/'+id,direccionProveedor,{
      headers: headers,
      withCredentials: true
    });
  }

  //metodo para eliminar direccionProveedor 
  eliminar_direccionProveedor(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'direccionProveedores/'+id,{
      headers: headers,
      withCredentials: true
    });
  }
}
