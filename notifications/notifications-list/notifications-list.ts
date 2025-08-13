import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NotificationListService } from './notificationslistservice';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-notifications-list',
  imports:[CommonModule,  MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
  ReactiveFormsModule],
  templateUrl: './notifications-list.html'
})
export class NotificationsList implements OnInit, AfterViewInit {
  displayedColumns: string[] = ['sno', 'from', 'message', 'action'];
  dataSource = new MatTableDataSource<any>();
  loading = false;
  error = '';
  searchControl = new FormControl('');
  dateControl = new FormControl('');

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(private notificationService: NotificationListService) {}

  ngOnInit(): void {
    this.fetchNotifications();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  fetchNotifications(): void {
    this.loading = true;
    this.notificationService.getAllNotifications().subscribe({
      next: (res) => {
        const data = res.responseData || [];
        this.dataSource.data = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load notifications';
        this.loading = false;
      }
    });
  }

  applyFilter(): void {
  const search = this.searchControl.value?.trim().toLowerCase() || '';
  const date = this.dateControl.value
    ? new Date(this.dateControl.value).toDateString()
    : '';

  const filterValue = JSON.stringify({ search, date });

  this.dataSource.filterPredicate = (data: any, filter: string) => {
    const { search, date } = JSON.parse(filter);

    const messageMatch =
      data.message?.toLowerCase().includes(search) ||
      data.tickets?.user?.username?.toLowerCase().includes(search);

    const dateMatch = date
      ? new Date(data.date).toDateString() === date
      : true;

    return messageMatch && dateMatch;
  };

  this.dataSource.filter = filterValue;
}

  toggleReadStatus(note: any): void {
    note.read = !note.read;
    // You can call backend API here
  }
}
