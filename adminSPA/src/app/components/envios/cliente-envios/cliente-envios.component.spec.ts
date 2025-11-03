import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClienteEnviosComponent } from './cliente-envios.component';

describe('ClienteEnviosComponent', () => {
  let component: ClienteEnviosComponent;
  let fixture: ComponentFixture<ClienteEnviosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClienteEnviosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClienteEnviosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
