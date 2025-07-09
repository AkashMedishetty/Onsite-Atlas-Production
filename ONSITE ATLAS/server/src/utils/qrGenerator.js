/**
 * QR Code generation utility using the qrcode library
 * Generates QR codes for registration IDs, verification URLs, and other data
 */

const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');

/**
 * Generate a QR code for a registration ID or data
 * @param {String} data - The data to encode (registration ID, URL, etc.)
 * @param {Object} options - Options for QR code generation
 * @returns {Promise<String>} - Data URI of the QR code
 */
const generateQRCode = async (data, options = {}) => {
  try {
    const opts = {
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      type: 'image/png',
      margin: options.margin || 2,
      width: options.width || 256,
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#ffffff'
      }
    };
    
    // Generate QR code as data URI
    const dataUri = await QRCode.toDataURL(data, opts);
    return dataUri;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Generate a QR code and save it to file
 * @param {String} data - The data to encode
 * @param {String} filePath - Path where to save the QR code
 * @param {Object} options - Options for QR code generation
 * @returns {Promise<String>} - File path of the saved QR code
 */
const generateQRCodeToFile = async (data, filePath, options = {}) => {
  try {
    const opts = {
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      margin: options.margin || 2,
      width: options.width || 256,
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#ffffff'
      }
    };
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    // Generate QR code and save to file
    await QRCode.toFile(filePath, data, opts);
    return filePath;
  } catch (error) {
    console.error('Error generating QR code to file:', error);
    throw new Error('Failed to generate QR code file');
  }
};

/**
 * Generate a QR code for registration verification
 * @param {String} registrationId - The registration ID
 * @param {String} eventId - The event ID
 * @param {Object} options - Options for QR code generation
 * @returns {Promise<String>} - Data URI of the QR code
 */
const generateRegistrationQRCode = async (registrationId, eventId, options = {}) => {
  const baseUrl = process.env.FRONTEND_URL || process.env.API_URL || 'https://app.onsite-atlas.com';
  const verificationUrl = `${baseUrl}/verify-registration/${eventId}/${registrationId}`;
  
  return generateQRCode(verificationUrl, {
    ...options,
    width: 200,
    margin: 1
  });
};

/**
 * Generate a QR code for check-in verification
 * @param {String} registrationId - The registration ID
 * @param {String} eventId - The event ID
 * @param {Object} options - Options for QR code generation
 * @returns {Promise<String>} - Data URI of the QR code
 */
const generateCheckInQRCode = async (registrationId, eventId, options = {}) => {
  const baseUrl = process.env.FRONTEND_URL || process.env.API_URL || 'https://app.onsite-atlas.com';
  const checkInUrl = `${baseUrl}/check-in/${eventId}/${registrationId}`;
  
  return generateQRCode(checkInUrl, {
    ...options,
    width: 150,
    margin: 1
  });
};

/**
 * Generate a QR code for certificate verification
 * @param {String} certificateId - The certificate ID
 * @param {String} registrationId - The registration ID
 * @param {Object} options - Options for QR code generation
 * @returns {Promise<String>} - Data URI of the QR code
 */
const generateCertificateQRCode = async (certificateId, registrationId, options = {}) => {
  const baseUrl = process.env.FRONTEND_URL || process.env.API_URL || 'https://app.onsite-atlas.com';
  const verificationUrl = `${baseUrl}/verify-certificate/${certificateId}/${registrationId}`;
  
  return generateQRCode(verificationUrl, {
    ...options,
    width: 128,
    margin: 1
  });
};

module.exports = {
  generateQRCode,
  generateQRCodeToFile,
  generateRegistrationQRCode,
  generateCheckInQRCode,
  generateCertificateQRCode
}; 