const mongoose = require('mongoose');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const Category = require('../models/Category');
const { createApiError } = require('../middleware/error');
const asyncHandler = require('../middleware/async');
const Resource = require('../models/Resource');
const StandardErrorHandler = require('../utils/standardErrorHandler');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const { sendPaginated } = require('../utils/pagination');
const { sendSuccess } = require('../utils/responseFormatter');
const { getNextSequenceValue, getNextSequenceBlock } = require('../utils/counterUtils');
const ExcelJS = require('exceljs');
const ImportJob = require('../models/ImportJob');
const { processBulkImportJob } = require('../services/registrationImportService');
const logger = require('../config/logger');
const jwt = require('jsonwebtoken');
const emailService = require('../services/emailService');
const AdminNotificationService = require('../services/adminNotificationService');

// @desc    Get all registrations
// @route   GET /api/registrations
// @route   GET /api/events/:id/registrations
// @access  Private
const getRegistrations = asyncHandler(async (req, res) => {
  // Extract query parameters
  const { categoryId, status, search, page = 1, limit = 10 } = req.query;
  
  const eventId = req && req.params && req.params.id || req && req.query && req.query.eventId;
  
  console.log('Getting registrations with eventId:', eventId);
  
  const filter = {};
  
  if (eventId) {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return sendSuccess(res, 400, 'Invalid Event ID format');
    }
    filter.event = eventId;
    console.log('Filtering registrations by event:', eventId);
  } else {
    console.warn(`[getRegistrations] Access attempt without eventId. User: ${req && req.user && req.user.id || 'UNKNOWN'}`);
    return sendPaginated(res, {
        message: 'Event ID is required to list registrations.',
        data: [],
        page: 1,
        limit: parseInt(limit),
        total: 0
    }, 400);
  }
  
  // Support both 'category' and 'categoryId' as query params
  const categoryFilter = req && req.query && req.query.categoryId || req && req.query && req.query.category;
  if (categoryFilter) filter.category = categoryFilter;
  
  if (status) filter.status = status;
  
  // Add support for badgePrinted and registrationType filters
  if (req && req.query && req.query.badgePrinted !== undefined && req && req.query && req.query.badgePrinted !== '') {
    filter.badgePrinted = req && req.query && req.query.badgePrinted === 'true';
  }
  if (req && req.query && req.query.registrationType) {
    filter.registrationType = req && req.query && req.query.registrationType;
  }
  
  if (search) {
    filter.$or = [
      { registrationId: { $regex: search, $options: 'i' } },
      { 'personalInfo.firstName': { $regex: search, $options: 'i' } },
      { 'personalInfo.lastName': { $regex: search, $options: 'i' } },
      { 'personalInfo.email': { $regex: search, $options: 'i' } },
      { 'personalInfo.organization': { $regex: search, $options: 'i' } },
      { 'personalInfo.phone': { $regex: search, $options: 'i' } },
      // Support searching by full name (firstName + ' ' + lastName)
      {
        $expr: {
          $regexMatch: {
            input: { $concat: ['$personalInfo.firstName', ' ', '$personalInfo.lastName'] },
            regex: search,
            options: 'i'
          }
        }
      }
    ];
  }
  
  console.log('Registration filter:', JSON.stringify(filter, null, 2));
  
  const nLimit = parseInt(limit);
  const nPage = parseInt(page);
  const skip = (nPage - 1) * nLimit;
  
  const registrations = await Registration.find(filter)
    .populate('event', 'name startDate endDate logo')
    .populate('category', 'name color')
    .populate('printedBy', 'name email')
    .populate('sponsoredBy', 'companyName name contactPerson email phone sponsorshipLevel')
    .skip(skip)
    .limit(nLimit)
    .sort({ createdAt: -1 });
  
  console.log(`Found ${registrations && registrations.length} registrations`);
  
  const total = await Registration.countDocuments(filter);
  console.log(`Pagination values: total=${total}, page=${nPage}, limit=${nLimit}`);

  // Check if this is a specific lookup for registrant authentication
  // The frontend abstract portal uses search with registrationId and limit=1
  if (search && nLimit === 1 && total === 1 && registrations.length === 1) {
    const registrant = registrations[0];
    // Generate JWT for the registrant
    const payload = {
        id: registrant._id, // Registrant's MongoDB ID
        eventId: registrant.event?._id || registrant.event, // Ensure eventId is included
        registrationId: registrant.registrationId, // Include the string Registration ID
        type: 'registrant' 
    };
    
    // Use a specific secret for registrants if available, otherwise fallback to general JWT_SECRET
    const secret = process && process.env && process.env.REGISTRANT_JWT_SECRET || process && process.env && process.env.JWT_SECRET;
    const expiresIn = process && process.env && process.env.REGISTRANT_JWT_EXPIRES_IN || process && process.env && process.env.JWT_EXPIRES_IN || '1d';

    if (!secret) {
      console.error('[getRegistrations] JWT_SECRET or REGISTRANT_JWT_SECRET not configured for registrant login.');
      return StandardErrorHandler.sendError(res, 500, 'Server configuration error: JWT secret not set.');
    }

    const token = jwt.sign(payload, secret, { expiresIn });

    console.log(`[getRegistrations] Issuing JWT for registrant: ${registrant.registrationId}`);
    return res.status(200).json({
        success: true,
        message: 'Registrant authenticated successfully.',
        data: registrant, // Send the single registration object
        token: token      // Send the token
    });
  }
  
  // Otherwise, return paginated response as usual
  return sendPaginated(res, {
      message: 'Registrations retrieved successfully',
      data: registrations,
      page: nPage,
      limit: nLimit,
      total: total
  });
});

// @desc    Get count of registrations for an event
// @route   GET /api/events/:eventId/registrations/count
// @access  Private
const getRegistrationsCount = asyncHandler(async (req, res) => {
  // Get eventId from route parameters
  const eventId = req && req.params && req.params.eventId;
  
  console.log('Getting registration count for event:', eventId);
  
  if (!eventId) {
    return sendSuccess(res, 400, 'Event ID is required', { count: 0 });
  }
  
  try {
    // Build filter object
    const filter = { event: eventId };
    
    // Get counts for different statuses
    const totalCount = await Registration.countDocuments(filter);
    const checkedInCount = await Registration.countDocuments({
      ...filter,
      status: 'checked-in'
    });
    
    // Get counts by category
    const categoryCounts = await Registration.aggregate([
      { $match: filter },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    
    // Create a map of category IDs to counts
    const categoryCountMap = {};
    for (const item of categoryCounts) {
      if (item._id) {
        categoryCountMap[item && item._id && item._id.toString()] = item.count;
      }
    }
    
    // Get registrations created today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    const todayCount = await Registration.countDocuments({
      ...filter,
      createdAt: { $gte: startOfToday }
    });
    
    console.log(`Found ${totalCount} total registrations, ${checkedInCount} checked in, ${todayCount} today`);
    
    return sendSuccess(res, 200, 'Registration counts retrieved successfully', {
      total: totalCount,
      checkedIn: checkedInCount,
      categories: categoryCountMap,
      today: todayCount
    });
  } catch (error) {
    console.error('Error getting registration counts:', error);
    return sendSuccess(res, 500, 'Error retrieving registration counts', { count: 0 });
  }
});

// @desc    Get a single registration by ID
// @route   GET /api/registrations/:registrationId
// @route   GET /api/events/:id/registrations/:registrationId  <-- Nested Route
// @access  Private
const getRegistrationById = asyncHandler(async (req, res) => {
  const registrationId = req && req.params && req.params.registrationId;
  const eventId = req && req.params && req.params.id; // Event ID from parent route if nested

  if (!mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(registrationId)) {
     return sendSuccess(res, 400, 'Invalid Registration ID format');
  }

  // Build query - always use registrationId
  const query = { _id: registrationId };
  
  // If eventId is present (nested route), enforce it
  if (eventId) {
    if (!mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(eventId)) {
      return sendSuccess(res, 400, 'Invalid Event ID format');
    }
    query.event = eventId; 
    console.log(`[getRegistrationById] Scoping query to event ${eventId}`);
  }

  const registration = await Registration.findOne(query);
  if (!registration) {
    return StandardErrorHandler.sendError(res, 404, 'Resource not found');
  }
  
  if (!registration) {
    // Make error message more specific
    const notFoundMessage = eventId
       ? `Registration with ID ${registrationId} not found within event ${eventId}`
       : `Registration not found with ID ${registrationId}`;
    return sendSuccess(res, 404, notFoundMessage);
  }
  
  // If accessed via non-nested route, eventId might be undefined, which is fine.
  // The check above handles the case where it IS nested.
  
  return sendSuccess(res, 200, 'Registration retrieved successfully', registration);
});

