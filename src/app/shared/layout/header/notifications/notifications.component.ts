import { Component, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy, ChangeDetectorRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { trigger, state, style, transition, animate, keyframes } from '@angular/animations';
import { Subject, takeUntil, interval, BehaviorSubject, Observable, of, timer } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap, tap, finalize } from 'rxjs/operators';

import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NotificationViewDialog } from './notification-view-dialog/notification-view-dialog';

import { CommonSvgIconComponent } from '../../common-svg-icon/common-svg-icon.component';
import { ClickOutsideDirective } from '../../../directives/click-outside.directive';
import { TokenStorageService } from '../../../../authentication/login/services/tokenstorage.service';
import { AuthServiceService } from '../../../../authentication/login/services/auth.service';
import { NotificationService } from './notificationsservice';

// Interfaces
export interface Notification {
  id: string;
  message: string;
  date: string;
  read: boolean;
  type?: 'ticket' | 'system' | 'user' | 'payment';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tickets?: {
    id: string;
    user?: {
      username: string;
      accountType: string;
      avatar?: string;
    };
  };
  user?: {
    username: string;
    accountType: string;
    avatar?: string;
  };
  metadata?: {
    [key: string]: any;
  };
}

export interface NotificationState {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
  unreadCount: number;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    MatDialogModule,
    CommonSvgIconComponent,
    ClickOutsideDirective
  ],
  animations: [
    trigger('slideInOut', [
      state('void', style({
        opacity: 0,
        transform: 'translateY(-20px) scale(0.95)',
        transformOrigin: 'top right'
      })),
      state('*', style({
        opacity: 1,
        transform: 'translateY(0) scale(1)',
        transformOrigin: 'top right'
      })),
      transition('void => *', [
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)')
      ]),
      transition('* => void', [
        animate('200ms cubic-bezier(0.4, 0, 0.2, 1)')
      ])
    ]),
    trigger('fadeInOut', [
      state('void', style({ opacity: 0 })),
      state('*', style({ opacity: 1 })),
      transition('void => *', animate('200ms ease-in')),
      transition('* => void', animate('150ms ease-out'))
    ]),
    trigger('badgePulse', [
      state('*', style({ transform: 'scale(1)' })),
      transition('* => *', [
        animate('600ms ease-in-out', keyframes([
          style({ transform: 'scale(1)', offset: 0 }),
          style({ transform: 'scale(1.2)', offset: 0.5 }),
          style({ transform: 'scale(1)', offset: 1 })
        ]))
      ])
    ]),
    trigger('itemSlide', [
      state('void', style({
        opacity: 0,
        transform: 'translateX(-20px)'
      })),
      state('*', style({
        opacity: 1,
        transform: 'translateX(0)'
      })),
      transition('void => *', [
        animate('250ms cubic-bezier(0.4, 0, 0.2, 1)')
      ])
    ])
  ]
})
export class NotificationsComponent implements OnInit, OnDestroy {
  // Signals for reactive state management
  private notificationState = signal<NotificationState>({
    notifications: [],
    loading: false,
    error: null,
    lastFetch: null,
    unreadCount: 0
  });

  // Computed values
  public notifications = computed(() => this.notificationState().notifications);
  public loading = computed(() => this.notificationState().loading);
  public error = computed(() => this.notificationState().error);
  public unreadCount = computed(() => this.notificationState().unreadCount);
  public latestThree = computed(() => this.notifications().slice(0, 3));

  // Component state
  public isShow = signal(false);
  public activeMenuId = signal<string | null>(null);

  // Configuration
  private readonly REFRESH_INTERVAL = 30000; // 30 seconds
  private readonly MAX_NOTIFICATIONS = 50;
  private readonly RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 2000;

  // Subjects for cleanup
  private destroy$ = new Subject<void>();
  private refreshTrigger$ = new BehaviorSubject<void>(undefined);

