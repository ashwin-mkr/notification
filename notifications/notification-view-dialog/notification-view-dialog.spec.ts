import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationViewDialog } from './notification-view-dialog';

describe('NotificationViewDialog', () => {
  let component: NotificationViewDialog;
  let fixture: ComponentFixture<NotificationViewDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationViewDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationViewDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
