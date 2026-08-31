import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { FormulaMatizado, MatizadoLineaPayload } from '../models/formula-matizado.model';

@Injectable({
  providedIn: 'root'
})
export class FormulaMatizadoService {
  private readonly base = `${environment.API_URL}matizado/formulas`;

  constructor(private http: HttpClient) {}

  listar(filtros?: { q?: string; placa?: string; idProductoBase?: string; limite?: number }): Observable<FormulaMatizado[]> {
    let params = new HttpParams();
    const q = String(filtros?.q || '').trim();
    const placa = String(filtros?.placa || '').trim();
    if (q) params = params.set('q', q);
    if (placa) params = params.set('placa', placa);
    if (filtros?.idProductoBase) params = params.set('idProductoBase', filtros.idProductoBase);
    if (filtros?.limite) params = params.set('limit', String(filtros.limite));
    return this.http
      .get<{ data: FormulaMatizado[] }>(this.base, { params, withCredentials: true })
      .pipe(map((res) => (Array.isArray(res?.data) ? res.data : [])));
  }

  obtener(idFormula: string): Observable<FormulaMatizado> {
    return this.http
      .get<{ data: FormulaMatizado }>(`${this.base}/${encodeURIComponent(idFormula)}`, {
        withCredentials: true
      })
      .pipe(map((res) => res?.data as FormulaMatizado));
  }

  guardar(body: MatizadoLineaPayload & { nombre: string; idProductoBase?: string; idFormula?: string }): Observable<string> {
    const id = String(body.idFormula || '').trim();
    const payload = {
      nombre: body.nombre,
      marcaVehiculo: body.marcaVehiculo,
      modeloVehiculo: body.modeloVehiculo,
      placa: body.placa,
      idProductoBase: body.idProductoBase,
      factorEscala: body.factorEscala,
      tintes: (body.tintes || []).map((t) => ({
        idProductoTinte: t.idProductoTinte,
        gramos: t.gramos
      }))
    };
    const req = id
      ? this.http.put<{ data: { idFormula: string } }>(`${this.base}/${encodeURIComponent(id)}`, payload, {
          withCredentials: true
        })
      : this.http.post<{ data: { idFormula: string } }>(this.base, payload, { withCredentials: true });
    return req.pipe(map((res) => String(res?.data?.idFormula || '')));
  }

  eliminar(idFormula: string): Observable<void> {
    return this.http
      .delete<{ message?: string }>(`${this.base}/${encodeURIComponent(idFormula)}`, {
        withCredentials: true
      })
      .pipe(map(() => undefined));
  }
}