  constructor(
    private dialog: MatDialog,
    private notificationService: NotificationService,
    private tokenService: TokenStorageService,
    private authService: AuthServiceService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeNotifications();
    this.setupAutoRefresh();
    this.setupKeyboardShortcuts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Event Listeners
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const notificationElement = target.closest('.notification-container');
    
    if (!notificationElement && this.isShow()) {
      this.closeDropdown();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.isShow()) {
      this.closeDropdown();
      event.preventDefault();
    }
  }

  @HostListener('document:keydown.n', ['$event'])
  onNotificationShortcut(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey) {
      this.toggleShow();
      event.preventDefault();
    }
  }

  // Public Methods
  toggleShow(): void {
    const currentState = this.isShow();
    this.isShow.set(!currentState);
    
    if (!currentState && this.notifications().length === 0) {
      this.fetchNotifications();
    }

    // Close any open menus
    this.activeMenuId.set(null);
  }

  closeDropdown(): void {
    this.isShow.set(false);
    this.activeMenuId.set(null);
  }

  fetchNotifications(silent: boolean = false): void {
    const token = this.tokenService.getToken();
    
    if (!token) {
      this.updateState({ error: 'Authentication required', loading: false });
      return;
    }

    if (!silent) {
      this.updateState({ loading: true, error: null });
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    this.notificationService.getAllNotifications(headers)
      .pipe(
        tap(() => {
          if (!silent) {
            this.updateState({ loading: true });
          }
        }),
        catchError((error: HttpErrorResponse) => {
          const errorMessage = this.getErrorMessage(error);
          this.updateState({ 
            error: errorMessage, 
            loading: false 
          });
          return of({ responseData: [], success: false });
        }),
        finalize(() => {
          if (!silent) {
            this.updateState({ loading: false });
          }
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          if (response.success !== false) {
            this.processNotifications(response.responseData || []);
          }
        }
      });
  }

  markAsRead(notification: Notification): void {
    const updatedNotifications = this.notifications().map(n => 
      n.id === notification.id ? { ...n, read: !n.read } : n
    );
    
    const unreadCount = updatedNotifications.filter(n => !n.read).length;
    
    this.updateState({
      notifications: updatedNotifications,
      unreadCount
    });

    // Call API to update read status
    this.notificationService.markNotificationAsRead(notification.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (error) => {
          console.error('Failed to update read status:', error);
          // Revert the change on error
          this.fetchNotifications(true);
        }
      });
  }

  markAllAsRead(): void {
    const updatedNotifications = this.notifications().map(n => ({ ...n, read: true }));
    
    this.updateState({
      notifications: updatedNotifications,
      unreadCount: 0
    });

    this.notificationService.markAllNotificationsAsRead()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (error) => {
          console.error('Failed to mark all as read:', error);
          this.fetchNotifications(true);
        }
      });
  }

  deleteNotification(notification: Notification): void {
    const updatedNotifications = this.notifications().filter(n => n.id !== notification.id);
    const unreadCount = updatedNotifications.filter(n => !n.read).length;
    
    this.updateState({
      notifications: updatedNotifications,
      unreadCount
    });

    this.notificationService.deleteNotification(notification.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (error) => {
          console.error('Failed to delete notification:', error);
          this.fetchNotifications(true);
        }
      });

    this.activeMenuId.set(null);
  }

  toggleNotificationMenu(notificationId: string, event: Event): void {
    event.stopPropagation();
    const currentId = this.activeMenuId();
    this.activeMenuId.set(currentId === notificationId ? null : notificationId);
  }

  openNotificationDialog(notification: Notification): void {
    // Mark as read when opened
    if (!notification.read) {
      this.markAsRead(notification);
    }

    const dialogRef = this.dialog.open(NotificationViewDialog, {
      width: '500px',
      maxWidth: '90vw',
      data: notification,
      panelClass: 'notification-dialog',
      autoFocus: false,
      restoreFocus: false,
      disableClose: false
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
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

    this.authService.currentUser
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        const agentId = user?.id;
        
        if (!agentId) {
          console.error('No agent ID found');
          return;
        }

        const payload = {
          id: ticketId,
          assignedAgent: { id: agentId }
        };

        this.notificationService.allocateTicketToAgent(payload)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              console.log('Ticket allocated successfully');
              this.fetchNotifications(true);
            },
            error: (error) => {
              console.error('Failed to allocate ticket:', error);
            }
          });
      });
  }

  // Utility Methods
  getMessage(data: string): string {
    if (!data) return 'No message';
    const cleanMessage = data.split("{")[0].trim();
    return cleanMessage || data;
  }

  getNotificationSender(notification: Notification): string {
    return notification.tickets?.user?.username || 
           notification.user?.username || 
           notification.tickets?.user?.accountType || 
           notification.user?.accountType || 
           'System';
  }

  getNotificationAvatar(notification: Notification): string {
    return notification.tickets?.user?.avatar ||
           notification.user?.avatar ||
           'assets/images/logo/notification-logo.jpg';
  }

  getRelativeTime(dateString: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  }

  isTicketNotification(message: string): boolean {
    return message?.toLowerCase().includes('new ticket') || 
           message?.toLowerCase().includes('ticket');
  }

  hasUnreadNotifications(): boolean {
    return this.unreadCount() > 0;
  }

  trackByNotification(index: number, notification: Notification): string {
    return notification.id;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/logo/notification-logo.jpg';
  }

  // Private Methods
  private initializeNotifications(): void {
    this.fetchNotifications();
  }

  private setupAutoRefresh(): void {
    interval(this.REFRESH_INTERVAL)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => {
          // Only refresh if dropdown is closed to avoid disrupting user interaction
          return this.isShow() ? of(null) : of(true);
        }),
        tap((shouldRefresh) => {
          if (shouldRefresh) {
            this.fetchNotifications(true);
          }
        })
      )
      .subscribe();
  }

  private setupKeyboardShortcuts(): void {
    // Additional keyboard shortcuts can be added here
  }

  private processNotifications(data: any[]): void {
    try {
      const processedNotifications = data
        .map(notification => ({
          ...notification,
          id: notification.id || this.generateId(),
          read: notification.read || false,
          type: this.determineNotificationType(notification),
          priority: this.determineNotificationPriority(notification)
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, this.MAX_NOTIFICATIONS);

      const unreadCount = processedNotifications.filter(n => !n.read).length;

      this.updateState({
        notifications: processedNotifications,
        unreadCount,
        lastFetch: new Date(),
        error: null,
        loading: false
      });

    } catch (error) {
      console.error('Error processing notifications:', error);
      this.updateState({
        error: 'Failed to process notifications',
        loading: false
      });
    }
  }

  private updateState(partialState: Partial<NotificationState>): void {
    const currentState = this.notificationState();
    this.notificationState.set({
      ...currentState,
      ...partialState
    });
    this.cdr.markForCheck();
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 401) return 'Session expired. Please login again.';
    if (error.status === 403) return 'Access denied';
    if (error.status === 0) return 'Network error. Please check your connection.';
    if (error.status >= 500) return 'Server error. Please try again later.';
    return 'Failed to load notifications';
  }

  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineNotificationType(notification: any): Notification['type'] {
    const message = notification.message?.toLowerCase() || '';
    if (message.includes('ticket')) return 'ticket';
    if (message.includes('payment')) return 'payment';
    if (message.includes('user')) return 'user';
    return 'system';
  }

  private determineNotificationPriority(notification: any): Notification['priority'] {
    const message = notification.message?.toLowerCase() || '';
    if (message.includes('urgent') || message.includes('critical')) return 'urgent';
    if (message.includes('important') || message.includes('ticket')) return 'high';
    if (message.includes('reminder')) return 'medium';
    return 'low';
  }
}