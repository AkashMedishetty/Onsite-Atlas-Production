import api from './apiService';

const resourceBlockingService = {
  /**
   * Get all resource blocks for a registration
   * @param {string} eventId - Event ID
   * @param {string} registrationId - Registration ID
   * @returns {Promise} - API response
   */
  getResourceBlocks: async (eventId, registrationId) => {
    try {
      const response = await api.get(`/events/${eventId}/registrations/${registrationId}/resource-blocking`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Block a resource for a registration
   * @param {string} eventId - Event ID
   * @param {string} registrationId - Registration ID
   * @param {Object} blockData - Block data
   * @returns {Promise} - API response
   */
  blockResource: async (eventId, registrationId, blockData) => {
    try {
      const response = await api.post(`/events/${eventId}/registrations/${registrationId}/resource-blocking`, blockData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Remove a resource block
   * @param {string} eventId - Event ID
   * @param {string} registrationId - Registration ID
   * @param {string} resourceId - Resource ID to unblock
   * @param {string} reason - Reason for removal
   * @returns {Promise} - API response
   */
  removeResourceBlock: async (eventId, registrationId, resourceId, reason) => {
    try {
      const response = await api.delete(`/events/${eventId}/registrations/${registrationId}/resource-blocking/${resourceId}`, {
        data: { reason }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Check if a resource is blocked for a registration
   * @param {string} eventId - Event ID
   * @param {string} registrationId - Registration ID
   * @param {string} resourceId - Resource ID to check
   * @returns {Promise} - API response
   */
  checkResourceBlock: async (eventId, registrationId, resourceId) => {
    try {
      const response = await api.get(`/events/${eventId}/registrations/${registrationId}/resource-blocking/${resourceId}/check`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error checking resource block:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to check resource block'
      };
    }
  }
};

export default resourceBlockingService; 