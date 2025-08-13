import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of, timer } from 'rxjs';
import { catchError, retry, tap, map, switchMap, shareReplay, timeout } from 'rxjs/operators';

// Interfaces
export interface NotificationResponse {
  responseData: any[];
  success: boolean;
  message?: string;
  totalCount?: number;
  unreadCount?: number;
}

export interface TicketAllocationPayload {
  id: string;
  assignedAgent: {
    id: string;
  };
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  notificationTypes: {
    tickets: boolean;
    payments: boolean;
    system: boolean;
    user: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
}

export interface NotificationFilter {
  type?: string;
  read?: boolean;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly baseUrl = 'https://dev.ganittax.com/api/';
  private readonly timeout = 10000; // 10 seconds
  private readonly maxRetries = 3;

  // State management
  private notificationCountSubject = new BehaviorSubject<number>(0);
  private notificationCacheSubject = new BehaviorSubject<any[]>([]);
  private lastFetchTime = 0;
  private readonly cacheTimeout = 30000; // 30 seconds

  // Public observables
  public notificationCount$ = this.notificationCountSubject.asObservable();
  public notificationCache$ = this.notificationCacheSubject.asObservable();

  constructor(private http: HttpClient) {
    this.initializeService();
  }

  /**
   * Get all notifications for the current user
   */
  getAllNotifications(headers?: HttpHeaders, filter?: NotificationFilter): Observable<NotificationResponse> {
    const httpOptions = {
      headers: headers || this.getDefaultHeaders(),
      params: this.buildQueryParams(filter)
    };

    // Check cache first
    if (this.shouldUseCache() && !filter) {
      const cachedData = this.notificationCacheSubject.value;
      if (cachedData.length > 0) {
        return of({
          responseData: cachedData,
          success: true,
          unreadCount: cachedData.filter(n => !n.read).length
        });
      }
    }

    return this.http.get<NotificationResponse>(`${this.baseUrl}notification/all`, httpOptions)
      .pipe(
        timeout(this.timeout),
        retry({
          count: this.maxRetries,
          delay: (error, retryCount) => timer(retryCount * 1000)
        }),
        tap((response) => {
          if (response.success !== false && response.responseData) {
            // Update cache
            this.notificationCacheSubject.next(response.responseData);
            this.lastFetchTime = Date.now();

            // Update notification count
            const unreadCount = response.unreadCount || 
              response.responseData.filter(n => !n.read).length;
            this.notificationCountSubject.next(unreadCount);
          }
        }),
        catchError(this.handleError),
        shareReplay(1)
      );
  }

  /**
   * Get notifications with real-time updates
   */
  getNotificationsWithUpdates(filter?: NotificationFilter): Observable<NotificationResponse> {
    return timer(0, 30000).pipe(
      switchMap(() => this.getAllNotifications(undefined, filter)),
      shareReplay(1)
    );
  }

  /**
   * Get a single notification by ID
   */
  getNotificationById(id: string): Observable<any> {
    const httpOptions = {
      headers: this.getDefaultHeaders()
    };

    return this.http.get(`${this.baseUrl}notification/${id}`, httpOptions)
      .pipe(
        timeout(this.timeout),
        catchError(this.handleError)
      );
  }

