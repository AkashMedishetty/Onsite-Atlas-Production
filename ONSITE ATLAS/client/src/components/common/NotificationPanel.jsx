import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BellIcon,
  XMarkIcon,
  UserPlusIcon,
  CreditCardIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  CogIcon,
  CalendarIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useNotifications } from '../../contexts/NotificationContext';
import DeletionNotificationTimer from './DeletionNotificationTimer';

const NotificationPanel = ({ isOpen, onClose, notifications: propNotifications = [] }) => {
  const { markAsRead, markAllAsRead, deleteNotification, loading } = useNotifications();
  
  // Use notifications from props (passed from DashboardLayout)
  const notifications = propNotifications;

  // Notification types with ClickUp-inspired styling
  const notificationTypes = {
    registration: {
      icon: UserPlusIcon,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      label: 'New Registration'
    },
    payment: {
      icon: CreditCardIcon,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      label: 'Payment'
    },
    abstract: {
      icon: DocumentTextIcon,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      label: 'Abstract'
    },
    alert: {
      icon: ExclamationTriangleIcon,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
      label: 'Alert'
    },
    success: {
      icon: CheckCircleIcon,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      label: 'Success'
    },
    info: {
      icon: InformationCircleIcon,
      color: 'bg-cyan-500',
      bgColor: 'bg-cyan-50',
      textColor: 'text-cyan-600',
      label: 'Info'
    },
    system: {
      icon: CogIcon,
      color: 'bg-gray-500',
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-600',
      label: 'System'
    },
    event: {
      icon: CalendarIcon,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
      label: 'Event'
    }
  };

  // Clear notification (using deleteNotification from context)
  const clearNotification = (notificationId) => {
    console.log('Clearing notification:', notificationId);
    try {
      deleteNotification(notificationId);
    } catch (error) {
      console.error('Error clearing notification:', error);
    }
  };

  // Clear all notifications
  const clearAllNotifications = () => {
    if (confirm('Clear all notifications? This action cannot be undone.')) {
      notifications.forEach(notification => {
        const notificationId = notification._id || notification.id;
        clearNotification(notificationId);
      });
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return;
    
    // Clear all with Ctrl+Shift+Delete or Cmd+Shift+Delete
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Delete') {
      e.preventDefault();
      clearAllNotifications();
    }
  }, [isOpen, clearAllNotifications]);

  // Add keyboard event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Get time ago string
  const getTimeAgo = (notification) => {
    const timestamp = new Date(notification.createdAt || notification.timestamp);
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Notification Panel */}
          <motion.div
            initial={{ opacity: 0, x: 320 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 320 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full w-96 bg-white dark:bg-gray-800 shadow-2xl z-50 border-l border-gray-200 dark:border-gray-700 flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-xl">
                    <BellIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      Notifications
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {unreadCount} unread
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Actions */}
              {notifications.length > 0 && (
                <div className="flex items-center space-x-4">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium transition-colors"
                    >
                      Mark all as read
                    </button>
                  )}
                  <button
                    onClick={clearAllNotifications}
                    className="flex items-center space-x-1 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium transition-colors"
                    title="Clear all notifications (Ctrl+Shift+Delete)"
                  >
                    <TrashIcon className="w-4 h-4" />
                    <span>Clear all</span>
                  </button>
                </div>
              )}
            </div>

            {/* Notifications List */}
            <div 
              className="flex-1 overflow-y-auto min-h-0"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 transparent'
              }}
            >
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <BellIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    No notifications
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    You're all caught up!
                  </p>
                </div>
              ) : (
                <div className="space-y-2 p-3 pb-6">
                  <AnimatePresence mode="popLayout">
                    {notifications.map((notification, index) => {
                      const type = notificationTypes[notification.type] || notificationTypes['info'];
                      const IconComponent = type.icon;
                      const notificationId = notification._id || notification.id;

                      // Check if this is a deletion countdown notification
                      const isDeletionNotification = 
                        notification.title?.includes('🔒 Event Deletion Scheduled') ||
                        notification.metadata?.eventId;

                      // Render deletion notifications with countdown timer
                      if (isDeletionNotification) {
                        return (
                          <DeletionNotificationTimer
                            key={notificationId}
                            notification={notification}
                            onDismiss={() => {
                              console.log('Dismissing deletion notification:', notificationId);
                              clearNotification(notificationId);
                            }}
                            onClick={() => {
                              markAsRead(notificationId);
                              if (notification.actionUrl && notification.actionType === 'navigate') {
                                window.location.href = notification.actionUrl;
                              }
                            }}
                          />
                        );
                      }

                      return (
                        <motion.div
                          key={notificationId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 100, transition: { duration: 0.2 } }}
                          transition={{ delay: index * 0.05 }}
                          className={`
                            p-4 rounded-xl border transition-all duration-200 cursor-pointer hover:shadow-md group
                            ${notification.read 
                              ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' 
                              : 'bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-700'
                            }
                          `}
                          onClick={() => {
                            markAsRead(notificationId);
                            if (notification.actionUrl) {
                              // Handle navigation
                              console.log('Navigate to:', notification.actionUrl);
                            }
                          }}
                        >
                          <div className="flex items-start space-x-3">
                            <div className={`
                              flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${type.color}
                              shadow-sm
                            `}>
                              <IconComponent className="w-5 h-5 text-white" />
                            </div>
                            
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 pr-2">
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                                    {notification.title}
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                    {notification.message}
                                  </p>
                                  <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {getTimeAgo(notification)}
                                    </span>
                                    <span className={`
                                      px-2 py-0.5 text-xs font-medium rounded-full ${type.bgColor} ${type.textColor}
                                    `}>
                                      {type.label}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              {!notification.read && (
                                <div className="absolute top-4 right-12 w-2 h-2 bg-purple-500 rounded-full"></div>
                              )}
                            </div>
                            
                            {/* Delete Button - Always Visible */}
                            <div className="flex-shrink-0 flex items-start">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearNotification(notificationId);
                                }}
                                className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                                title="Delete notification"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  
                  {/* Scroll indicator for many notifications */}
                  {notifications.length > 4 && (
                    <div className="text-center py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 mx-3">
                      {notifications.length} total notifications • Scroll for more
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="text-center">
                <button className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium transition-colors">
                  View all notifications
                </button>
                {notifications.length > 3 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Scroll up to see more notifications
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationPanel; 