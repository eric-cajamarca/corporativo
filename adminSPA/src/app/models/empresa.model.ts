export class Empresa {
  constructor(
    public logo: string = '',
    public nombre: string = 'Nombre Predeterminado',
    public ruc: string = '',
    public rubro: string = '',
    public correo: string = '',
    public direccion: string = '',
    public telefono: string = ''
  ) {}
}