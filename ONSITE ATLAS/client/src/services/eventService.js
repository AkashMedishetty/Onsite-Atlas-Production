import { baseURL, fetchWithAuth, handleApiResponse } from './apiService';
import axios from 'axios';

// Helper function to format event data consistently
const formatEventData = (event) => {
  if (!event) return null;
  

  
  // Ensure all required structures exist
  return {
    ...event,
    name: event.name || 'Unnamed Event',
    status: event.status || 'Draft',
    startDate: event.startDate || null,
    endDate: event.endDate || null,
    // Explicitly preserve registration count
    registrationCount: event.registrationCount || 0,
    registrationSettings: event.registrationSettings || { 
      idPrefix: 'REG', 
      enabled: false,
      fields: []
    },
    abstractSettings: event.abstractSettings || {
      enabled: false,
      isOpen: false,
      deadline: null,
      maxLength: 500,
      allowEditing: false,
      guidelines: '',
      categories: [],
      notifyOnSubmission: false,
      allowFiles: false,
      maxFileSize: 5
    },
    resourceSettings: event.resourceSettings || {
      food: { enabled: false, items: [] },
      kits: { enabled: false, items: [] },
      certificates: { enabled: false, types: [] }
    },
    emailSettings: event.emailSettings || {
      enabled: false,
      templates: []
    },
    badgeSettings: event.badgeSettings || {
      orientation: 'portrait',
      size: { width: 3.5, height: 5 },
      unit: 'in',
      showLogo: true,
      logoPosition: 'top',
      showQR: true,
      qrPosition: 'bottom',
      fields: {
        name: true,
        organization: true,
        registrationId: true,
        category: true,
        country: true,
        qrCode: true
      },
      fieldConfig: {
        name: {
          fontSize: 18,
          fontWeight: 'bold',
          position: { top: 40, left: 50 }
        },
        organization: {
          fontSize: 14,
          fontWeight: 'normal',
          position: { top: 65, left: 50 }
        },
        registrationId: {
          fontSize: 12,
          fontWeight: 'normal',
          position: { top: 85, left: 50 }
        },
        category: {
          fontSize: 12,
          fontWeight: 'normal',
          position: { top: 105, left: 50 }
        },
        country: {
          fontSize: 12,
          fontWeight: 'normal',
          position: { top: 240, left: 50 }
        },
        qrCode: {
          size: 100,
          position: { top: 135, left: 100 }
        }
      },
      colors: {
        background: '#FFFFFF',
        text: '#000000',
        accent: '#3B82F6',
        borderColor: '#CCCCCC'
      }
    },
    portalUrls: event.portalUrls || {},
    pricingRules: event.pricingRules || []
  };
};

// Helper to clean custom fields for backend schema compliance
function cleanCustomFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields.map(f => ({
    name: f.name,
    label: f.label,
    placeholder: f.placeholder,
    description: f.description,
    type: f.type,
    options: f.options || [],
    isRequired: f.required !== undefined ? f.required : (f.isRequired || false)
  }));
}

// Create a new event
const createEvent = async (eventData) => {
  try {
    const response = await axios.post(`${baseURL}/events`, eventData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await handleApiResponse(response);
    return formatEventData(data.event);
  } catch (error) {
    console.error('Error creating event:', error);
    return { 
      success: false, 
      message: error.response?.data?.message || 'Failed to create event'
    };
  }
};

// Fetch all events
const fetchEvents = async (params = {}) => {
  try {
    // Build query string from params
    const queryString = Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== null)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    const url = queryString ? `${baseURL}/events?${queryString}` : `${baseURL}/events`;
    
    const response = await axios.get(url);
    const data = await handleApiResponse(response);
    

    
    // Handle different API response formats
    if (data && Array.isArray(data)) {
      return data;
    } else if (data && data.events && Array.isArray(data.events)) {
      return {
        success: true,
        data: data.events.map(formatEventData),
        total: data.total || data.events.length
      };
    } else if (data && Array.isArray(data.data)) {
      return {
        success: true,
        data: data.data.map(formatEventData),
        total: data.total || data.data.length
      };
    } else {
      // Return whatever we got as a successful response
      return {
        success: true,
        data: data || [],
        total: (data && data.total) || 0
      };
    }
  } catch (error) {
    console.error('Error fetching events:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch events',
      data: [],
      total: 0
    };
  }
};

