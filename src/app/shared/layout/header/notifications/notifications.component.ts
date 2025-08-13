import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Subject, takeUntil, interval } from 'rxjs';

import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NotificationViewDialog } from './notification-view-dialog/notification-view-dialog';

import { CommonSvgIconComponent } from '../../common-svg-icon/common-svg-icon.component';
import { TokenStorageService } from '../../../../authentication/login/services/tokenstorage.service';
import { AuthServiceService } from '../../../../authentication/login/services/auth.service';
import { NotificationService } from './notificationsservice';

interface Notification {
  id: string;
  message: string;
  date: string;
  read: boolean;
  tickets?: {
    id: string;
    user?: {
      username: string;
      accountType: string;
    };
  };
  user?: {
    username: string;
    accountType: string;
  };
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  imports: [
    CommonModule,
    RouterModule,
    MatDialogModule,
    CommonSvgIconComponent
  ],
  animations: [
    trigger('slideInOut', [
      state('in', style({ opacity: 1, transform: 'translateY(0) scale(1)' })),
      transition('void => *', [
        style({ opacity: 0, transform: 'translateY(-10px) scale(0.95)' }),
        animate('200ms cubic-bezier(0.4, 0, 0.2, 1)')
      ]),
      transition('* => void', [
        animate('150ms cubic-bezier(0.4, 0, 0.2, 1)', 
          style({ opacity: 0, transform: 'translateY(-10px) scale(0.95)' }))
      ])
    ])
  ]
})
export class NotificationsComponent implements OnInit, OnDestroy {
  public isShow: boolean = false;
  public notifications: Notification[] = [];
  public latestThree: Notification[] = [];
  public loading: boolean = true;
  public error: string | null = null;

  private destroy$ = new Subject<void>();
  private refreshInterval = 30000; // 30 seconds

  constructor(
    private dialog: MatDialog,
    private notificationService: NotificationService,
    private tokenService: TokenStorageService,
    private authService: AuthServiceService
  ) {}

  ngOnInit(): void {
    this.fetchNotifications();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const notificationElement = target.closest('.notification-box, .notification-dropdown');
    
    if (!notificationElement && this.isShow) {
      this.closeDropdown();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.isShow) {
      this.closeDropdown();
    }
  }

  toggleShow(): void {
    this.isShow = !this.isShow;
    
    if (this.isShow && this.notifications.length === 0) {
      this.fetchNotifications();
    }
  }

  closeDropdown(): void {
    this.isShow = false;
  }

  startAutoRefresh(): void {
    interval(this.refreshInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.isShow) {
          this.fetchNotifications(true); // Silent refresh
        }
      });
  }

  fetchNotifications(silent: boolean = false): void {
    const token = this.tokenService.getToken();
    
    if (!token) {
      this.error = 'Authentication required';
      this.loading = false;
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    if (!silent) {
      this.loading = true;
      this.error = null;
    }

    this.notificationService.getAllNotifications(headers).subscribe({
      next: (res) => {
        try {
          const all = Array.isArray(res.responseData) ? res.responseData : [];
          
          this.notifications = all
            .map(notification => ({
              ...notification,
              id: notification.id || this.generateId(),
              read: notification.read || false
            }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          this.latestThree = this.notifications.slice(0, 3);
          this.loading = false;
          this.error = null;
        } catch (err) {
          console.error('Error processing notifications:', err);
          this.error = 'Failed to process notifications';
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Notification fetch error:', err);
        this.error = this.getErrorMessage(err);
        this.loading = false;
      }
    });
  }

  private getErrorMessage(error: any): string {
    if (error.status === 401) {
      return 'Session expired. Please login again.';
    } else if (error.status === 403) {
      return 'Access denied';
    } else if (error.status === 0) {
      return 'Network error. Please check your connection.';
    } else {
      return 'Failed to load notifications';
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  getMessage(data: string): string {
    if (!data) return 'No message';
    return data.split("{")[0].trim() || data;
  }

  getNotificationSender(notification: Notification): string {
    return notification.tickets?.user?.username || 
           notification.user?.username || 
           notification.tickets?.user?.accountType || 
           notification.user?.accountType || 
           'System';
  }

  getNotificationAvatar(notification: Notification): string {
    // You can customize this based on notification type or user
    return 'assets/images/logo/notification-logo.jpg';
  }

  getRelativeTime(dateString: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  isTicketNotification(message: string): boolean {
    return message?.toLowerCase().includes('new ticket') || 
           message?.toLowerCase().includes('ticket');
  }

  hasUnreadNotifications(): boolean {
    return this.notifications.some(n => !n.read);
  }

  markAllAsRead(): void {
    this.notifications.forEach(notification => {
      notification.read = true;
    });
    this.latestThree = this.notifications.slice(0, 3);
    
    // Here you would typically call an API to mark notifications as read
    // this.notificationService.markAllAsRead().subscribe();
  }

  trackByNotification(index: number, notification: Notification): string {
    return notification.id;
  }

  openNotificationDialog(notification: Notification): void {
    // Mark as read when opened
    if (!notification.read) {
      notification.read = true;
      // Update the latestThree array
      this.latestThree = this.notifications.slice(0, 3);
    }

    const dialogRef = this.dialog.open(NotificationViewDialog, {
      width: '500px',
      maxWidth: '90vw',
      data: notification,
      panelClass: 'notification-dialog',
      autoFocus: false,
      restoreFocus: false
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'accept' && this.isTicketNotification(notification.message)) {
        this.acceptTicket(notification.tickets?.id);
      }
    });
  }

  acceptTicket(ticketId: string | undefined): void {
    if (!ticketId) {
      console.error('No ticket ID provided');
      return;
    }

    this.authService.currentUser.subscribe((user) => {
      const agentId = user?.id;
      
      if (!agentId) {
        console.error('No agent ID found');
        return;
      }

      const payload = {
        id: ticketId,
        assignedAgent: {
          id: agentId
        }
      };

      this.notificationService.allocateTicketToAgent(payload).subscribe({
        next: () => {
          console.log('Ticket allocated successfully to agent.');
          // Refresh notifications to reflect the change
          this.fetchNotifications();
        },
        error: (err) => {
          console.error('Failed to allocate ticket:', err);
        }
      });
    });
  }
}