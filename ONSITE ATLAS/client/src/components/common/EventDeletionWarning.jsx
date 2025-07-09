import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ExclamationTriangleIcon, 
  ClockIcon, 
  ShieldExclamationIcon,
  XMarkIcon,
  TrashIcon
} from '@heroicons/react/24/solid';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import eventService from '../../services/eventService';

/**
 * EventDeletionWarning Component
 * PurpleHat Advanced Security Protocol interface for event deletion
 * Shows countdown timer, warnings, and cancellation options
 */
const EventDeletionWarning = ({ 
  event, 
  isOpen, 
  onClose, 
  onDeleteConfirm, 
  onCancelDeletion,
  deletionStatus = null
}) => {
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(deletionStatus);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showForceDelete, setShowForceDelete] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  // Check if user is admin to show force delete option
  useEffect(() => {
    setShowForceDelete(user?.role === 'admin');
  }, [user]);

  // Update deletion status periodically
  useEffect(() => {
    if (!isOpen || !event?.id) return;

    const fetchStatus = async () => {
      try {
        const response = await eventService.getEventDeletionStatus(event.id);
        if (response.success) {
          setCurrentStatus(response.data);
        }
      } catch (error) {
        console.error('Error fetching deletion status:', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [isOpen, event?.id]);

  // Real-time countdown timer
  useEffect(() => {
    if (!currentStatus?.hasScheduledDeletion || currentStatus.status !== 'scheduled') {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const remaining = currentStatus.remainingTime;
      if (remaining <= 0) {
        setTimeRemaining(null);
        return;
      }
      setTimeRemaining(remaining);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    
    return () => clearInterval(timer);
  }, [currentStatus]);

  // Format remaining time
  const formatRemainingTime = (milliseconds) => {
    if (!milliseconds || milliseconds <= 0) return '00:00:00';
    
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle deletion confirmation
  const handleDeleteConfirm = async (forceImmediate = false) => {
    setLoading(true);
    try {
      const options = forceImmediate ? { forceImmediate: true } : {};
      await onDeleteConfirm(options);
    } finally {
      setLoading(false);
    }
  };

  // Handle deletion cancellation
  const handleCancelDeletion = async () => {
    if (!cancellationReason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }
    
    setLoading(true);
    try {
      await onCancelDeletion(cancellationReason);
      setCurrentStatus(null);
      onClose();
    } catch (error) {
      console.error('Error cancelling deletion:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Different content based on deletion status
  const renderContent = () => {
    // If deletion is already scheduled
    if (currentStatus?.hasScheduledDeletion && currentStatus.status === 'scheduled') {
      return (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-full ${resolvedTheme === 'dark' ? 'bg-red-900' : 'bg-red-100'}`}>
              <ShieldExclamationIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Deletion Scheduled
              </h3>
              <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                PurpleHat Advanced Security Protocol Active
              </p>
            </div>
          </div>

          {/* Countdown Timer */}
          <div className={`p-4 rounded-lg border-2 border-dashed ${
            resolvedTheme === 'dark' 
              ? 'border-red-600 bg-red-900/20' 
              : 'border-red-500 bg-red-50'
          }`}>
            <div className="flex items-center justify-center space-x-3">
              <ClockIcon className="w-8 h-8 text-red-600" />
              <div className="text-center">
                <div className={`text-3xl font-mono font-bold ${
                  timeRemaining <= 300000 ? 'text-red-600' : 'text-orange-500'
                }`}>
                  {formatRemainingTime(timeRemaining)}
                </div>
                <div className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Until permanent deletion
                </div>
              </div>
            </div>
          </div>

          {/* Warning Messages */}
          <div className="space-y-3">
            <div className={`p-3 rounded-lg ${resolvedTheme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'}`}>
              <div className="flex items-start space-x-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-red-600">
                    🚨 PERMANENT DELETION SCHEDULED
                  </p>
                  <p className={resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                    All event data will be permanently destroyed when the timer reaches zero.
                  </p>
                </div>
              </div>
            </div>

            <div className={`p-3 rounded-lg ${resolvedTheme === 'dark' ? 'bg-yellow-900/20' : 'bg-yellow-50'}`}>
              <div className="flex items-start space-x-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-600">
                    ⚠️ This action cannot be undone
                  </p>
                  <p className={resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                    {currentStatus.eventMetadata?.registrationCount || 0} registrations and all related data will be lost forever.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Cancellation Section */}
          <div className="space-y-3">
            <h4 className={`font-medium ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Cancel Deletion
            </h4>
            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Reason for cancellation (required)..."
              className={`w-full p-3 border rounded-lg resize-none ${
                resolvedTheme === 'dark'
                  ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              rows={3}
            />
            <button
              onClick={handleCancelDeletion}
              disabled={loading || !cancellationReason.trim()}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
            >
              {loading ? 'Cancelling...' : 'Cancel Deletion'}
            </button>
          </div>

          {/* Admin Force Delete (always show for admins when deletion is scheduled) */}
          {user?.role === 'admin' && (
            <div className={`p-4 border-2 border-red-600 rounded-lg ${
              resolvedTheme === 'dark' ? 'bg-red-900/10' : 'bg-red-50'
            }`}>
              <h4 className="font-medium text-red-600 mb-2">⚠️ Admin Override</h4>
              <p className={`text-sm mb-3 ${resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Force immediate deletion bypassing security protocol
              </p>
              <button
                onClick={() => handleDeleteConfirm(true)}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
              >
                {loading ? 'Deleting...' : 'Force Delete Now'}
              </button>
            </div>
          )}
        </div>
      );
    }

    // Initial deletion confirmation
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className={`p-3 rounded-full ${resolvedTheme === 'dark' ? 'bg-red-900' : 'bg-red-100'}`}>
            <TrashIcon className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Delete Event: "{event?.name}"
            </h3>
            <p className={`text-sm ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              This will schedule the event for permanent deletion
            </p>
          </div>
        </div>

        {/* Warning Messages */}
        <div className="space-y-3">
          <div className={`p-4 rounded-lg border-l-4 border-red-500 ${
            resolvedTheme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'
          }`}>
            <h4 className="font-medium text-red-600 mb-2">🔒 PurpleHat Advanced Security Protocol</h4>
            <ul className={`text-sm space-y-1 ${resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              <li>• Event will be scheduled for deletion with a 1-hour grace period</li>
              <li>• You can cancel the deletion during this time</li>
              <li>• After 1 hour, ALL data will be permanently destroyed</li>
              <li>• This includes registrations, payments, abstracts, and all related data</li>
            </ul>
          </div>

          <div className={`p-4 rounded-lg border-l-4 border-yellow-500 ${
            resolvedTheme === 'dark' ? 'bg-yellow-900/20' : 'bg-yellow-50'
          }`}>
            <h4 className="font-medium text-yellow-600 mb-2">⚠️ Data Impact</h4>
            <ul className={`text-sm space-y-1 ${resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              <li>• This action cannot be undone after the grace period</li>
              <li>• All event data will be permanently lost</li>
              <li>• No recovery will be possible</li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors duration-200 ${
              resolvedTheme === 'dark'
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={() => handleDeleteConfirm(false)}
            disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
          >
            {loading ? 'Scheduling...' : 'Schedule Deletion'}
          </button>
        </div>

        {/* Admin Options */}
        {user?.role === 'admin' && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowForceDelete(!showForceDelete)}
              className="text-sm text-red-600 hover:text-red-700 underline"
            >
              {showForceDelete ? 'Hide' : 'Show'} Admin Force Delete Option
            </button>
            
            {/* Admin Force Delete Option - Initial View */}
            {showForceDelete && (
              <div className={`mt-3 p-4 border-2 border-red-600 rounded-lg ${
                resolvedTheme === 'dark' ? 'bg-red-900/10' : 'bg-red-50'
              }`}>
                <h4 className="font-medium text-red-600 mb-2">⚠️ Admin Override</h4>
                <p className={`text-sm mb-3 ${resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Skip security protocol and delete immediately without grace period
                </p>
                <button
                  onClick={() => handleDeleteConfirm(true)}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  {loading ? 'Deleting...' : 'Force Delete Immediately'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={`relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl shadow-xl ${
              resolvedTheme === 'dark' ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className={`absolute top-4 right-4 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200`}
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>

            {/* Content */}
            <div className="p-6">
              {renderContent()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EventDeletionWarning; 