// Alias for backward compatibility
const getEvents = fetchEvents;

// Archive event (soft delete)
const archiveEvent = async (id) => {
  if (!id) {
    throw new Error('Event ID is required');
  }
  
  try {
    const response = await axios.patch(`${baseURL}/events/${id}/archive`);
    return await handleApiResponse(response);
  } catch (error) {
    console.error('Error archiving event:', error);
    throw error;
  }
};

// Fetch a single event by ID
const getEventById = async (id) => {
  if (!id) {
    console.error('getEventById called without an ID');
    throw new Error('Event ID is required');
  }
  
  try {
    const response = await axios.get(`${baseURL}/events/${id}`);
    const result = await handleApiResponse(response);
    
    // Handle the standardized response format from sendSuccess utility
    let eventData;
    
    if (result && result.success === true && result.data) {
      // The data property contains the event object
      eventData = result.data;
    } else if (result && result.data) {
      // Legacy format, the event is directly in the data property
      eventData = result.data;
    } else if (result) {
      // The result itself is the event (old format)
      eventData = result;
    } else {
      // No data found
      return {
        success: false,
        message: 'No event data found'
      };
    }
    
    // Ensure abstractSettings are properly defined
    if (!eventData.abstractSettings) {
      eventData.abstractSettings = {
        enabled: false,
        isOpen: false,
        deadline: null,
        maxLength: 500,
        allowEditing: false,
        guidelines: '',
        categories: [],
        notifyOnSubmission: false,
        allowFiles: false,
        maxFileSize: 5
      };
    } else {
      console.log('Found abstractSettings in event data:', eventData.abstractSettings);
      
      // Fix inconsistency: normalize isEnabled to enabled if needed
      if (eventData.abstractSettings.isEnabled !== undefined && eventData.abstractSettings.enabled === undefined) {
        eventData.abstractSettings.enabled = eventData.abstractSettings.isEnabled;
        delete eventData.abstractSettings.isEnabled;
      }
    }
    
    const formattedData = formatEventData(eventData);
    console.log('Formatted event data with abstractSettings:', formattedData.abstractSettings);
    
    return {
      success: true,
      data: formattedData
    };
  } catch (error) {
    console.error(`Error fetching event by ID ${id}:`, error);
    return {
      success: false,
      message: error.response?.data?.message || `Failed to fetch event with ID ${id}`
    };
  }
};

