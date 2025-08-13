import { Directive, ElementRef, EventEmitter, HostListener, Output } from '@angular/core';

@Directive({
  selector: '[clickOutside]',
  standalone: true
})
export class ClickOutsideDirective {
  @Output() clickOutside = new EventEmitter<Event>();

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const clickedInside = this.elementRef.nativeElement.contains(target);
    
    if (!clickedInside) {
      this.clickOutside.emit(event);
    }
  }

  @HostListener('document:touchstart', ['$event'])
  onDocumentTouchStart(event: TouchEvent): void {
    const target = event.target as HTMLElement;
    const clickedInside = this.elementRef.nativeElement.contains(target);
    
    if (!clickedInside) {
      this.clickOutside.emit(event);
    }
  }
}