// @desc    Create a new registration
// @route   POST /api/registrations
// @route   POST /api/events/:eventId/registrations
// @access  Private
const createRegistration = asyncHandler(async (req, res) => {
  // Get eventId from params if route is nested, otherwise from body
  const eventId = req && req.params && req.params.eventId || req && req.body && req.body.eventId && req && req.body && req.body.eventId; 
  const { categoryId, personalInfo, seatHoldIds = [], amountCents = 0, currency = 'INR'  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };
  
  // Validate required fields
  if (!eventId || !categoryId || !personalInfo) {
    return sendSuccess(res, 400, 'Missing required fields: eventId, categoryId, personalInfo');
  }
  
  // Check if event exists
  const event = await Event.findById(eventId);
  if (!event) {
    return sendSuccess(res, 404, 'Event not found');
  }
  
  // Check if category exists
  const category = await Category.findById(categoryId);
  if (!category) {
    return sendSuccess(res, 404, 'Category not found');
  }
  
  // Validate accompanying persons' custom fields
  const accompanyingPersonFields = event.registrationSettings?.accompanyingPersonFields || [];
  const requiredAccompanyingFields = accompanyingPersonFields.filter(f => f.isRequired).map(f => f.name);
  const accompanyingPersons = req && req.body && req.body.accompanyingPerson && req && req.body && req.body.accompanyingPersons || [];
  for (const [idx, person] of accompanyingPersons.entries()) {
    for (const fieldName of requiredAccompanyingFields) {
      if (!person.customFields || person.customFields[fieldName] === undefined || person.customFields[fieldName] === "") {
        return sendSuccess(res, 400, `Accompanying person #${idx + 1} is missing required field: ${fieldName}`);
      }
    }
  }
  
  // --- Use Counter Pattern for ID Generation --- 
  const registrationPrefix = event.registrationSettings?.idPrefix || 'REG';
  const startNumber = event.registrationSettings?.startNumber || 1;
  const sequenceName = `${eventId}_registration_id`; // Unique sequence name per event
  
  let registrationId;
  try {
    const nextNumber = await getNextSequenceValue(sequenceName, startNumber);
    const formattedNumber = nextNumber.toString().padStart(4, '0'); // Pad to 4 digits
    registrationId = `${registrationPrefix}-${formattedNumber}`;

    // Optional: Double-check uniqueness just in case (though counter should handle it)
    const existing = await Registration.findOne({ event: eventId, registrationId: registrationId });
    if (existing) {
       // This case should be extremely rare with the atomic counter
       console.error(`Generated duplicate ID ${registrationId} for event ${eventId} despite using counter. Retrying might be needed or check counter logic.`);
       return sendSuccess(res, 500, 'Failed to generate unique registration ID. Please try again.');
    }

  } catch (error) {
     console.error("Error generating registration ID using counter:", error);
     return sendSuccess(res, 500, 'Failed to generate registration ID');
  }
  // --- End ID Generation ---
  
  // Determine registrationType based on event start date (admin logic)
  let registrationType = 'pre-registered';
  if (new Date() > new Date(event.startDate)) {
    registrationType = 'onsite';
  }
  if (req && req.body && req.body.registrationType && req && req.body && req.body.registrationType) {
    registrationType = req && req.body && req.body.registrationType && req && req.body && req.body.registrationType;
  }

  // Create new registration
  const registration = await Registration.create({
    registrationId,
    event: eventId,
    category: categoryId,
    personalInfo,
    // PATCH: Save professionalInfo if provided
    ...(req && req.body && req.body.professionalInf && req && req.body && req.body.professionalInfo && { professionalInfo: req && req.body && req.body.professionalInfo && req && req.body && req.body.professionalInfo }),
    // PATCH: Save customFields if provided
    ...(req && req.body && req.body.customField && req && req.body && req.body.customFields && { customFields: req && req.body && req.body.customFields && req && req.body && req.body.customFields }),
    registrationType,
    status: 'active', // Ensure status is valid based on schema enum
    amountCents,
    currency,
    seatHolds: seatHoldIds,
    paymentStatus: amountCents > 0 ? 'pending' : 'paid',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  // Associate seat holds with this registration (if provided)
  if (Array.isArray(seatHoldIds) && seatHoldIds && seatHoldIds.length) {
    try {
      const SeatHold = require('../models/SeatHold');
      // Only update holds that match the event, are unassigned and not expired
      const now = new Date();
      await SeatHold.updateMany(
        { _id: { $in: seatHoldIds }, event: eventId, registration: { $exists: false }, expiresAt: { $gte: now } },
        { registration: registration._id }
      );
    } catch (error) {
      console.error('Failed to associate seat holds:', error);
    }
  }
  
  // Return created registration with populated references
  const populatedRegistration = await Registration.findById(registration._id)
    .populate('event', 'name startDate endDate logo')
    .populate('category', 'name color permissions');
  
  if (!populatedRegistration) {
    return StandardErrorHandler.sendError(res, 404, 'Resource not found');
  }
  
  // Send registration confirmation email if enabled
  if (event.emailSettings?.enabled && 
      event.emailSettings?.automaticEmails?.registrationConfirmation) {
    try {
      await emailService.sendRegistrationConfirmationEmail(registration._id);
    } catch (error) {
      console.error('Failed to send registration confirmation email:', error);
      // Don't fail the request if email sending fails
    }
  }
  
  return sendSuccess(res, 201, 'Registration created successfully', populatedRegistration);
});

// @desc    Update an existing registration
// @route   PUT /api/registrations/:registrationId
// @route   PUT /api/events/:id/registrations/:registrationId <-- Nested Route
// @access  Private
const updateRegistration = asyncHandler(async (req, res, next) => {
  const registrationId = req && req.params && req.params.registrationId;
  const eventId = req && req.params && req.params.id; // Event ID from parent route if nested
  
  // Log the entire request body, especially personalInfo, upon arrival
  console.log(`[Backend Update Start] Received PUT request for Registration ID: ${registrationId}, Event ID: ${eventId}`);
  console.log(`[Backend Update Start] Request Body:`, req.body);
  console.log(`[Backend Update Start] req && req.body && req.body.personalInfo && req && req.body && req.body.personalInfo:`, req && req.body && req.body.personalInfo && req && req.body && req.body.personalInfo);

  const { categoryId, personalInfo, status  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };
  
  // Validate IDs
  if (!mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(registrationId)) {
     return sendSuccess(res, 400, 'Invalid Registration ID format');
  }
  // If eventId is present (nested route), validate it
  if (eventId && !mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(eventId)) {
     return sendSuccess(res, 400, 'Invalid Event ID format');
  }
  
  // Find registration by its ID first
  let registration = await Registration.findById(registrationId);
  
  // Primary check: Does the registration exist?
  if (!registration) {
    return sendSuccess(res, 404, `Registration not found with ID ${registrationId}`);
  }
  
  // Secondary check: If accessed via nested route, does it belong to the correct event?
  if (eventId && registration && registration.event && registration.event.toString() !== eventId) {
      console.warn(`[AUTH/SCOPE ERROR] Attempted to update registration ${registrationId} via event ${eventId}, but it belongs to event ${registration && registration.event && registration.event.toString()}`);
      // Return 404 to avoid revealing the registration exists elsewhere
      return sendSuccess(res, 404, `Registration not found within event ${eventId}`); 
  }
  
  // --- Proceed with updates only if checks pass ---
  if (categoryId) registration.category = categoryId;
  
  if (personalInfo) {
    console.log('[Backend Update] Updating personalInfo fields:', personalInfo);
    for (const key in personalInfo) {
      if (personalInfo.hasOwnProperty(key)) { 
        console.log(`[Backend Update] Setting personalInfo.${key} = ${personalInfo[key]}`);
        registration.personalInfo[key] = personalInfo[key];
      }
    }
    registration.markModified('personalInfo'); 
    console.log('[Backend Update] Marked personalInfo as modified.');
  }

  // PATCH: Save professionalInfo if provided
  if (req && req.body && req.body.professionalInfo && req && req.body && req.body.professionalInfo) {
    registration.professionalInfo = req && req.body && req.body.professionalInfo && req && req.body && req.body.professionalInfo;
    registration.markModified('professionalInfo');
    console.log('[Backend Update] Updated professionalInfo:', req && req.body && req.body.professionalInfo && req && req.body && req.body.professionalInfo);
  }

  // PATCH: Save customFields if provided (Map)
  if (req && req.body && req.body.customFields && req && req.body && req.body.customFields) {
    registration.customFields = req && req.body && req.body.customFields && req && req.body && req.body.customFields;
    registration.markModified('customFields');
    console.log('[Backend Update] Updated customFields:', req && req.body && req.body.customFields && req && req.body && req.body.customFields);
  }

  if (status) registration.status = status;
  
  registration.updatedAt = new Date();

  console.log('[Backend Pre-Save] Registration object before .save():', JSON.stringify(registration.toObject(), null, 2)); 

  await registration.save();
  console.log('[Backend Post-Save] Registration saved successfully.');

  // Return updated registration with populated references
  const updatedRegistration = await Registration.findById(registrationId)
    .populate('event', 'name startDate endDate logo')
    .populate('category', 'name color permissions');
  
  if (!updatedRegistration) {
    return StandardErrorHandler.sendError(res, 404, 'Resource not found');
  }
  
  console.log('[Final Send] Sending updated data:', updatedRegistration);

  return sendSuccess(res, 200, 'Registration updated successfully', updatedRegistration);
});

// @desc    Delete a registration
// @route   DELETE /api/registrations/:registrationId
// @route   DELETE /api/events/:id/registrations/:registrationId <-- Nested Route
// @access  Private (Admin only)
const deleteRegistration = asyncHandler(async (req, res, next) => {
  const registrationId = req && req.params && req.params.registrationId;
  const eventId = req && req.params && req.params.id; // Event ID from parent route if nested

  // Validate IDs
  if (!mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(registrationId)) {
     return sendSuccess(res, 400, 'Invalid Registration ID format');
  }
  // If eventId is present (nested route), validate it
  if (eventId && !mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(eventId)) {
     return sendSuccess(res, 400, 'Invalid Event ID format');
  }

  // Construct query to find the specific registration
  const query = { _id: registrationId };
  
  // IMPORTANT: If called via nested route, ensure the registration BELONGS to the event
  if (eventId) {
      query.event = eventId;
      console.log(`[deleteRegistration] Scoping query to event ${eventId}`);
  }

  // Find the registration using the combined query
  const registration = await Registration.findOne(query);

  if (!registration) {
    // Make error message more specific
    const notFoundMessage = eventId
       ? `Registration with ID ${registrationId} not found within event ${eventId}`
       : `Registration not found with ID ${registrationId}`;
    return sendSuccess(res, 404, notFoundMessage);
  }

  // --- Proceed with deletion checks only if registration found in scope ---

  // Check if any resources have been used by this registration
  const usedResources = await Resource.find({ registration: registration._id }); 
  if (usedResources.length > 0) {
    return sendSuccess(res, 400, 'Cannot delete registration with used resources');
  }

  try {
    await registration.deleteOne();
    return sendSuccess(res, 200, 'Registration deleted successfully');
  } catch (error) {
     console.error(`Error deleting registration ${registrationId}:`, error);
     return next(createApiError(500, 'Failed to delete registration'));
  }
});

// @desc    Check in a registration
// @route   PATCH /api/registrations/:registrationId/check-in
// @route   PATCH /api/events/:id/registrations/:registrationId/check-in <-- Nested Route?
// @access  Private
const checkInRegistration = asyncHandler(async (req, res) => {
  const registrationId = req && req.params && req.params.registrationId;
  const eventId = req && req.params && req.params.id; // Event ID from parent route if nested

  if (!mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(registrationId)) {
     return sendSuccess(res, 400, 'Invalid Registration ID format');
  }
  // Find registration by ID
  const registration = await Registration.findById(registrationId);
  
  if (!registration) {
    return sendSuccess(res, 404, `Registration not found with ID ${registrationId}`);
  }

  // If accessed via nested route, verify event match
  if (eventId) {
    if (!mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(eventId)) {
       return sendSuccess(res, 400, 'Invalid Event ID format');
    }
    if (registration && registration.event && registration.event.toString() !== eventId) {
      console.warn(`[AUTH/SCOPE ERROR] Attempted to check-in registration ${registrationId} via event ${eventId}, but it belongs to event ${registration && registration.event && registration.event.toString()}`);
      return sendSuccess(res, 404, `Registration not found within event ${eventId}`); 
  }
  }
  
  // --- Correctly update the nested checkIn object and badgePrinted status --- 
  let changesMade = false; // Flag to track if we need to save
  
  // Update check-in details if not already checked in
  if (!registration.checkIn?.isCheckedIn) {
      registration.checkIn = {
          isCheckedIn: true,
          checkedInAt: new Date(),
          checkedInBy: req.user?._id // Assuming req.user is populated by auth middleware
      };
      registration.markModified('checkIn');
      console.log(`Marked registration ${registrationId} as checked in.`);
      changesMade = true;
  }
  
  // Update badge printed status if not already marked
  if (!registration.badgePrinted) {
    registration.badgePrinted = true;
    registration.printedBy = req.user?._id; // Store who printed
    registration.printedAt = new Date(); // Store when printed
    console.log(`Marked registration ${registrationId} as badge printed by ${req.user?._id}.`);
    changesMade = true;
  }
  
  // Save changes only if any were made
  if (changesMade) {
    registration.updatedAt = new Date(); // Update the main updatedAt timestamp
  await registration.save();
    console.log(`Saved registration ${registrationId} after check-in/badge print update.`);
  } else {
     console.log(`No changes needed for registration ${registrationId} (already checked in and printed).`);
  }
  // --- End CheckIn/Print Update --- 
  
  // Return success, potentially with the updated registration object
  return sendSuccess(res, 200, 'Check-in/Print status updated successfully', registration);
});

// @desc    Import registrations in bulk
// @route   POST /api/events/:eventId/registrations/import
// @access  Private
const importRegistrations = asyncHandler(async (req, res, next) => {
  logger.info('[ImportRegController] Received bulk import request. Raw req.params: ' + JSON.stringify(req.params, null, 2));
  
  const { id: eventId } = req.params;
  const { registrations: incomingRegistrations, originalFileName  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };

  if (!eventId || !mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(eventId)) {
    logger.warn(`[ImportRegController] Invalid or missing eventId after extraction: ${eventId}`);
    return sendSuccess(res, 400, 'Valid Event ID is required.');
  }

  if (!incomingRegistrations || !Array.isArray(incomingRegistrations) || incomingRegistrations.length === 0) {
    logger.warn(`[ImportRegController] No registrations provided for event ${eventId}`);
    return sendSuccess(res, 400, 'No registration data provided or data is not an array.');
  }

  if (!req.user || !req && req.user && req.user._id) {
    logger.error('[ImportRegController] User not found on request. This should be protected by auth middleware.');
    return sendSuccess(res, 401, 'Authentication required.');
  }
  const userId = req && req.user && req.user._id;

  try {
    const event = await Event.findById(eventId).lean();
    if (!event) {
      logger.warn(`[ImportRegController] Event not found: ${eventId}`);
      return sendSuccess(res, 404, 'Event not found.');
    }

    const newJob = await ImportJob.create({
      eventId: eventId,
      totalRecords: incomingRegistrations && incomingRegistrations.length,
      status: 'pending',
      createdBy: userId,
      originalFileName: originalFileName || 'Bulk Import', // Use provided filename or a default
    });

    logger.info(`[ImportRegController] Created ImportJob ${newJob._id} for event ${eventId} with ${incomingRegistrations && incomingRegistrations.length} records by user ${userId}.`);

    // Call the service function asynchronously. DO NOT await it here.
    processBulkImportJob(newJob._id, incomingRegistrations, eventId, userId)
      .then(() => {
        logger.info(`[ImportRegController] processBulkImportJob for ${newJob._id} finished its execution path.`);
      })
      .catch(error => {
        // This catch is for errors in *triggering* or unhandled promise rejections from the async function itself,
        // not for errors *within* the job processing (those are handled by the service and saved to the job document).
        logger.error(`[ImportRegController] Error triggering processBulkImportJob for ${newJob._id}:`, error);
        // Optionally, update the job status to failed here if the trigger itself fails catastrophically.
        // However, the service should ideally handle its own errors and update the job status.
      });

    return sendSuccess(res, 202, 'Registration import process started.', { jobId: newJob._id });

  } catch (error) {
    logger.error(`[ImportRegController] Failed to create ImportJob for event ${eventId}:`, error);
    // Use next(error) for unhandled errors to be caught by global error handler
    // Or use createApiError if you have a specific structure for it
    return next(createApiError(500, 'Failed to start import process.', error.message));
  }
});

/**
 * @desc    Delete a registration
 * @route   DELETE /api/registrations/:id
 * @access  Private (Admin only)
 */
exports.deleteRegistration = asyncHandler(async (req, res, next) => {
  const registration = await Registration.findById(req && req.params && req.params.id);

  if (!registration) {
    return next(createApiError(404, `Registration not found with id of ${req && req.params && req.params.id}`));
  }

  // Check if any resources have been used by this registration
  const usedResources = await Resource.find({ registration: req && req.params && req.params.id });
  if (usedResources.length > 0) {
    return next(createApiError(400, 'Cannot delete registration with used resources'));
  }

  await registration.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

/**
 * @desc    Generate QR code for registration
 * @route   POST /api/registrations/:id/qr
 * @access  Private (Admin only)
 */
exports.generateQrCode = asyncHandler(async (req, res, next) => {
  // Find registration
  const registration = await Registration.findById(req && req.params && req.params.id);

  if (!registration) {
    return next(createApiError(404, `Registration not found with id of ${req && req.params && req.params.id}`));
  }

  // Generate QR code if it doesn't exist
  if (!registration.qrCode) {
    registration.qrCode = crypto.randomBytes(12).toString('hex');
    await registration.save();
  }

  res.status(200).json({
    success: true,
    data: {
      qrCode: registration.qrCode
    }
  });
});

/**
 * @desc    Check in participant
 * @route   POST /api/registrations/:id/check-in
 * @access  Private
 */
exports.checkInParticipant = asyncHandler(async (req, res, next) => {
  // Find registration by ID
  const registration = await Registration.findById(req && req.params && req.params.id);

  if (!registration) {
    return next(createApiError(404, `Registration not found with id of ${req && req.params && req.params.id}`));
  }

  // Update check-in status
  registration.isCheckedIn = true;
  registration.checkedInAt = Date.now();
  registration.checkedInBy = req && req.user && req.user._id;

  // Add to activity log
  registration.activities = registration.activities || [];
  registration && registration.activities && registration.activities.push({
    action: 'Checked In',
    description: 'Participant was checked in',
    user: req && req.user && req.user.name,
    timestamp: new Date()
  });

  await registration.save();

  StandardErrorHandler.sendSuccess(res, 200, 'Operation successful', registration
  );
});

/**
 * @desc    Find a registration by QR code or Registration ID
 * @route   GET /api/registrations/find/:qrOrRegId
 * @access  Private
 */
exports.findRegistrationByQrOrRegId = asyncHandler(async (req, res, next) => {
  const { qrOrRegId } = req.params;
  const { eventId } = req.query;

  if (!qrOrRegId) {
    return next(createApiError(400, 'QR Code or Registration ID is required'));
  }

  if (!eventId) {
    return next(createApiError(400, 'Event ID is required'));
  }

  // Find registration by QR code or registration ID
  const registration = await Registration.findOne({
    $or: [
      { qrCode: qrOrRegId },
      { registrationId: qrOrRegId }
    ],
    event: eventId
  }).populate('category', 'name color')
    .lean();

  if (!registration) {
    return next(createApiError(404, 'Registration not found'));
  }

  // Get resources used by this registration
  const resources = await Resource.find({
    registration: registration._id,
    isVoided: { $ne: true }
  }).sort({ createdAt: -1 });

  // Format response
  const formattedRegistration = {
    _id: registration._id,
    registrationId: registration.registrationId,
    qrCode: registration.qrCode,
    status: registration.status,
    isCheckedIn: registration.isCheckedIn,
    checkedInAt: registration.checkedInAt,
    personalInfo: registration.personalInfo,
    contactInfo: registration.contactInfo,
    category: registration.category,
    resourceUsage: registration.resourceUsage || {
      meals: [],
      kitItems: [],
      certificates: []
    },
    resources: resources.map(r => ({
      _id: r._id,
      type: r.type,
      details: r.details,
      actionDate: r.actionDate
    }))
  };

  StandardErrorHandler.sendSuccess(res, 200, 'Operation successful', formattedRegistration
  );
});

/**
 * @desc    Send email to registrant
 * @route   POST /api/registrations/:id/send-email
 * @access  Private (Admin only)
 */
exports.sendEmailToRegistrant = asyncHandler(async (req, res, next) => {
  const { subject, message, emailType  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };
  
  if (!subject || !message) {
    return next(createApiError(400, 'Please provide subject and message'));
  }

  // Find registration
  const registration = await Registration.findById(req && req.params && req.params.id)
    .populate('event', 'name startDate endDate location emailSettings');
  if (!registration) {
    return next(createApiError(404, `Registration not found with id of ${req && req.params && req.params.id}`));
  }

  if (!registration) {
    return next(createApiError(404, `Registration not found with id of ${req && req.params && req.params.id}`));
  }

  // Ensure full event document to access smtp settings
  let eventDoc = registration.event;
  if (!eventDoc.emailSettings) {
    eventDoc = await Event.findById(registration && registration.event && registration.event._id);
  }

  // Check if email exists
  if (!registration && registration.contactInfo && registration.contactInfo.email) {
    return next(createApiError(400, 'Registrant does not have an email address'));
  }

  try {
    // Send email
    await sendEmail({
      to: registration && registration.contactInfo && registration.contactInfo.email,
      subject,
      html: message,
      fromName: eventDoc.emailSettings?.senderName || 'Event Organizer',
      fromEmail: eventDoc.emailSettings?.senderEmail || 'noreply@example.com',
      smtp: {
        host: eventDoc.emailSettings?.smtpHost,
        port: eventDoc.emailSettings?.smtpPort,
        secure: eventDoc.emailSettings?.smtpSecure,
        auth: {
          user: eventDoc.emailSettings?.smtpUser,
          pass: eventDoc.emailSettings?.smtpPassword
        }
      }
    });

    // Add to activity log
    registration.activities = registration.activities || [];
    registration && registration.activities && registration.activities.push({
      action: 'Email Sent',
      description: `Email with subject "${subject}" was sent to ${registration && registration.contactInfo && registration.contactInfo.email}`,
      user: req && req.user && req.user.name,
      timestamp: new Date()
    });

    await registration.save();

    res.status(200).json({
      success: true,
      data: {
        message: `Email sent to ${registration && registration.contactInfo && registration.contactInfo.email}`
      }
    });
  } catch (error) {
    console.error('Email sending error:', error);
    return next(createApiError(500, 'Email could not be sent'));
  }
});

/**
 * @desc    Create a note on a registration
 * @route   POST /api/registrations/:id/notes
 * @access  Private
 */
exports.addRegistrationNote = asyncHandler(async (req, res, next) => {
  const { note  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };
  
  if (!note) {
    return next(createApiError(400, 'Please provide a note'));
  }

  // Find registration
  const registration = await Registration.findById(req && req.params && req.params.id);

  if (!registration) {
    return next(createApiError(404, `Registration not found with id of ${req && req.params && req.params.id}`));
  }

  // Add note to registration
  registration.notes = registration.notes || [];
  registration && registration.notes && registration.notes.push({
    text: note,
    createdBy: req && req.user && req.user._id,
    createdAt: new Date()
  });

  // Add to activity log
  registration.activities = registration.activities || [];
  registration && registration.activities && registration.activities.push({
    action: 'Note Added',
    description: 'A note was added to the registration',
    user: req && req.user && req.user.name,
    timestamp: new Date()
  });

  await registration.save();

  StandardErrorHandler.sendSuccess(res, 200, 'Operation successful', registration.notes
  );
});

// @desc    Export registrations to Excel (ALL DATA, ALL FILTERS, FLATTENED)
// @route   GET /api/events/:id/registrations/export
// @access  Private
const exportRegistrationsController = asyncHandler(async (req, res) => {
  const eventId = req && req.params && req.params.id;
  // --- Accept all possible filters from query ---
  const {
    category, status, search, registrationType, badgePrinted, startDate, endDate, paymentStatus, workshopId
  } = req.query;

  if (!eventId || !mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(eventId)) {
    return StandardErrorHandler.sendError(res, 400, 'Valid Event ID is required in the route.');
  }

  // --- Build Filter Query ---
  const filter = { event: eventId };
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (registrationType) filter.registrationType = registrationType;
  if (badgePrinted !== undefined && badgePrinted !== '') filter.badgePrinted = badgePrinted === 'true';
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }
  if (search) {
    filter.$or = [
      { registrationId: { $regex: search, $options: 'i' } },
      { 'personalInfo.firstName': { $regex: search, $options: 'i' } },
      { 'personalInfo.lastName': { $regex: search, $options: 'i' } },
      { 'personalInfo.email': { $regex: search, $options: 'i' } },
      { 'personalInfo.organization': { $regex: search, $options: 'i' } },
      { 'personalInfo.phone': { $regex: search, $options: 'i' } },
      {
        $expr: {
          $regexMatch: {
            input: { $concat: ['$personalInfo.firstName', ' ', '$personalInfo.lastName'] },
            regex: search,
            options: 'i'
          }
        }
      }
    ];
  }

  // --- Fetch ALL matching registrations (no pagination) ---
  let registrations = await Registration.find(filter)
    .populate('category', 'name color')
    .populate('event', 'name startDate endDate')
    .lean();

  if (!registrations && registrations.length) {
    return sendSuccess(res, 404, 'No registrations found matching the criteria for export.');
  }

  // --- Gather all related data for each registration ---
  const registrationIds = registrations.map(r => r._id);

  // Fetch related data in bulk for efficiency
  const [resources, abstracts, payments, workshops] = await Promise.all([
    // All resources for these registrations
    require('../models/Resource').find({ registration: { $in: registrationIds } }).lean(),
    // All abstracts for these registrations
    require('../models/Abstract').find({ registration: { $in: registrationIds } }).lean(),
    // All payments for these registrations
    require('../models/Payment').find({ registration: { $in: registrationIds } }).lean(),
    // All workshops where this registration is in attendees or registrations
    require('../models/Workshop').find({
      $or: [
        { registrations: { $in: registrationIds } },
        { 'attendees.registration': { $in: registrationIds } }
      ]
    }).lean()
  ]);

  // --- Build dynamic columns ---
  // Collect all custom field keys
  const allCustomFieldKeys = new Set();
  registrations.forEach(reg => {
    if (reg.customFields) Object.keys(reg.customFields).forEach(k => allCustomFieldKeys.add(k));
  });

  // Collect all resource types/items
  const allResourceTypes = ['food', 'kitBag', 'certificate'];
  const allResourceDetails = { food: new Set(), kitBag: new Set(), certificate: new Set() };
  resources.forEach(res => {
    if (allResourceTypes.includes(res.type) && res.details && res && res.details && res.details.name) {
      allResourceDetails[res.type].add(res && res.details && res.details.name);
    }
  });

  // Collect all abstract fields
  const allAbstractFields = ['title', 'status', 'topic', 'submissionType'];

  // Collect all payment fields
  const allPaymentFields = ['status', 'amount', 'currency', 'gateway', 'invoiceNumber'];

  // Collect all workshop titles
  const allWorkshopTitles = new Set();
  workshops.forEach(ws => allWorkshopTitles.add(ws.title));

  // --- Define columns ---
  const columns = [
    { header: 'Registration ID', key: 'registrationId' },
    { header: 'First Name', key: 'firstName' },
    { header: 'Last Name', key: 'lastName' },
    { header: 'Email', key: 'email' },
    { header: 'Phone', key: 'phone' },
    { header: 'Organization', key: 'organization' },
    { header: 'Designation', key: 'designation' },
    { header: 'Country', key: 'country' },
    { header: 'Category', key: 'category' },
    { header: 'Status', key: 'status' },
    { header: 'Type', key: 'registrationType' },
    { header: 'Registered At', key: 'createdAt' },
    { header: 'Checked In', key: 'checkedIn' },
    { header: 'Badge Printed', key: 'badgePrinted' },
    // Professional Info
    { header: 'MCI Number', key: 'mciNumber' },
    { header: 'Membership', key: 'membership' },
  ];
  // Add custom fields
  allCustomFieldKeys.forEach(key => columns.push({ header: key, key: `custom_${key}` }));
  // Add resource columns
  Object.entries(allResourceDetails).forEach(([type, names]) => {
    names.forEach(name => columns.push({ header: `${type}:${name}`, key: `${type}_${name}` }));
  });
  // Add abstract columns
  allAbstractFields.forEach(field => columns.push({ header: `Abstract ${field}`, key: `abstract_${field}` }));
  // Add payment columns
  allPaymentFields.forEach(field => columns.push({ header: `Payment ${field}`, key: `payment_${field}` }));
  // Add workshop columns
  allWorkshopTitles.forEach(title => columns.push({ header: `Workshop: ${title}`, key: `workshop_${title}` }));

  // --- Create Excel workbook ---
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Registrations');
  worksheet.columns = columns;

  // --- Add rows ---
  for (const reg of registrations) {
    const row = {
      registrationId: reg.registrationId,
      firstName: reg.personalInfo?.firstName || '',
      lastName: reg.personalInfo?.lastName || '',
      email: reg.personalInfo?.email || '',
      phone: reg.personalInfo?.phone || '',
      organization: reg.personalInfo?.organization || '',
      designation: reg.personalInfo?.designation || '',
      country: reg.personalInfo?.country || '',
      category: reg.category?.name || '',
      status: reg.status,
      registrationType: reg.registrationType,
      createdAt: reg.createdAt ? new Date(reg.createdAt).toLocaleString() : '',
      checkedIn: reg.checkIn?.isCheckedIn ? 'Yes' : 'No',
      badgePrinted: reg.badgePrinted ? 'Yes' : 'No',
      mciNumber: reg.professionalInfo?.mciNumber || '',
      membership: reg.professionalInfo?.membership || '',
    };
    // Custom fields
    allCustomFieldKeys.forEach(key => {
      row[`custom_${key}`] = reg.customFields?.[key] || '';
    });
    // Resource usage
    Object.entries(allResourceDetails).forEach(([type, names]) => {
      names.forEach(name => {
        const used = resources.find(r => r.registration?.toString() === reg && reg._id && reg._id.toString() && r.type === type && r.details?.name === name && r.status !== 'voided');
        row[`${type}_${name}`] = used ? 'Yes' : '';
      });
    });
    // Abstracts (concatenate multiple)
    const regAbstracts = abstracts.filter(a => a.registration?.toString() === reg && reg._id && reg._id.toString());
    allAbstractFields.forEach(field => {
      row[`abstract_${field}`] = regAbstracts.map(a => a[field] || '').filter(Boolean).join('; ');
    });
    // Payments (concatenate multiple)
    const regPayments = payments.filter(p => p.registration?.toString() === reg && reg._id && reg._id.toString());
    allPaymentFields.forEach(field => {
      row[`payment_${field}`] = regPayments.map(p => p[field] || '').filter(Boolean).join('; ');
    });
    // Workshops
    workshops.forEach(ws => {
      const isRegistered = (ws.registrations || []).some(rid => rid.toString() === reg && reg._id && reg._id.toString()) ||
        (ws.attendees || []).some(a => a.registration?.toString() === reg && reg._id && reg._id.toString());
      row[`workshop_${ws.title}`] = isRegistered ? 'Yes' : '';
    });
    worksheet.addRow(row);
  }

  // --- Style header row ---
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDDDDDD' }
  };
  worksheet.getRow(1).border = { bottom: { style: 'thin' } };

  // --- Set response headers and send file ---
  const filename = `registrations_${eventId}_${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument && officedocument.spreadsheetml && officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook && workbook.xlsx && workbook.xlsx.write(res);
  res.end();
});

/**
 * @desc    Get registration statistics for an event
 * @route   GET /api/events/:id/registrations/statistics
 * @access  Private
 */
const getRegistrationStatistics = asyncHandler(async (req, res, next) => {
  const { id: eventId } = req.params; // Get eventId from the merged params

  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
    // Use createApiError for consistency
    return next(createApiError(400, 'Invalid or missing Event ID')); 
  }

  try {
    // Aggregation pipeline
    const statsPipeline = [
      {
        $match: {
          event: new mongoose.Types.ObjectId(eventId)
        }
      },
      {
        $facet: { // Perform multiple aggregations in parallel
          "total": [
            { $count: "count" }
          ],
          "byStatus": [
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $group: { _id: null, counts: { $push: { k: "$_id", v: "$count" } } } },
            { $replaceRoot: { newRoot: { $arrayToObject: "$counts" } } }
          ],
          "byCategory": [
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'categoryInfo' } },
            { $unwind: { path: "$categoryInfo", preserveNullAndEmptyArrays: true } }, // Keep registrations even if category is deleted
            { $group: { _id: null, counts: { $push: { k: { $ifNull: ["$categoryInfo.name", "Uncategorized"] }, v: "$count" } } } },
            { $replaceRoot: { newRoot: { $arrayToObject: "$counts" } } }
          ],
          "checkedIn": [
            { $match: { isCheckedIn: true } },
            { $count: "count" }
          ],
          "byDay": [
             { $group: { 
                 _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, 
                 count: { $sum: 1 } 
             } },
             { $sort: { _id: 1 } }, // Sort by date
             { $project: { _id: 0, date: "$_id", count: "$count" } }
          ]
        }
      }
    ];

    const results = await Registration.aggregate(statsPipeline);

    // Process the results from the $facet stage
    const statistics = {
      total: results[0]?.total[0]?.count || 0,
      checkedIn: results[0]?.checkedIn[0]?.count || 0,
      byStatus: results[0]?.byStatus[0] || {},
      byCategory: results[0]?.byCategory[0] || {},
      byDay: results[0]?.byDay || []
      // Add default statuses if needed
    };
    
    // Ensure default statuses exist
    const defaultStatuses = { draft: 0, active: 0, inactive: 0, cancelled: 0 };
    statistics.byStatus = { ...defaultStatuses, ...statistics.byStatus };

    sendSuccess(res, 200, 'Registration statistics retrieved successfully', statistics);

  } catch (error) {
    console.error(`Error fetching registration statistics for event ${eventId}:`, error);
    // Use createApiError for consistency
    next(createApiError(500, 'Server error fetching registration statistics', error.message)); 
  }
});

/**
 * @desc    Get status of a bulk import job
 * @route   GET /api/import-jobs/:jobId/status
 * @access  Private (Assumed, ensure 'protect' middleware is added to the route)
 */
const getImportJobStatus = asyncHandler(async (req, res, next) => {
  const { jobId } = req.params;

  if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
    return sendSuccess(res, 400, 'Valid Job ID is required.');
  }

  try {
    const job = await ImportJob.findById(jobId)
      .populate('eventId', 'name') // Populate event name for context
      .populate('createdBy', 'name email'); // Populate user details

    if (!job) {
      return sendSuccess(res, 404, 'Import job not found.');
    }

    // Optionally, check if req.user is admin or owner of the job if more granular access control is needed
    // For now, assuming if they have the jobId and are authenticated, they can see status.

    return sendSuccess(res, 200, 'Import job status retrieved successfully.', job);
  } catch (error) {
    logger.error(`[GetImportJobStatus] Error fetching job ${jobId}:`, error);
    return next(createApiError(500, 'Failed to retrieve import job status.', error.message));
  }
});

/**
 * @desc    Get registration details by QR code string or registration ID string for a specific event
 * @route   POST /api/events/:eventId/registrations/scan
 * @access  Private
 */
const getRegistrationDetailsByScan = asyncHandler(async (req, res, next) => {
  const eventId = req && req.params && req.params.id; // From the parent router :id mapped to /events/:id
  const { qrCode } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  }

  logger.info(`[getRegistrationDetailsByScan] Attempting to find registration for event: ${eventId} with QR/ID: ${qrCode}`);

  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
    logger.warn(`[getRegistrationDetailsByScan] Invalid or missing eventId: ${eventId}`);
    return sendSuccess(res, 400, 'Valid Event ID is required.');
  }

  if (!qrCode) {
    logger.warn(`[getRegistrationDetailsByScan] Missing qrCode in request body.`);
    return sendSuccess(res, 400, 'QR code or Registration ID is required in the request body.');
  }

  const match = mongoose.Types.ObjectId.isValid(qrCode)
    ? { event: new mongoose.Types.ObjectId(eventId), _id: new mongoose.Types.ObjectId(qrCode) }
    : { event: new mongoose.Types.ObjectId(eventId), $or: [{ qrCode }, { registrationId: qrCode }] };

  const registration = await Registration.findOne(match)
    .select('registrationId personalInfo firstName lastName category')
    .populate('category', 'name color')
    .lean();

  if (!registration) {
    logger.warn(`[getRegistrationDetailsByScan] Registration not found for event ${eventId} with QR/ID: ${qrCode}`);
    return sendSuccess(res, 404, 'Registration not found for the given QR code/ID and event.');
  }

  logger.info(`[getRegistrationDetailsByScan] Found registration: ${registration._id} (${registration.registrationId})`);
  
  return sendSuccess(res, 200, 'Registration details retrieved successfully.', registration);
});

/**
 * @desc    Create a new registration (public, no auth)
 * @route   POST /api/events/:eventId/public-registrations
 * @access  Public
 */
const createRegistrationPublic = async (req, res, next) => {
  // Get eventId from params if route is nested, otherwise from body
  const eventId = req && req.params && req.params.eventId || req && req.body && req.body.eventId && req && req.body && req.body.eventId; 
  const { categoryId, personalInfo } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  }

  // Validate required fields
  if (!eventId || !categoryId || !personalInfo) {
    return sendSuccess(res, 400, 'Missing required fields: eventId, categoryId, personalInfo');
  }

  // Check if event exists and is open for registration
  const event = await Event.findById(eventId);
  if (!event) {
    return sendSuccess(res, 404, 'Event not found');
  }
  if (!event.registrationSettings?.isOpen) {
    return sendSuccess(res, 403, 'Registration for this event is currently closed');
  }

  // Check if category exists
  const category = await Category.findById(categoryId);
  if (!category) {
    return sendSuccess(res, 404, 'Category not found');
  }

  // Validate accompanying persons' custom fields
  const accompanyingPersonFields = event.registrationSettings?.accompanyingPersonFields || [];
  const requiredAccompanyingFields = accompanyingPersonFields.filter(f => f.isRequired).map(f => f.name);
  const accompanyingPersons = req && req.body && req.body.accompanyingPerson && req && req.body && req.body.accompanyingPersons || [];
  for (const [idx, person] of accompanyingPersons.entries()) {
    for (const fieldName of requiredAccompanyingFields) {
      if (!person.customFields || person.customFields[fieldName] === undefined || person.customFields[fieldName] === "") {
        return sendSuccess(res, 400, `Accompanying person #${idx + 1} is missing required field: ${fieldName}`);
      }
    }
  }
  
  // --- Use Counter Pattern for ID Generation --- 
  const registrationPrefix = event.registrationSettings?.idPrefix || 'REG';
  const startNumber = event.registrationSettings?.startNumber || 1;
  const sequenceName = `${eventId}_registration_id`; // Unique sequence name per event

  let registrationId;
  try {
    const nextNumber = await getNextSequenceValue(sequenceName, startNumber);
    const formattedNumber = nextNumber.toString().padStart(4, '0'); // Pad to 4 digits
    registrationId = `${registrationPrefix}-${formattedNumber}`;

    // Optional: Double-check uniqueness just in case (though counter should handle it)
    const existing = await Registration.findOne({ event: eventId, registrationId: registrationId });
    if (existing) {
      // This case should be extremely rare with the atomic counter
      console.error(`Generated duplicate ID ${registrationId} for event ${eventId} despite using counter. Retrying might be needed or check counter logic.`);
      return sendSuccess(res, 500, 'Failed to generate unique registration ID. Please try again.');
    }
  } catch (error) {
    console.error("Error generating registration ID using counter:", error);
    return sendSuccess(res, 500, 'Failed to generate registration ID');
  }
  // --- End ID Generation ---

  let registration;
  try {
    registration = await Registration.create({
      registrationId,
      event: eventId,
      category: categoryId,
      personalInfo,
      // PATCH: Save professionalInfo if provided
      ...(req && req.body && req.body.professionalInf && req && req.body && req.body.professionalInfo && { professionalInfo: req && req.body && req.body.professionalInfo && req && req.body && req.body.professionalInfo }),
      // PATCH: Save customFields if provided
      ...(req && req.body && req.body.customField && req && req.body && req.body.customFields && { customFields: req && req.body && req.body.customFields && req && req.body && req.body.customFields }),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  } catch (error) {
    if (err.code === 11000) {
      // Duplicate key error (likely due to unique index on event/category/first/last name)
      return StandardErrorHandler.sendError(res, 400, 'A registration with this name already exists in this category for this event.');
    }
    // Other errors
    return res.status(500).json({
      success: false,
      message: 'Failed to create registration',
      error: err.message
    });
  }

  // Return created registration with populated references
  const populatedRegistration = await Registration.findById(registration._id)
    .populate('event', 'name startDate endDate logo')
    .populate('category', 'name color permissions');
  
  if (!populatedRegistration) {
    return StandardErrorHandler.sendError(res, 404, 'Resource not found');
  }

  // Send registration confirmation email if enabled
  if (event.emailSettings?.enabled && 
      event.emailSettings?.automaticEmails?.registrationConfirmation) {
    try {
      await emailService.sendRegistrationConfirmationEmail(registration._id);
    } catch (error) {
      console.error('Failed to send registration confirmation email:', error);
      // Don't fail the request if email sending fails
    }
  }

  return sendSuccess(res, 201, 'Registration created successfully', populatedRegistration);
};

// --- PATCH: Enforce sponsoredBy for sponsored registrations ---
function validateSponsoredBy(req, res, next) {
  const { registrationType, sponsoredBy  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };
  if (registrationType === 'sponsored' && !sponsoredBy) {
    return StandardErrorHandler.sendError(res, 400, 'sponsoredBy is required when registrationType is sponsored.');
  }
  next();
}

const sendPaymentLink = async (req, res, next) => {
  try {
    const { eventId, registrationId } = req.params;
    const { link  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };
    const registration = await Registration.findById(registrationId);
    const event = await Event.findById(eventId);
    if (!registration || !event) return res.status(404).json({ success: false, message: 'Not found' });
    if (!registration.personalInfo?.email) return StandardErrorHandler.sendError(res, 400, 'No email on file');
    const subject = `Payment Link for ${event.name}`;
    const html = `Dear ${registration && registration.personalInfo && registration.personalInfo.firstName || 'Attendee'},<br/><br/>Please complete your payment for <b>${event.name}</b> using the link below:<br/><br/><a href="${link}">${link}</a><br/><br/>Regards,<br/>${event.name} Team`;
    await emailService.sendGenericEmail({
      to: registration && registration.personalInfo && registration.personalInfo.email,
      subject,
      html,
      from: event.emailSettings?.senderEmail || undefined
    });
    sendSuccess(res, 200, 'Payment link sent');
  } catch (error) {
    next(err);
  }
};

// =====================================================
// NEW: Component-Based Registration Functions
// =====================================================

/**
 * @desc    Get available registration components for an event
 * @route   GET /api/events/:eventId/registration-components
 * @access  Public
 */
const getAvailableComponents = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { audience, category } = req.query;
  
  // Validate event exists
  const event = await Event.findById(eventId);
  if (!event) {
    return sendSuccess(res, 404, 'Event not found');
  }
  
  // Check if component-based registration is enabled
  if (!event.isComponentBasedRegistration()) {
    return sendSuccess(res, 200, 'Component-based registration not enabled for this event', {
      enabled: false,
      components: []
    });
  }
  
  // Get available components
  const components = {
    enabled: true,
    dailyComponents: event.getAvailableDailyComponents(audience, category),
    workshopComponents: event.getAvailableWorkshopComponents(audience, category),
    sessionComponents: event && event.registrationComponents && event.registrationComponents.sessionComponents
      .filter(session => session.active)
      .map(session => ({
        sessionId: session.sessionId,
        name: session.name,
        description: session.description,
        componentType: session.componentType,
        pricing: session && session.pricing && session.pricing.filter(price =>
          (!audience || !price.audience || price.audience === audience) &&
          (!category || !price.category || price.category === category)
        ),
        entitlements: session.entitlements
      })),
    packageDeals: event && event.registrationComponents && event.registrationComponents.packageDeals
      .filter(pkg => pkg.active)
      .map(pkg => ({
        name: pkg.name,
        description: pkg.description,
        includedComponents: pkg.includedComponents,
        pricing: pkg && pkg.pricing && pkg.pricing.filter(price =>
          (!audience || !price.audience || price.audience === audience) &&
          (!category || !price.category || price.category === category)
        ),
        constraints: pkg.constraints
      }))
  };
  
  return sendSuccess(res, 200, 'Available registration components retrieved successfully', components);
});

