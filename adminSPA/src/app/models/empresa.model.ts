export class Empresa {
  constructor(
    public logo: string = '',
    public nombre: string = 'Nombre Predeterminado',
    public ruc: string = '',
    public rubro: string = '',
    public idRubro?: number | null,
    public codigoRubro?: string | null,
    public correo: string = '',
    public direccion: string = '',
    public telefono: string = ''
  ) {}
}