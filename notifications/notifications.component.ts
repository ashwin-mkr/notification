import { Component, OnInit, inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NotificationViewDialog } from './notification-view-dialog/notification-view-dialog';

import { CommonSvgIconComponent } from '../../common-svg-icon/common-svg-icon.component';

import { TokenStorageService } from '../../../../authentication/login/services/tokenstorage.service';
import { AuthServiceService } from '../../../../authentication/login/services/auth.service';
import { NotificationService } from './notificationsservice';


@Component({
  selector: 'app-notifications',
  standalone: true,
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  imports: [
    CommonModule,
    RouterModule,
    MatDialogModule, // ✅ Required for dialog to work
    CommonSvgIconComponent
  ]
})
export class NotificationsComponent implements OnInit {

  public isShow: boolean = false;
  public notifications: any[] = [];
  public latestThree: any[] = [];
  public loading: boolean = true;
  public error: string | null = null;

  expandedMap: { [id: string]: boolean } = {};

  constructor(
    private dialog: MatDialog,
    private notificationService: NotificationService,
    private tokenService: TokenStorageService,
    private authService: AuthServiceService
  ) { }

  ngOnInit(): void {
    this.fetchNotifications();
  }

  toggleShow(): void {
    this.isShow = !this.isShow;
  }

  fetchNotifications(): void {
    const token = this.tokenService.getToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    this.loading = true;

    this.notificationService.getAllNotifications().subscribe({
      next: (res) => {
        const all = Array.isArray(res.responseData) ? res.responseData : [];

        this.notifications = all.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        this.latestThree = this.notifications.slice(0, 3);
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load notifications';
        this.loading = false;
        console.error('Notification fetch error:', err);
      }
    });
  }

  getMessage(data: string): string {
    return data?.split("{")[0] || '';
  }

  openNotificationDialog(notification: any) {
    const dialogRef = this.dialog.open(NotificationViewDialog, {
      width: '500px',
      data: notification,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'accept' && notification.message?.toLowerCase().includes('new ticket')) {
        this.acceptTicket(notification.tickets?.id);
      }
    });
  }


  acceptTicket(ticketId: string) {
    this.authService.currentUser.subscribe((user) => {
      const agentId = user?.id;
      console.log('agent',agentId)
      console.log('ticket',ticketId)
      if (!agentId || !ticketId) return;

      const payload = {
        id: ticketId, 
        assignedAgent: {
          id: agentId 
        }
      };

      this.notificationService.allocateTicketToAgent(payload).subscribe({
        next: () => {
          console.log('Ticket allocated successfully to agent.');
          // Optional: Refresh the list so the UI updates
          this.fetchNotifications();
        },
        error: (err) => {
          console.error('Failed to allocate ticket:', err);
        }
      });
    });
  }
  getIcon(type: string): string {
    switch (type) {
      case 'profile': return 'assets/icons/profile.png';
      case 'questionnaire': return 'assets/icons/questionnaire.png';
      default: return 'assets/icons/default.png';
    }
  }
}