// Update an existing event
const updateEvent = async (eventId, eventData) => {
  try {
    console.log('[eventService.updateEvent] Original data:', eventData);
    
    // Create a clean copy of update data
    const updateData = { ...eventData };
    
    // COMPREHENSIVE FRONTEND PROTECTION: Remove empty/undefined settings to prevent overwrites
    
    // Protection for Pricing Rules - don't send empty arrays
    if (!updateData.pricingRules || updateData.pricingRules.length === 0) {
      console.log('[eventService.updateEvent] Removing empty pricingRules from update');
      delete updateData.pricingRules;
    }
    
    // Protection for Registration Settings - don't send empty objects
    if (updateData.registrationSettings && Object.keys(updateData.registrationSettings).length === 0) {
      console.log('[eventService.updateEvent] Removing empty registrationSettings from update');
      delete updateData.registrationSettings;
    }
    
    // Protection for Abstract Settings - don't send empty objects
    if (updateData.abstractSettings && Object.keys(updateData.abstractSettings).length === 0) {
      console.log('[eventService.updateEvent] Removing empty abstractSettings from update');
      delete updateData.abstractSettings;
    }
    
    // Protection for Email Settings - don't send empty objects
    if (updateData.emailSettings && Object.keys(updateData.emailSettings).length === 0) {
      console.log('[eventService.updateEvent] Removing empty emailSettings from update');
      delete updateData.emailSettings;
    }
    
    // Protection for Badge Settings - don't send empty objects
    if (updateData.badgeSettings && Object.keys(updateData.badgeSettings).length === 0) {
      console.log('[eventService.updateEvent] Removing empty badgeSettings from update');
      delete updateData.badgeSettings;
    }
    
    // Protection for Resource Settings - don't send empty objects
    if (updateData.resourceSettings && Object.keys(updateData.resourceSettings).length === 0) {
      console.log('[eventService.updateEvent] Removing empty resourceSettings from update');
      delete updateData.resourceSettings;
    }
    
    // Protection for Payment Settings - don't send empty objects
    if (updateData.paymentSettings && Object.keys(updateData.paymentSettings).length === 0) {
      console.log('[eventService.updateEvent] Removing empty paymentSettings from update');
      delete updateData.paymentSettings;
    }
    
    // Protection for Categories - don't send empty arrays
    if (!updateData.categories || updateData.categories.length === 0) {
      console.log('[eventService.updateEvent] Removing empty categories from update');
      delete updateData.categories;
    }
    
    // Protection for Workshops - don't send empty arrays
    if (!updateData.workshops || updateData.workshops.length === 0) {
      console.log('[eventService.updateEvent] Removing empty workshops from update');
      delete updateData.workshops;
    }
    
    // Protection for Schedule - don't send empty objects
    if (updateData.schedule && Object.keys(updateData.schedule).length === 0) {
      console.log('[eventService.updateEvent] Removing empty schedule from update');
      delete updateData.schedule;
    }
    
    // Remove fields that shouldn't be updated via general update
    delete updateData.createdBy;
    delete updateData.createdAt;
    delete updateData.__v;
    delete updateData._id;
    
    console.log('[eventService.updateEvent] Cleaned update data:', updateData);
    
    const response = await axios.put(`${baseURL}/events/${eventId}`, updateData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('[eventService.updateEvent] Error updating event:', error);
    throw error;
  }
};

// Delete an event (schedules with PurpleHat Advanced Security Protocol)
const deleteEvent = async (id, options = {}) => {
  if (!id) {
    console.error('deleteEvent called without an ID');
    throw new Error('Event ID is required');
  }
  
  try {
    const response = await axios.delete(`${baseURL}/events/${id}`, { data: options });
    return handleApiResponse(response);
  } catch (error) {
    console.error(`Error deleting event ${id}:`, error);
    return { 
      success: false, 
      message: error.response?.data?.message || 'Failed to schedule event deletion'
    };
  }
};

// Cancel scheduled event deletion
const cancelEventDeletion = async (id, reason = 'Cancelled by user') => {
  if (!id) {
    console.error('cancelEventDeletion called without an ID');
    throw new Error('Event ID is required');
  }
  
  try {
    const response = await axios.post(`${baseURL}/events/${id}/cancel-deletion`, { reason });
    return handleApiResponse(response);
  } catch (error) {
    console.error(`Error cancelling event deletion ${id}:`, error);
    return { 
      success: false, 
      message: error.response?.data?.message || 'Failed to cancel event deletion'
    };
  }
};

// Get event deletion status
const getEventDeletionStatus = async (id) => {
  if (!id) {
    console.error('getEventDeletionStatus called without an ID');
    throw new Error('Event ID is required');
  }
  
  try {
    const response = await axios.get(`${baseURL}/events/${id}/deletion-status`);
    return handleApiResponse(response);
  } catch (error) {
    // Handle 404 as "no deletion scheduled" instead of error
    if (error.response?.status === 404) {
      return {
        success: true,
        data: {
          hasScheduledDeletion: false,
          status: 'active'
        },
        message: 'No deletion scheduled'
      };
    }
    
    console.error(`Error getting deletion status for event ${id}:`, error);
    return { 
      success: false, 
      message: error.response?.data?.message || 'Failed to get deletion status'
    };
  }
};

/**
 * Get event statistics
 * @param {string} id - Event ID
 * @returns {Promise} - API response with event statistics
 */
const getEventStatistics = async (id) => {
  if (!id) {
    console.error('getEventStatistics called without an ID');
    throw new Error('Event ID is required');
  }
  
  try {
    // Get auth token from localStorage
    const token = localStorage.getItem('token');
    
    // Set up request headers with authorization
    const config = {
      headers: {}
    };
    
    // Add authentication header if token exists
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await axios.get(`${baseURL}/events/${id}/statistics`, config);
    const result = await handleApiResponse(response);
    
    // Format the statistics data to ensure consistent structure
    let formattedData;
    
    if (result && result.success === true && result.data) {
      formattedData = normalizeStatisticsData(result.data);
      console.log('Normalized statistics data:', formattedData);
      
      return {
        success: true,
        data: formattedData
      };
    } else if (result && !result.success) {
      return result; // Return the error response
    } else {
      return {
        success: true,
        data: {
          totalRegistrations: { total: 0, checkedIn: 0 },
          registrationsToday: 0,
          checkedIn: 0,
          categories: [],
          resourcesDistributed: { food: 0, kits: 0, certificates: 0 },
          abstractsSubmitted: 0,
          abstractsApproved: 0
        }
      };
    }
  } catch (error) {
    console.error(`Error fetching event statistics for ID ${id}:`, error);
    return {
      success: false,
      message: error.response?.data?.message || `Failed to fetch statistics for event with ID ${id}`,
      data: {
        totalRegistrations: { total: 0, checkedIn: 0 },
        registrationsToday: 0,
        checkedIn: 0,
        categories: [],
        resourcesDistributed: { food: 0, kits: 0, certificates: 0 },
        abstractsSubmitted: 0,
        abstractsApproved: 0
      }
    };
  }
};

/**
 * Helper function to normalize statistics data from various formats
 */
const normalizeStatisticsData = (data) => {
  // Create a normalized format with default values
  const normalized = {
    totalRegistrations: { total: 0, checkedIn: 0 },
    registrationsToday: 0,
    checkedIn: 0,
    categories: [],
    categoriesDetailed: [],
    resourcesDistributed: { food: 0, kits: 0, certificates: 0 },
    abstractsSubmitted: 0,
    abstractsApproved: 0
  };
  
  // Normalize registrations data
  if (data.registrations) {
    if (data.registrations.total !== undefined) {
      normalized.totalRegistrations.total = data.registrations.total;
    }
    if (data.registrations.checkedIn !== undefined) {
      normalized.totalRegistrations.checkedIn = data.registrations.checkedIn;
      normalized.checkedIn = data.registrations.checkedIn;
    }
    if (data.registrations.printed !== undefined) {
      normalized.totalRegistrations.printed = data.registrations.printed;
    }
    if (data.registrations.byCategory) {
      normalized.categories = Object.entries(data.registrations.byCategory)
        .map(([name, count]) => ({ name, count }));
    }
    if (Array.isArray(data.registrations.categoriesDetailed)) {
       normalized.categoriesDetailed = data.registrations.categoriesDetailed;
    }
  }
  
  // Normalize resources data
  if (data.resources) {
    // Format for resources: { food: { total, byType }, kitBags: { total, byType }, certificates: { total, byType } }
    if (data.resources.food && data.resources.food.total !== undefined) {
      normalized.resourcesDistributed.food = data.resources.food.total;
    }
    // Accept both kitBags and kitBag for compatibility, but always use kitBag in normalized output
    const kitBagData = data.resources.kitBag || data.resources.kitBags;
    if (kitBagData && kitBagData.total !== undefined) {
      normalized.resourcesDistributed.kitBag = kitBagData.total;
    }
    if (data.resources.certificates && data.resources.certificates.total !== undefined) {
      normalized.resourcesDistributed.certificates = data.resources.certificates.total;
    }
  }
  
  // Handle older API response formats
  if (data.registrationsCount !== undefined) {
    normalized.totalRegistrations.total = data.registrationsCount;
  }
  if (data.checkedInCount !== undefined) {
    normalized.totalRegistrations.checkedIn = data.checkedInCount;
    normalized.checkedIn = data.checkedInCount;
  }
  if (data.printedCount !== undefined) {
    normalized.totalRegistrations.printed = data.printedCount;
  }
  if (data.registrationsToday !== undefined) {
    normalized.registrationsToday = data.registrationsToday;
  }
  if (data.abstractsCount !== undefined) {
    normalized.abstractsSubmitted = data.abstractsCount;
  }
  if (data.abstractsApproved !== undefined) {
    normalized.abstractsApproved = data.abstractsApproved;
  }
  if (data.resourcesCount) {
    if (data.resourcesCount.food !== undefined) {
      normalized.resourcesDistributed.food = data.resourcesCount.food;
    }
    if (data.resourcesCount.kits !== undefined) {
      normalized.resourcesDistributed.kitBag = data.resourcesCount.kits;
    }
    if (data.resourcesCount.certificates !== undefined) {
      normalized.resourcesDistributed.certificates = data.resourcesCount.certificates;
    }
  }
  
  // If backend sent categoriesDetailed at top level (newer API)
  if (Array.isArray(data.categoriesDetailed) && data.categoriesDetailed.length) {
      normalized.categoriesDetailed = data.categoriesDetailed;
  }
  
  return normalized;
};

// Get event dashboard data
const getEventDashboard = async (id) => {
  if (!id) {
    console.error('getEventDashboard called without an ID');
    throw new Error('Event ID is required');
  }
  
  try {
    // Get auth token from localStorage
    const token = localStorage.getItem('token');
    
    // Set up request headers with authorization
    const config = {
      headers: {}
    };
    
    // Add authentication header if token exists
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await axios.get(`${baseURL}/events/${id}/dashboard`, config);
    const raw = await handleApiResponse(response);
    // 'raw' may contain its own success flag and a nested 'data' object
    const payload = raw.data || raw; // Support both formats

    return {
      success: true,
      data: {
        recentActivities: payload.recentActivities || []
      }
    };
  } catch (error) {
    console.error(`Error fetching event dashboard for ${id}:`, error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch event dashboard',
      data: {
        recentActivities: []
      }
    };
  }
};

// Get categories for a specific event
const getEventCategories = async (eventId) => {
  if (!eventId) throw new Error('getEventCategories called without eventId');
  try {
    console.log(`Fetching categories for event ID: ${eventId}`);
    // Detect sponsor portal context
    let headers = {};
    if (typeof window !== 'undefined' && window.location.pathname.includes('sponsor-portal')) {
      const sponsorToken = localStorage.getItem('sponsorToken');
      if (sponsorToken) {
        headers['Authorization'] = `Bearer ${sponsorToken}`;
      }
    }
    const response = await axios.get(`${baseURL}/events/${eventId}/categories`, { headers });
    console.log('Categories response:', response.data);
    return response.data;
  } catch (error) {
    console.error(`Error fetching categories for event ${eventId}:`, error);
    return {
      success: false,
      message: error.response?.data?.message || `Failed to fetch categories for event ${eventId}`,
      data: []
    };
  }
};

// Get registration form configuration for an event
const getRegistrationFormConfig = async (id) => {
  if (!id) {
    console.error('getRegistrationFormConfig called without an ID');
    throw new Error('Event ID is required');
  }
  
  try {
    // Try to get the event first - the registration config is likely part of the event object
    try {
      const eventResponse = await axios.get(`${baseURL}/events/${id}`);
      const eventData = await handleApiResponse(eventResponse);
      
      // Extract registration settings from the event
      let event = null;
      if (eventData.event) {
        event = eventData.event;
      } else if (eventData.data && typeof eventData.data === 'object') {
        event = eventData.data;
      } else if (eventData._id) {
        event = eventData;
      }
      
      if (event && event.registrationSettings) {
        // Use the registration settings from the event
        return {
          success: true,
          data: {
            requiredFields: event.registrationSettings.requiredFields || ['firstName', 'lastName', 'email', 'categoryId'],
            visibleFields: event.registrationSettings.visibleFields || [
              'firstName', 'lastName', 'email', 'phone', 'organization', 'title', 
              'categoryId', 'address', 'city', 'state', 'country', 'postalCode',
              'dietaryRestrictions', 'emergencyContact', 'emergencyPhone', 'specialRequirements',
              'agreeToTerms'
            ],
            fieldOrder: event.registrationSettings.fieldOrder || []
          }
        };
      }
    } catch (eventError) {
      console.warn('Could not get registration config from event:', eventError);
      // Continue to try the dedicated endpoint
    }
    
    // If we couldn't get it from the event, try the dedicated endpoint
    try {
      const response = await axios.get(`${baseURL}/events/${id}/registration-config`);
      const data = await handleApiResponse(response);
      
      return {
        success: true,
        data: data.config || data
      };
    } catch (error) {
      console.warn('Could not get registration config from dedicated endpoint:', error);
      // Return default config if both methods fail
      return {
        success: true,
        data: {
          requiredFields: ['firstName', 'lastName', 'email', 'categoryId'],
          visibleFields: [
            'firstName', 'lastName', 'email', 'phone', 'organization', 'title', 
            'categoryId', 'address', 'city', 'state', 'country', 'postalCode',
            'dietaryRestrictions', 'emergencyContact', 'emergencyPhone', 'specialRequirements',
            'agreeToTerms'
          ],
          fieldOrder: []
        }
      };
    }
  } catch (error) {
    console.error(`Error fetching registration form config for ${id}:`, error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch registration form config',
      data: null
    };
  }
};

// Create a category for an event
const createEventCategory = async (eventId, categoryData) => {
  if (!eventId) {
    console.error('createEventCategory called without an event ID');
    throw new Error('Event ID is required');
  }
  
  try {
    const response = await axios.post(`${baseURL}/events/${eventId}/categories`, categoryData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await handleApiResponse(response);
    
    return {
      success: true,
      message: 'Category created successfully',
      data: data
    };
  } catch (error) {
    console.error(`Error creating category for event ${eventId}:`, error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to create category',
      data: null
    };
  }
};

// Abstract settings
const saveAbstractSettings = async (eventId, settings) => {
  try {
    console.log(`Saving abstract settings for event ${eventId}:`, settings);
    
    const response = await axios.put(`${baseURL}/events/${eventId}/abstract-settings`, {
      settings
    });
    
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error saving abstract settings:', error);
    throw error;
  }
};

/**
 * Get badge settings for an event
 * @param {string} eventId - Event ID
 * @returns {Promise} - API response with badge settings
 */
const getBadgeSettings = async (eventId) => {
  try {
    const response = await axios.get(`${baseURL}/events/${eventId}/badge-settings`);
    return response;
  } catch (error) {
    console.error('Error fetching badge settings:', error);
    // Return default badge settings if API call fails
    return {
      success: true,
      data: {
        orientation: 'portrait',
        size: { width: 3.375, height: 5.375 },
        unit: 'in',
        background: '#FFFFFF',
        logo: null,
        fields: {
          name: { enabled: true, fontSize: 18, fontWeight: 'bold' },
          organization: { enabled: true, fontSize: 14, fontWeight: 'normal' },
          registrationId: { enabled: true, fontSize: 12, fontWeight: 'normal' },
          qrCode: { enabled: true, size: 100 }
        },
        colors: { background: '#FFFFFF', text: '#000000', accent: '#3B82F6' }
      }
    };
  }
};

/**
 * Get resource statistics for a specific resource type within an event.
 */
const getResourceTypeStatistics = async (eventId, resourceType) => {
  try {
    console.log(`[eventService] Fetching ${resourceType} stats for event ${eventId}`);
    // Corrected URL format:
    const response = await axios.get(`${baseURL}/resources/statistics/${eventId}/${resourceType}`);
    
    // The correct backend endpoint should directly return the data for the requested type.
    // No need for client-side filtering anymore.
    console.log(`[eventService] Response for ${resourceType} stats:`, response.data);
    
    // Check if the response was successful and data exists
    if (response.data && response.data.success && response.data.data) {
      return response.data.data; // Return the data object directly
    } else {
      // If the backend indicates success but no data, return default structure
      console.warn(`[eventService] No specific stats found for ${resourceType}, returning default.`);
      return { totalCount: 0, todayCount: 0, uniqueAttendees: 0 }; // Default structure
    }
  } catch (error) {
    console.error(`[eventService] Error fetching ${resourceType} statistics for event ${eventId}:`, error);
    // Return default structure on error to prevent crashes
    return { totalCount: 0, todayCount: 0, uniqueAttendees: 0 }; 
  }
};

// Fetch resource configuration for an event
const getResourceConfig = async (eventId) => {
  if (!eventId) {
    console.error('getResourceConfig called without eventId');
    return { success: false, message: 'Event ID is required', data: null };
  }
  try {
    const response = await axios.get(`${baseURL}/events/${eventId}/resource-config`);
    const result = await handleApiResponse(response); 
    
    if (result && result.success && result.data) {
      return result; // Return the {success, message, data} object
    } else {
      // Handle cases where handleApiResponse might return just data or an error structure
      console.warn('Unexpected response format from getResourceConfig API:', result);
      return { success: false, message: result?.message || 'Failed to parse resource config', data: null };
    }
  } catch (error) {
    console.error(`Error fetching resource config for event ${eventId}:`, error);
    return {
      success: false,
      message: error.response?.data?.message || `Failed to fetch resource config for event ${eventId}`,
      data: null
    };
  }
};

// Fetch users associated with a specific event
const getEventUsers = async (eventId) => {
  if (!eventId) {
    console.error('getEventUsers called without an event ID');
    return {
      success: false,
      message: 'Event ID is required to fetch users.',
      data: [],
      count: 0
    };
  }
  try {
    const response = await axios.get(`${baseURL}/events/${eventId}/users`);
    const result = await handleApiResponse(response);

    if (result && result.success) {
      return {
        success: true,
        data: result.data || [],
        count: result.count || (result.data ? result.data.length : 0)
      };
    }
    // If result.success is not explicitly true, treat as failure or unexpected format
    return {
      success: false,
      message: result?.message || 'Failed to fetch event users or unexpected response format',
      data: [],
      count: 0
    };
  } catch (error) {
    console.error(`Error fetching users for event ${eventId}:`, error);
    return {
      success: false,
      message: error.response?.data?.message || `Failed to fetch users for event ${eventId}`,
      data: [],
      count: 0
    };
  }
};

/**
 * Fetch users specifically designated as reviewers for an event's abstract workflow.
 * @param {string} eventId - The ID of the event.
 * @returns {Promise<object>} The API response with reviewer data.
 */
const getEventReviewers = async (eventId) => {
  if (!eventId) {
    console.error('getEventReviewers called without an eventId');
    return { success: false, message: 'Event ID is required', data: [] };
  }
  try {
    // Uses the main 'api' instance from apiService.js which should have auth interceptors
    const response = await axios.get(`${baseURL}/events/${eventId}/abstract-workflow/reviewers`);
    return await handleApiResponse(response); // Assumes handleApiResponse processes it correctly
  } catch (error) {
    console.error(`Error fetching reviewers for event ${eventId}:`, error);
    return {
      success: false,
      message: error.response?.data?.message || `Failed to fetch reviewers for event ${eventId}`,
      data: []
    };
  }
};

const getEventCategoriesPublic = async (eventId) => {
  if (!eventId) {
    console.warn('getEventCategoriesPublic called without eventId');
    return {
      success: false,
      message: 'Event ID is required',
      data: []
    };
  }
  try {
    console.log(`Fetching PUBLIC categories for event ID: ${eventId}`);
    const response = await axios.get(`${baseURL}/events/${eventId}/public-categories`);
    console.log('Public categories response:', response.data);
    return response.data;
  } catch (error) {
    console.error(`Error fetching public categories for event ${eventId}:`, error);
    return {
      success: false,
      message: error.response?.data?.message || `Failed to fetch public categories for event ${eventId}`,
      data: []
    };
  }
};

// Fetch sponsors for an event
const getEventSponsors = async (eventId) => {
  if (!eventId) {
    throw new Error('Event ID is required to fetch sponsors');
  }
  try {
    const response = await axios.get(`${baseURL}/events/${eventId}/sponsors`);
    // Assume backend returns { success, data: [sponsors] }
    return response.data;
  } catch (error) {
    console.error('Error fetching event sponsors:', error);
    return { success: false, message: error.response?.data?.message || 'Failed to fetch sponsors', results: [] };
  }
};

// Get categories for the sponsor portal (sponsor's event only)
const getSponsorPortalCategories = async () => {
  try {
    let headers = {};
    if (typeof window !== 'undefined') {
      const sponsorToken = localStorage.getItem('sponsorToken');
      if (sponsorToken) {
        headers['Authorization'] = `Bearer ${sponsorToken}`;
      }
    }
    const response = await axios.get(`${baseURL}/sponsor-portal-auth/me/categories`, { headers });
    return response.data;
  } catch (error) {
    console.error('Error fetching sponsor portal categories:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch sponsor categories',
      data: []
    };
  }
};

// Specific update functions for individual settings tabs
const updateEventGeneralSettings = async (eventId, generalData) => {
  try {
    console.log('[eventService.updateEventGeneralSettings] Updating only general settings');
    const response = await axios.put(`${baseURL}/events/${eventId}`, {
      name: generalData.name,
      description: generalData.description,
      startDate: generalData.startDate,
      endDate: generalData.endDate,
      location: generalData.location,
      timezone: generalData.timezone,
      status: generalData.status,
      maxAttendees: generalData.maxAttendees,
      venue: generalData.venue,
      registrationSettings: generalData.registrationSettings // Only if specifically updating
    });
    return response.data;
  } catch (error) {
    console.error('[eventService.updateEventGeneralSettings] Error:', error);
    throw error;
  }
};

const updateEventRegistrationSettings = async (eventId, registrationSettings) => {
  try {
    console.log('[eventService.updateEventRegistrationSettings] Updating only registration settings');
    const response = await axios.put(`${baseURL}/events/${eventId}`, {
      registrationSettings
    });
    return response.data;
  } catch (error) {
    console.error('[eventService.updateEventRegistrationSettings] Error:', error);
    throw error;
  }
};

const updateEventAbstractSettings = async (eventId, abstractSettings) => {
  try {
    console.log('[eventService.updateEventAbstractSettings] Updating only abstract settings');
    const response = await axios.put(`${baseURL}/events/${eventId}`, {
      abstractSettings
    });
    return response.data;
  } catch (error) {
    console.error('[eventService.updateEventAbstractSettings] Error:', error);
    throw error;
  }
};

const updateEventEmailSettings = async (eventId, emailSettings) => {
  try {
    console.log('[eventService.updateEventEmailSettings] Updating only email settings');
    const response = await axios.put(`${baseURL}/events/${eventId}`, {
      emailSettings
    });
    return response.data;
  } catch (error) {
    console.error('[eventService.updateEventEmailSettings] Error:', error);
    throw error;
  }
};

const updateEventBadgeSettings = async (eventId, badgeSettings) => {
  try {
    console.log('[eventService.updateEventBadgeSettings] Updating only badge settings');
    const response = await axios.put(`${baseURL}/events/${eventId}`, {
      badgeSettings
    });
    return response.data;
  } catch (error) {
    console.error('[eventService.updateEventBadgeSettings] Error:', error);
    throw error;
  }
};

const updateEventResourceSettings = async (eventId, resourceSettings) => {
  try {
    console.log('[eventService.updateEventResourceSettings] Updating only resource settings');
    const response = await axios.put(`${baseURL}/events/${eventId}`, {
      resourceSettings
    });
    return response.data;
  } catch (error) {
    console.error('[eventService.updateEventResourceSettings] Error:', error);
    throw error;
  }
};

const updateEventPaymentSettings = async (eventId, paymentSettings) => {
  try {
    console.log('[eventService.updateEventPaymentSettings] Updating only payment settings');
    const response = await axios.put(`${baseURL}/events/${eventId}`, {
      paymentSettings
    });
    return response.data;
  } catch (error) {
    console.error('[eventService.updateEventPaymentSettings] Error:', error);
    throw error;
  }
};

const updateEventCategories = async (eventId, categories) => {
  try {
    console.log('[eventService.updateEventCategories] Updating only categories');
    const response = await axios.put(`${baseURL}/events/${eventId}`, {
      categories
    });
    return response.data;
  } catch (error) {
    console.error('[eventService.updateEventCategories] Error:', error);
    throw error;
  }
};

const updateEventWorkshops = async (eventId, workshops) => {
  try {
    console.log('[eventService.updateEventWorkshops] Updating only workshops');
    const response = await axios.put(`${baseURL}/events/${eventId}`, {
      workshops
    });
    return response.data;
  } catch (error) {
    console.error('[eventService.updateEventWorkshops] Error:', error);
    throw error;
  }
};

const eventService = {
  createEvent,
  fetchEvents,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  cancelEventDeletion,
  getEventDeletionStatus,
  archiveEvent,
  getEventStatistics,
  getEventDashboard,
  getEventCategories,
  getRegistrationFormConfig,
  createEventCategory,
  saveAbstractSettings,
  getBadgeSettings,
  getResourceTypeStatistics,
  getResourceConfig,
  getEventUsers,
  getEventReviewers,
  getEventCategoriesPublic,
  getEventSponsors,
  getSponsorPortalCategories,
  // New specific update functions
  updateEventGeneralSettings,
  updateEventRegistrationSettings,
  updateEventAbstractSettings,
  updateEventEmailSettings,
  updateEventBadgeSettings,
  updateEventResourceSettings,
  updateEventPaymentSettings,
  updateEventCategories,
  updateEventWorkshops
};

export default eventService; 