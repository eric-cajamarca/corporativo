import { Directive, HostListener, ElementRef } from '@angular/core';

@Directive({
  selector: '[appConvertToUpper]'
})
export class ConvertToUpperDirective {

  constructor(private el: ElementRef) {}

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.el.nativeElement.value = value.toUpperCase();
  }

}
