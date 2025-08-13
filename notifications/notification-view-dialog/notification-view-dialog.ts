import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'notification-view-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './notification-view-dialog.html',
  styleUrls:['./notification-view-dialog.scss']
})
export class NotificationViewDialog {
  constructor(
    public dialogRef: MatDialogRef<NotificationViewDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  accept(): void {
    this.dialogRef.close('accept');
  }

  isTicketNotification(message: string): boolean {
    return message?.toLowerCase().includes('new ticket');
  }
}
