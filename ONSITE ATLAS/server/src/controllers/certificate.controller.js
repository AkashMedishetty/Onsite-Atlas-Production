// @desc    Download certificate for registrant
// @route   GET /api/certificates/download/:registrationId
// @access  Public (registrants)
const downloadCertificate = async (req, res, next) => {
  try {
    const { registrationId } = req.params;
    
    if (!registrationId) {
      return res.status(400).json({
        success: false,
        message: 'Registration ID is required'
      });
    }

    // Find registration
    const Registration = require('../models/Registration');
const StandardErrorHandler = require('../utils/standardErrorHandler');
    const registration = await Registration.findOne({ registrationId })
      .populate('event', 'name startDate endDate')
      .populate('category', 'name');

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Check if certificate is issued
    if (!registration.certificateIssued) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not available yet. Please check back later.'
      });
    }

    // For now, return success (in real implementation, would generate/return PDF)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Certificate-${registrationId}.pdf"`);
    
    // Simulate PDF response
    return res.json({
      success: true,
      message: 'Certificate ready for download',
      data: {
        registrationId,
        certificateUrl: `/certificates/${registrationId}.pdf`,
        issuedDate: registration.certificateIssuedDate || new Date()
      }
    });

  } catch (error) {
    console.error('Error downloading certificate:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving certificate'
    });
  }
};

module.exports = {
  // ... existing exports
  downloadCertificate
}; 