/**
 * @desc    Calculate component-based registration pricing
 * @route   POST /api/events/:eventId/registration-components/calculate-price
 * @access  Public
 */
const calculateComponentPrice = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { components, audience, category  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };
  
  // Validate input
  if (!Array.isArray(components) || components.length === 0) {
    return sendSuccess(res, 400, 'Components array is required');
  }
  
  // Validate event exists
  const event = await Event.findById(eventId);
  if (!event) {
    return sendSuccess(res, 404, 'Event not found');
  }
  
  // Check if component-based registration is enabled
  if (!event.isComponentBasedRegistration()) {
    return sendSuccess(res, 400, 'Component-based registration not enabled for this event');
  }
  
  // Validate component combination
  const validation = event.validateComponentCombination(components);
  if (!validation.valid) {
    return sendSuccess(res, 400, 'Invalid component combination', {
      errors: validation.errors
    });
  }
  
  // Calculate pricing
  const pricing = event.calculateComponentTotal(components, audience, category);
  
  return sendSuccess(res, 200, 'Component pricing calculated successfully', {
    pricing,
    validation: validation
  });
});

/**
 * @desc    Create component-based registration
 * @route   POST /api/events/:eventId/component-registrations
 * @access  Public
 */
const createComponentRegistration = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { categoryId, 
    personalInfo, 
    professionalInfo,
    customFields,
    components, 
    audience, 
    paymentInfo 
   } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };
  
  // Validate required fields
  if (!eventId || !categoryId || !personalInfo || !Array.isArray(components) || components.length === 0) {
    return sendSuccess(res, 400, 'Missing required fields: eventId, categoryId, personalInfo, components');
  }
  
  // Check if event exists and component registration is enabled
  const event = await Event.findById(eventId);
  if (!event) {
    return sendSuccess(res, 404, 'Event not found');
  }
  
  if (!event.isComponentBasedRegistration()) {
    return sendSuccess(res, 400, 'Component-based registration not enabled for this event');
  }
  
  if (!event.registrationSettings?.isOpen) {
    return sendSuccess(res, 403, 'Registration for this event is currently closed');
  }
  
  // Check if category exists
  const category = await Category.findById(categoryId);
  if (!category) {
    return sendSuccess(res, 404, 'Category not found');
  }
  
  // Validate component combination
  const validation = event.validateComponentCombination(components);
  if (!validation.valid) {
    return sendSuccess(res, 400, 'Invalid component combination', {
      errors: validation.errors
    });
  }
  
  // Calculate pricing
  const pricing = event.calculateComponentTotal(components, audience, category.name);
  
  // Generate unique registration ID
  const registrationPrefix = event.registrationSettings?.idPrefix || 'REG';
  const startNumber = event.registrationSettings?.startNumber || 1;
  const sequenceName = `${eventId}_registration_id`;
  
  let registrationId;
  try {
    const nextNumber = await getNextSequenceValue(sequenceName, startNumber);
    const formattedNumber = nextNumber.toString().padStart(4, '0');
    registrationId = `${registrationPrefix}-${formattedNumber}`;
    
    // Double-check uniqueness
    const existing = await Registration.findOne({ event: eventId, registrationId: registrationId });
    if (existing) {
      console.error(`Generated duplicate ID ${registrationId} for event ${eventId}`);
      return sendSuccess(res, 500, 'Failed to generate unique registration ID. Please try again.');
    }
  } catch (error) {
    console.error("Error generating registration ID:", error);
    return sendSuccess(res, 500, 'Failed to generate registration ID');
  }
  
  // Create registration components with entitlements
  const registrationComponents = components.map(comp => {
    const component = {
      componentType: comp.componentType,
      name: comp.name || `${comp.componentType} - ${comp.componentId}`,
      description: comp.description,
      basePrice: {
        cents: 0,
        currency: pricing.currency
      },
      finalPrice: {
        cents: 0,
        currency: pricing.currency
      },
      config: {
        accessLevel: 'full'
      },
      entitlements: {
        mainEventAccess: comp.componentType === 'main-event',
        dayAccess: {},
        meals: { breakfast: [], lunch: [], dinner: [], snacks: [] },
        kitItems: [],
        certificates: [],
        workshops: [],
        sessions: [],
        networking: {
          welcomeReception: false,
          dinnerBanquet: false,
          networkingBreaks: false,
          closingCeremony: false
        },
        virtualAccess: {
          liveStreaming: false,
          recordings: false,
          presentations: false,
          digitalResources: false
        },
        badgeAccess: true,
        printingAccess: true
      },
      status: 'active',
      purchaseDate: new Date()
    };
    
    // Set component-specific entitlements based on event configuration
    if (comp.componentType === 'daily' && comp.componentId) {
      const dayConfig = event && event.registrationComponents && event.registrationComponents.dailyConfiguration.days
        .find(d => d.dayId === comp.componentId);
      if (dayConfig) {
        const dayPricing = dayConfig.componentPricing
          .find(p => (!audience || !p.audience || p.audience === audience));
        if (dayPricing) {
          if (component && component.basePrice) {
            component.basePrice.cents = dayPricing.priceCents;
          }
          if (component && component.finalPrice) {
            component.finalPrice.cents = dayPricing.priceCents;
          }
          component.entitlements = { ...component.entitlements, ...dayPricing.entitlements };
          if (component && component.entitlements && component.entitlements.dayAccess) {
            component.entitlements.dayAccess[comp.componentId] = true;
          }
        }
      }
    }
    
    // Set workshop entitlements
    if ((comp.componentType === 'workshop-standalone' || comp.componentType === 'workshop-addon') && comp.componentId) {
      const workshopConfig = event && event.registrationComponents && event.registrationComponents.workshopComponents
        .find(w => w && w.workshopId && w.workshopId.toString() === comp.componentId);
      if (workshopConfig) {
        const workshopPricing = workshopConfig.pricing
          .find(p => (!audience || !p.audience || p.audience === audience));
        if (workshopPricing) {
          if (component && component.basePrice) {
            component.basePrice.cents = workshopPricing.priceCents;
          }
          if (component && component.finalPrice) {
            component.finalPrice.cents = workshopPricing.priceCents;
          }
          if (component && component.entitlements && component.entitlements.workshops) {
            component.entitlements.workshops.push({
            workshopId: comp.componentId,
            accessType: 'participant'
          });
          }
        }
      }
    }
    
    return component;
  });
  
  // Determine registration type
  let registrationType = 'component-based'; // New type for component registrations
  if (pricing.appliedPackage) {
    registrationType = 'package-deal';
  }
  if (new Date() > new Date(event.startDate)) {
    registrationType = 'onsite-component';
  }
  
  // Create the registration
  let registration;
  try {
    registration = await Registration.create({
      registrationId,
      event: eventId,
      category: categoryId,
      personalInfo,
      ...(professionalInfo && { professionalInfo }),
      ...(customFields && { customFields }),
      registrationComponents,
      registrationType,
      status: 'active',
      pricing: {
        totalAmount: {
          cents: pricing.totalCents,
          currency: pricing.currency
        },
        breakdown: pricing.breakdown,
        appliedPackage: pricing.appliedPackage
      },
      amountCents: pricing.totalCents,
      currency: pricing.currency,
      paymentStatus: pricing.totalCents > 0 ? 'pending' : 'paid',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  } catch (error) {
    if (err.code === 11000) {
      return StandardErrorHandler.sendError(res, 400, 'A registration with this name already exists in this category for this event.');
    }
    console.error('Registration creation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create component registration',
      error: err.message
    });
  }
  
  // Populate the registration
  const populatedRegistration = await Registration.findById(registration._id)
    .populate('event', 'name startDate endDate logo')
    .populate('category', 'name color permissions');
  
  if (!populatedRegistration) {
    return StandardErrorHandler.sendError(res, 404, 'Resource not found');
  }
  
  // Send registration confirmation email
  if (event.emailSettings?.enabled && 
      event.emailSettings?.automaticEmails?.registrationConfirmation) {
    try {
      await emailService.sendRegistrationConfirmationEmail(registration._id);
    } catch (error) {
      console.error('Failed to send registration confirmation email:', error);
    }
  }
  
  return sendSuccess(res, 201, 'Component-based registration created successfully', {
    registration: populatedRegistration,
    pricing: pricing
  });
});

