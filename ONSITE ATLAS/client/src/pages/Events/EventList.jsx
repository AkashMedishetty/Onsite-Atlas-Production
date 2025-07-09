import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  FunnelIcon,
  EllipsisVerticalIcon,
  CalendarDaysIcon,
  MapPinIcon,
  UsersIcon,
  LinkIcon,
  ArchiveBoxIcon,
  TrashIcon,
  ChartBarIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  PencilIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Card,
  Pagination,
  Select,
  Spinner,
  Input,
  Modal
} from '../../components/common';
import { EventListSkeleton } from '../../components/common/EventCardSkeleton';
import EventDeletionWarning from '../../components/common/EventDeletionWarning';
import eventService from '../../services/eventService';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';

// Countdown Timer Component for Event Cards
const DeletionCountdownTimer = ({ deletionData, eventId, onExpired }) => {
  const { resolvedTheme } = useTheme();
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    if (!deletionData?.hasScheduledDeletion || 
        deletionData.status !== 'scheduled' || 
        !deletionData.executeAt ||
        deletionData.status === 'cancelled' ||
        deletionData.status === 'completed') {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const executeTime = new Date(deletionData.executeAt).getTime();
      const remaining = Math.max(0, executeTime - now);
      
      // Only log once per minute to avoid console spam
      if (remaining % 60000 < 1000) {
        console.log(`[EventCardTimer] Timer update for event ${eventId}: ${formatRemainingTime(remaining)} remaining`);
      }
      
      if (remaining <= 0) {
        setTimeRemaining(0);
        onExpired?.(eventId);
        return;
      }
      setTimeRemaining(remaining);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    
    return () => clearInterval(timer);
  }, [deletionData, eventId, onExpired]);

  // Format remaining time
  const formatRemainingTime = (milliseconds) => {
    if (!milliseconds || milliseconds <= 0) return '00:00:00';
    
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!timeRemaining) return null;

  const isUrgent = timeRemaining <= 300000; // 5 minutes
  const isCritical = timeRemaining <= 60000; // 1 minute

  return (
    <div className={`mt-2 p-2 rounded-lg border-2 border-dashed animate-pulse ${
      isCritical 
        ? (resolvedTheme === 'dark' ? 'border-red-500 bg-red-900/30' : 'border-red-500 bg-red-100')
        : isUrgent
        ? (resolvedTheme === 'dark' ? 'border-orange-500 bg-orange-900/30' : 'border-orange-500 bg-orange-100')
        : (resolvedTheme === 'dark' ? 'border-yellow-500 bg-yellow-900/20' : 'border-yellow-500 bg-yellow-50')
    }`}>
      <div className="flex items-center justify-center space-x-2">
        <ClockIcon className={`w-4 h-4 ${
          isCritical ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-yellow-600'
        }`} />
        <div className="text-center">
          <div className={`text-lg font-mono font-bold ${
            isCritical ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-yellow-600'
          }`}>
            {formatRemainingTime(timeRemaining)}
          </div>
          <div className={`text-xs ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Until deletion
          </div>
        </div>
      </div>
    </div>
  );
};

const EventList = () => {
  // Theme context
  const { resolvedTheme, theme } = useTheme();
  const { createNotification } = useNotifications();
  
  // State
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('startDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [eventsPerPage] = useState(10);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [actionType, setActionType] = useState(''); // 'archive' or 'delete'
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [showDeletionWarning, setShowDeletionWarning] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState(null);
  const [eventDeletionStatuses, setEventDeletionStatuses] = useState({});

  // Create notification for deletion countdown
  const createDeletionNotification = (event, deletionData) => {
    const remaining = deletionData.remainingTime || 0;
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    let timeText = '';
    if (hours > 0) {
      timeText = `${hours}h ${minutes}m`;
    } else {
      timeText = `${minutes}m`;
    }

    console.log(`Creating deletion notification for "${event.name}" with ${timeText} remaining`);

    createNotification({
      title: '🔒 Event Deletion Scheduled',
      message: `"${event.name}" will be permanently deleted in ${timeText}`,
      type: 'alert',
      priority: remaining <= 300000 ? 'critical' : 'high',
      actionUrl: `/events/${event._id}`,
      actionType: 'navigate',
      metadata: {
        eventId: event._id,
        executeAt: deletionData.executeAt,
        deletionTime: deletionData.executeAt,
        remainingTime: remaining
      }
    });
  };

  // Fetch deletion statuses for all events
  const fetchEventDeletionStatuses = async (eventList) => {
    const statuses = {};
    await Promise.all(
      eventList.map(async (event) => {
        try {
          const response = await eventService.getEventDeletionStatus(event._id);
          if (response.success && response.data?.hasScheduledDeletion && response.data.status === 'scheduled') {
            // Only include active scheduled deletions, not cancelled or completed ones
            statuses[event._id] = response.data;
            
            // Create notification for scheduled deletions
            createDeletionNotification(event, response.data);
          }
        } catch (error) {
          // Silently ignore errors (404s are expected for events without scheduled deletions)
          console.debug(`No deletion status for event ${event._id}:`, error.response?.status || error.message);
        }
      })
    );
    setEventDeletionStatuses(statuses);
  };

  // Handle timer expiration
  const handleTimerExpired = (eventId) => {
    // Remove the expired deletion status
    setEventDeletionStatuses(prev => {
      const updated = { ...prev };
      delete updated[eventId];
      return updated;
    });

    // Refresh events to get updated list
    fetchEvents();

    // Create expiration notification
    const event = events.find(e => e._id === eventId);
    if (event) {
      createNotification({
        title: '🗑️ Event Deleted',
        message: `"${event.name}" has been permanently deleted`,
        type: 'alert',
        priority: 'high'
      });
    }
  };

  // Fetch events with pagination and filters
  const fetchEvents = async () => {
    try {
      setLoading(true);
      
      const params = {
        page: currentPage,
        limit: eventsPerPage,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        sortBy,
        sortOrder
      };
      
      console.log('Fetching events with params:', params);
      const result = await eventService.getEvents(params);
      console.log('API Response:', result);
      
      let eventList = [];
      if (Array.isArray(result)) {
        eventList = result;
        setEvents(result);
        setTotalEvents(result.length);
      } else if (result && result.data && Array.isArray(result.data)) {
        eventList = result.data;
        setEvents(result.data);
        setTotalEvents(result.total || result.data.length);
      } else {
        console.error('Unexpected API response format:', result);
        setError('Received invalid data format from API');
        setEvents([]);
      }
      
      // Fetch deletion statuses for all events
      if (eventList.length > 0) {
        await fetchEventDeletionStatuses(eventList);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      setError('Error fetching events. Please try again.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, [currentPage, filterStatus, sortBy, sortOrder]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveDropdown(null);
    };

    if (activeDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeDropdown]);

  // Listen for deletion cancellation events from other components
  useEffect(() => {
    const handleDeletionCancelled = (event) => {
      const { eventId } = event.detail;
      console.log(`Received deletion cancellation event for event ${eventId}`);
      
      // Remove from deletion statuses immediately
      setEventDeletionStatuses(prev => {
        const updated = { ...prev };
        delete updated[eventId];
        return updated;
      });
      
      // Optionally refresh the events list to ensure consistency
      setTimeout(() => {
        fetchEvents();
      }, 1000);
    };

    window.addEventListener('deletionCancelled', handleDeletionCancelled);
    return () => window.removeEventListener('deletionCancelled', handleDeletionCancelled);
  }, []);

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Filter events based on search query
  const filteredEvents = events.filter(event => {
    const matchesSearch = searchQuery.trim() === '' ||
      (event.name && event.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (event.venue?.city && event.venue.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (event.venue?.country && event.venue.country.toLowerCase().includes(searchQuery.toLowerCase()));
      
    return matchesSearch;
  });

  // Handle refresh
  const handleRefresh = () => {
    fetchEvents();
  };

  // Get status badge color
  const getStatusBadgeColor = (status) => {
    if (!status) return 'secondary';
    
    switch (status.toLowerCase()) {
      case 'draft': return 'info';
      case 'published': return 'success';
      case 'completed': return 'primary';
      case 'archived': return 'warning';
      default: return 'secondary';
    }
  };

  // Handle archive confirmation (delete now uses security lockdown)
  const handleEventAction = async () => {
    if (!selectedEvent || !actionType) return;
    
    try {
      if (actionType === 'archive') {
        await eventService.archiveEvent(selectedEvent._id);
        setError(null); // Clear any previous errors
        fetchEvents();
        setShowActionModal(false);
        setSelectedEvent(null);
        setActionType('');
      }
      // Delete action is now handled by the security lockdown interface
    } catch (error) {
      console.error(`Error ${actionType}ing event:`, error);
      setError(`Failed to ${actionType} event. Please try again.`);
    }
  };

  // Show archive modal
  const showArchiveModal = (event) => {
    setSelectedEvent(event);
    setActionType('archive');
    setShowActionModal(true);
    setActiveDropdown(null);
  };

  // Show delete modal with security lockdown
  const showDeleteModal = async (event) => {
    setSelectedEvent(event);
    setActiveDropdown(null);
    
    // Check if event already has scheduled deletion
    try {
      const statusResponse = await eventService.getEventDeletionStatus(event._id);
      if (statusResponse.success) {
        setDeletionStatus(statusResponse.data);
      }
    } catch (error) {
      console.error('Error fetching deletion status:', error);
      setDeletionStatus(null);
    }
    
    setShowDeletionWarning(true);
  };

  // Handle deletion confirmation (with security lockdown)
  const handleDeleteConfirm = async (options = {}) => {
    if (!selectedEvent) return;
    
    try {
      const response = await eventService.deleteEvent(selectedEvent._id, options);
      
      if (response.success) {
        // Refresh events list
      fetchEvents();
        
        // Show success message based on type
        if (options.forceImmediate) {
          alert('Event permanently deleted immediately');
          // Remove deletion status from the list view
          setEventDeletionStatuses(prev => {
            const updated = { ...prev };
            delete updated[selectedEvent._id];
            return updated;
          });
          setShowDeletionWarning(false);
          setSelectedEvent(null);
          setDeletionStatus(null);
        } else {
          // Update deletion status to show countdown timer
          const statusResponse = await eventService.getEventDeletionStatus(selectedEvent._id);
          if (statusResponse.success) {
            setDeletionStatus(statusResponse.data);
            // Update the event deletion statuses for the list view
            setEventDeletionStatuses(prev => ({
              ...prev,
              [selectedEvent._id]: statusResponse.data
            }));
          }
          
          alert(`Event "${selectedEvent.name}" scheduled for deletion with 1-hour grace period`);
          // Keep modal open to show countdown timer
        }
      } else {
        alert(response.message || 'Failed to delete event');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Error occurred while scheduling deletion');
    }
  };

  // Handle deletion cancellation
  const handleCancelDeletion = async (reason) => {
    if (!selectedEvent) return;
    
    try {
      const response = await eventService.cancelEventDeletion(selectedEvent._id, reason);
      
      if (response.success) {
        alert('Event deletion cancelled successfully');
        
        // Remove deletion status from the list view immediately
        setEventDeletionStatuses(prev => {
          const updated = { ...prev };
          delete updated[selectedEvent._id];
          return updated;
        });
        
        // Refresh the list to ensure consistency
        await fetchEvents();
        
        // Create success notification
        createNotification({
          title: '✅ Deletion Cancelled',
          message: `"${selectedEvent.name}" deletion has been cancelled successfully`,
          type: 'success',
          priority: 'normal'
        });
        
        // Close modal and reset state
        setShowDeletionWarning(false);
        setSelectedEvent(null);
        setDeletionStatus(null);
      } else {
        alert(response.message || 'Failed to cancel deletion');
      }
    } catch (error) {
      console.error('Error cancelling deletion:', error);
      alert('Error occurred while cancelling deletion');
    }
  };

  // Handle dropdown toggle
  const toggleDropdown = (eventId, e) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDropdown(activeDropdown === eventId ? null : eventId);
  };

  // Smart banner generation with hierarchy: uploaded image → theme colors → default purple/indigo
  const getEventBannerStyle = (event) => {
    // Priority 1: Use uploaded banner image
    if (event.bannerImage) {
      // Check if it's a base64 data URL (too large for HTTP headers)
      if (event.bannerImage.startsWith('data:image/')) {
        // For base64 data URLs, use them directly but with size limit check
        const base64Size = event.bannerImage.length * (3/4); // Approximate byte size
        if (base64Size < 1024 * 1024) { // Only use if less than 1MB
          return {
            backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url("${event.bannerImage}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          };
        } else {
          // Base64 too large, fall back to gradient
          console.warn('Banner image base64 too large, falling back to gradient');
        }
      } else {
        // Regular image URL
        const imageUrl = event.bannerImage.startsWith('http') 
          ? event.bannerImage 
          : `${window.location.origin}${event.bannerImage.startsWith('/') ? '' : '/'}${event.bannerImage}`;
        
        return {
          backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url("${imageUrl}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        };
      }
    }

    // Priority 2: Use event-specific theme colors if available
    if (event.badgeSettings?.colors?.accent && event.badgeSettings?.colors?.background) {
      const primaryColor = event.badgeSettings.colors.accent;
      const secondaryColor = event.badgeSettings.colors.background;
      return {
        background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
      };
    }

    // Priority 3: Use global theme colors if available
    if (theme?.primaryColor && theme?.secondaryColor) {
      return {
        background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`
      };
    }

    // Priority 4: Default purple and indigo gradient
    return {
      background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)'
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-2xl font-bold ${
            resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Events
          </h1>
          <p className={`${
            resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}>
            Manage your events and conferences
          </p>
        </div>
        <Link to="/events/new">
          <Button
            variant="primary"
            leftIcon={<PlusIcon className="h-5 w-5" />}
          >
            Create Event
          </Button>
        </Link>
      </div>

      {/* Filters - Improved Responsive Layout */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        {/* Search Input - Takes most space */}
        <div className="flex-1 min-w-0">
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />}
            className="w-full h-10"
            inputClassName="!pl-12"
          />
        </div>
        
        {/* Filters and Actions - Consistent height and spacing */}
        <div className="flex gap-2 items-center flex-shrink-0">
          <Select
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
              { value: 'completed', label: 'Completed' },
              { value: 'archived', label: 'Archived' }
            ]}
            value={filterStatus}
            onChange={(value) => setFilterStatus(value)}
            className="w-36 sm:w-40 h-10"
          />
          <Button
            variant="outline"
            onClick={handleRefresh}
            leftIcon={<ArrowPathIcon className="h-5 w-5" />}
            className="h-10 px-3 sm:px-4"
            aria-label="Refresh"
          >
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="animate-pulse">
          <EventListSkeleton count={6} />
        </div>
      ) : error ? (
        <Card className={`p-6 text-center ${
          resolvedTheme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <p className="text-red-500">{error}</p>
          <Button variant="primary" className="mt-4" onClick={handleRefresh}>
            Try Again
          </Button>
        </Card>
      ) : filteredEvents.length === 0 ? (
        <Card className={`p-8 text-center ${
          resolvedTheme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <CalendarDaysIcon className={`h-12 w-12 mb-4 ${
              resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <h3 className={`text-lg font-medium mb-2 ${
              resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              No events found
            </h3>
            <p className={`mb-6 ${
              resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {searchQuery ? 'Try adjusting your search criteria' : 'Get started by creating your first event'}
            </p>
            <Link to="/events/new">
              <Button
                variant="primary"
                leftIcon={<PlusIcon className="h-5 w-5" />}
              >
                Create Event
              </Button>
            </Link>
          </motion.div>
        </Card>
      ) : (
        <motion.div 
          className="space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredEvents.map((event, index) => (
              <motion.div
                key={event._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.3, 
                  delay: index * 0.03,
                  ease: "easeOut"
                }}
                className="group"
              >
                <Card 
                  padding="none"
                  className={`h-full overflow-hidden border-2 rounded-lg ${
                    resolvedTheme === 'dark' 
                      ? 'bg-gray-800 border-gray-700' 
                      : 'bg-white border-gray-200'
                  }`}
                >
                  {/* Banner - Exact Match to Skeleton Structure */}
                  <div 
                    className="w-full h-48 relative"
                    style={getEventBannerStyle(event)}
                  >
                    {/* Show event title on banner when no image */}
                    {!event.bannerImage && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <h3 className="text-xl font-bold text-white drop-shadow-lg text-center px-4">
                          {event.name || 'Unnamed Event'}
                        </h3>
                      </div>
                    )}
                    
                    {/* Status Badge - Match Skeleton Position */}
                    <div className="absolute top-3 left-3 flex flex-col space-y-1">
                      <Badge 
                        variant={getStatusBadgeColor(event.status)}
                        size="sm"
                        className="backdrop-blur-sm bg-opacity-90"
                      >
                        {event.status || 'draft'}
                      </Badge>
                      
                      {/* Deletion Status Indicator */}
                      {eventDeletionStatuses[event._id] && (
                        <Badge 
                          variant="danger"
                          size="sm"
                          className="backdrop-blur-sm bg-red-600/90 text-white animate-pulse"
                        >
                          🔒 Deletion Scheduled
                        </Badge>
                      )}
                    </div>
                    
                    {/* Action Buttons - Match Skeleton Position (3 buttons) */}
                    <div className="absolute top-3 right-3 flex space-x-1">
                      <Link
                        to={`/events/${event._id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 backdrop-blur-sm shadow-md border border-gray-200/50 dark:border-gray-600/50"
                        title="View Event"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </Link>
                      <Link
                        to={`/events/${event._id}/settings`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 backdrop-blur-sm shadow-md border border-gray-200/50 dark:border-gray-600/50"
                        title="Edit Event"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Link>
                      <div className="relative">
                        <button
                          onClick={(e) => toggleDropdown(event._id, e)}
                          className="p-2 rounded-lg bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 backdrop-blur-sm shadow-md border border-gray-200/50 dark:border-gray-600/50"
                          title="More Actions"
                        >
                          <EllipsisVerticalIcon className="h-4 w-4" />
                        </button>
                        {/* Simplified Dropdown Menu */}
                        {activeDropdown === event._id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                            <div className="py-1">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  showArchiveModal(event);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                              >
                                <ArchiveBoxIcon className="h-4 w-4 mr-3" />
                                Archive Event
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  showDeleteModal(event);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <TrashIcon className="h-4 w-4 mr-3" />
                                Delete Permanently
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Content Skeleton - Exact Match Structure */}
                  <div className="p-6 flex flex-col h-full">
                    {/* Clickable Event Content Area - Flex grow to fill space */}
                    <Link to={`/events/${event._id}`} className="block cursor-pointer flex-grow">
                      {/* Title - Fixed height for consistency */}
                      <div className="mb-3 h-16 flex items-start">
                        <h3 className={`text-xl font-bold line-clamp-2 ${
                          resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                          {event.name || 'Unnamed Event'}
                        </h3>
                      </div>
                      
                      {/* Description - Fixed height for consistency */}
                      <div className="mb-4 h-12 flex items-start">
                        <p className={`text-sm line-clamp-2 ${
                          resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-500'
                        }`}>
                          {event.description || 'No description available for this event'}
                        </p>
                      </div>
                      
                      {/* Event Details - Fixed height for consistency */}
                      <div className="space-y-2 mb-4 h-20 flex flex-col justify-start">
                        <div className={`flex items-center text-sm ${
                          resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <CalendarDaysIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span className="truncate">
                            {event.startDate ? format(new Date(event.startDate), 'MMM d, yyyy') : 'TBD'} - 
                            {event.endDate ? format(new Date(event.endDate), 'MMM d, yyyy') : 'TBD'}
                          </span>
                        </div>
                        <div className={`flex items-center text-sm ${
                          resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <MapPinIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span className="truncate">
                            {event.venue?.city && event.venue?.country 
                              ? `${event.venue.city}, ${event.venue.country}` 
                              : 'Location TBD'
                            }
                          </span>
                          </div>
                        <div className={`flex items-center text-sm ${
                          resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <UsersIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span>{event.registrationCount || 0} Registrations</span>
                        </div>
                      </div>
                      
                      {/* Analytics Section - Match Skeleton Structure */}
                      <div className={`mt-4 pt-4 border-t ${
                        resolvedTheme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      }`}>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className={`text-lg font-bold ${
                              resolvedTheme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                            }`}>
                              {event.registrationCount || 0}
                            </div>
                            <div className={`text-xs ${
                              resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                              Registered
                            </div>
                          </div>
                          <div>
                            <div className={`text-lg font-bold ${
                              resolvedTheme === 'dark' ? 'text-green-400' : 'text-green-600'
                            }`}>
                              {event.registrationCount > 0 ? Math.floor((event.registrationCount || 0) * 0.8) : Math.floor((event.capacity || 50) * 0.8)}
                            </div>
                            <div className={`text-xs ${
                              resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                              Expected
                            </div>
                          </div>
                          <div>
                            <div className={`text-lg font-bold ${
                              resolvedTheme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                            }`}>
                              {event.status === 'published' ? 'Live' : event.status?.charAt(0).toUpperCase() + event.status?.slice(1) || 'Draft'}
                            </div>
                            <div className={`text-xs ${
                              resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                              Status
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                    
                    {/* Deletion Countdown Timer */}
                    {eventDeletionStatuses[event._id] && (
                      <DeletionCountdownTimer 
                        deletionData={eventDeletionStatuses[event._id]}
                        eventId={event._id}
                        onExpired={handleTimerExpired}
                      />
                    )}
                    
                    {/* Quick Cancel Deletion Button */}
                    {eventDeletionStatuses[event._id] && (
                      <div className="mt-3 flex justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            const reason = prompt("Please provide a reason for cancelling the deletion:");
                            if (!reason || !reason.trim()) {
                              alert("Cancellation reason is required.");
                              return;
                            }
                            
                            try {
                              const response = await eventService.cancelEventDeletion(event._id, reason.trim());
                              
                              if (response.success) {
                                alert('Event deletion cancelled successfully!');
                                
                                // Update the deletion statuses immediately
                                setEventDeletionStatuses(prev => {
                                  const updated = { ...prev };
                                  delete updated[event._id];
                                  return updated;
                                });
                                
                                // Refresh events list to ensure consistency
                                await fetchEvents();
                                
                                // Create success notification
                                createNotification({
                                  title: '✅ Deletion Cancelled',
                                  message: `"${event.name}" deletion has been cancelled successfully`,
                                  type: 'success',
                                  priority: 'normal'
                                });
                              } else {
                                alert(response.message || 'Failed to cancel deletion');
                              }
                            } catch (error) {
                              console.error('Error cancelling deletion:', error);
                              alert('Error occurred while cancelling deletion');
                            }
                          }}
                          className={`border-red-300 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20 ${
                            resolvedTheme === 'dark' ? 'bg-gray-800' : 'bg-white'
                          }`}
                        >
                          🛑 Cancel Deletion
                        </Button>
                      </div>
                    )}
                    
                    {/* Landing Page Button - Always Present - Fixed Position at Bottom */}
                    <div className={`mt-4 pt-4 border-t flex-shrink-0 ${
                      resolvedTheme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                      {event.landingPageUrl ? (
                        <a
                          href={event.landingPageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center text-sm font-medium transition-colors duration-200 hover:underline ${
                            resolvedTheme === 'dark' 
                              ? 'text-purple-400 hover:text-purple-300' 
                              : 'text-purple-600 hover:text-purple-700'
                          }`}
                        >
                          <LinkIcon className="h-4 w-4 mr-1" />
                          Visit Landing Page
                        </a>
                      ) : (
                        <span className={`inline-flex items-center text-sm font-medium ${
                          resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          <LinkIcon className="h-4 w-4 mr-1 opacity-50" />
                          Landing Page Not Configured
                        </span>
                      )}
                      </div>
                    </div>
                  </Card>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {totalEvents > eventsPerPage && (
            <div className="flex justify-center mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(totalEvents / eventsPerPage)}
                onPageChange={handlePageChange}
                showPageSizeOptions={false}
              />
            </div>
          )}
        </motion.div>
      )}

      {/* Archive/Delete confirmation modal */}
      <Modal
        isOpen={showActionModal}
        onClose={() => {
          setShowActionModal(false);
          setSelectedEvent(null);
          setActionType('');
        }}
        title={actionType === 'archive' ? 'Archive Event' : 'Delete Event Permanently'}
        centered={true}
        size="lg"
      >
        <p className="mb-6">
          {actionType === 'archive' ? (
            <>
              Are you sure you want to archive the event{' '}
              <span className="font-semibold">{selectedEvent?.name}</span>?
              <br />
              <span className="text-sm text-gray-500 mt-2 block">
                Archived events will not be visible to the public but can be restored later.
              </span>
            </>
          ) : (
            <>
              Are you sure you want to permanently delete the event{' '}
              <span className="font-semibold">{selectedEvent?.name}</span>?
              <br />
              <span className="text-sm text-red-500 mt-2 block">
                This action cannot be undone and all related data will be lost.
              </span>
            </>
          )}
        </p>
        <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
              setShowActionModal(false);
              setSelectedEvent(null);
              setActionType('');
              }}
            >
              Cancel
            </Button>
          <Button 
            variant={actionType === 'archive' ? 'warning' : 'danger'} 
            onClick={handleEventAction}
          >
            {actionType === 'archive' ? 'Archive Event' : 'Delete Permanently'}
            </Button>
        </div>
      </Modal>

      {/* Event Deletion Warning with iOS-style Security Lockdown */}
      <EventDeletionWarning
        event={selectedEvent}
        isOpen={showDeletionWarning}
        onClose={() => {
          setShowDeletionWarning(false);
          setSelectedEvent(null);
          setDeletionStatus(null);
        }}
        onDeleteConfirm={handleDeleteConfirm}
        onCancelDeletion={handleCancelDeletion}
        deletionStatus={deletionStatus}
      />
    </div>
  );
};

export default EventList; 