import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ClockIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * DeletionNotificationTimer Component
 * Shows real-time countdown timers for scheduled event deletions in notifications
 */
const DeletionNotificationTimer = ({ 
  notification, 
  onDismiss,
  onClick 
}) => {
  const { resolvedTheme } = useTheme();
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    if (!notification?.metadata?.executeAt) return;

    const updateTimer = () => {
      const now = Date.now();
      const executeTime = new Date(notification.metadata.executeAt).getTime();
      const remaining = Math.max(0, executeTime - now);
      
      // Only log once per minute to avoid console spam
      if (remaining % 60000 < 1000) {
        console.log(`[DeletionNotificationTimer] Timer update: ${formatRemainingTime(remaining)} remaining for event ${notification.metadata.eventId}`);
      }
      
      if (remaining <= 0) {
        setTimeRemaining(0);
        return;
      }
      setTimeRemaining(remaining);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    
    return () => clearInterval(timer);
  }, [notification]);

  // Format remaining time
  const formatRemainingTime = (milliseconds) => {
    if (!milliseconds || milliseconds <= 0) return '00:00:00';
    
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getPriorityStyles = () => {
    if (!timeRemaining) return {};
    
    const isUrgent = timeRemaining <= 300000; // 5 minutes
    const isCritical = timeRemaining <= 60000; // 1 minute
    
    if (isCritical) {
      return {
        border: resolvedTheme === 'dark' ? 'border-red-500' : 'border-red-500',
        background: resolvedTheme === 'dark' ? 'bg-red-900/20' : 'bg-red-50',
        textColor: 'text-red-600',
        iconColor: 'text-red-600'
      };
    } else if (isUrgent) {
      return {
        border: resolvedTheme === 'dark' ? 'border-orange-500' : 'border-orange-500',
        background: resolvedTheme === 'dark' ? 'bg-orange-900/20' : 'bg-orange-50',
        textColor: 'text-orange-600',
        iconColor: 'text-orange-600'
      };
    } else {
      return {
        border: resolvedTheme === 'dark' ? 'border-yellow-500' : 'border-yellow-500',
        background: resolvedTheme === 'dark' ? 'bg-yellow-900/20' : 'bg-yellow-50',
        textColor: 'text-yellow-600',
        iconColor: 'text-yellow-600'
      };
    }
  };

  const styles = getPriorityStyles();
  const isExpired = !timeRemaining || timeRemaining <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`border-2 border-dashed rounded-lg p-4 mb-3 ${
        isExpired 
          ? (resolvedTheme === 'dark' ? 'border-gray-600 bg-gray-800/50' : 'border-gray-300 bg-gray-50')
          : `${styles.border} ${styles.background} animate-pulse`
      }`}
    >
      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className={`flex-shrink-0 p-2 rounded-lg ${
          isExpired 
            ? (resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')
            : styles.background
        }`}>
          {isExpired ? (
            <TrashIcon className="w-5 h-5 text-gray-500" />
          ) : (
            <ClockIcon className={`w-5 h-5 ${styles.iconColor}`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className={`text-sm font-semibold ${
                resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {notification.title}
              </h4>
              <p className={`text-sm mt-1 ${
                resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {notification.message}
              </p>

              {/* Countdown Timer */}
              {!isExpired && timeRemaining && (
                <div className="mt-3 flex items-center space-x-2">
                  <div className={`font-mono text-lg font-bold ${styles.textColor}`}>
                    {formatRemainingTime(timeRemaining)}
                  </div>
                  <span className={`text-xs ${
                    resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    remaining
                  </span>
                </div>
              )}

              {/* Expired Message */}
              {isExpired && (
                <div className="mt-2 text-sm text-gray-500">
                  ⚠️ Deletion completed or cancelled
                </div>
              )}

              {/* Action Buttons */}
              {!isExpired && (
                <div className="mt-3 flex items-center space-x-3">
                  {notification.actionUrl && (
                    <button
                      onClick={onClick}
                      className={`text-sm font-medium hover:underline ${styles.textColor}`}
                    >
                      View Event →
                    </button>
                  )}
                                     <button
                     onClick={async (e) => {
                       e.stopPropagation();
                       
                       const reason = prompt("Please provide a reason for cancelling the deletion:");
                       if (!reason || !reason.trim()) {
                         alert("Cancellation reason is required.");
                         return;
                       }
                       
                       try {
                         // Import eventService dynamically
                         const eventService = (await import('../../services/eventService')).default;
                         const response = await eventService.cancelEventDeletion(
                           notification.metadata.eventId, 
                           reason.trim()
                         );
                         
                         if (response.success) {
                           alert('Event deletion cancelled successfully!');
                           onDismiss(); // Remove the notification
                           
                           // Trigger a custom event to notify other components
                           const event = new CustomEvent('deletionCancelled', {
                             detail: { eventId: notification.metadata.eventId }
                           });
                           window.dispatchEvent(event);
                         } else {
                           alert(response.message || 'Failed to cancel deletion');
                         }
                       } catch (error) {
                         console.error('Error cancelling deletion:', error);
                         alert('Error occurred while cancelling deletion');
                       }
                     }}
                     className="text-sm font-medium px-3 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
                   >
                     🛑 Cancel Deletion
                   </button>
                </div>
              )}

              {/* Timestamp */}
              <div className={`text-xs mt-2 ${
                resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}>
                {new Date(notification.createdAt || notification.timestamp).toLocaleString()}
              </div>
            </div>

            {/* Dismiss Button */}
            <button
              onClick={onDismiss}
              className={`ml-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {!isExpired && timeRemaining && notification.metadata?.remainingTime && (
        <div className="mt-3">
          <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2`}>
            <div 
              className={`h-2 rounded-full transition-all duration-1000 ${
                timeRemaining <= 60000 ? 'bg-red-500' :
                timeRemaining <= 300000 ? 'bg-orange-500' : 'bg-yellow-500'
              }`}
              style={{
                width: `${Math.max(0, (timeRemaining / notification.metadata.remainingTime) * 100)}%`
              }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default DeletionNotificationTimer; 