/**
 * @desc    Update existing registration with additional components
 * @route   POST /api/events/:eventId/registrations/:registrationId/add-components
 * @access  Private
 */
const addComponentsToRegistration = asyncHandler(async (req, res) => {
  const { eventId, registrationId } = req.params;
  const { components, audience  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };
  
  // Find the registration
  const registration = await Registration.findOne({
    _id: registrationId,
    event: eventId
  }).populate('category', 'name');
  if (!registration) {
    return StandardErrorHandler.sendError(res, 404, 'Resource not found');
  }
  
  if (!registration) {
    return sendSuccess(res, 404, 'Registration not found');
  }
  
  // Find the event
  const event = await Event.findById(eventId);
  if (!event || !event.isComponentBasedRegistration()) {
    return sendSuccess(res, 400, 'Component-based registration not enabled for this event');
  }
  
  // Validate new components
  const allComponents = [
    ...registration && registration.registrationComponents && registration.registrationComponents.map(rc => ({
      componentType: rc.componentType,
      componentId: rc.config?.componentId || rc.name
    })),
    ...components
  ];
  
  const validation = event.validateComponentCombination(allComponents);
  if (!validation.valid) {
    return sendSuccess(res, 400, 'Invalid component combination', {
      errors: validation.errors
    });
  }
  
  // Calculate pricing for new components
  const newComponentPricing = event.calculateComponentTotal(components, audience, registration && registration.category && registration.category.name);
  
  // Add new components to registration
  components.forEach(comp => {
    const newComponent = {
      componentType: comp.componentType,
      name: comp.name || `${comp.componentType} - ${comp.componentId}`,
      description: comp.description,
      basePrice: { cents: 0, currency: 'INR' },
      finalPrice: { cents: 0, currency: 'INR' },
      config: { accessLevel: 'full' },
      entitlements: {
        mainEventAccess: comp.componentType === 'main-event',
        dayAccess: {},
        meals: { breakfast: [], lunch: [], dinner: [], snacks: [] },
        kitItems: [],
        certificates: [],
        workshops: [],
        sessions: [],
        networking: {
          welcomeReception: false,
          dinnerBanquet: false,
          networkingBreaks: false,
          closingCeremony: false
        },
        virtualAccess: {
          liveStreaming: false,
          recordings: false,
          presentations: false,
          digitalResources: false
        },
        badgeAccess: true,
        printingAccess: true
      },
      status: 'active',
      purchaseDate: new Date()
    };
    
    // Set component pricing from event configuration
    const price = event.getComponentPrice(comp.componentType, comp.componentId, audience, registration && registration.category && registration.category.name);
    if (price) {
      if (newComponent && newComponent.basePrice) {
        newComponent.basePrice.cents = price.priceCents;
      }
      if (newComponent && newComponent.finalPrice) {
        newComponent.finalPrice.cents = price.priceCents;
      }
    }
    
    registration && registration.registrationComponents && registration.registrationComponents.push(newComponent);
  });
  
  // Update total pricing
  const currentTotal = registration.amountCents || 0;
  registration.amountCents = currentTotal + newComponentPricing.totalCents;
  
  // Update aggregated entitlements
  if (registration.updateAggregatedEntitlements) {
  registration.updateAggregatedEntitlements();
  }
  
  // If there's a new payment amount, update payment status
  if (newComponentPricing.totalCents > 0) {
    registration.paymentStatus = 'pending';
  }
  
  await registration.save();
  
  // Populate and return
  const updatedRegistration = await Registration.findById(registration._id)
    .populate('event', 'name startDate endDate logo')
    .populate('category', 'name color permissions');
  
  if (!updatedRegistration) {
    return StandardErrorHandler.sendError(res, 404, 'Resource not found');
  }
  
  return sendSuccess(res, 200, 'Components added to registration successfully', {
    registration: updatedRegistration,
    addedComponents: components,
    additionalCost: newComponentPricing
  });
});

