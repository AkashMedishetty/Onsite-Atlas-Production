import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { notificationService } from '../services/notificationService';

// Initial state
const initialState = {
  notifications: [],
  unreadCount: 0,
  isConnected: false,
  isLoading: false,
  error: null,
  filters: {
    type: null,
    read: null,
    priority: null
  },
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  }
};

// Action types
const ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_NOTIFICATIONS: 'SET_NOTIFICATIONS',
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  UPDATE_NOTIFICATION: 'UPDATE_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
  SET_UNREAD_COUNT: 'SET_UNREAD_COUNT',
  SET_CONNECTION_STATUS: 'SET_CONNECTION_STATUS',
  MARK_AS_READ: 'MARK_AS_READ',
  MARK_ALL_AS_READ: 'MARK_ALL_AS_READ',
  SET_FILTERS: 'SET_FILTERS',
  SET_PAGINATION: 'SET_PAGINATION',
  CLEAR_NOTIFICATIONS: 'CLEAR_NOTIFICATIONS'
};

// Reducer function
const notificationReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };
    
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };
    
    case ACTIONS.SET_NOTIFICATIONS:
      return {
        ...state,
        notifications: action.payload.notifications || [],
        pagination: action.payload.pagination || state.pagination,
        unreadCount: action.payload.unreadCount !== undefined ? action.payload.unreadCount : state.unreadCount,
        isLoading: false,
        error: null
      };
    
    case ACTIONS.ADD_NOTIFICATION:
      // Avoid duplicates
      if (state.notifications.some(n => n._id === action.payload._id)) {
        return state;
      }
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
        unreadCount: action.payload.read ? state.unreadCount : state.unreadCount + 1
      };
    
    case ACTIONS.UPDATE_NOTIFICATION:
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification._id === action.payload._id
            ? { ...notification, ...action.payload }
            : notification
        )
      };
    
    case ACTIONS.REMOVE_NOTIFICATION:
      const removedNotification = state.notifications.find(n => n._id === action.payload);
      return {
        ...state,
        notifications: state.notifications.filter(n => n._id !== action.payload),
        unreadCount: removedNotification && !removedNotification.read 
          ? Math.max(0, state.unreadCount - 1) 
          : state.unreadCount
      };
    
    case ACTIONS.SET_UNREAD_COUNT:
      return { ...state, unreadCount: action.payload };
    
    case ACTIONS.SET_CONNECTION_STATUS:
      return { ...state, isConnected: action.payload };
    
    case ACTIONS.MARK_AS_READ:
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification._id === action.payload
            ? { ...notification, read: true, readAt: new Date() }
            : notification
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      };
    
    case ACTIONS.MARK_ALL_AS_READ:
      return {
        ...state,
        notifications: state.notifications.map(notification => ({
          ...notification,
          read: true,
          readAt: new Date()
        })),
        unreadCount: 0
      };
    
    case ACTIONS.SET_FILTERS:
      return { ...state, filters: { ...state.filters, ...action.payload } };
    
    case ACTIONS.SET_PAGINATION:
      return { ...state, pagination: { ...state.pagination, ...action.payload } };
    
    case ACTIONS.CLEAR_NOTIFICATIONS:
      return { ...state, notifications: [], unreadCount: 0 };
    
    default:
      return state;
  }
};

// Create context
const NotificationContext = createContext();

