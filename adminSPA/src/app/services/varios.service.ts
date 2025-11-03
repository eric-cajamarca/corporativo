import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { global } from "./global";
import { Observable } from "rxjs/internal/Observable";


@Injectable({
    providedIn: 'root'
})


export class variosService {
    public url: any;
    private _router: any;
    public idUser: any;


    constructor(
        private _http: HttpClient,
    ) {
        this.url = global.url;
    }

        

    obtenerMarcas(): Observable<any> {
        let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
        return this._http.get(this.url + 'marcas', { 
            headers: headers,
            withCredentials: true
         });
    }

    obtenerMarcaPorId(id: any): Observable<any> {
        let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
        return this._http.get(this.url + 'marcas/' + id, { 
            headers: headers,
            withCredentials: true
         });
    }

    crearMarca(marca: any): Observable<any> {
        let params = JSON.stringify(marca);
        console.log('marca.id', marca._id);
        let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
        return this._http.post(this.url + 'marcas', params, { 
            headers: headers,
            withCredentials: true
         });
    }

    editarMarca(id:any, marca: any): Observable<any> {
        let params = JSON.stringify(marca);
        let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
        return this._http.put(this.url + 'marcas/' + id, params, { 
            headers: headers,
            withCredentials: true
         });
    }

    // eliminar_stock_sucursal('':any,id:any):Observable<any>{
    //     let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    //     return this._http.delete(this.url+'stocksucursal/'+id,{headers:headers});
    //   }

    editarEstadoMarca(id:any, estado:any): Observable<any>{
        console.log('id, estado', id,estado);
        let params = JSON.stringify(estado);
        let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
        return this._http.put(this.url + 'marcasestado/'+id,{estado},{
            headers:headers,
            withCredentials: true
        });
    }

    // Rutas para el CRUD de unidporcaja
    // api.get('/unidporcaja',auth.auth, unidporcajaController.obtenerUnidPorCaja);
    // api.put('/unidporcaja/:id',auth.auth, unidporcajaController.editarUnidPorCaja);

    obtenerUnidPorCaja(): Observable<any> {
        let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
        return this._http.get(this.url + 'unidporcaja', { 
            headers: headers,
            withCredentials: true
         });
    }

    editarUnidPorCaja(unidporcaja: any): Observable<any> {
        let params = JSON.stringify(unidporcaja);
        console.log('unidporcaja', unidporcaja._id);
        let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
        return this._http.put(this.url + 'unidporcaja/' + unidporcaja._id, params, { 
            headers: headers,
            withCredentials: true
         });
    }

}