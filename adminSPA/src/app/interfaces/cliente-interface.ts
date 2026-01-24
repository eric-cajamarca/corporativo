import { Documento } from "./documento-interface";

export interface Cliente{
    idCliente:string;
    idDocumento:number;
    ruc:string;
    rSocial:string;
    nombre?: string;
    apellido?: string;
    idDireccion: number;
    nombreDireccion: string;
    correo?: string;
    celular?: string;
    condicion?: string;

}

export type ClienteResumido = Pick<Cliente, 'idCliente' | 'idDocumento' | 'ruc'| 'rSocial'>;