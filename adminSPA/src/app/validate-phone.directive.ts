import { Directive, HostListener, ElementRef, Renderer2 } from '@angular/core';


@Directive({
  selector: '[appValidatePhone]'
})
export class ValidatePhoneDirective {

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  @HostListener('input', ['$event'])
  onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value;

    // Elimina caracteres que no sean dígitos
    value = value.replace(/\D/g, '');

    // Verifica si el valor comienza con 9 y tiene 9 dígitos
    //const isValid = /^9\d{8}$/.test(value);

    // Verifica si el valor comienza con 9
    const isValid = /^9/.test(value);
    // Limita la longitud a 9 numeros
    if (value.length > 9) {
      value = value.substring(0, 9);
    }

    if (isValid || value === '') {
      // Actualiza el valor del input solo si es válido o está vacío
      this.renderer.setProperty(input, 'value', value);
    } else {
      // Si no es válido, mantiene el valor anterior pero elimina caracteres no deseados
      const trimmedValue = value.substring(0, value.length - 1);
      this.renderer.setProperty(input, 'value', trimmedValue);
    }

    // Opcional: Agrega lógica para mostrar un mensaje de error o cambiar el estilo del input si el valor no es válido
    if (!isValid && value !== '') {
      // Por ejemplo, cambia el color del borde a rojo
      this.renderer.setStyle(this.el.nativeElement, 'borderColor', 'red');
    } else {
      // Restablece el estilo si el valor es válido
      this.renderer.setStyle(this.el.nativeElement, 'borderColor', 'green');
    }
  }

  // onInputChange(event: Event): void {
  //   const input = event.target as HTMLInputElement;
  //   let value = input.value;

  //   // Elimina caracteres que no sean dígitos
  //   value = value.replace(/\D/g, '');

  //   // Limita la longitud a 9 dígitos
  //   if (value.length > 9) {
  //     value = value.substring(0, 9);
  //   }

  //   // Actualiza el valor del input
  //   this.renderer.setProperty(input, 'value', value);

  //   // Opcional: Agrega alguna lógica para mostrar un mensaje de error o cambiar el estilo del input si el valor no es válido
  //   if (value.length !== 9) {
  //     // Por ejemplo, cambia el color del borde a rojo
  //     this.renderer.setStyle(this.el.nativeElement, 'borderColor', 'red');
  //   } else {
  //     // Restablece el estilo si el valor es válido
  //     this.renderer.setStyle(this.el.nativeElement, 'borderColor', 'green');
  //   }
  // }


}
