//import { Directive } from '@angular/core';
import { Directive, HostListener, ElementRef } from '@angular/core';

@Directive({
  selector: '[appFormatSentence]'
})
export class FormatSentenceDirective {

  constructor(private el: ElementRef) {}

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const newValue = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    this.el.nativeElement.value = newValue;
  }

}

