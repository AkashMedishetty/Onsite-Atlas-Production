import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

const TestNotificationGenerator = ({ isOpen, onClose }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedType, setSelectedType] = useState('info');
  const [selectedPriority, setSelectedPriority] = useState('normal');
  const [customTitle, setCustomTitle] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  
  const { createTestNotification, unreadCount } = useNotifications();

  const notificationTypes = [
    { value: 'registration', label: 'Registration', icon: '👥', color: 'blue' },
    { value: 'payment', label: 'Payment', icon: '💳', color: 'green' },
    { value: 'abstract', label: 'Abstract', icon: '📄', color: 'purple' },
    { value: 'alert', label: 'Alert', icon: '⚠️', color: 'red' },
    { value: 'success', label: 'Success', icon: '✅', color: 'emerald' },
    { value: 'info', label: 'Info', icon: 'ℹ️', color: 'blue' },
    { value: 'system', label: 'System', icon: '⚙️', color: 'gray' },
    { value: 'event', label: 'Event', icon: '📅', color: 'indigo' }
  ];

  const priorityLevels = [
    { value: 'critical', label: 'Critical', color: 'red' },
    { value: 'high', label: 'High', color: 'orange' },
    { value: 'normal', label: 'Normal', color: 'blue' },
    { value: 'low', label: 'Low', color: 'gray' }
  ];

  const presetNotifications = [
    {
      title: 'New Registration Received',
      message: 'John Doe has registered for the Annual Tech Conference 2024',
      type: 'registration',
      priority: 'normal'
    },
    {
      title: 'Payment Confirmed',
      message: 'Payment of $299 received from Sarah Johnson for Premium Registration',
      type: 'payment',
      priority: 'normal'
    },
    {
      title: 'Abstract Submitted',
      message: 'New abstract "AI in Healthcare" submitted by Dr. Smith',
      type: 'abstract',
      priority: 'normal'
    },
    {
      title: 'System Alert',
      message: 'Event capacity is 95% full - only 15 spots remaining',
      type: 'alert',
      priority: 'high'
    },
    {
      title: 'Critical Security Alert',
      message: 'Multiple failed login attempts detected from suspicious IP',
      type: 'alert',
      priority: 'critical'
    },
    {
      title: 'Bulk Import Completed',
      message: 'Successfully imported 150/150 registrations with 0 errors',
      type: 'success',
      priority: 'normal'
    }
  ];

  const handleGeneratePreset = async (preset) => {
    setIsGenerating(true);
    try {
      await createTestNotification(preset);
    } catch (error) {
      console.error('Failed to generate preset notification:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCustom = async () => {
    if (!customTitle.trim() || !customMessage.trim()) {
      alert('Please enter both title and message');
      return;
    }

    setIsGenerating(true);
    try {
      await createTestNotification({
        title: customTitle.trim(),
        message: customMessage.trim(),
        type: selectedType,
        priority: selectedPriority
      });
      
      // Clear the form
      setCustomTitle('');
      setCustomMessage('');
    } catch (error) {
      console.error('Failed to generate custom notification:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const getTypeColor = (type) => {
    const typeInfo = notificationTypes.find(t => t.value === type);
    return typeInfo ? typeInfo.color : 'gray';
  };

  const getPriorityColor = (priority) => {
    const priorityInfo = priorityLevels.find(p => p.value === priority);
    return priorityInfo ? priorityInfo.color : 'gray';
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <SparklesIcon className="h-6 w-6" />
              <div>
                <h2 className="text-xl font-bold">Test Notification Generator</h2>
                <p className="text-purple-100 text-sm">Generate test notifications to verify the system is working</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm opacity-90">Current Unread</div>
                <div className="text-2xl font-bold">{unreadCount}</div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Preset Notifications */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Test Notifications
              </h3>
              <div className="space-y-3">
                {presetNotifications.map((preset, index) => (
                  <motion.div
                    key={index}
                    whileHover={{ scale: 1.02 }}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm">{notificationTypes.find(t => t.value === preset.type)?.icon}</span>
                          <span className={`text-xs px-2 py-1 rounded-full bg-${getTypeColor(preset.type)}-100 text-${getTypeColor(preset.type)}-700 dark:bg-${getTypeColor(preset.type)}-900 dark:text-${getTypeColor(preset.type)}-300`}>
                            {preset.type}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full bg-${getPriorityColor(preset.priority)}-100 text-${getPriorityColor(preset.priority)}-700 dark:bg-${getPriorityColor(preset.priority)}-900 dark:text-${getPriorityColor(preset.priority)}-300`}>
                            {preset.priority}
                          </span>
                        </div>
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                          {preset.title}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {preset.message}
                        </p>
                      </div>
                      <button
                        onClick={() => handleGeneratePreset(preset)}
                        disabled={isGenerating}
                        className="ml-3 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isGenerating ? '...' : 'Send'}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Custom Notification Generator */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Custom Notification
              </h3>
              <div className="space-y-4">
                {/* Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {notificationTypes.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setSelectedType(type.value)}
                        className={`p-2 text-xs rounded-lg border-2 transition-colors ${
                          selectedType === type.value
                            ? `border-${type.color}-500 bg-${type.color}-50 dark:bg-${type.color}-900 dark:bg-opacity-20`
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-sm mb-1">{type.icon}</div>
                          <div className="text-xs text-gray-700 dark:text-gray-300">{type.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Priority
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {priorityLevels.map((priority) => (
                      <button
                        key={priority.value}
                        onClick={() => setSelectedPriority(priority.value)}
                        className={`p-2 text-xs rounded-lg border-2 transition-colors ${
                          selectedPriority === priority.value
                            ? `border-${priority.color}-500 bg-${priority.color}-50 dark:bg-${priority.color}-900 dark:bg-opacity-20`
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-xs text-gray-700 dark:text-gray-300">{priority.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Enter notification title..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Message Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Message
                  </label>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Enter notification message..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                  />
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerateCustom}
                  disabled={isGenerating || !customTitle.trim() || !customMessage.trim()}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Generating...</span>
                    </div>
                  ) : (
                    'Generate Custom Notification'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-xl">
            <div className="flex items-start space-x-3">
              <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-medium mb-1">How to test:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Click any preset notification to generate a test notification instantly</li>
                  <li>• Create custom notifications with different types and priorities</li>
                  <li>• Watch the notification badge update in the top navigation</li>
                  <li>• Check the notification panel to see your generated notifications</li>
                  <li>• Browser notifications will appear if you've granted permission</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TestNotificationGenerator; 