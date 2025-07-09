const Registration = require('../models/Registration');
const ResourceSetting = require('../models/ResourceSetting');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { generateCertificateQRCode } = require('../utils/qrGenerator');

/**
 * Certificate Service
 * Provides unified interface for certificate generation and management
 */
class CertificateService {
  
  /**
   * Generate certificate for a registration
   * @param {String} registrationId - Registration ID
   * @param {String} eventId - Event ID  
   * @param {String} templateId - Certificate template ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Certificate data with download URL
   */
  async generateCertificate(registrationId, eventId, templateId = null, options = {}) {
    try {
      // Find registration
      const registration = await Registration.findById(registrationId)
        .populate('event', 'name startDate endDate venue')
        .populate('category', 'name');
      
      if (!registration) {
        throw new ApiError('Registration not found', 404);
      }
      
      if (registration.event._id.toString() !== eventId) {
        throw new ApiError('Registration does not belong to the specified event', 400);
      }
      
      // Check if event has ended (certificates only available after event)
      const eventEndDate = new Date(registration.event.endDate);
      const now = new Date();
      
      if (eventEndDate > now && !options.forceGenerate) {
        throw new ApiError('Certificates will be available after the event ends', 400);
      }
      
      // Get certificate template
      if (!templateId) {
        templateId = await this.getDefaultCertificateTemplate(eventId);
      }
      
      if (!templateId) {
        throw new ApiError('No certificate template found for this event', 404);
      }
      
      // Generate QR code for certificate verification
      const qrCode = await generateCertificateQRCode(
        registration._id.toString(), 
        registration.registrationId
      );
      
      // Mark certificate as issued
      registration.certificateIssued = true;
      registration.certificateIssuedDate = new Date();
      registration.certificateTemplateId = templateId;
      await registration.save();
      
      const certificateData = {
        id: registration._id,
        registrationId: registration.registrationId,
        participantName: `${registration.personalInfo?.firstName} ${registration.personalInfo?.lastName}`,
        eventName: registration.event.name,
        eventDate: registration.event.startDate,
        venue: registration.event.venue,
        categoryName: registration.category?.name,
        issuedDate: registration.certificateIssuedDate,
        templateId: templateId,
        qrCode: qrCode,
        downloadUrl: `/api/resources/events/${eventId}/certificate-templates/${templateId}/registrations/${registrationId}/generate-pdf`,
        verificationUrl: `${process.env.FRONTEND_URL}/verify-certificate/${registration._id}/${registration.registrationId}`
      };
      
      logger.info(`Certificate generated for registration ${registrationId} in event ${eventId}`);
      
      return certificateData;
      
    } catch (error) {
      logger.error('Error generating certificate:', error);
      throw error;
    }
  }
  
  /**
   * Check if certificate is available for download
   * @param {String} registrationId - Registration ID
   * @returns {Promise<Object>} Certificate availability status
   */
  async checkCertificateAvailability(registrationId) {
    try {
      const registration = await Registration.findById(registrationId)
        .populate('event', 'name startDate endDate');
      
      if (!registration) {
        return { available: false, reason: 'Registration not found' };
      }
      
      // Check if event has ended
      const eventEndDate = new Date(registration.event.endDate);
      const now = new Date();
      
      if (eventEndDate > now) {
        return { 
          available: false, 
          reason: 'Certificate will be available after the event ends',
          availableDate: eventEndDate
        };
      }
      
      // Check if certificate is issued
      if (!registration.certificateIssued) {
        return { 
          available: false, 
          reason: 'Certificate is being processed. You will be notified when ready.',
          status: 'processing'
        };
      }
      
      return { 
        available: true, 
        issuedDate: registration.certificateIssuedDate,
        templateId: registration.certificateTemplateId
      };
      
    } catch (error) {
      logger.error('Error checking certificate availability:', error);
      return { available: false, reason: 'Error checking certificate status' };
    }
  }
  
  /**
   * Get default certificate template for an event
   * @param {String} eventId - Event ID
   * @returns {Promise<String|null>} Template ID
   */
  async getDefaultCertificateTemplate(eventId) {
    try {
      const resourceSetting = await ResourceSetting.findOne({
        event: eventId,
        type: 'certificatePrinting',
        isEnabled: true
      });
      
      if (!resourceSetting || !resourceSetting.certificatePrintingTemplates || 
          resourceSetting.certificatePrintingTemplates.length === 0) {
        return null;
      }
      
      // Return the first template or the one marked as default
      const defaultTemplate = resourceSetting.certificatePrintingTemplates.find(t => t.isDefault);
      if (defaultTemplate) {
        return defaultTemplate._id.toString();
      }
      
      return resourceSetting.certificatePrintingTemplates[0]._id.toString();
      
    } catch (error) {
      logger.error('Error getting default certificate template:', error);
      return null;
    }
  }
  
  /**
   * Bulk generate certificates for multiple registrations
   * @param {Array} registrationIds - Array of registration IDs
   * @param {String} eventId - Event ID
   * @param {String} templateId - Certificate template ID
   * @returns {Promise<Object>} Bulk generation results
   */
  async bulkGenerateCertificates(registrationIds, eventId, templateId = null) {
    const results = {
      successful: [],
      failed: [],
      total: registrationIds.length
    };
    
    for (const registrationId of registrationIds) {
      try {
        const certificate = await this.generateCertificate(registrationId, eventId, templateId, {
          forceGenerate: true
        });
        results.successful.push({
          registrationId,
          certificate
        });
      } catch (error) {
        results.failed.push({
          registrationId,
          error: error.message
        });
      }
    }
    
    logger.info(`Bulk certificate generation completed. Successful: ${results.successful.length}, Failed: ${results.failed.length}`);
    
    return results;
  }
  
  /**
   * Verify certificate authenticity
   * @param {String} certificateId - Certificate ID
   * @param {String} registrationId - Registration ID
   * @returns {Promise<Object>} Verification result
   */
  async verifyCertificate(certificateId, registrationId) {
    try {
      const registration = await Registration.findOne({
        _id: certificateId,
        registrationId: registrationId,
        certificateIssued: true
      })
      .populate('event', 'name startDate endDate venue')
      .populate('category', 'name');
      
      if (!registration) {
        return { valid: false, reason: 'Certificate not found or not issued' };
      }
      
      return {
        valid: true,
        certificateData: {
          participantName: `${registration.personalInfo?.firstName} ${registration.personalInfo?.lastName}`,
          eventName: registration.event.name,
          eventDate: registration.event.startDate,
          venue: registration.event.venue,
          categoryName: registration.category?.name,
          issuedDate: registration.certificateIssuedDate,
          registrationId: registration.registrationId
        }
      };
      
    } catch (error) {
      logger.error('Error verifying certificate:', error);
      return { valid: false, reason: 'Error verifying certificate' };
    }
  }
  
}

module.exports = new CertificateService(); 