import { Directive, HostListener, ElementRef, Renderer2 } from '@angular/core';


@Directive({
  selector: '[appValidateEmail]'
})
export class ValidateEmailDirective {

  
  constructor(private el: ElementRef, private renderer: Renderer2) {}

  @HostListener('input', ['$event.target.value'])
  validateEmail(value: string): void {
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (!isValidEmail && value !== '') {
      this.renderer.setStyle(this.el.nativeElement, 'borderColor', 'red');
    } else {
      this.renderer.setStyle(this.el.nativeElement, 'borderColor', 'green');
    }
  }

}
