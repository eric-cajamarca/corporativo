import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdateProgramacionComponent } from './update-programacion.component';

describe('UpdateProgramacionComponent', () => {
  let component: UpdateProgramacionComponent;
  let fixture: ComponentFixture<UpdateProgramacionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateProgramacionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdateProgramacionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