/**
 * Get resource usage for a specific registration
 * @route   GET /api/events/:eventId/registrations/:registrationId/resource-usage
 * @access  Private (Admin, Staff, Organizer)
 */
const getRegistrationResourceUsage = async (req, res, next) => {
  try {
    const { eventId, registrationId } = req.params;
    
    // Validate IDs
    if (!eventId || !registrationId) {
      return next(createApiError(400, 'Event ID and Registration ID are required'));
    }
    
    // Get resource usage from Resource model
    const Resource = require('../models/Resource');
    const resourceUsage = await Resource.find({
      event: eventId,
      registration: registrationId
    }).sort({ createdAt: -1 });
    
    // Transform the data for frontend consumption
    const formattedUsage = resourceUsage.map(resource => ({
      _id: resource._id,
      type: resource.type,
      displayName: resource.details?.displayName || resource.details?.option || resource.type,
      actionDate: resource.createdAt,
      createdAt: resource.createdAt,
      isVoided: resource.isVoided || false,
      voidedAt: resource.voidedAt,
      voidedBy: resource.voidedBy,
      details: resource.details
    }));
    
    sendSuccess(res, 200, 'Resource usage retrieved successfully', formattedUsage);
  } catch (error) {
    console.error('Error getting registration resource usage:', error);
    next(createApiError(500, 'Error retrieving resource usage'));
  }
};