  /**
   * Mark a notification as read
   */
  markNotificationAsRead(notificationId: string): Observable<any> {
    const httpOptions = {
      headers: this.getDefaultHeaders()
    };

    return this.http.patch(`${this.baseUrl}notification/${notificationId}/read`, {}, httpOptions)
      .pipe(
        timeout(this.timeout),
        tap(() => {
          // Update local cache
          this.updateNotificationInCache(notificationId, { read: true });
          this.decrementUnreadCount();
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Mark a notification as unread
   */
  markNotificationAsUnread(notificationId: string): Observable<any> {
    const httpOptions = {
      headers: this.getDefaultHeaders()
    };

    return this.http.patch(`${this.baseUrl}notification/${notificationId}/unread`, {}, httpOptions)
      .pipe(
        timeout(this.timeout),
        tap(() => {
          // Update local cache
          this.updateNotificationInCache(notificationId, { read: false });
          this.incrementUnreadCount();
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Mark all notifications as read
   */
  markAllNotificationsAsRead(): Observable<any> {
    const httpOptions = {
      headers: this.getDefaultHeaders()
    };

    return this.http.patch(`${this.baseUrl}notification/mark-all-read`, {}, httpOptions)
      .pipe(
        timeout(this.timeout),
        tap(() => {
          // Update local cache
          const updatedCache = this.notificationCacheSubject.value.map(n => ({ ...n, read: true }));
          this.notificationCacheSubject.next(updatedCache);
          this.notificationCountSubject.next(0);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Delete a notification
   */
  deleteNotification(notificationId: string): Observable<any> {
    const httpOptions = {
      headers: this.getDefaultHeaders()
    };

    return this.http.delete(`${this.baseUrl}notification/${notificationId}`, httpOptions)
      .pipe(
        timeout(this.timeout),
        tap(() => {
          // Update local cache
          const currentCache = this.notificationCacheSubject.value;
          const notificationToDelete = currentCache.find(n => n.id === notificationId);
          const updatedCache = currentCache.filter(n => n.id !== notificationId);
          
          this.notificationCacheSubject.next(updatedCache);
          
          // Update unread count if deleted notification was unread
          if (notificationToDelete && !notificationToDelete.read) {
            this.decrementUnreadCount();
          }
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Delete multiple notifications
   */
  deleteMultipleNotifications(notificationIds: string[]): Observable<any> {
    const httpOptions = {
      headers: this.getDefaultHeaders()
    };

    const payload = { notificationIds };

    return this.http.post(`${this.baseUrl}notification/delete-multiple`, payload, httpOptions)
      .pipe(
        timeout(this.timeout),
        tap(() => {
          // Update local cache
          const currentCache = this.notificationCacheSubject.value;
          const deletedNotifications = currentCache.filter(n => notificationIds.includes(n.id));
          const updatedCache = currentCache.filter(n => !notificationIds.includes(n.id));
          
          this.notificationCacheSubject.next(updatedCache);
          
          // Update unread count
          const deletedUnreadCount = deletedNotifications.filter(n => !n.read).length;
          const currentUnreadCount = this.notificationCountSubject.value;
          this.notificationCountSubject.next(Math.max(0, currentUnreadCount - deletedUnreadCount));
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Allocate a ticket to an agent
   */
  allocateTicketToAgent(payload: TicketAllocationPayload): Observable<any> {
    const httpOptions = {
      headers: this.getDefaultHeaders()
    };

    return this.http.post(`${this.baseUrl}tickets/update-agent`, payload, httpOptions)
      .pipe(
        timeout(this.timeout),
        retry(2),
        catchError(this.handleError)
      );
  }

  /**
   * Get notification preferences
   */
  getNotificationPreferences(): Observable<NotificationPreferences> {
    const httpOptions = {
      headers: this.getDefaultHeaders()
    };

    return this.http.get<NotificationPreferences>(`${this.baseUrl}notification/preferences`, httpOptions)
      .pipe(
        timeout(this.timeout),
        catchError(this.handleError)
      );
  }

  /**
   * Update notification preferences
   */
  updateNotificationPreferences(preferences: Partial<NotificationPreferences>): Observable<any> {
    const httpOptions = {
      headers: this.getDefaultHeaders()
    };

    return this.http.put(`${this.baseUrl}notification/preferences`, preferences, httpOptions)
      .pipe(
        timeout(this.timeout),
        catchError(this.handleError)
      );
  }

  /**
   * Get notification statistics
   */
  getNotificationStats(): Observable<any> {
    const httpOptions = {
      headers: this.getDefaultHeaders()
    };

    return this.http.get(`${this.baseUrl}notification/stats`, httpOptions)
      .pipe(
        timeout(this.timeout),
        catchError(this.handleError)
      );
  }

  /**
   * Search notifications
   */
  searchNotifications(query: string, filter?: NotificationFilter): Observable<NotificationResponse> {
    const httpOptions = {
      headers: this.getDefaultHeaders(),
      params: this.buildQueryParams({ ...filter, search: query })
    };

    return this.http.get<NotificationResponse>(`${this.baseUrl}notification/search`, httpOptions)
      .pipe(
        timeout(this.timeout),
        catchError(this.handleError)
      );
  }

  /**
   * Subscribe to real-time notifications (WebSocket)
   */
  subscribeToRealTimeNotifications(): Observable<any> {
    // This would typically use WebSocket or Server-Sent Events
    // For now, we'll use polling as a fallback
    return timer(0, 10000).pipe(
      switchMap(() => this.getAllNotifications()),
      map(response => response.responseData),
      shareReplay(1)
    );
  }

  /**
   * Get current notification count
   */
  getCurrentNotificationCount(): number {
    return this.notificationCountSubject.value;
  }

  /**
   * Update notification count manually
   */
  updateNotificationCount(count: number): void {
    this.notificationCountSubject.next(Math.max(0, count));
  }

  /**
   * Clear notification cache
   */
  clearCache(): void {
    this.notificationCacheSubject.next([]);
    this.lastFetchTime = 0;
  }

  /**
   * Refresh notifications (force fetch)
   */
  refreshNotifications(): Observable<NotificationResponse> {
    this.clearCache();
    return this.getAllNotifications();
  }

  // Private Methods
  private initializeService(): void {
    // Initialize any required setup
    this.loadInitialNotificationCount();
  }

  private loadInitialNotificationCount(): void {
    // Try to load from localStorage or make initial API call
    const savedCount = localStorage.getItem('notificationCount');
    if (savedCount) {
      this.notificationCountSubject.next(parseInt(savedCount, 10));
    }
  }

  private shouldUseCache(): boolean {
    const now = Date.now();
    return (now - this.lastFetchTime) < this.cacheTimeout;
  }

  private updateNotificationInCache(id: string, updates: Partial<any>): void {
    const currentCache = this.notificationCacheSubject.value;
    const updatedCache = currentCache.map(notification =>
      notification.id === id ? { ...notification, ...updates } : notification
    );
    this.notificationCacheSubject.next(updatedCache);
  }

  private incrementUnreadCount(): void {
    const currentCount = this.notificationCountSubject.value;
    this.notificationCountSubject.next(currentCount + 1);
  }

  private decrementUnreadCount(): void {
    const currentCount = this.notificationCountSubject.value;
    this.notificationCountSubject.next(Math.max(0, currentCount - 1));
  }

  private buildQueryParams(filter?: NotificationFilter & { search?: string }): HttpParams {
    let params = new HttpParams();

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, value.toString());
        }
      });
    }

    return params;
  }

  private getDefaultHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    });
  }

  private getAuthToken(): string {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'An unknown error occurred';
    let errorCode = 'UNKNOWN_ERROR';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
      errorCode = 'CLIENT_ERROR';
    } else {
      // Server-side error
      switch (error.status) {
        case 400:
          errorMessage = 'Bad Request: Please check your input';
          errorCode = 'BAD_REQUEST';
          break;
        case 401:
          errorMessage = 'Unauthorized: Please login again';
          errorCode = 'UNAUTHORIZED';
          // Clear auth token on 401
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          break;
        case 403:
          errorMessage = 'Forbidden: You do not have permission';
          errorCode = 'FORBIDDEN';
          break;
        case 404:
          errorMessage = 'Not Found: The requested resource was not found';
          errorCode = 'NOT_FOUND';
          break;
        case 408:
          errorMessage = 'Request Timeout: The request took too long';
          errorCode = 'TIMEOUT';
          break;
        case 429:
          errorMessage = 'Too Many Requests: Please slow down';
          errorCode = 'RATE_LIMIT';
          break;
        case 500:
          errorMessage = 'Internal Server Error: Please try again later';
          errorCode = 'SERVER_ERROR';
          break;
        case 502:
          errorMessage = 'Bad Gateway: Server is temporarily unavailable';
          errorCode = 'BAD_GATEWAY';
          break;
        case 503:
          errorMessage = 'Service Unavailable: Please try again later';
          errorCode = 'SERVICE_UNAVAILABLE';
          break;
        case 504:
          errorMessage = 'Gateway Timeout: The server took too long to respond';
          errorCode = 'GATEWAY_TIMEOUT';
          break;
        default:
          errorMessage = `Server Error: ${error.status} - ${error.message}`;
          errorCode = `HTTP_${error.status}`;
      }
    }

    // Log error for debugging
    console.error('NotificationService Error:', {
      message: errorMessage,
      code: errorCode,
      status: error.status,
      url: error.url,
      timestamp: new Date().toISOString()
    });

    // Return user-friendly error
    return throwError(() => ({
      message: errorMessage,
      code: errorCode,
      status: error.status,
      originalError: error
    }));
  };
}