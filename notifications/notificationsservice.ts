import { Injectable } from '@angular/core';

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private baseUrl = 'https://dev.ganittax.com/api/';

  constructor(private http: HttpClient) {}

  getAllNotifications(headers?: HttpHeaders): Observable<any> {
    return this.http.get(`${this.baseUrl}notification/all`,{headers});
  }
  allocateTicketToAgent(payload: any): Observable<any> {
  const url = `${this.baseUrl}tickets/update-agent`; // replace with actual API endpoint
  return this.http.post(url, payload);   // POST the object
}

}