/**
 * @desc    Public registration lookup by registration ID (no auth required)
 * @route   POST /api/events/:eventId/registrations/public-lookup
 * @access  Public
 */
const publicRegistrationLookup = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { registrationId  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };

  if (!registrationId) {
    return sendSuccess(res, 400, 'Registration ID is required');
  }

  if (!mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(eventId)) {
    return sendSuccess(res, 400, 'Invalid Event ID format');
  }

  try {
    // Find registration by registrationId string and event
    const registration = await Registration.findOne({
      event: eventId,
      registrationId: registrationId.trim()
    })
    .populate('event', 'name startDate endDate')
    .populate('category', 'name color')
    .populate('sponsoredBy', 'companyName name contactPerson email sponsorshipLevel');

    if (!registration) {
      return sendSuccess(res, 404, 'Registration not found with the provided ID');
    }

    // Return only public-safe information
    const publicData = {
      _id: registration._id,
      registrationId: registration.registrationId,
      personalInfo: {
        firstName: registration.personalInfo?.firstName,
        lastName: registration.personalInfo?.lastName,
        email: registration.personalInfo?.email,
        phone: registration.personalInfo?.phone,
        organization: registration.personalInfo?.organization,
        designation: registration.personalInfo?.designation,
        country: registration.personalInfo?.country
      },
      category: registration.category,
      registrationType: registration.registrationType,
      status: registration.status,
      paymentStatus: registration.paymentStatus,
      checkIn: registration.checkIn,
      badgePrinted: registration.badgePrinted,
      createdAt: registration.createdAt,
      sponsoredBy: registration.sponsoredBy,
      event: registration.event
    };

    return sendSuccess(res, 200, 'Registration found successfully', publicData);
  } catch (error) {
    console.error('Error in public registration lookup:', error);
    return sendSuccess(res, 500, 'An error occurred while searching for the registration');
  }
});

module.exports = {
  getRegistrations,
  getRegistrationsCount,
  getRegistrationById,
  createRegistration,
  updateRegistration,
  deleteRegistration,
  checkInRegistration,
  importRegistrations,
  exportRegistrationsController,
  getRegistrationStatistics,
  getImportJobStatus,
  getRegistrationDetailsByScan,
  createRegistrationPublic,
  sendPaymentLink,
  // NEW: Component-based registration functions
  getAvailableComponents,
  calculateComponentPrice,
  createComponentRegistration,
  addComponentsToRegistration,
  getRegistrationResourceUsage,
  publicRegistrationLookup
}; 