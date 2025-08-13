import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationListService {
  constructor(private http: HttpClient) {}

  getAllNotifications(): Observable<any> {
    const token = localStorage.getItem('token'); // or use a TokenService
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    return this.http.get<any>('https://dev.ganittax.com/api/notification/all', { headers });
  }
  

}
