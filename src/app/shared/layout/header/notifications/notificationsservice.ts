import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, retry, tap } from 'rxjs/operators';

export interface NotificationResponse {
  responseData: any[];
  success: boolean;
  message?: string;
}

export interface TicketAllocationPayload {
  id: string;
  assignedAgent: {
    id: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private baseUrl = 'https://dev.ganittax.com/api/';
  private notificationCountSubject = new BehaviorSubject<number>(0);
  
  // Observable for components to subscribe to notification count changes
  public notificationCount$ = this.notificationCountSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get all notifications for the current user
   */
  getAllNotifications(headers?: HttpHeaders): Observable<NotificationResponse> {
    const httpOptions = {
      headers: headers || this.getDefaultHeaders()
    };

    return this.http.get<NotificationResponse>(`${this.baseUrl}notification/all`, httpOptions)
      .pipe(
        retry(2), // Retry failed requests up to 2 times
        tap((response) => {
          // Update notification count
          if (response.responseData && Array.isArray(response.responseData)) {
            const unreadCount = response.responseData.filter(n => !n.read).length;
            this.notificationCountSubject.next(unreadCount);
          }
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Allocate a ticket to an agent
   */
  allocateTicketToAgent(payload: TicketAllocationPayload): Observable<any> {
    const url = `${this.baseUrl}tickets/update-agent`;
    const httpOptions = {
      headers: this.getDefaultHeaders()
    };

    return this.http.post(url, payload, httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Mark a notification as read
   */
  markNotificationAsRead(notificationId: string): Observable<any> {
    const url = `${this.baseUrl}notification/${notificationId}/read`;
    const httpOptions = {
      headers: this.getDefaultHeaders()
    };

    return this.http.patch(url, {}, httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Mark all notifications as read
   */
  markAllNotificationsAsRead(): Observable<any> {
    const url = `${this.baseUrl}notification/mark-all-read`;
    const httpOptions = {
      headers: this.getDefaultHeaders()
    };

    return this.http.patch(url, {}, httpOptions)
      .pipe(
        tap(() => {
          // Reset notification count to 0
          this.notificationCountSubject.next(0);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Delete a notification
   */
  deleteNotification(notificationId: string): Observable<any> {
    const url = `${this.baseUrl}notification/${notificationId}`;
    const httpOptions = {
      headers: this.getDefaultHeaders()
    };

    return this.http.delete(url, httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Get notification preferences
   */
  getNotificationPreferences(): Observable<any> {
    const url = `${this.baseUrl}notification/preferences`;
    const httpOptions = {
      headers: this.getDefaultHeaders()
    };

    return this.http.get(url, httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Update notification preferences
   */
  updateNotificationPreferences(preferences: any): Observable<any> {
    const url = `${this.baseUrl}notification/preferences`;
    const httpOptions = {
      headers: this.getDefaultHeaders()
    };

    return this.http.put(url, preferences, httpOptions)
      .pipe(
        catchError(this.handleError)
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
    this.notificationCountSubject.next(count);
  }

  /**
   * Get default headers with authentication
   */
  private getDefaultHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  /**
   * Handle HTTP errors
   */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      switch (error.status) {
        case 400:
          errorMessage = 'Bad Request: Please check your input';
          break;
        case 401:
          errorMessage = 'Unauthorized: Please login again';
          break;
        case 403:
          errorMessage = 'Forbidden: You do not have permission';
          break;
        case 404:
          errorMessage = 'Not Found: The requested resource was not found';
          break;
        case 500:
          errorMessage = 'Internal Server Error: Please try again later';
          break;
        case 503:
          errorMessage = 'Service Unavailable: Please try again later';
          break;
        default:
          errorMessage = `Server Error: ${error.status} - ${error.message}`;
      }
    }

    console.error('NotificationService Error:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  };
}