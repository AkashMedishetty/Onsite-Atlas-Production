const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class NotificationService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/admin-notifications`;
  }

  // Helper method to get auth headers
  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // Helper method to handle API responses
  async handleResponse(response) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data || data; // Handle both wrapped and direct responses
  }

  // Get all notifications with pagination and filtering
  async getNotifications(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // Add pagination
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      
      // Add filters
      if (params.type) queryParams.append('type', params.type);
      if (typeof params.read === 'boolean') queryParams.append('read', params.read);
      if (params.priority) queryParams.append('priority', params.priority);
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.search) queryParams.append('search', params.search);

      const url = `${this.baseURL}?${queryParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
      throw error;
    }
  }

  // Get unread notification count
  async getUnreadCount() {
    try {
      const response = await fetch(`${this.baseURL}/unread-count`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return data.count || 0;
    } catch (error) {
      console.error('❌ Error fetching unread count:', error);
      throw error;
    }
  }

  // Mark a notification as read
  async markAsRead(notificationId) {
    try {
      const response = await fetch(`${this.baseURL}/${notificationId}/read`, {
        method: 'PUT',
        headers: this.getAuthHeaders()
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllAsRead() {
    try {
      const response = await fetch(`${this.baseURL}/mark-all-read`, {
        method: 'PUT',
        headers: this.getAuthHeaders()
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Delete a notification
  async deleteNotification(notificationId) {
    try {
      const response = await fetch(`${this.baseURL}/${notificationId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      throw error;
    }
  }

  // Delete multiple notifications
  async deleteMultiple(notificationIds) {
    try {
      const response = await fetch(`${this.baseURL}/bulk`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ ids: notificationIds })
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error deleting multiple notifications:', error);
      throw error;
    }
  }

  // Get notifications by type
  async getNotificationsByType(type, params = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);

      const url = `${this.baseURL}/type/${type}?${queryParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error fetching notifications by type:', error);
      throw error;
    }
  }

  // Get notification statistics
  async getStats(timeframe = '7d') {
    try {
      const response = await fetch(`${this.baseURL}/stats?timeframe=${timeframe}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error fetching notification stats:', error);
      throw error;
    }
  }

  // Create a test notification (development/testing)
  async createTestNotification(data = {}) {
    try {
      const payload = {
        title: data.title || 'Test Notification',
        message: data.message || 'This is a test notification to verify the system is working.',
        type: data.type || 'info',
        priority: data.priority || 'normal'
      };

      const response = await fetch(`${this.baseURL}/test`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error creating test notification:', error);
      throw error;
    }
  }

  // Update notification preferences
  async updatePreferences(preferences) {
    try {
      const response = await fetch(`${this.baseURL}/preferences`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(preferences)
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error updating notification preferences:', error);
      throw error;
    }
  }

  // Export notifications
  async exportNotifications(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (params.format) queryParams.append('format', params.format);
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.type) queryParams.append('type', params.type);

      const url = `${this.baseURL}/export?${queryParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (params.format === 'csv') {
        // For CSV, return the blob for download
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.blob();
      } else {
        return await this.handleResponse(response);
      }
    } catch (error) {
      console.error('❌ Error exporting notifications:', error);
      throw error;
    }
  }

  // Helper method to download exported data
  downloadExport(data, filename = 'notifications.csv') {
    const blob = new Blob([data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // Utility methods for notification types and priorities
  getNotificationTypes() {
    return [
      { value: 'registration', label: 'Registration', icon: '👥' },
      { value: 'payment', label: 'Payment', icon: '💳' },
      { value: 'abstract', label: 'Abstract', icon: '📄' },
      { value: 'alert', label: 'Alert', icon: '⚠️' },
      { value: 'success', label: 'Success', icon: '✅' },
      { value: 'info', label: 'Info', icon: 'ℹ️' },
      { value: 'system', label: 'System', icon: '⚙️' },
      { value: 'event', label: 'Event', icon: '📅' }
    ];
  }

  getPriorityLevels() {
    return [
      { value: 'critical', label: 'Critical', color: 'red' },
      { value: 'high', label: 'High', color: 'orange' },
      { value: 'normal', label: 'Normal', color: 'blue' },
      { value: 'low', label: 'Low', color: 'gray' }
    ];
  }

  // Get icon for notification type
  getTypeIcon(type) {
    const types = this.getNotificationTypes();
    const typeInfo = types.find(t => t.value === type);
    return typeInfo ? typeInfo.icon : 'ℹ️';
  }

  // Get color for priority level
  getPriorityColor(priority) {
    const priorities = this.getPriorityLevels();
    const priorityInfo = priorities.find(p => p.value === priority);
    return priorityInfo ? priorityInfo.color : 'gray';
  }

  // Format notification timestamp
  formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const now = new Date();
    const date = new Date(timestamp);
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  }

  // Check if notification is recent (within last hour)
  isRecent(timestamp) {
    if (!timestamp) return false;
    const now = new Date();
    const date = new Date(timestamp);
    const diff = now - date;
    return diff < 3600000; // 1 hour in milliseconds
  }
}

// Create and export a singleton instance
export const notificationService = new NotificationService();
export default notificationService; 