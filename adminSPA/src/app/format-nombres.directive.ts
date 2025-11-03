import { Directive, ElementRef, HostListener } from '@angular/core';


@Directive({
  selector: '[appFormatNombres]'
})
export class FormatNombresDirective {
  
  constructor(private el: ElementRef) {}

  @HostListener('blur') onBlur() {
    let value: string = this.el.nativeElement.value;
    this.el.nativeElement.value = this.capitalizeWords(value);
  }

  private capitalizeWords(value: string): string {
    return value.replace(/\b\w/g, char => char.toUpperCase()).replace(/\B\w/g, char => char.toLowerCase());
  }

}