// Provider component
export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const syncIntervalRef = useRef(null);

  // Initialize WebSocket connection
  const initializeSocket = () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // Connect to the backend server on port 5000
      const socketUrl = 'http://localhost:5000';
      
      socketRef.current = io(socketUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 20000
      });

      const socket = socketRef.current;

      // Connection events
      socket.on('connect', () => {
        console.log('🟢 Notification WebSocket connected');
        dispatch({ type: ACTIONS.SET_CONNECTION_STATUS, payload: true });
        
        // Sync notifications on connection
        socket.emit('sync_notifications');
        
        // Clear any reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('🔴 Notification WebSocket disconnected:', reason);
        dispatch({ type: ACTIONS.SET_CONNECTION_STATUS, payload: false });
        
        // Attempt to reconnect after a delay
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect notification WebSocket...');
            socket.connect();
          }, 3000);
        }
      });

      // Notification events
      socket.on('new_notification', (notification) => {
        console.log('📢 New notification received:', notification);
        dispatch({ type: ACTIONS.ADD_NOTIFICATION, payload: notification });
        
        // Show browser notification if permission granted
        showBrowserNotification(notification);
      });

      socket.on('unread_count_updated', (data) => {
        console.log('📊 Unread count updated:', data.count);
        dispatch({ type: ACTIONS.SET_UNREAD_COUNT, payload: data.count });
      });

      socket.on('notification_read', (data) => {
        console.log('✅ Notification marked as read:', data.id);
        dispatch({ type: ACTIONS.MARK_AS_READ, payload: data.id });
      });

      socket.on('all_notifications_read', () => {
        console.log('✅ All notifications marked as read');
        dispatch({ type: ACTIONS.MARK_ALL_AS_READ });
      });

      socket.on('notification_deleted', (data) => {
        console.log('🗑️ Notification deleted:', data.id);
        dispatch({ type: ACTIONS.REMOVE_NOTIFICATION, payload: data.id });
      });

      socket.on('notifications_synced', (data) => {
        console.log('🔄 Notifications synced:', data);
        dispatch({
          type: ACTIONS.SET_NOTIFICATIONS,
          payload: {
            notifications: data.notifications,
            unreadCount: data.unreadCount
          }
        });
      });

      // Error handling
      socket.on('sync_error', (error) => {
        console.error('❌ Sync error:', error);
        dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        dispatch({ type: ACTIONS.SET_CONNECTION_STATUS, payload: false });
      });

    } catch (error) {
      console.error('❌ Failed to initialize notification socket:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to connect to notification service' });
    }
  };

  // Show browser notification
  const showBrowserNotification = (notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification._id,
        requireInteraction: notification.priority === 'critical'
      });

      browserNotification.onclick = () => {
        window.focus();
        // Handle notification click (could navigate to specific page)
        if (notification.actionUrl && notification.actionType === 'navigate') {
          window.location.href = notification.actionUrl;
        }
        browserNotification.close();
      };

      // Auto close after 5 seconds unless critical
      if (notification.priority !== 'critical') {
        setTimeout(() => browserNotification.close(), 5000);
      }
    }
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  };

  // API methods
  const loadNotifications = async (options = {}) => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      const params = {
        page: state.pagination.page,
        limit: state.pagination.limit,
        ...state.filters,
        ...options
      };

      const response = await notificationService.getNotifications(params);
      
      dispatch({
        type: ACTIONS.SET_NOTIFICATIONS,
        payload: response
      });
    } catch (error) {
      console.error('❌ Failed to load notifications:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      // Optimistic update
      dispatch({ type: ACTIONS.MARK_AS_READ, payload: notificationId });
      
      // Emit via WebSocket if connected, otherwise use API
      if (socketRef.current && state.isConnected) {
        socketRef.current.emit('mark_notification_read', { notificationId });
      } else {
        await notificationService.markAsRead(notificationId);
      }
    } catch (error) {
      console.error('❌ Failed to mark notification as read:', error);
      // Revert optimistic update on error
      loadNotifications();
    }
  };

  const markAllAsRead = async () => {
    try {
      // Optimistic update
      dispatch({ type: ACTIONS.MARK_ALL_AS_READ });
      
      // Emit via WebSocket if connected, otherwise use API
      if (socketRef.current && state.isConnected) {
        socketRef.current.emit('mark_all_read');
      } else {
        await notificationService.markAllAsRead();
      }
    } catch (error) {
      console.error('❌ Failed to mark all notifications as read:', error);
      // Revert optimistic update on error
      loadNotifications();
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      // Check if it's a local notification (temporary/client-only)
      const notification = state.notifications.find(n => (n._id || n.id) === notificationId);
      const isLocalNotification = notification?.isLocal || notificationId.toString().startsWith('temp_');
      
      // Optimistic update - always remove from local state
      dispatch({ type: ACTIONS.REMOVE_NOTIFICATION, payload: notificationId });
      
      // Only try to delete from backend if it's not a local notification
      if (!isLocalNotification) {
        // Emit via WebSocket if connected, otherwise use API
        if (socketRef.current && state.isConnected) {
          socketRef.current.emit('delete_notification', { notificationId });
        } else {
          await notificationService.deleteNotification(notificationId);
        }
      } else {
        console.log('Deleted local notification:', notificationId);
      }
    } catch (error) {
      console.error('❌ Failed to delete notification:', error);
      // Only revert if it wasn't a local notification
      const notification = state.notifications.find(n => (n._id || n.id) === notificationId);
      if (!notification?.isLocal && !notificationId.toString().startsWith('temp_')) {
        loadNotifications();
      }
    }
  };

  const createTestNotification = async (data = {}) => {
    try {
      await notificationService.createTestNotification(data);
    } catch (error) {
      console.error('❌ Failed to create test notification:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
    }
  };

  const createNotification = (notificationData) => {
    // Generate a proper string ID that can work with both local state and backend
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const notification = {
      _id: tempId,
      id: tempId, // Fallback for different ID formats
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type || 'info',
      priority: notificationData.priority || 'normal',
      actionUrl: notificationData.actionUrl,
      actionType: notificationData.actionType || 'none',
      metadata: notificationData.metadata || {},
      read: false,
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      isLocal: true // Mark as local notification
    };

    // Add to local state immediately
    dispatch({ type: ACTIONS.ADD_NOTIFICATION, payload: notification });

    // Show browser notification
    showBrowserNotification(notification);

    return notification;
  };

  const setFilters = (filters) => {
    dispatch({ type: ACTIONS.SET_FILTERS, payload: filters });
  };

  const setPagination = (pagination) => {
    dispatch({ type: ACTIONS.SET_PAGINATION, payload: pagination });
  };

  // Initialize on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      initializeSocket();
      loadNotifications();
      
      // Set up periodic sync in case WebSocket fails
      syncIntervalRef.current = setInterval(() => {
        if (!state.isConnected) {
          loadNotifications();
        }
      }, 30000); // Sync every 30 seconds when disconnected
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-initialize socket when token changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !socketRef.current) {
      initializeSocket();
    } else if (!token && socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      dispatch({ type: ACTIONS.CLEAR_NOTIFICATIONS });
      dispatch({ type: ACTIONS.SET_CONNECTION_STATUS, payload: false });
    }
  }, [localStorage.getItem('token')]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    // State
    ...state,
    
    // Actions
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createTestNotification,
    createNotification,
    setFilters,
    setPagination,
    requestNotificationPermission,
    
    // Socket management
    reconnectSocket: initializeSocket,
    
    // Utility
    isConnected: state.isConnected,
    hasUnreadNotifications: state.unreadCount > 0
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook to use notification context
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext; 