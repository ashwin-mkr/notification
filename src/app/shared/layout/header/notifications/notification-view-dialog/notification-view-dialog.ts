import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

interface NotificationData {
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

interface MetadataItem {
  key: string;
  value: string;
}

@Component({
  selector: 'notification-view-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    DatePipe
  ],
  templateUrl: './notification-view-dialog.html',
  styleUrls: ['./notification-view-dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationViewDialog implements OnInit {
  public isAccepting = false;
  public isTicketAccepted = false;

  constructor(
    public dialogRef: MatDialogRef<NotificationViewDialog>,
    @Inject(MAT_DIALOG_DATA) public data: NotificationData
  ) {}

  ngOnInit(): void {
    // Initialize component state
    this.validateData();
  }

  // Public Methods
  accept(): void {
    if (this.isAccepting || this.isTicketAccepted) {
      return;
    }

    this.isAccepting = true;
    
    // Simulate API call delay
    setTimeout(() => {
      this.isAccepting = false;
      this.isTicketAccepted = true;
      this.dialogRef.close('accept');
    }, 1500);
  }

  toggleReadStatus(): void {
    this.data.read = !this.data.read;
    // The parent component will handle the actual API call
  }

  isTicketNotification(message: string): boolean {
    if (!message) return false;
    const lowerMessage = message.toLowerCase();
    return lowerMessage.includes('new ticket') || 
           lowerMessage.includes('ticket') ||
           lowerMessage.includes('support request');
  }

  // Utility Methods
  formatDate(dateString: string): string {
    if (!dateString) return 'Unknown date';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  }

  getRelativeTime(dateString: string): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
      
      return 'More than a week ago';
    } catch (error) {
      console.error('Error calculating relative time:', error);
      return '';
    }
  }

  getSenderName(): string {
    return this.data.tickets?.user?.username || 
           this.data.user?.username || 
           'System';
  }

  getSenderType(): string {
    return this.data.tickets?.user?.accountType || 
           this.data.user?.accountType || 
           '';
  }

  getSenderAvatar(): string {
    return this.data.tickets?.user?.avatar ||
           this.data.user?.avatar ||
           'assets/images/logo/notification-logo.jpg';
  }

  getMetadataItems(): MetadataItem[] {
    if (!this.data.metadata) return [];
    
    return Object.entries(this.data.metadata).map(([key, value]) => ({
      key: this.formatMetadataKey(key),
      value: this.formatMetadataValue(value)
    }));
  }

  getTypeLabel(type: string): string {
    const typeLabels: { [key: string]: string } = {
      'ticket': 'Support Ticket',
      'system': 'System Notification',
      'user': 'User Activity',
      'payment': 'Payment Related'
    };
    return typeLabels[type] || type;
  }

  getTypeIcon(type: string): string {
    const typeIcons: { [key: string]: string } = {
      'ticket': 'fas fa-ticket-alt',
      'system': 'fas fa-cog',
      'user': 'fas fa-user',
      'payment': 'fas fa-credit-card'
    };
    return typeIcons[type] || 'fas fa-bell';
  }

  getPriorityLabel(priority: string): string {
    const priorityLabels: { [key: string]: string } = {
      'low': 'Low Priority',
      'medium': 'Medium Priority',
      'high': 'High Priority',
      'urgent': 'Urgent'
    };
    return priorityLabels[priority] || priority;
  }

  getPriorityIcon(priority: string): string {
    const priorityIcons: { [key: string]: string } = {
      'low': 'fas fa-arrow-down',
      'medium': 'fas fa-minus',
      'high': 'fas fa-arrow-up',
      'urgent': 'fas fa-exclamation-triangle'
    };
    return priorityIcons[priority] || 'fas fa-info-circle';
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/logo/notification-logo.jpg';
  }

  // Private Methods
  private validateData(): void {
    if (!this.data) {
      console.error('No notification data provided to dialog');
      this.dialogRef.close();
      return;
    }

    // Ensure required fields have default values
    this.data.id = this.data.id || this.generateId();
    this.data.message = this.data.message || 'No message content';
    this.data.date = this.data.date || new Date().toISOString();
    this.data.read = this.data.read ?? false;
  }

  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatMetadataKey(key: string): string {
    // Convert camelCase or snake_case to Title Case
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private formatMetadataValue(value: any): string {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    return String(value);
  }
}