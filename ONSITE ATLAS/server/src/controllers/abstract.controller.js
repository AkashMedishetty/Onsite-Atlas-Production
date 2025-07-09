const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const mongoose = require('mongoose');
const Abstract = require('../models/Abstract');
const User = require('../models/User');
const { createApiError } = require('../middleware/error');
const { sendSuccess, sendPaginated } = require('../utils/responseFormatter');
const logger = require('../config/logger');
const sendEmail = require('../utils/sendEmail');
const { generateAbstractsExcel } = require('../utils/excelHelper');
const { buildUploadDir, buildFileUrl, UPLOADS_BASE_DIR } = require('../config/paths');
const { processTemplate } = require('../services/emailService');
const AuthorUser = require('../models/AuthorUser');
const asyncHandler = require('../middleware/async');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Category = require('../models/Category');
const StandardErrorHandler = require('../utils/standardErrorHandler');
/**
 * @desc    Get all abstracts for an event OR a specific registrant's abstracts
 * @route   GET /api/events/:eventId/abstracts (for registrant, uses protectRegistrant)
 * @route   GET /api/events/:eventId/abstracts/all-event-abstracts (for admin/staff, uses protect/restrict)
 * @access  Protected (Registrant or Admin/Staff/Reviewer)
 */
const getAbstracts = asyncHandler(async (req, res, next) => {
  const { eventId } = req.params;
  let filters = {};
  if (!eventId) {
    return next(createApiError(400, 'Event ID is required'));
  }
  filters.event = eventId;
  if (req?.query?.category) {
    filters.category = req?.query?.category;
  }
  // If finalOnly query param is set, filter to abstracts that have finalFileUrl
  if (req?.query?.finalOnly === 'true' || req?.query?.finalOnly === '1') {
    filters.finalFileUrl = { $exists: true, $ne: null };
  }
  // Fetch the event to get embedded abstractSettings.categories
  const event = await Event.findById(eventId);
  let embeddedCategories = [];
  if (event && event.abstractSettings && Array.isArray(event?.abstractSettings?.categories)) {
    embeddedCategories = event?.abstractSettings?.categories;
  }
  // Determine access type and apply further filters
  if (req.registrant && req?.registrant?._id) {
    filters.registration = req?.registrant?._id;
  } else if (req.author && req?.author?._id) {
    filters.author = req?.author?._id;
  } else if (req.user && (req?.user?.role === 'admin' || req?.user?.role === 'staff' || req?.user?.role === 'reviewer')) {
    if (req?.query?.status) {
      filters.status = req?.query?.status;
    }
    if (req?.query?.category) {
      filters.category = req?.query?.category;
    }
    if (req?.query?.author) {
      filters.author = req?.query?.author;
    }
  } else {
    return next(createApiError(403, 'Not authorized to access this resource'));
  }
  // Pagination params
  const page = parseInt(req?.query?.page, 10) || 1;
  const limit = parseInt(req?.query?.limit, 10) || 20;
  const skip = (page - 1) * limit;

  // If search is present, use aggregation pipeline to support registration fields
  if (req?.query?.search && typeof req?.query?.search === 'string' && req?.query?.search.trim()) {
    const searchTerm = req?.query?.search.trim();
    logger.info('[all-event-abstracts] Search term:', searchTerm);
    // Only search on Abstract fields for robust search
    const orFilters = [
      { title: { $regex: searchTerm, $options: 'i' } },
      { authors: { $regex: searchTerm, $options: 'i' } },
      { authorAffiliations: { $regex: searchTerm, $options: 'i' } },
      { topic: { $regex: searchTerm, $options: 'i' } },
      { subTopic: { $regex: searchTerm, $options: 'i' } },
      { content: { $regex: searchTerm, $options: 'i' } },
      { keywords: { $elemMatch: { $regex: searchTerm, $options: 'i' } } },
      { registrationId: { $regex: searchTerm, $options: 'i' } }, // Only if present on Abstract
    ];
    // Use a simple find with $or for robust search
    filters.$or = orFilters;
    // Debug log for filters
    logger.info('[all-event-abstracts] MongoDB filters (robust):', JSON.stringify(filters));
    let [abstracts, total] = await Promise.all([
      Abstract.find(filters)
        .populate('registration', 'registrationId personalInfo')
        .populate('author', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Abstract.countDocuments(filters)
    ]);
    // Debug log for number of results
    logger.info(`[all-event-abstracts] Found ${total} abstracts for filters. Returned ${abstracts && abstracts.length} on this page.`);
    function flattenRegistrationInfo(abstract) {
      if (!abstract) return abstract;
      if (abstract.registration && abstract?.registration?.registrationId) {
        abstract.registrationId = abstract?.registration?.registrationId;
      } else if (!abstract.registrationId) {
        logger.warn('[DEBUG] registrationId missing after population:', abstract._id);
      }
      if (abstract.registration && abstract?.registration?.personalInfo) {
        abstract.personalInfo = abstract?.registration?.personalInfo;
      }
      return abstract;
    }
    if (Array.isArray(abstracts)) {
      abstracts = abstracts.map(a => flattenRegistrationInfo(a.toObject ? a.toObject() : a));
      abstracts.forEach(abs => {
        let catId = abs.category;
        if (catId && typeof catId === 'object' && catId.$oid) catId = catId.$oid;
        else if (catId && catId._id) catId = catId._id;
        else if (catId) catId = String(catId);
        const match = embeddedCategories.find(cat => {
          let embeddedId = cat._id;
          if (embeddedId && typeof embeddedId === 'object' && embeddedId.$oid) embeddedId = embeddedId.$oid;
          else if (embeddedId && embeddedId._id) embeddedId = embeddedId._id;
          else if (embeddedId) embeddedId = String(embeddedId);
          return embeddedId === catId;
        });
        abs.categoryName = match ? match.name : 'N/A';
      });
      abstracts.forEach(abs => {
        logger.info('[all-event-abstracts] Abstract:', abs._id, 'category field:', abs.category, 'categoryName:', abs.categoryName);
      });
    }
    return sendPaginated(res, 200, 'Abstracts retrieved successfully', abstracts, page, limit, total);
  }
  // ... existing code ...

  // Debug log for filters
  logger.info('[all-event-abstracts] MongoDB filters:', JSON.stringify(filters));
  // Populate fields
  let [abstracts, total] = await Promise.all([
    Abstract.find(filters)
      .populate('registration', 'registrationId personalInfo')
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Abstract.countDocuments(filters)
  ]);
  // Debug log for number of results
  logger.info(`[all-event-abstracts] Found ${total} abstracts for filters. Returned ${abstracts && abstracts.length} on this page.`);
  function flattenRegistrationInfo(abstract) {
    if (!abstract) return abstract;
    if (abstract.registration && abstract?.registration?.registrationId) {
      abstract.registrationId = abstract?.registration?.registrationId;
    } else if (!abstract.registrationId) {
      logger.warn('[DEBUG] registrationId missing after population:', abstract._id);
    }
    if (abstract.registration && abstract?.registration?.personalInfo) {
      abstract.personalInfo = abstract?.registration?.personalInfo;
    }
    return abstract;
  }
  if (Array.isArray(abstracts)) {
    abstracts = abstracts.map(a => flattenRegistrationInfo(a.toObject ? a.toObject() : a));
    abstracts.forEach(abs => {
      let catId = abs.category;
      if (catId && typeof catId === 'object' && catId.$oid) catId = catId.$oid;
      else if (catId && catId._id) catId = catId._id;
      else if (catId) catId = String(catId);
      const match = embeddedCategories.find(cat => {
        let embeddedId = cat._id;
        if (embeddedId && typeof embeddedId === 'object' && embeddedId.$oid) embeddedId = embeddedId.$oid;
        else if (embeddedId && embeddedId._id) embeddedId = embeddedId._id;
        else if (embeddedId) embeddedId = String(embeddedId);
        return embeddedId === catId;
      });
      abs.categoryName = match ? match.name : 'N/A';
    });
    abstracts.forEach(abs => {
      logger.info('[all-event-abstracts] Abstract:', abs._id, 'category field:', abs.category, 'categoryName:', abs.categoryName);
    });
  }
  // Fix: Pass correct arguments to sendPaginated (status, message, data, page, limit, total)
  return sendPaginated(res, 200, 'Abstracts retrieved successfully', abstracts, page, limit, total);
});

/**
 * @desc    Get all abstracts for a specific registration within an event (Admin/Staff access)
 * @route   GET /api/events/:eventId/abstracts/by-registration/:registrationId
 * @access  Protected (Admin/Staff)
 */
const getAbstractsByRegistration = asyncHandler(async (req, res, next) => {
  const { eventId, registrationId } = req.params;
  const { status } = req.query;

  if (!eventId || !mongoose?.Types?.ObjectId.isValid(eventId)) {
    return next(createApiError(400, 'Valid Event ID is required'));
  }
  if (!registrationId || !mongoose?.Types?.ObjectId.isValid(registrationId)) {
    return next(createApiError(400, 'Valid Registration ID is required'));
  }

  // Verify the event exists (optional, but good practice)
  const event = await Event.findById(eventId);
  if (!event) {
    return next(createApiError(`Event not found with id of ${eventId}`, 404));
  }

  // Verify the registration exists (optional, but good practice)
  const registration = await Registration.findById(registrationId);
  if (!registration) {
    return next(createApiError(`Registration not found with id of ${registrationId}`, 404));
  }

  // Ensure the registration belongs to the event (important consistency check)
  if (registration?.event?.toString() !== eventId) {
    logger.warn(`[getAbstractsByRegistration] Registration ${registrationId} does not belong to event ${eventId}.`);
    return next(createApiError(`Registration ${registrationId} is not associated with event ${eventId}.`, 400));
  }

  logger.info(`[getAbstractsByRegistration] Admin/Staff ${req?.user?._id} fetching abstracts for registration ${registrationId} in event ${eventId} with status: ${status}`);

  // Build query
  let query = { event: eventId, registration: registrationId };
  if (status) {
    query.status = status;
  }
  logger.info(`[getAbstractsByRegistration] MongoDB query: ${JSON.stringify(query)}`);

  let abstracts = await Abstract.find(query)
    .populate('registration', 'registrationId personalInfo')
    .populate('category', 'name')
    .populate('author', 'name email')
    .sort({ createdAt: -1 });

  logger.info(`[getAbstractsByRegistration] Found ${abstracts && abstracts.length} abstracts for registration ${registrationId} in event ${eventId} with status: ${status}`);

  // Utility to flatten registrationId and personalInfo on each abstract
  function flattenRegistrationInfo(abstract) {
    if (!abstract) return abstract;
    if (abstract.registration && abstract?.registration?.registrationId) {
      abstract.registrationId = abstract?.registration?.registrationId;
    } else if (!abstract.registrationId) {
      // Log if missing
      logger.warn('[DEBUG] registrationId missing after population:', abstract._id);
    }
    if (abstract.registration && abstract?.registration?.personalInfo) {
      abstract.personalInfo = abstract?.registration?.personalInfo;
    }
    return abstract;
  }

  // For arrays:
  if (Array.isArray(abstracts)) {
    abstracts = abstracts.map(a => flattenRegistrationInfo(a.toObject ? a.toObject() : a));
  }

  if (!abstracts || abstracts.length === 0) {
    // Not an error, just no abstracts for this specific registration in this event
    return sendSuccess(res, 200, 'No abstracts found for this registration in this event.', []);
  }

  return sendSuccess(res, 200, 'Abstracts retrieved successfully for the specified registration.', abstracts, abstracts && abstracts.length);
});

/**
 * @desc    Get single abstract
 * @route   GET /api/events/:eventId/abstracts/:id 
 * @access  Protected (Registrant Owner or Admin/Staff/Reviewer)
 */
exports.getAbstract = asyncHandler(async (req, res, next) => {
  const abstractId = req?.params?.id;
  const abstract = await Abstract.findById(abstractId)
    .populate('registration', 'registrationId personalInfo') 
    .populate('category', 'name')
    .populate('author', 'name email');

  if (!abstract) {
    return StandardErrorHandler.sendError(res, 404, 'Resource not found');
  }

  let isAuthorized = false;

  // Check Admin/Staff/Reviewer access via req.user
  if (req.user && ('admin' === req?.user?.role || 'staff' === req?.user?.role || 'reviewer' === req?.user?.role)) {
    isAuthorized = true;
    logger.info(`[getAbstract] Admin/Staff/Reviewer ${req?.user?._id} accessing abstract ${abstractId}`);
  }
  // Check Registrant owner access via req.registrant
  else if (req.registrant && abstract.registration && abstract?.registration?.equals(req?.registrant?._id)) {
    isAuthorized = true;
    logger.info(`[getAbstract] Registrant owner ${req?.registrant?._id} accessing abstract ${abstractId}`);
  }

  if (!isAuthorized) {
     logger.warn(`[getAbstract] Unauthorized attempt to access abstract ${abstractId}`);
         // Return 404 to hide existence from unauthorized users
     return next(createApiError(`Abstract not found with id of ${abstractId}`, 404)); 
  }

  // For single abstract fetches:
  if (abstract && abstract.registration && abstract?.registration?.registrationId) {
    abstract.registrationId = abstract?.registration?.registrationId;
  }
  if (abstract && abstract.registration && abstract?.registration?.personalInfo) {
    abstract.personalInfo = abstract?.registration?.personalInfo;
  }

  return sendSuccess(res, 200, 'Abstract retrieved successfully', abstract);
});

/**
 * @desc    Create new abstract
 * @route   POST /api/abstracts
 * @route   POST /api/events/:eventId/abstracts
 * @access  Private
 */
exports.createAbstract = asyncHandler(async (req, res, next) => {
  try {
    // logger.info('Create abstract request body:', req.body); // Keep for debugging if needed
    
    if (req?.params?.eventId) {
      // Fix: Don't use optional chaining in assignment
      if (!req.body) req.body = {};
      req.body.event = req.params.eventId;
    }

    const eventId = req?.body?.event || req?.body?.eventId;
    const registrationId = req?.body?.registration || req?.body?.registrationId;
    
    if (!eventId || (typeof eventId !== 'string' && typeof eventId !== 'object')) {
      return next(new ErrorResponse('Invalid or missing event ID', 400));
    }

    const isAuthorFlow = !!req.author;

    // In author flow we do NOT require registrationId
    if (!isAuthorFlow && (!registrationId || (typeof registrationId !== 'string' && typeof registrationId !== 'object'))) {
      return next(new ErrorResponse('Invalid or missing registration ID', 400));
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return next(new ErrorResponse(`Event not found with id of ${eventId}`, 404));
    }

    let registration = null;
    if (!isAuthorFlow) {
      registration = await Registration.findById(registrationId).populate('personalInfo');
      if (!registration) {
        return next(new ErrorResponse(`Registration not found with id of ${registrationId}`, 404));
      }
    }

    const abstractData = {
      event: eventId,
      // registration only if available (post-registration flow)
      registration: registrationId || undefined,
      author: isAuthorFlow ? req?.author?._id : undefined,
      submissionPath: isAuthorFlow ? 'pre-registration' : 'post-registration',
      title: req?.body?.title || 'Untitled Abstract',
      authors: req?.body?.authors || 'Anonymous',
      authorAffiliations: req?.body?.authorAffiliations || req?.body?.affiliations || '',
      topic: req?.body?.topic || '',
      subTopic: req?.body?.subTopic || '',
      content: req?.body?.content || 'Abstract content',
      category: req?.body?.category || null,
      wordCount: req?.body?.content ? req?.body?.content.trim && req?.body?.content.trim().split(/\s+/).length : 0
    };

    if (!event.abstractSettings || !event?.abstractSettings?.enabled) {
      return next(new ErrorResponse('Abstract submissions are not enabled for this event', 400));
    }
    if (!event?.abstractSettings?.isOpen) {
      return next(new ErrorResponse('Abstract submissions are not currently open for this event', 400));
    }
    if (event?.abstractSettings?.deadline) {
      const deadline = new Date(event?.abstractSettings?.deadline);
      const now = new Date();
      if (now > deadline) {
        return next(new ErrorResponse('Abstract submission deadline has passed', 400));
      }
    }
    if (abstractData.content) {
      const maxLength = event?.abstractSettings?.maxLength || 500;
      if (abstractData.wordCount > maxLength) {
        return next(new ErrorResponse(`Abstract exceeds maximum word count of ${maxLength}`, 400));
      }
    }
    // No per-category uniqueness restriction anymore — authors/registrants may submit multiple abstracts.

    const abstract = await Abstract.create(abstractData);

    // Removed email sending logic from here as it's likely handled by abstractWorkflowController.submitAbstract
    // logger.info(`Abstract ${abstract._id} created. Email confirmation handled by workflow controller if applicable.`);

    // Auto-assign reviewers based on category
    if (abstract.category && event.abstractSettings && Array.isArray(event?.abstractSettings?.categories)) {
      let catId = abstract.category;
      if (catId && typeof catId === 'object' && catId.$oid) catId = catId.$oid;
      else if (catId && catId._id) catId = catId._id;
      else if (catId) catId = String(catId);
      const match = event?.abstractSettings?.categories.find(cat => {
        let embeddedId = cat._id;
        if (embeddedId && typeof embeddedId === 'object' && embeddedId.$oid) embeddedId = embeddedId.$oid;
        else if (embeddedId && embeddedId._id) embeddedId = embeddedId._id;
        else if (embeddedId) embeddedId = String(embeddedId);
        return embeddedId === catId;
      });
      if (match && Array.isArray(match.reviewerIds) && match?.reviewerIds?.length > 0) {
        abstract.reviewDetails = abstract.reviewDetails || {};
        abstract.reviewDetails.assignedTo = match.reviewerIds.map(id => id.toString());
        await abstract.save();
      }
    }

    // ---- Send abstract submission confirmation email (author or registrant) ----
    try {
      let recipientEmail='', firstName='Author';
      if(isAuthorFlow && req.author){
        recipientEmail = req?.author?.email;
        firstName = req?.author?.name?.split(' ')[0] || 'Author';
      } else if(registration){
        recipientEmail = registration?.personalInfo?.email;
        firstName = registration?.personalInfo?.firstName || 'Participant';
      }
      if(recipientEmail && event.emailSettings?.enabled){
        const tmpl = event?.emailSettings?.templates?.abstractSubmission;
        const placeholderData={
          firstName,
          eventName: event.name,
          abstractTitle: abstract.title,
          abstractNumber: abstract.abstractNumber||''
        };
        const subj = tmpl? processTemplate(tmpl.subject, placeholderData) : `Abstract Submission Received - ${event.name}`;
        const bodyRaw = tmpl? processTemplate(tmpl.body, placeholderData) : `Dear ${firstName},<br/><br/>Thank you for submitting your abstract "${abstract.title}" for ${event.name}.<br/>Your abstract ID is ${abstract.abstractNumber}. We will notify you once review is complete.<br/><br/>Regards,<br/>The Organizing Team`;
        await sendEmail({
          to: recipientEmail,
          subject: subj,
          html: bodyRaw,
          fromName: event?.emailSettings?.senderName,
          fromEmail: event?.emailSettings?.senderEmail,
          smtp: {
            host: event?.emailSettings?.smtpHost,
            port: event?.emailSettings?.smtpPort,
            secure: event?.emailSettings?.smtpSecure,
            auth: {
              user: event?.emailSettings?.smtpUser,
              pass: event?.emailSettings?.smtpPassword
            }
          }
        });
      }
    } catch(mailErr){
      logger.error('[createAbstract] Failed to send submission email:', mailErr.message);
    }

    return sendSuccess(res, 201, 'Abstract created successfully.', abstract);
  } catch (error) {
    logger.error('Error in createAbstract:', error);
    return next(error);
  }
});

/**
 * @desc    Update abstract
 * @route   PUT /api/events/:eventId/abstracts/:id
 * @access  Protected (Registrant Owner or Admin/Staff)
 */
exports.updateAbstract = asyncHandler(async (req, res, next) => {
  const abstractId = req?.params?.id;
  let abstract = await Abstract.findById(abstractId);

  if (!abstract) {
    return next(createApiError(`Abstract not found with id of ${abstractId}`, 404));
  }
  
  let isAuthorized = false;
  let canEdit = false;
  const editableStatuses = ['draft', 'submitted', 'revision-requested']; // Statuses where owner can edit

  // Check Admin/Staff access via req.user
  if (req.user && (req?.user?.role === 'admin' || req?.user?.role === 'staff')) {
    isAuthorized = true;
    canEdit = true; // Admins/Staff can edit regardless of status
    logger.info(`[updateAbstract] Admin/Staff ${req?.user?._id} updating abstract ${abstractId}`);
  }
  // Check Registrant owner access via req.registrant
  else if (req.registrant && abstract.registration && abstract?.registration?.equals(req?.registrant?._id)) {
     logger.info(`[updateAbstract] Registrant owner ${req?.registrant?._id} attempting update for abstract ${abstractId}`);
    isAuthorized = true;
    const event = await Event.findById(abstract.event);
    if (event && event.abstractSettings && !event?.abstractSettings?.allowEditing) {
        logger.warn(`[updateAbstract] Registrant ${req?.registrant?._id} cannot edit abstract ${abstractId} as editing is disallowed by event settings.`);
        return next(createApiError(400, 'Editing is not allowed for abstracts in this event.'));
    }
    if (editableStatuses.includes(abstract.status)) {
        canEdit = true;
    } else {
        logger.warn(`[updateAbstract] Registrant ${req?.registrant?._id} cannot edit abstract ${abstractId} due to status: ${abstract.status}`);
        return next(createApiError(`Abstract cannot be edited in its current status: ${abstract.status}`, 400));
    }
  } else if (req.author && abstract.author && abstract?.author?.equals(req?.author?._id)) {
     logger.info(`[updateAbstract] Author owner ${req?.author?._id} attempting update for abstract ${abstractId}`);
    isAuthorized = true;
    const event = await Event.findById(abstract.event);
    if (event && event.abstractSettings && !event?.abstractSettings?.allowEditing) {
        logger.warn(`[updateAbstract] Author ${req?.author?._id} cannot edit abstract ${abstractId} as editing is disallowed by event settings.`);
        return next(createApiError(400, 'Editing is not allowed for abstracts in this event.'));
    }
    if (editableStatuses.includes(abstract.status)) {
        canEdit = true;
    } else {
        logger.warn(`[updateAbstract] Author ${req?.author?._id} cannot edit abstract ${abstractId} due to status: ${abstract.status}`);
        return next(createApiError(`Abstract cannot be edited in its current status: ${abstract.status}`, 400));
    }
  } else {
     isAuthorized = false;
  }

  if (!isAuthorized) {
     logger.warn(`[updateAbstract] Unauthorized attempt to update abstract ${abstractId}`);
     return next(createApiError(`Abstract not found with id of ${abstractId}`, 404)); 
  }
  
  if (!canEdit) {
      return next(createApiError(`Abstract cannot be edited in its current status: ${abstract.status}`, 400));
  }

  const updateData = { ...req.body };
  const oldFileUrl = abstract.fileUrl;

  if (req.registrant || req.author) {
      delete updateData.status;
      delete updateData.event; 
      delete updateData.registration;
      delete updateData.author;
      // Prevent registrants from directly modifying fileUrl, fileName, fileSize, fileType - this should go via uploadAbstractFile
      delete updateData.fileUrl;
      delete updateData.fileName;
      delete updateData.fileSize;
      delete updateData.fileType;
  }

  // If an admin is explicitly setting fileUrl to null or empty, it means they want to remove the file.
  if (req.user && (req?.user?.role === 'admin' || req?.user?.role === 'staff') && 
      oldFileUrl && (updateData.fileUrl === null || updateData.fileUrl === '')) {
    const relPath = oldFileUrl.replace(/^\/?uploads[\/]/, '');
    const filePath = path.join(UPLOADS_BASE_DIR, relPath);
    fs.unlink(filePath, (err) => {
      if (err) {
        logger.error(`[updateAbstract] Failed to delete physical file ${filePath} during update (file removal): ${err.message}`);
      } else {
        logger.info(`[updateAbstract] Successfully deleted physical file ${filePath} during update (file removal)`);
        // Ensure these fields are also cleared in the database if fileUrl is cleared by admin
        updateData.fileName = null;
        updateData.fileSize = null;
        updateData.fileType = null;
      }
    });
  } else if (req.user && (req?.user?.role === 'admin' || req?.user?.role === 'staff') && updateData.fileUrl && updateData.fileUrl !== oldFileUrl) {
    // Admin is changing the fileUrl directly - this is discouraged, uploadAbstractFile should be used.
    // However, if they do, and there was an old file, attempt to delete it.
    // This part is risky if the new fileUrl isn't managed properly by an upload process.
    if (oldFileUrl) {
        const oldFilePath = path.join(__dirname, '..', oldFileUrl);
        fs.unlink(oldFilePath, (err) => {
            if (err) {
                logger.error(`[updateAbstract] Failed to delete old physical file ${oldFilePath} when admin changed fileUrl directly: ${err.message}`);
            } else {
                logger.info(`[updateAbstract] Successfully deleted old physical file ${oldFilePath} when admin changed fileUrl directly`);
            }
        });
    }
    logger.warn(`[updateAbstract] Admin ${req?.user?._id} changed fileUrl directly for abstract ${abstractId}. This is not the recommended way to update files.`);
  }
  
  // Word count check from event settings if content is being updated
  if (updateData.content && ((req.user && (req?.user?.role === 'admin' || req?.user?.role === 'staff')) || req.registrant)) {
    const event = await Event.findById(abstract.event);
    if (event && event.abstractSettings && event?.abstractSettings?.maxLength) {
        const wordCount = updateData?.content?.trim().split(/\s+/).length;
        if (wordCount > event?.abstractSettings?.maxLength) {
            return next(createApiError(`Abstract content exceeds the maximum word count of ${event?.abstractSettings?.maxLength}.`, 400));
        }
        updateData.wordCount = wordCount; // Update word count if content changes
    }
  }

  const updatedAbstract = await Abstract.findByIdAndUpdate(abstractId, updateData, {
    new: true,
    runValidators: true
  });

  return sendSuccess(res, 200, 'Abstract updated successfully', updatedAbstract);
});

/**
 * @desc    Delete abstract
 * @route   DELETE /api/events/:eventId/abstracts/:id 
 * @access  Protected (Registrant Owner or Admin/Staff)
 */
exports.deleteAbstract = asyncHandler(async (req, res, next) => {
  const abstractId = req?.params?.id;
  const abstract = await Abstract.findById(abstractId);

  if (!abstract) {
    return next(createApiError(`Abstract not found with id of ${abstractId}`, 404));
  }

  let isAuthorized = false;

  // Check Admin/Staff access via req.user
  if (req.user && (req?.user?.role === 'admin' || req?.user?.role === 'staff')) {
    isAuthorized = true;
    logger.info(`[deleteAbstract] Admin/Staff ${req?.user?._id} deleting abstract ${abstractId}`);
  }
  // Check Registrant owner access via req.registrant
  else if (req.registrant && abstract.registration && abstract?.registration?.equals(req?.registrant?._id)) {
        isAuthorized = true;
    logger.info(`[deleteAbstract] Registrant owner ${req?.registrant?._id} deleting abstract ${abstractId}`);
  }

  if (!isAuthorized) {
    logger.warn(`[deleteAbstract] Unauthorized attempt to delete abstract ${abstractId}`);
    return next(createApiError(`Not authorized to delete this abstract`, 403));
  }

  // Physical file deletion
  if (abstract.fileUrl) {
    const filePath = path.join(UPLOADS_BASE_DIR, abstract?.fileUrl?.replace(/^\/uploads[\/]/, ''));
    fs.unlink(filePath, (err) => {
      if (err) {
        // Log the error but don't necessarily block the abstract deletion
        // It could be that the file was already deleted or path is incorrect
        logger.error(`[deleteAbstract] Failed to delete physical file ${filePath}: ${err.message}`);
      } else {
        logger.info(`[deleteAbstract] Successfully deleted physical file ${filePath}`);
      }
    });
  }

  await abstract.deleteOne(); // Changed from abstract.remove() for Mongoose v6+

  return sendSuccess(res, 200, 'Abstract deleted successfully', {});
});

/**
 * @desc    Update abstract status
 * @route   PUT /api/abstracts/:id/status
 * @access  Private/Admin
 */
exports.updateAbstractStatus = asyncHandler(async (req, res, next) => {
  const { status  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };

  if (!status || !['draft', 'submitted', 'under-review', 'approved', 'rejected'].includes(status)) {
    return next(new ErrorResponse('Please provide a valid status', 400));
  }

  const abstract = await Abstract.findById(req?.params?.id);

  if (!abstract) {
    return next(new ErrorResponse(`Abstract not found with id of ${req?.params?.id}`, 404));
  }

  // Update status
  abstract.status = status;
  await abstract.save();

  return sendSuccess(res, 200, 'Abstract status updated successfully', abstract);
});

/**
 * @desc    Add review comment
 * @route   POST /api/abstracts/:id/comments
 * @access  Private/Admin
 */
exports.addReviewComment = asyncHandler(async (req, res, next) => {
  const { comment  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };

  if (!comment) {
    return next(new ErrorResponse('Please provide a comment', 400));
  }

  const abstract = await Abstract.findById(req?.params?.id);

  if (!abstract) {
    return next(new ErrorResponse(`Abstract not found with id of ${req?.params?.id}`, 404));
  }

  // Add comment
  abstract?.reviewComments?.push({
    userId: req?.user?.id,
    comment
  });

  await abstract.save();

  return sendSuccess(res, 200, 'Comment added successfully', abstract);
});

/**
 * @desc    Upload file for abstract
 * @route   POST /api/events/:eventId/abstracts/:id/file
 * @access  Protected (Registrant Owner or Admin/Staff)
 */
exports.uploadAbstractFile = asyncHandler(async (req, res, next) => {
  const abstractId = req?.params?.id;
  const abstract = await Abstract.findById(abstractId);

  if (!abstract) {
    return next(createApiError(`Abstract not found with id of ${abstractId}`, 404));
  }
  
  let isAuthorized = false;
  let canUpload = false;
  const editableStatuses = ['draft', 'submitted', 'revision-requested']; // Added revision-requested

  // Check Admin/Staff access via req.user
  if (req.user && (req?.user?.role === 'admin' || req?.user?.role === 'staff')) {
    isAuthorized = true;
    canUpload = true; // Admins/Staff can upload regardless of status
    logger.info(`[uploadAbstractFile] Admin/Staff ${req?.user?._id} uploading file for abstract ${abstractId}`);
  }
  // Check Registrant owner access via req.registrant
  else if (req.registrant && abstract.registration && abstract?.registration?.equals(req?.registrant?._id)) {
    logger.info(`[uploadAbstractFile] Registrant owner ${req?.registrant?._id} attempting upload for abstract ${abstractId}`);
    isAuthorized = true;
    // Registrants can only upload if status allows
    if (editableStatuses.includes(abstract.status)) {
        canUpload = true;
    } else {
        logger.warn(`[uploadAbstractFile] Registrant ${req?.registrant?._id} cannot upload file for abstract ${abstractId} due to status: ${abstract.status}`);
        return next(createApiError(`Cannot upload file for abstract in its current status: ${abstract.status}`, 400));
    }
  } else {
    // Check Author owner access via req.author (pre-registration submissions)
    if (req.author && abstract.author && abstract?.author?.equals(req?.author?._id)) {
      logger.info(`[uploadAbstractFile] Author owner ${req?.author?._id} attempting upload for abstract ${abstractId}`);
      isAuthorized = true;
      if (editableStatuses.includes(abstract.status)) {
        canUpload = true;
      } else {
        logger.warn(`[uploadAbstractFile] Author ${req?.author?._id} cannot upload file for abstract ${abstractId} due to status: ${abstract.status}`);
        return next(createApiError(`Cannot upload file for abstract in its current status: ${abstract.status}`, 400));
      }
    }
    else {
      isAuthorized = false;
    }
  }
  
  if (!isAuthorized) {
     logger.warn(`[uploadAbstractFile] Unauthorized attempt to upload file for abstract ${abstractId}`);
     return next(createApiError(`Abstract not found with id of ${abstractId}`, 404)); 
  }
  
  if (!canUpload) {
      return next(createApiError(`Cannot upload file for abstract in its current status: ${abstract.status}`, 400));
  }

  if (!req.files || !req?.files?.file) {
    return next(createApiError(400, 'No file uploaded'));
  }

  const file = req?.files?.file;
  const eventId = abstract.event; // Get eventId from the abstract to fetch event-specific settings
  const event = await Event.findById(eventId);

  if (!event || !event.abstractSettings) {
    logger.error(`[uploadAbstractFile] Event or event.abstractSettings not found for eventId: ${eventId} on abstract ${abstractId}`);
    return next(createApiError(500, 'Event configuration error for abstract submission.'));
  }

  // Use event-specific settings or defaults
  const maxSizeMB = event?.abstractSettings?.maxFileSizeMB || 10; // Default to 10MB if not set
  const maxSize = maxSizeMB * 1024 * 1024;
  const allowedFileTypes = event?.abstractSettings?.allowedFileTypes || ['.pdf', '.doc', '.docx', '.ppt', '.pptx']; // Default if not set

  if (file.size > maxSize) {
    return next(createApiError(`File size cannot exceed ${maxSizeMB}MB`, 400));
  }

  const fileExt = path.extname(file.name).toLowerCase();
  if (!allowedFileTypes.map(type => type.toLowerCase()).includes(fileExt)) {
    return next(createApiError(`Please upload a valid file. Allowed formats: ${allowedFileTypes.join(', ')}`, 400));
  }

  // Delete old file if it exists
  if (abstract.fileUrl) {
    const oldFilePath = path.join(UPLOADS_BASE_DIR, abstract?.fileUrl?.replace(/^\/uploads[\/]/, ''));
    fs.unlink(oldFilePath, (err) => {
      if (err) {
        logger.error(`[uploadAbstractFile] Failed to delete old physical file ${oldFilePath}: ${err.message}`);
      } else {
        logger.info(`[uploadAbstractFile] Successfully deleted old physical file ${oldFilePath}`);
      }
    });
  }

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const newFileName = `abstract_${abstract._id}_${uniqueSuffix}${fileExt}`;
  const uploadDir = buildUploadDir('abstracts', event?._id?.toString());
  const newFilePath = path.join(uploadDir, newFileName);
  logger.info(`[uploadAbstractFile] uploadDir: ${uploadDir}`);
  logger.info(`[uploadAbstractFile] newFilePath: ${newFilePath}`);
  
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    await file.mv(newFilePath);
    logger.info(`[uploadAbstractFile] File moved successfully to ${newFilePath}`);

    abstract.fileUrl = buildFileUrl('abstracts', event?._id?.toString(), newFileName); 
    abstract.fileName = file.name;
    abstract.fileSize = file.size;
      abstract.fileType = fileExt.substring(1); 

    await abstract.save();
    logger.info(`[uploadAbstractFile] Abstract ${abstractId} updated with new file info.`);

    return sendSuccess(res, 200, 'File uploaded and abstract updated successfully', abstract);

  } catch (error) {
    logger.error(`[uploadAbstractFile] Error during file upload process for abstract ${abstractId}:`, error);
    return next(createApiError(500, 'File upload failed'));
  }
});

/**
 * @desc    Download all abstracts for an event
 * @route   GET /api/events/:eventId/abstracts/download
 * @access  Private/Admin
 * @query   exportMode=excel-single|excel-multi (optional) - Export abstracts as Excel (single-row or multi-row per review)
 * @query   category=categoryId (optional) - Filter abstracts by category
 * @query   topic=topicName (optional) - Filter abstracts by topic
 * @query   status=status (optional) - Filter abstracts by status (e.g. 'under-review', 'accepted', comma-separated for multiple)
 * @query   minScore=number (optional) - Minimum review score (inclusive)
 * @query   maxScore=number (optional) - Maximum review score (inclusive)
 * @query   reviewer=UserId (optional) - Only include abstracts reviewed by this reviewer
 */
exports.downloadAbstracts = asyncHandler(async (req, res, next) => {
  const eventId = req?.params?.eventId;
  const exportMode = req?.query?.exportMode || null; // 'excel-single', 'excel-multi', or null
  const filterCategory = req?.query?.category || null;
  const filterTopic = req?.query?.topic || null;
  const filterStatus = req?.query?.status || null;
  const minScore = req?.query?.minScore !== undefined ? parseFloat(req?.query?.minScore) : null;
  const maxScore = req?.query?.maxScore !== undefined ? parseFloat(req?.query?.maxScore) : null;
  const reviewerId = req?.query?.reviewer || null;
  const finalOnly = req?.query?.finalOnly === 'true' || req?.query?.finalOnly === '1';

  // Get event to validate it exists
  const event = await Event.findById(eventId);
  if (!event) {
    return next(new ErrorResponse(`Event not found with id of ${eventId}`, 404));
  }

  // Find all abstracts for the event, with optional filtering
  let query = { event: eventId };
  if (filterCategory) query['category'] = filterCategory;
  if (filterTopic) query['topic'] = filterTopic;
  if (filterStatus) {
    const statusList = filterStatus.split(',').map(s => s.trim());
    query['status'] = { $in: statusList };
  }
  // Filter for only those with uploaded final files
  if (finalOnly) {
    query['finalFileUrl'] = { $exists: true, $ne: null };
  }
  let abstracts = await Abstract.find(query)
    .populate('registrationInfo', 'registrationId personalInfo')
    .populate('category', 'name')
    .populate('author', 'name email')
    .sort({ createdAt: -1 });

  // Utility to flatten registrationId and personalInfo on each abstract
  function flattenRegistrationInfo(abstract) {
    if (!abstract) return abstract;
    if (abstract.registration && abstract?.registration?.registrationId) {
      abstract.registrationId = abstract?.registration?.registrationId;
    } else if (!abstract.registrationId) {
      // Log if missing
      logger.warn('[DEBUG] registrationId missing after population:', abstract._id);
    }
    if (abstract.registration && abstract?.registration?.personalInfo) {
      abstract.personalInfo = abstract?.registration?.personalInfo;
    }
    return abstract;
  }

  // For arrays:
  if (Array.isArray(abstracts)) {
    abstracts = abstracts.map(a => flattenRegistrationInfo(a.toObject ? a.toObject() : a));
  }

  // Score and reviewer filtering (in-memory, since reviews are subdocuments)
  if (minScore !== null || maxScore !== null || reviewerId) {
    abstracts = abstracts.filter(abs => {
      if (!abs.reviewDetails || !Array.isArray(abs?.reviewDetails?.reviews)) return false;
      return abs?.reviewDetails?.reviews.some(r => {
        if (typeof r.score !== 'number' && (minScore !== null || maxScore !== null)) return false;
        if (minScore !== null && r.score < minScore) return false;
        if (maxScore !== null && r.score > maxScore) return false;
        if (reviewerId && (!r.reviewer || r?.reviewer?.toString() !== reviewerId)) return false;
        return true;
      });
    });
  }

  if (abstracts.length === 0) {
    return next(new ErrorResponse('No abstracts found for this event', 404));
  }

  // --- NEW: If files-only export is requested, send ZIP with only uploaded files ---
  if (exportMode === 'files-only') {
    logger.info('[abstract.controller] Processing files-only export mode');
    const sanitize = (name) => name.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 50);
    const zipFileName = `abstracts_files_${sanitize(event.name)}_${Date.now()}.zip`;
    const zipFilePath = buildUploadDir('temp', zipFileName);
    const dir = path.dirname(zipFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Set up completion handler
    output.on('close', () => {
      logger.info('[abstract.controller] Files-only ZIP archive completed');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
      res.download(zipFilePath, zipFileName, (err) => {
        if (err) {
          logger.error('Error sending zip file:', error);
        }
        fs.unlinkSync(zipFilePath);
      });
    });
    
    // Set up error handlers
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        logger.warn('Archive warning:', err);
      } else {
        logger.error('Archive error:', error);
        return next(new ErrorResponse('Error creating archive', 500));
      }
    });
    
    archive.on('error', (err) => {
      logger.error('Archive error:', error);
      return next(new ErrorResponse('Error creating archive', 500));
    });
    
    archive.pipe(output);
    
    logger.info(`[abstract.controller] Processing ${abstracts && abstracts.length} abstracts for files-only ZIP`);
    let fileCount = 0;
    
    const includeFinalOnly = finalOnly;
    // Add each abstract's file (main or final) to the archive based on flag
    for (const abstract of abstracts) {
      // decide which url to use
      let relUrl = null;
      if (includeFinalOnly) {
        if (abstract.finalFileUrl) relUrl = abstract.finalFileUrl;
      } else {
        // prefer final if exists, else main fileUrl
        relUrl = abstract.finalFileUrl || abstract.fileUrl;
      }

      if (!relUrl) continue;

      const regId = abstract.registrationInfo ? abstract?.registrationInfo?.registrationId : 'unknown';
      const authorName = abstract.registrationInfo ? `${abstract?.registrationInfo?.personalInfo.firstName}_${abstract?.registrationInfo?.personalInfo.lastName}`.replace(/\s+/g, '_') : 'unknown';
      // Determine disk path and extension
      // Remove leading '/uploads/' to avoid duplication when joining with UPLOADS_BASE_DIR
      const relPath = relUrl.replace(/^\/?uploads\//, '');
      const filePath = path.join(UPLOADS_BASE_DIR, relPath);

      logger.info(`[abstract.controller] Processing file: ${filePath}`);

      if (fs.existsSync(filePath)) {
        fileCount++;
        const fileExt = path.extname(filePath);
        const sanitize = (str)=>str.replace(/[^a-zA-Z0-9_-]/g,'_');
        const parts = [];
        if (abstract.abstractNumber) parts.push(sanitize(abstract.abstractNumber));
        if (regId !== 'unknown') parts.push(sanitize(regId));
        parts.push(sanitize(authorName));
        const archiveFileName = `${parts.join('_')}${fileExt}`;
        logger.info(`[abstract.controller] Adding file to ZIP: ${archiveFileName}`);
        archive.file(filePath, { name: archiveFileName });
      } else {
        logger.warn(`[abstract.controller] File not found: ${filePath}`);
      }
    }
    
    logger.info(`[abstract.controller] Added ${fileCount} files to the ZIP archive`);
    archive.finalize();
    return;
  }
  // --- END FILES-ONLY ---

  // --- If Excel export is requested, send Excel file directly ---
  if (exportMode && exportMode.startsWith('excel')) {
    const excelMode = exportMode === 'excel-multi' ? 'multi-row' : 'single-row';
    const catOrTopic = filterCategory || filterTopic || 'all';
    // Attach eventInfo to each abstract for subtopic name resolution
    const abstractsWithEventInfo = abstracts.map(abs => ({ ...abs, eventInfo: event }));
    const { buffer, fileName } = await generateAbstractsExcel(abstractsWithEventInfo, {
      eventName: event.name,
      categoryOrTopic: catOrTopic,
      exportMode: excelMode,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument?.spreadsheetml?.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.end(buffer); // Send Excel file directly
  }
  // --- END EXCEL ---

  // Default case: Create zip file for all abstracts (including text and files)
  // ... rest of the code remains the same ...

  // --- NEW: If Excel export is requested, send Excel file directly ---
  if (exportMode && exportMode.startsWith('excel')) {
    const excelMode = exportMode === 'excel-multi' ? 'multi-row' : 'single-row';
    const catOrTopic = filterCategory || filterTopic || 'all';
    // Attach eventInfo to each abstract for subtopic name resolution
    const abstractsWithEventInfo = abstracts.map(abs => ({ ...abs, eventInfo: event }));
    const { buffer, fileName } = await generateAbstractsExcel(abstractsWithEventInfo, {
      eventName: event.name,
      categoryOrTopic: catOrTopic,
      exportMode: excelMode,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument?.spreadsheetml?.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.end(buffer); // Send Excel file directly
  }
  // --- END NEW ---

  // --- NEW: If files-only export is requested, send ZIP with only uploaded files ---
  if (exportMode === 'files-only') {
    const sanitize = (name) => name.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 50);
    const zipFileName = `abstracts_files_${sanitize(event.name)}_${Date.now()}.zip`;
    const zipFilePath = buildUploadDir('temp', zipFileName);
    const dir = path.dirname(zipFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
      res.download(zipFilePath, zipFileName, (err) => {
        if (err) {
          logger.error('Error sending zip file:', error);
        }
        fs.unlinkSync(zipFilePath);
      });
    });
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        logger.warn('Archive warning:', err);
      } else {
        logger.error('Archive error:', error);
        return next(new ErrorResponse('Error creating archive', 500));
      }
    });
    archive.on('error', (err) => {
      logger.error('Archive error:', error);
      return next(new ErrorResponse('Error creating archive', 500));
    });
    archive.pipe(output);
    for (const abstract of abstracts) {
      if (abstract.fileUrl && abstract.fileName) {
        const regId = abstract.registrationInfo ? abstract?.registrationInfo?.registrationId : 'unknown';
        const authorName = abstract.registrationInfo ? `${abstract?.registrationInfo?.personalInfo.firstName}_${abstract?.registrationInfo?.personalInfo.lastName}`.replace(/\s+/g, '_') : 'unknown';
        const oldFilePath = path.join(
  UPLOADS_BASE_DIR,
  abstract?.fileUrl?.replace(/^\/uploads[\/]/, '')
);
        if (fs.existsSync(filePath)) {
          const fileExt = path.extname(abstract.fileName);
          const fileBaseName = path.basename(abstract.fileName, fileExt);
          const parts = [];
          if (abstract.abstractNumber) parts.push(abstract.abstractNumber);
          if (regId !== 'unknown') parts.push(regId);
          parts.push(authorName);
          parts.push(fileBaseName);
          const archiveFileName = `${parts.join('_')}${fileExt}`;
          archive.file(filePath, { name: archiveFileName });
        }
      }
    }
    archive.finalize();
    return;
  }
  // --- END NEW ---

  // Create zip file for all abstracts
  const sanitize = (name) => name.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 50);
  const zipFileName = `abstracts_${sanitize(event.name)}_${Date.now()}.zip`;
  const zipFilePath = buildUploadDir('temp', zipFileName);

  // Create directory if it doesn't exist
  const dir = path.dirname(zipFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Create a file to stream archive data to
  const output = fs.createWriteStream(zipFilePath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Compression level
  });

  output.on('close', () => {
    res.download(zipFilePath, zipFileName, (err) => {
      if (err) {
        logger.error('Error sending zip file:', error);
      }
      fs.unlinkSync(zipFilePath);
    });
  });

  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      logger.warn('Archive warning:', err);
    } else {
      logger.error('Archive error:', error);
      return next(new ErrorResponse('Error creating archive', 500));
    }
  });
  archive.on('error', (err) => {
    logger.error('Archive error:', error);
    return next(new ErrorResponse('Error creating archive', 500));
  });
  archive.pipe(output);

  // If Excel export is requested, generate and add Excel file(s)
  if (exportMode && exportMode.startsWith('excel')) {
    // Determine mode
    const excelMode = exportMode === 'excel-multi' ? 'multi-row' : 'single-row';
    // Use category or topic for file naming if filtered, else 'all'
    const catOrTopic = filterCategory || filterTopic || 'all';
    const { buffer, fileName } = await generateAbstractsExcel(abstracts, {
      eventName: event.name,
      categoryOrTopic: catOrTopic,
      exportMode: excelMode,
    });
    archive.append(buffer, { name: fileName });
  }

  // Add each abstract as text and file as before
  for (const abstract of abstracts) {
    // Create text content for the abstract
    const textContent = `
      Title: ${abstract.title}
      Authors: ${abstract.authors}
      Affiliations: ${abstract.authorAffiliations || 'N/A'}
      Topic: ${abstract.topic}
      Category: ${abstract.categoryInfo ? abstract?.categoryInfo?.name : 'N/A'}
      Status: ${abstract.status}
      Submission Date: ${new Date(abstract.submissionDate).toLocaleString()}
      
      Abstract Content:
      ${abstract.content}
      
      Word Count: ${abstract.wordCount}
      
      Review Comments:
      ${abstract?.reviewComments?.map(comment => 
        `${new Date(comment.timestamp).toLocaleString()}: ${comment.comment}`
      ).join('\n') || 'No comments'}
    `;

    // Get registration info to name file
    const regId = abstract.registrationInfo ? abstract?.registrationInfo?.registrationId : 'unknown';
    const authorName = abstract.registrationInfo ? 
      `${abstract?.registrationInfo?.personalInfo.firstName}_${abstract?.registrationInfo?.personalInfo.lastName}`.replace(/\s+/g, '_') : 
      'unknown';
    
    // Create filename based on registration ID and author name
    const fileName = `${regId}_${authorName}_${abstract._id}.txt`;
    
    // Add text file to archive
    archive.append(textContent, { name: fileName });
    
    // If there's a file attached to the abstract, add it too
    if (abstract.fileUrl) {
      const filePath = path.join(UPLOADS_BASE_DIR, abstract?.fileUrl?.replace(/^\/uploads[\/]/, ''), );
      if (fs.existsSync(filePath)) {
        // Add original file to archive with registration ID prefix
        const fileExt = path.extname(abstract.fileName);
        const fileBaseName = path.basename(abstract.fileName, fileExt);
        const parts = [];
        if (abstract.abstractNumber) parts.push(abstract.abstractNumber);
        if (regId !== 'unknown') parts.push(regId);
        parts.push(authorName);
        parts.push(fileBaseName);
        const archiveFileName = `${parts.join('_')}${fileExt}`;
        
        archive.file(filePath, { name: archiveFileName });
      }
    }
  }

  // Finalize the archive
  archive.finalize();
});

/**
 * @desc    Get abstract statistics for an event
 * @route   GET /api/events/:eventId/abstracts/statistics
 * @access  Private
 */
exports.getAbstractStatistics = asyncHandler(async (req, res, next) => {
  const { eventId } = req.params;

  if (!eventId || !mongoose?.Types?.ObjectId.isValid(eventId)) {
    return next(createApiError(400, 'Invalid or missing Event ID'));
  }

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return next(createApiError(`Event not found with id ${eventId}`, 404));
    }

    // Get abstracts counts by status
    const statusCountsArr = await Abstract.aggregate([
      { $match: { event: new mongoose.Types.ObjectId(eventId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Get abstract counts by submission type (if submissionType field exists on Abstract model)
    // If not, this part can be omitted or adapted
    let typeCountsArr = [];
    // Check if submissionType exists in schema before aggregating
    if (Abstract?.schema?.paths['submissionType']) {
        typeCountsArr = await Abstract.aggregate([
            { $match: { event: new mongoose.Types.ObjectId(eventId) } },
            { $group: { _id: '$submissionType', count: { $sum: 1 } } }
        ]);
    }
    
    // Get reviewer statistics
    const reviewerStatsArr = await Abstract.aggregate([
      { $match: { 
          event: new mongoose.Types.ObjectId(eventId),
          'reviewDetails.reviews': { $exists: true, $ne: [] }
      }},
      { $unwind: '$reviewDetails.reviews' },
      { $group: {
          _id: '$reviewDetails?.reviews?.reviewer',
          completedReviews: { $sum: { $cond: [{ $eq: ['$reviewDetails?.reviews?.isComplete', true] }, 1, 0] } },
          // pendingReviews: { $sum: { $cond: [{ $eq: ['$reviewDetails?.reviews?.isComplete', false] }, 1, 0] } }, // Pending might be less useful here, focus on completed and score
          averageScore: { $avg: '$reviewDetails?.reviews?.score' },
          reviewCount: { $sum: 1 }
      }},
      { $sort: { reviewCount: -1 } } // Sort by number of reviews done
    ]);
    
    // Get reviewer details for populated stats
    const reviewerIds = reviewerStatsArr.map(stat => stat._id).filter(id => id); // Filter out null/undefined IDs
    let reviewers = [];
    if (reviewerIds.length > 0) {
        reviewers = await User.find({ _id: { $in: reviewerIds } }).select('name email');
    }
    
    const populatedReviewerStats = reviewerStatsArr.map(stat => {
      const reviewer = reviewers.find(r => r?._id?.equals(stat._id));
      return {
        reviewerId: stat._id,
        reviewerName: reviewer ? reviewer.name : 'Unknown Reviewer',
        reviewerEmail: reviewer ? reviewer.email : 'N/A',
        completedReviews: stat.completedReviews || 0,
        averageScore: stat.averageScore ? parseFloat(stat?.averageScore?.toFixed(1)) : null,
        reviewCount: stat.reviewCount || 0
      };
    });
    
    // Format status counts into an object
    const statusCounts = statusCountsArr.reduce((acc, count) => {
      acc[count._id] = count.count;
      return acc;
    }, {});

    // Format type counts into an object (if applicable)
    const typeCounts = typeCountsArr.reduce((acc, count) => {
        if(count._id) acc[count._id] = count.count; // Ensure _id is not null
        return acc;
    }, {});
    
    const totalAbstracts = await Abstract.countDocuments({ event: eventId });

    // Get abstract counts by category
    const categoryCountsArr = await Abstract.aggregate([
      { $match: { event: new mongoose.Types.ObjectId(eventId), category: { $ne: null } } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    // Resolve category names
    const categoryIds = categoryCountsArr.map(c => c._id);
    let categoriesMap = {};
    if (categoryIds && categoryIds.length) {
      const categories = await Category.find({ _id: { $in: categoryIds } }).select('name');
      categoriesMap = categories.reduce((acc, cat) => {
        acc[cat?._id?.toString()] = cat.name;
        return acc;
      }, {});
    }
    // Fallback: use event?.abstractSettings?.categories for name resolution if not found in Category collection
    if (!Object.keys(categoriesMap).length && event?.abstractSettings?.categories) {
      event?.abstractSettings?.categories.forEach(cat => {
        if (cat._id) categoriesMap[cat?._id?.toString()] = cat.name;
      });
    }

    const categoryCounts = categoryCountsArr.reduce((acc, cur) => {
      const name = categoriesMap[cur._id?.toString()] || 'Unknown';
      acc[name] = cur.count;
      return acc;
    }, {});

    const statistics = {
      totalAbstracts,
      byStatus: statusCounts,
      bySubmissionType: typeCounts, // Include if submissionType exists and is relevant
      byCategory: categoryCounts,
      reviewerPerformance: populatedReviewerStats
    };

    sendSuccess(res, 200, 'Abstract statistics retrieved successfully', statistics);

  } catch (error) {
    logger.error(`Error fetching abstract statistics for event ${eventId}:`, error);
    return next(createApiError('Server error fetching abstract statistics', 500, error.stack));
  }
});

/**
 * @desc    Submit an individual review for an abstract
 * @route   POST /api/abstracts/:id/reviews  (or /api/events/:eventId/abstracts/:id/reviews)
 * @access  Private (Assigned Reviewer or Admin)
 */
exports.submitIndividualReview = asyncHandler(async (req, res, next) => {
  const { score, comments, decision  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };
  const abstractId = req?.params?.id;
  const reviewerUser = req.user; // The user submitting the review

  if (!decision || !['accept', 'reject', 'revise', 'undecided'].includes(decision)) {
    return next(createApiError(400, 'Please provide a valid review decision (accept, reject, revise, undecided)'));
  }

  // Populate event for email settings and registration for author details upfront
  const abstract = await Abstract.findById(abstractId)
    .populate('event', 'name emailSettings')
    .populate('registration', 'personalInfo email')
    .populate('author', 'name email');

  if (!abstract) {
    return StandardErrorHandler.sendError(res, 404, 'Resource not found');
  }

  const event = abstract.event; // Already populated
  if (!event) {
    logger.error(`[submitIndividualReview] Event not found for abstract ${abstractId}`);
    return next(createApiError(500, 'Associated event not found for this abstract.'));
  }

  const isAssignedReviewer = abstract.reviewDetails && abstract?.reviewDetails?.assignedTo &&
                           abstract?.reviewDetails?.assignedTo.some(id => id.equals(reviewerUser._id));

  if (reviewerUser.role !== 'admin' && !isAssignedReviewer) { // Admins can also submit/override reviews
    return next(createApiError(403, 'User not authorized to review this abstract'));
  }

  // Initialize reviewDetails if needed
  if (!abstract.reviewDetails) {
    abstract.reviewDetails = {};
  }
  abstract.reviewDetails.reviews = [];

  const existingReviewIndex = abstract?.reviewDetails?.reviews.findIndex(
    review => review.reviewer && review?.reviewer?.equals(reviewerUser._id)
  );

  if (existingReviewIndex > -1) {
    // Update existing review
    const reviewToUpdate = abstract?.reviewDetails?.reviews[existingReviewIndex];
    reviewToUpdate.score = score !== undefined ? Number(score) : reviewToUpdate.score;
    reviewToUpdate.comments = comments !== undefined ? comments : reviewToUpdate.comments;
    reviewToUpdate.decision = decision;
    reviewToUpdate.isComplete = true;
    reviewToUpdate.reviewedAt = Date.now();
    logger.info(`[submitIndividualReview] Review updated for abstract ${abstractId} by reviewer ${reviewerUser._id}`);
  } else {
    // Add new review
    abstract?.reviewDetails?.reviews.push({
      reviewer: reviewerUser._id,
      score: score !== undefined ? Number(score) : null,
      comments,
      decision,
      isComplete: true,
      reviewedAt: Date.now(),
    });
    logger.info(`[submitIndividualReview] New review added for abstract ${abstractId} by reviewer ${reviewerUser._id}`);
  }

  // Calculate average score
  const validScores = abstract?.reviewDetails?.reviews
    .filter(r => r.isComplete && typeof r.score === 'number')
    .map(r => r.score);
  if (validScores.length > 0) {
    abstract.reviewDetails.averageScore = validScores.reduce((acc, cur) => acc + cur, 0) / validScores.length;
  } else {
    abstract.reviewDetails.averageScore = null;
  }

  // Update global abstract status based on this reviewer's decision
  if (decision === 'revise') {
    if (abstract.status !== 'revision-requested') {
      abstract.status = 'revision-requested';
      abstract.markModified('status'); // Explicitly mark as modified
      logger.info(`[submitIndividualReview] Global status of abstract ${abstract._id} set to 'revision-requested' in memory prior to save.`);
    }
  } else if (decision === 'accept') {
    // If one reviewer accepts, and we want to immediately mark as approved globally.
    // Consider if this should only happen if ALL reviewers accept, or by admin action.
    if (abstract.status !== 'approved') { // Or other statuses that shouldn't be overridden by a single accept
        abstract.status = 'approved';
        abstract.markModified('status');
        logger.info(`[submitIndividualReview] Global status of abstract ${abstract._id} set to 'approved' in memory prior to save.`);
    }
  } else if (decision === 'reject') {
    // If one reviewer rejects, and we want to immediately mark as rejected globally.
    // Consider if this should only happen if ALL reviewers reject, or by admin action.
    // For now, implementing direct change: one rejection updates global status.
    if (abstract.status !== 'rejected') { // Or other statuses that shouldn't be overridden by a single reject
        abstract.status = 'rejected';
        abstract.markModified('status');
        logger.info(`[submitIndividualReview] Global status of abstract ${abstract._id} set to 'rejected' in memory prior to save.`);
    }
  }
  // Note: 'undecided' from a single reviewer does not change the global abstract.status here.
  // Global rejection/approval might also be an admin action or based on aggregated reviews for 'accept'/'reject'.

  // Single save operation for all changes
  try {
    await abstract.save();
    logger.info(`[submitIndividualReview] Abstract ${abstract._id} saved successfully. Current status: ${abstract.status}`);
  } catch (error) {
    logger.error(`[submitIndividualReview] Error saving abstract ${abstractId}:`, saveError);
    return next(createApiError('Failed to save review and update abstract status.', 500, saveError.stack));
  }

  // Post-save actions (e.g., email notifications)
  // AUTOMATION: If reviewer decision was 'accept' AND global status is now 'approved', notify registrant and admins
  if (decision === 'accept' && abstract.status === 'approved') {
    logger.info(`[submitIndividualReview] Abstract ${abstractId} approved, proceeding with notifications.`);

    // Resolve author/registrant contact for email
    let authorEmail = '';
    let authorName = 'Author';
    if (abstract.registration && abstract?.registration?.personalInfo.email) {
      authorEmail = abstract?.registration?.personalInfo.email;
      authorName = abstract?.registration?.personalInfo.firstName || 'Participant';
          } else if (abstract.author) {
        const authorUser = await AuthorUser.findById(abstract.author).lean();
        if (!authorUser) {
          return StandardErrorHandler.sendError(res, 404, 'Resource not found');
        }
        if (authorUser) {
          authorEmail = authorUser.email;
          authorName = (authorUser.name || 'Author').split(' ')[0];
        }
    }

    if (authorEmail && event.emailSettings && event?.emailSettings?.enabled) {
      const emailSubject = `Abstract Approved - ${event.name}`;
      const emailBody = `<p>Dear ${authorName},</p>
        <p>Your abstract titled "<strong>${abstract.title}</strong>" for the event "<strong>${event.name}</strong>" has been <strong>approved</strong> by a reviewer.</p>
        <p><strong>Reviewer Decision:</strong> Accept</p>
        <p><strong>Reviewer Comments:</strong></p>
        <blockquote>${comments || 'No comments provided.'}</blockquote>
        <p>Congratulations! Please await further instructions from the event organizers.</p>
        <p>Regards,<br/>The Event Team</p>`;
      try {
        await sendEmail({
          to: authorEmail,
          subject: emailSubject,
          html: emailBody,
          fromName: event?.emailSettings?.senderName,
          fromEmail: event?.emailSettings?.senderEmail,
          smtp: {
            host: event?.emailSettings?.smtpHost,
            port: event?.emailSettings?.smtpPort,
            secure: event?.emailSettings?.smtpSecure,
            auth: {
              user: event?.emailSettings?.smtpUser,
              pass: event?.emailSettings?.smtpPassword
            }
          }
        });
        logger.info(`[submitIndividualReview] Approval email sent to registrant ${authorEmail} for abstract ${abstractId}`);
      } catch (error) {
        logger.error(`[submitIndividualReview] Failed to send approval email to registrant ${authorEmail} for abstract ${abstractId}:`, emailError);
      }
    }

    if (event.emailSettings && event?.emailSettings?.enabled && event?.emailSettings?.automaticEmails.reviewSubmittedNotificationToAdmin) {
      const adminsToNotify = await User.find({ role: { $in: ['admin', 'staff'] }, email: { $ne: null } });
      if (adminsToNotify.length > 0) {
        logger.info(`[submitIndividualReview] Notifying ${adminsToNotify && adminsToNotify.length} admin/staff of approval for abstract ${abstractId}.`);
        const adminSubject = `Abstract Approved by Reviewer - ${event.name}`;
        for (const admin of adminsToNotify) {
          const adminBody = `<p>Dear ${admin.name || 'Admin/Staff'},</p>
            <p>A reviewer has <strong>approved</strong> the abstract titled "<strong>${abstract.title}</strong>" (ID: ${abstract._id}) for the event "<strong>${event.name}</strong>".</p>
            <p>Reviewer: ${reviewerUser.name} (${reviewerUser.email})</p>
            <p>Reviewer Comments:</p>
            <blockquote>${comments || 'No comments provided.'}</blockquote>
            <p>Please log in to the admin panel to view the details.</p>
            <p>Regards,<br/>System Notification</p>`;
          try {
            await sendEmail({
              to: admin.email,
              subject: adminSubject,
              html: adminBody,
              fromName: event?.emailSettings?.senderName,
              fromEmail: event?.emailSettings?.senderEmail,
              smtp: {
                host: event?.emailSettings?.smtpHost,
                port: event?.emailSettings?.smtpPort,
                secure: event?.emailSettings?.smtpSecure,
                auth: {
                  user: event?.emailSettings?.smtpUser,
                  pass: event?.emailSettings?.smtpPassword
                }
              }
            });
            logger.info(`[submitIndividualReview] Approval notification sent to admin ${admin.email} for abstract ${abstract._id}`);
          } catch (error) {
            logger.error(`[submitIndividualReview] Failed to send approval notification to admin ${admin.email} for abstract ${abstract._id}:`, emailError);
          }
        }
      }
    }
  }

  // Populate for response
  const populatedAbstract = await Abstract.findById(abstract._id)
    .populate('event', 'name emailSettings')
    .populate('registration', 'personalInfo email')
    .populate('category', 'name')
    .populate('reviewDetails.assignedTo', 'name email')
    .populate('reviewDetails.reviews.reviewer', 'name email')
    .populate('author', 'name email');

  if (!populatedAbstract) {
    return StandardErrorHandler.sendError(res, 404, 'Resource not found');
  }

  return sendSuccess(res, 200, 'Review submitted successfully', populatedAbstract);
});

/**
 * @desc    Assign a reviewer to an abstract (NOW HANDLES MULTIPLE & USES TRANSACTION)
 * @route   POST /api/events/:eventId/abstracts/:id/assign-reviewer (or /assign-reviewers)
 * @access  Private (Admin/Staff)
 */
exports.assignAbstractReviewer = asyncHandler(async (req, res, next) => {
  const { reviewerIds  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };
  const abstractId = req?.params?.id;
  const eventIdFromParams = req?.params?.eventId;

  if (!reviewerIds || !Array.isArray(reviewerIds) || reviewerIds.length === 0) {
    return next(createApiError(400, 'Please provide a valid array of reviewer IDs'));
  }
  for (const id of reviewerIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createApiError(`Invalid reviewer ID format: ${id}`, 400));
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const abstract = await Abstract.findById(abstractId).session(session);
    if (!abstract) {
      await session.abortTransaction();
      session.endSession();
      return next(createApiError(`Abstract not found with id of ${abstractId}`, 404));
    }

    const eventIdForLookup = eventIdFromParams || abstract?.event?.toString();
    const event = await Event.findById(eventIdForLookup).session(session);
    if (!event) {
      await session.abortTransaction();
      session.endSession();
      logger.error(`[assignAbstractReviewer] Event not found with ID: ${eventIdForLookup} for abstract ${abstractId}`);
      return next(createApiError(`Event configuration error for abstract ${abstractId}`, 500));
    }

    if (!abstract.reviewDetails) {
      abstract.reviewDetails = { assignedTo: [], reviews: [] };
    }
    if (!abstract.reviewDetails.assignedTo) {
      abstract.reviewDetails.assignedTo = [];
    }

    const newAssignments = [];
    const alreadyAssigned = [];
    const invalidReviewers = [];
    const successfullyAssignedReviewersData = []; // For email notifications

    for (const reviewerId of reviewerIds) {
      const isAlreadyAssigned = abstract?.reviewDetails?.assignedTo.some(assignedId => assignedId.equals(reviewerId));
      if (isAlreadyAssigned) {
        alreadyAssigned.push(reviewerId);
        continue;
      }
      const reviewerUser = await User.findById(reviewerId).session(session);
      if (!reviewerUser || !reviewerUser.email) {
        invalidReviewers.push({ id: reviewerId, reason: reviewerUser ? 'User email not found' : 'User not found' });
        continue;
      }
      abstract.reviewDetails.assignedTo.push(reviewerUser._id);
      
      // Hypothetical: Increment assignedAbstractsCount on User model
      reviewerUser.assignedAbstractsCount = (reviewerUser.assignedAbstractsCount || 0) + 1;
      await reviewerUser.save({ session }); // Save user within the transaction

      newAssignments.push(reviewerUser._id);
      successfullyAssignedReviewersData.push({ email: reviewerUser.email, name: reviewerUser.name || 'Reviewer', id: reviewerUser._id });
    }

    if (newAssignments.length > 0) {
      if (abstract.status === 'submitted' || abstract.status === 'pending' || abstract.status === 'revised-pending-review') {
        abstract.status = 'under-review';
        logger.info(`[assignAbstractReviewer] Abstract ${abstractId} status updated to under-review.`);
      }
      await abstract.save({ session }); // Save abstract within the transaction
      logger.info(`[assignAbstractReviewer] ${newAssignments.length} new reviewers assigned and abstract updated for abstract ${abstractId} within transaction.`);
    }

    await session.commitTransaction();
    logger.info(`[assignAbstractReviewer] Transaction committed successfully for abstract ${abstractId}.`);

    // Send email notifications AFTER successful transaction commit
    if (successfullyAssignedReviewersData.length > 0 && event.emailSettings && event.emailSettings.enabled) {
      logger.info(`[assignAbstractReviewer] Attempting to send assignment emails for abstract ${abstractId} to ${successfullyAssignedReviewersData.length} reviewers post-transaction.`);
      for (const reviewer of successfullyAssignedReviewersData) {
        const emailSubject = `New Abstract Assigned for Review - ${event.name}`;
        const emailBody = `<p>Dear ${reviewer.name},</p>
                         <p>You have been assigned a new abstract titled "<strong>${abstract.title}</strong>" for review for the event "<strong>${event.name}</strong>".</p>
                         <p>Please log in to the reviewer portal to view the abstract and submit your review.</p>
                         <p>Abstract ID: ${abstract._id}</p>
                         <p>Thank you for your contribution.</p>
                         <p>Regards,<br/>The Event Team</p>`;
        try {
          await sendEmail({
            to: reviewer.email,
            subject: emailSubject,
            html: emailBody,
            fromName: event.emailSettings.senderName,
            fromEmail: event.emailSettings.senderEmail,
            smtp: {
              host: event.emailSettings.smtpHost,
              port: event.emailSettings.smtpPort,
              secure: event.emailSettings.smtpSecure,
              auth: {
                user: event.emailSettings.smtpUser,
                pass: event.emailSettings.smtpPassword
              }
            }
          });
          logger.info(`Reviewer assignment email sent to ${reviewer.email} for abstract ${abstract._id}`);
        } catch (error) {
          logger.error(`Failed to send reviewer assignment email to ${reviewer.email} for abstract ${abstract._id} (post-transaction):`, error);
          // Log error, but don't fail the whole operation as transaction is already committed
        }
      }
    } else if (successfullyAssignedReviewersData.length > 0) {
      logger.warn(`[assignAbstractReviewer] Master email sending is disabled for event ${event._id}. No assignment emails sent for abstract ${abstractId} (post-transaction).`);
    }

    const populatedAbstract = await Abstract.findById(abstract._id)
      .populate('reviewDetails.assignedTo', 'name email')
      .populate('reviewDetails.reviews.reviewer', 'name email')
      .populate('author', 'name email');
    
    if (!populatedAbstract) {
      return next(createApiError(`Abstract not found with id of ${abstractId}`, 404));
    }

    let message = 'Reviewer assignment processed.';
    if (newAssignments.length > 0) message += ` ${newAssignments.length} new reviewer(s) assigned.`;
    if (alreadyAssigned.length > 0) message += ` ${alreadyAssigned.length} reviewer(s) were already assigned.`;
    if (invalidReviewers.length > 0) message += ` ${invalidReviewers.length} user(s) could not be assigned (details in errors).`;
    
    const responseData = {
      abstract: populatedAbstract,
      newAssignments,
      alreadyAssigned,
      invalidReviewers
    };

    if (invalidReviewers.length > 0 && newAssignments.length === 0 && alreadyAssigned.length === 0) {
      // If only invalid reviewers, this is effectively an error condition for the assignment part
      return next(createApiError(message, 400, { invalidReviewers })); 
    }
    return sendSuccess(res, 200, message, responseData);

  } catch (error) {
    logger.error(`[assignAbstractReviewer] Error during transaction for abstract ${abstractId}:`, error);
    await session.abortTransaction();
    return next(createApiError('Reviewer assignment failed due to a server error. Please try again.', 500, error));
  } finally {
    session.endSession();
    logger.info(`[assignAbstractReviewer] MongoDB session ended for abstract ${abstractId}.`);
  }
});

/**
 * @desc    Download an abstract's attached file with a custom filename
 * @route   GET /api/events/:eventId/abstracts/:id/download-attachment
 * @access  Protected (same as getAbstract)
 */
const downloadAbstractAttachment = asyncHandler(async (req, res, next) => {
  const abstractId = req?.params?.id; // This is abstractId from the route
  // eventId is available via req?.params?.eventId due to mergeParams in router

  const abstract = await Abstract.findById(abstractId)
    .populate('registration', 'registrationId personalInfo')
    .populate('event', 'name');

  if (!abstract) {
    return StandardErrorHandler.sendError(res, 404, 'Resource not found');
  }

  if (!abstract.fileUrl || !abstract.fileName) {
    return next(createApiError(404, 'Abstract does not have an attached file.'));
  }

  // Construct the physical path to the file
  // Always resolve to server/public/uploads/abstracts/... regardless of leading slash
  const relativePath = abstract?.fileUrl?.replace(/^\/uploads[\/]/, '');
  const physicalFilePath = path.join(UPLOADS_BASE_DIR, relativePath);
  if (!fs.existsSync(physicalFilePath)) {
    logger.error(`File not found at physical path: ${physicalFilePath} for abstract ${abstractId}`);
    return next(createApiError(404, 'File not found on server.'));
  }

  // Construct the new filename
  // Sanitize names to be filesystem/URL friendly
  const sanitize = (name) => name.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 50);
  
  const regId = abstract.registration?.registrationId || 'UnknownRegID';
  // Assuming authors string is suitable or pick first author if it's an array/object
  const authorName = abstract.authors ? sanitize(abstract?.authors?.split(',')[0].trim()) : 'UnknownAuthor';
  const originalFileName = abstract.fileName;
  const ext = path.extname(originalFileName);
  const baseName = path.basename(originalFileName, ext);

  const newFileName = `${sanitize(regId)}_${authorName}_${sanitize(baseName)}${ext}`;

  // Log details for debugging
  logger.info(`Attempting to download file for abstract ${abstractId}`);
  logger.info(`Original filename: ${originalFileName}, New filename: ${newFileName}`);
  logger.info(`Physical path: ${physicalFilePath}`);

  res.download(physicalFilePath, newFileName, (err) => {
    if (err) {
      logger.error(`Error downloading file ${physicalFilePath} as ${newFileName}:`, error);
      // Avoid sending another response if headers already sent by res.download on error
      if (!res.headersSent) {
        // If it's a common error like file not found (though checked above), send 404
        // Otherwise, a generic server error. res.download often handles this.
        return next(createApiError(500, 'Could not download the file.'));
      }
    }
  });
});

/**
 * @desc    Approve an abstract
 * @route   PUT /api/abstracts/:id/approve
 * @access  Private (Admin)
 */
exports.approveAbstract = asyncHandler(async (req, res, next) => {
  const abstractId = req?.params?.id;
  const abstract = await Abstract.findById(abstractId)
    .populate('registration', 'personalInfo email')
    .populate('event');

  if (!abstract) {
    return StandardErrorHandler.sendError(res, 404, 'Resource not found');
  }

  abstract.status = 'approved';
  if (req.user) {
    abstract.reviewDetails = abstract.reviewDetails || {};
    abstract.reviewDetails.finalDecision = 'approved';
    abstract.reviewDetails.decisionBy = req.user._id;
    abstract.reviewDetails.decisionDate = Date.now();
    abstract.reviewDetails.decisionReason = req?.body?.reason || 'Approved by admin.';
  }
  await abstract.save();
  logger.info(`[approveAbstract] Abstract ${abstractId} approved by ${req.user ? req?.user?._id : 'N/A'}`);

  const event = abstract.event;
  let author = abstract.registration;
  if (!author && abstract.author) {
    const authorUser = await AuthorUser.findById(abstract.author).lean();
    if (!authorUser) {
      return StandardErrorHandler.sendError(res, 404, 'Resource not found');
    }
    if (authorUser) {
      author = { personalInfo: { firstName: authorUser.name?.split(' ')[0] || 'Author', email: authorUser.email } };
    }
  }

  if (author && author.personalInfo && author?.personalInfo?.email && 
      event && event.emailSettings && event?.emailSettings?.enabled) {
    logger.info(`[approveAbstract] Master email sending enabled. Attempting to send approval email for abstract ${abstract._id} to ${author?.personalInfo?.email}.`);
    const tmpl = event.emailSettings?.templates?.abstractApproved;
    const placeholderData = {
      firstName: author?.personalInfo?.firstName || 'Author',
      eventName: event.name,
      abstractTitle: abstract.title,
      abstractNumber: abstract.abstractNumber || '',
    };

    let emailSubject, emailBody;
    if (tmpl && tmpl.subject && tmpl.body) {
      emailSubject = processTemplate(tmpl.subject, placeholderData);
      emailBody = processTemplate(tmpl.body, placeholderData).replace(/\n/g,'<br/>');
      logger.info('[approveAbstract] Using template abstractApproved');
    } else {
      emailSubject = `Abstract Approved - ${event.name}`;
      emailBody = `<p>Dear ${placeholderData.firstName},</p>
                     <p>Congratulations! Your abstract titled "<strong>${abstract.title}</strong>" for the event "<strong>${event.name}</strong>" has been approved.</p>
                     <p>Further details regarding your presentation or publication (if applicable) will be communicated soon.</p>
                     <p>Regards,<br/>The Event Team</p>`;
      logger.info(`[approveAbstract] Using generic approval content for ${author?.personalInfo?.email} for abstract ${abstract._id}`);
    }
    try {
      await sendEmail({
        to: author?.personalInfo?.email,
        subject: emailSubject,
        html: emailBody,
        fromName: event?.emailSettings?.senderName,
        fromEmail: event?.emailSettings?.senderEmail,
        smtp: {
          host: event?.emailSettings?.smtpHost,
          port: event?.emailSettings?.smtpPort,
          secure: event?.emailSettings?.smtpSecure,
          auth: {
            user: event?.emailSettings?.smtpUser,
            pass: event?.emailSettings?.smtpPassword
          }
        }
      });
      logger.info(`Abstract approval email sent to ${author?.personalInfo?.email} for abstract ${abstract._id}`);
    } catch (error) {
      logger.error(`Failed to send abstract approval email for abstract ${abstract._id} to ${author?.personalInfo?.email}:`, emailError);
    }
  } else if (author && author.personalInfo && author?.personalInfo?.email) {
      logger.warn(`[approveAbstract] Master email sending is disabled for event ${event._id}. No approval email sent for abstract ${abstractId}.`);
  }

  return sendSuccess(res, 200, 'Abstract approved successfully', abstract);
});

/**
 * @desc    Reject an abstract
 * @route   PUT /api/abstracts/:id/reject
 * @access  Private (Admin)
 */
exports.rejectAbstract = asyncHandler(async (req, res, next) => {
  const abstractId = req?.params?.id;
  const { reason  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };

  const abstract = await Abstract.findById(abstractId)
    .populate('registration', 'personalInfo email')
    .populate('event');

  if (!abstract) {
    return StandardErrorHandler.sendError(res, 404, 'Resource not found');
  }

  abstract.status = 'rejected';
  if (req.user) {
    abstract.reviewDetails = abstract.reviewDetails || {};
    abstract.reviewDetails.finalDecision = 'rejected';
    abstract.reviewDetails.decisionBy = req.user._id;
    abstract.reviewDetails.decisionDate = Date.now();
    abstract.reviewDetails.decisionReason = reason || 'Rejected by admin.';
  }
  await abstract.save();
  logger.info(`[rejectAbstract] Abstract ${abstractId} rejected by ${req.user ? req?.user?._id : 'N/A'}. Reason: ${reason}`);

  const event = abstract.event;
  let author = abstract.registration;
  if (!author && abstract.author) {
    const authorUser = await AuthorUser.findById(abstract.author).lean();
    if (!authorUser) {
      return StandardErrorHandler.sendError(res, 404, 'Resource not found');
    }
    if (authorUser) {
      author = { personalInfo: { firstName: authorUser.name?.split(' ')[0] || 'Author', email: authorUser.email } };
    }
  }

  if (author && author.personalInfo && author?.personalInfo?.email && 
      event && event.emailSettings && event?.emailSettings?.enabled) {
    logger.info(`[rejectAbstract] Master email sending enabled. Attempting to send rejection email for abstract ${abstract._id} to ${author?.personalInfo?.email}.`);
    const tmplRej = event.emailSettings?.templates?.abstractRejected;
    const placeholderData = {
      firstName: author?.personalInfo?.firstName || 'Author',
      eventName: event.name,
      abstractTitle: abstract.title,
      abstractNumber: abstract.abstractNumber || '',
      reason: reason || '',
    };
    let emailSubject = '', emailBody='';
    if (tmplRej && tmplRej.subject && tmplRej.body) {
      emailSubject = processTemplate(tmplRej.subject, placeholderData);
      emailBody = processTemplate(tmplRej.body, placeholderData).replace(/\n/g,'<br/>');
      logger.info('[rejectAbstract] Using template abstractRejected');
    } else {
      emailSubject = `Abstract Submission Update - ${event.name}`;
      emailBody = `<p>Dear ${placeholderData.firstName},</p>
                     <p>We regret to inform you that your abstract titled "<strong>${abstract.title}</strong>" for the event "<strong>${event.name}</strong>" has not been accepted at this time.</p>
                     ${reason ? `<p>Reason: ${reason}</p>` : ''}
                     <p>We thank you for your submission and encourage you to participate in future events.</p>
                     <p>Regards,<br/>The Event Team</p>`;
      logger.info(`[rejectAbstract] Using generic rejection content for ${author?.personalInfo?.email} for abstract ${abstract._id}`);
    }
    try {
      await sendEmail({
        to: author?.personalInfo?.email,
        subject: emailSubject,
        html: emailBody,
        fromName: event?.emailSettings?.senderName,
        fromEmail: event?.emailSettings?.senderEmail,
        smtp: {
          host: event?.emailSettings?.smtpHost,
          port: event?.emailSettings?.smtpPort,
          secure: event?.emailSettings?.smtpSecure,
          auth: {
            user: event?.emailSettings?.smtpUser,
            pass: event?.emailSettings?.smtpPassword
          }
        }
      });
      logger.info(`Abstract rejection email sent to ${author?.personalInfo?.email} for abstract ${abstract._id}`);
    } catch (error) {
      logger.error(`Failed to send abstract rejection email for abstract ${abstract._id} to ${author?.personalInfo?.email}:`, emailError);
    }
  } else if (author && author.personalInfo && author?.personalInfo?.email) {
    logger.warn(`[rejectAbstract] Master email sending is disabled for event ${event._id}. No rejection email sent for abstract ${abstractId}.`);
  }
  return sendSuccess(res, 200, 'Abstract rejected successfully', abstract);
});

/**
 * @desc    Request a revision for an abstract
 * @route   PUT /api/abstracts/:id/request-revision
 * @access  Private (Admin)
 */
exports.requestRevision = asyncHandler(async (req, res, next) => {
  const abstractId = req?.params?.id;
  const { reason, revisionDeadline  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };

  const abstract = await Abstract.findById(abstractId)
    .populate('registration', 'personalInfo email')
    .populate('event');

  if (!abstract) {
    return StandardErrorHandler.sendError(res, 404, 'Resource not found');
  }

  abstract.status = 'revision-requested';
  if (req.user) {
    abstract.reviewDetails = abstract.reviewDetails || {};
    abstract.reviewDetails.finalDecision = 'revision-requested';
    abstract.reviewDetails.decisionBy = req.user._id;
    abstract.reviewDetails.decisionDate = Date.now();
    abstract.reviewDetails.decisionReason = reason || 'Revision requested by admin.';
    if (revisionDeadline) {
        abstract.reviewDetails.revisionDeadline = new Date(revisionDeadline);
    }
  }
  await abstract.save();
  logger.info(`[requestRevision] Revision requested for abstract ${abstractId} by ${req.user ? req?.user?._id : 'N/A'}. Reason: ${reason}`);

  const event = abstract.event;
  let author = abstract.registration;
  if (!author && abstract.author) {
    const authorUser = await AuthorUser.findById(abstract.author).lean();
    if (!authorUser) {
      return StandardErrorHandler.sendError(res, 404, 'Resource not found');
    }
    if (authorUser) {
      author = { personalInfo: { firstName: authorUser.name?.split(' ')[0] || 'Author', email: authorUser.email } };
    }
  }

  if (author && author.personalInfo && author?.personalInfo?.email && 
      event && event.emailSettings && event?.emailSettings?.enabled) {
    logger.info(`[requestRevision] Master email sending enabled. Attempting to send revision request email for abstract ${abstract._id} to ${author?.personalInfo?.email}.`);
    const tmplRev = event.emailSettings?.templates?.abstractRevisionRequested;
    const placeholderData = {
      firstName: author?.personalInfo?.firstName || 'Author',
      eventName: event.name,
      abstractTitle: abstract.title,
      abstractNumber: abstract.abstractNumber || '',
      reason: reason || '',
      revisionDeadline: abstract?.reviewDetails?.revisionDeadline ? new Date(abstract?.reviewDetails?.revisionDeadline).toLocaleDateString() : ''
    };
    let emailSubject,emailBody;
    if(tmplRev && tmplRev.subject && tmplRev.body){
      emailSubject = processTemplate(tmplRev.subject, placeholderData);
      emailBody = processTemplate(tmplRev.body, placeholderData).replace(/\n/g,'<br/>');
      logger.info('[requestRevision] Using template abstractRevisionRequested');
    } else {
      emailSubject = `Revision Requested for Your Abstract - ${event.name}`;
      emailBody = `<p>Dear ${placeholderData.firstName},</p>
                     <p>Regarding your abstract titled "<strong>${abstract.title}</strong>" for the event "<strong>${event.name}</strong>", a revision has been requested.</p>
                     <p><strong>Comments/Reason for Revision:</strong></p>
                     <p>${reason || 'Please review the abstract guidelines and resubmit.'}</p>
                     ${abstract?.reviewDetails?.revisionDeadline ? `<p>Please submit your revised abstract by: <strong>${placeholderData.revisionDeadline}</strong>.</p>` : ''}
                     <p>Please log in to the portal to update and resubmit your abstract.</p>
                     <p>Regards,<br/>The Event Team</p>`;
      logger.info(`[requestRevision] Using generic revision request content for ${author?.personalInfo?.email} for abstract ${abstract._id}`);
    }
    try {
      await sendEmail({
        to: author?.personalInfo?.email,
        subject: emailSubject,
        html: emailBody,
        fromName: event?.emailSettings?.senderName,
        fromEmail: event?.emailSettings?.senderEmail,
        smtp: {
          host: event?.emailSettings?.smtpHost,
          port: event?.emailSettings?.smtpPort,
          secure: event?.emailSettings?.smtpSecure,
          auth: {
            user: event?.emailSettings?.smtpUser,
            pass: event?.emailSettings?.smtpPassword
          }
        }
      });
      logger.info(`Abstract revision request email sent to ${author?.personalInfo?.email} for abstract ${abstract._id}`);
    } catch (error) {
      logger.error(`Failed to send abstract revision request email for abstract ${abstract._id} to ${author?.personalInfo?.email}:`, emailError);
    }
  } else if (author && author.personalInfo && author?.personalInfo?.email) {
    logger.warn(`[requestRevision] Master email sending is disabled for event ${event._id}. No revision request email sent for abstract ${abstractId}.`);
  }
  return sendSuccess(res, 200, 'Abstract revision requested successfully', abstract);
});

/**
 * @desc    Author resubmits an abstract after revision was requested
 * @route   POST /api/events/:eventId/abstracts/:id/resubmit-revision
 * @access  Protected (Registrant Owner of the abstract)
 */
exports.resubmitRevisedAbstract = asyncHandler(async (req, res, next) => {
  const abstractId = req?.params?.id;
  const registrant = req.registrant; // Assuming protectRegistrant middleware provides this

  const abstract = await Abstract.findById(abstractId)
    .populate('event')
    .populate('reviewDetails.assignedTo', 'name email'); // Populate assigned reviewers for notification

  if (!abstract) {
    return StandardErrorHandler.sendError(res, 404, 'Resource not found');
  }

  if (!abstract) {
    return next(createApiError(`Abstract not found with id of ${abstractId}`, 404));
  }

  // Authorization: Ensure the abstract belongs to the logged-in registrant and is in 'revision-requested' status
  if (!abstract?.registration?.equals(registrant._id)) {
    logger.warn(`[resubmitRevisedAbstract] Unauthorized attempt by registrant ${registrant._id} to resubmit abstract ${abstractId} not owned by them.`);
    return next(createApiError(403, 'Not authorized to modify this abstract'));
  }

  if (abstract.status !== 'revision-requested') {
    logger.warn(`[resubmitRevisedAbstract] Attempt to resubmit abstract ${abstractId} not in 'revision-requested' status. Current status: ${abstract.status}`);
    return next(createApiError(`Abstract cannot be resubmitted unless revision was requested. Current status: ${abstract.status}`, 400));
  }

  // Potentially check if revision deadline has passed (if abstract?.reviewDetails?.revisionDeadline exists)
  if (abstract.reviewDetails && abstract?.reviewDetails?.revisionDeadline && new Date() > new Date(abstract?.reviewDetails?.revisionDeadline)) {
      logger.warn(`[resubmitRevisedAbstract] Attempt to resubmit abstract ${abstractId} after revision deadline.`);
      return next(createApiError(400, 'The deadline for submitting revisions has passed.'));
  }

  // Update status
  abstract.status = 'revised-pending-review';
  abstract.lastUpdated = Date.now(); // Update lastUpdated timestamp
  // Optionally, clear previous finalDecision if it was 'revision-requested' to signify a new review cycle for that part.
  // abstract?.reviewDetails?.finalDecision = 'pending'; // Or some other appropriate reset
  // abstract?.reviewDetails?.decisionReason = null;
  // abstract?.reviewDetails?.decisionDate = null;
  // abstract?.reviewDetails?.decisionBy = null;

  await abstract.save();
  logger.info(`[resubmitRevisedAbstract] Abstract ${abstractId} resubmitted by registrant ${registrant._id}. Status changed to 'revised-pending-review'.`);

  const event = abstract.event;
  const assignedReviewers = abstract.reviewDetails?.assignedTo || [];

  // Send notification email to assigned reviewers
  if (assignedReviewers.length > 0 && event && event.emailSettings && event?.emailSettings?.enabled) {
    logger.info(`[resubmitRevisedAbstract] Master email sending enabled. Attempting to send notifications for revised abstract ${abstractId} to ${assignedReviewers && assignedReviewers.length} reviewers.`);
    const emailSubject = `Revised Abstract Submitted for Re-review - ${event.name}`;
    
    for (const reviewer of assignedReviewers) {
      if (reviewer.email) { // Ensure reviewer has an email
        const emailBody = `<p>Dear ${reviewer.name || 'Reviewer'},</p>
                         <p>The abstract titled "<strong>${abstract.title}</strong>" (ID: ${abstract._id}) for the event "<strong>${event.name}</strong>", for which a revision was requested, has now been resubmitted by the author.</p>
                         <p>Please log in to the portal to re-review the revised abstract.</p>
                         <p>Regards,<br/>The Event Team</p>`;
        logger.info(`[resubmitRevisedAbstract] Using generic notification content for ${reviewer.email} for revised abstract ${abstract._id}`);
        try {
          await sendEmail({
            to: reviewer.email,
            subject: emailSubject,
            html: emailBody,
            fromName: event?.emailSettings?.senderName,
            fromEmail: event?.emailSettings?.senderEmail,
            smtp: {
              host: event?.emailSettings?.smtpHost,
              port: event?.emailSettings?.smtpPort,
              secure: event?.emailSettings?.smtpSecure,
              auth: {
                user: event?.emailSettings?.smtpUser,
                pass: event?.emailSettings?.smtpPassword
              }
            }
          });
          logger.info(`Revised abstract notification sent to reviewer ${reviewer.email} for abstract ${abstract._id}`);
        } catch (error) {
          logger.error(`Failed to send revised abstract notification to reviewer ${reviewer.email} for abstract ${abstract._id}:`, emailError);
        }
      }
    }
  } else if (assignedReviewers.length > 0) {
    logger.warn(`[resubmitRevisedAbstract] Master email sending is disabled for event ${event._id}. No notifications sent to reviewers for revised abstract ${abstractId}.`);
  }

  return sendSuccess(res, 200, 'Abstract revision resubmitted successfully. Reviewers will be notified.', abstract);
});

/**
 * @desc    Get abstracts that are under review with their review progress
 * @route   GET /api/events/:eventId/abstracts/pending-review-progress
 * @access  Protected (Admin/Staff)
 */
const getAbstractsWithReviewProgress = asyncHandler(async (req, res, next) => {
  const { eventId } = req.params;

  if (!eventId || !mongoose?.Types?.ObjectId.isValid(eventId)) {
    return next(createApiError(400, 'Valid Event ID is required'));
  }

  const event = await Event.findById(eventId);
  if (!event) {
    return next(createApiError(`Event not found with id of ${eventId}`, 404));
  }

  const abstracts = await Abstract.find({
    event: eventId,
    status: { $in: ['under-review', 'revised-pending-review'] } // Include revised ones awaiting re-review
  })
    .populate('registration', 'registrationId personalInfo')
    .populate('category', 'name')
    .populate({ 
      path: 'reviewDetails.assignedTo', 
      select: 'name email' 
    })
    .populate({ 
      path: 'reviewDetails?.reviews?.reviewer',
      select: 'name email' 
    })
    .sort({ lastUpdated: -1 });

  if (!abstracts) {
    // Should return empty array if not found, but good practice to check
    return sendSuccess(res, 200, 'No abstracts currently pending review or in revised state.', []);
  }

  const abstractsWithStats = abstracts.map(abstract => {
    const abstractObj = abstract.toObject(); // Ensure we have a plain object to add properties
    
    let totalAssigned = 0;
    let completedReviews = 0;
    
    if (abstractObj.reviewDetails) {
      totalAssigned = abstractObj?.reviewDetails?.assignedTo ? abstractObj?.reviewDetails?.assignedTo && assignedTo.length : 0;
      completedReviews = abstractObj?.reviewDetails?.reviews ? 
        abstractObj?.reviewDetails?.reviews.filter(review => review.isComplete).length : 0;
    }
    
    abstractObj.reviewStats = {
      totalAssigned,
      completedReviews,
      pendingReviews: totalAssigned - completedReviews,
      completionPercentage: totalAssigned > 0 ? parseFloat(((completedReviews / totalAssigned) * 100).toFixed(1)) : 0
    };
    
    return abstractObj;
  });

  return sendSuccess(res, 200, 'Abstracts pending review with progress retrieved successfully', abstractsWithStats, abstractsWithStats && abstractsWithStats.length);
});

/**
 * Assign multiple reviewers to multiple abstracts
 * @route POST /api/events/:eventId/abstracts/assign-reviewers
 * @access Private/Admin or Staff
 */
const assignReviewersToAbstracts = async (req, res, next) => {
  const { eventId } = req.params; // Though eventId might not be strictly needed if abstracts are global
  const { abstractIds, reviewerIds  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };

  if (!Array.isArray(abstractIds) || abstractIds.length === 0) {
    return next(createApiError(400, 'Abstract IDs must be a non-empty array.'));
  }
  if (!Array.isArray(reviewerIds) || reviewerIds.length === 0) {
    return next(createApiError(400, 'Reviewer IDs must be a non-empty array.'));
  }

  try {
    const updatePromises = abstractIds.map(async (abstractId) => {
      const abstract = await Abstract.findById(abstractId);
      if (!abstract) {
        // Log or collect errors for abstracts not found
        logger.warn(`Abstract not found during bulk assignment: ${abstractId}`);
        return { abstractId, success: false, message: 'Abstract not found.' };
      }

      // Use the existing Mongoose method on the abstract instance
      await abstract.assignReviewers(reviewerIds); // This method already saves the abstract
      
      // Update status to 'under-review' if not already in a final state
      if (!['approved', 'rejected'].includes(abstract.status)) {
        abstract.status = 'under-review';
        await abstract.save();
      }
      
      // Here you might trigger email notifications to reviewers if that logic isn't in abstract.assignReviewers()
      // For now, assuming assignReviewers or a subsequent process handles notifications.
      logger.info(`Reviewers assigned to abstract ${abstractId}. Status set to under-review.`);
      return { abstractId, success: true };
    });

    const results = await Promise.allSettled(updatePromises);

    const successfulAssignments = results.filter(r => r.status === 'fulfilled' && r?.value?.success).length;
    const failedAssignments = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r?.value?.success));
    
    if (failedAssignments.length > 0) {
        // Partial success, or all failed.
        // You could return more detailed error messages if needed.
        logger.error(`${failedAssignments && failedAssignments.length} errors during bulk reviewer assignment for event ${eventId}.`);
         return res.status(207).json({ // Multi-Status
            success: false, // Or true if some succeeded
            message: `Assignment completed with ${successfulAssignments} successes and ${failedAssignments && failedAssignments.length} failures.`,
            results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message || 'Unknown error' })
        });
    }

    res.status(200).json({
      success: true,
      message: `Successfully assigned reviewers to ${successfulAssignments} abstract(s).`,
    });
  } catch (error) {
    logger.error('Error in bulk assigning reviewers:', error);
    next(error);
  }
};

// 2. Bulk auto-assign reviewers endpoint
exports.autoAssignReviewers = asyncHandler(async (req, res, next) => {
  const { eventId } = req.params;
  const event = await Event.findById(eventId);
  if (!event) {
    return next(createApiError(404, 'Event not found'));
  }
  if (!event.abstractSettings || !Array.isArray(event?.abstractSettings?.categories)) {
    return next(createApiError(400, 'No abstract categories configured for this event'));
  }
  const abstracts = await Abstract.find({ event: eventId });
  let updated = 0;
  for (const abstract of abstracts) {
    if (!abstract.category) continue;
    // Only assign if not already assigned
    if (abstract.reviewDetails && Array.isArray(abstract?.reviewDetails?.assignedTo) && abstract?.reviewDetails?.assignedTo.length > 0) continue;
    let catId = abstract.category;
    if (catId && typeof catId === 'object' && catId.$oid) catId = catId.$oid;
    else if (catId && catId._id) catId = catId._id;
    else if (catId) catId = String(catId);
    const match = event?.abstractSettings?.categories.find(cat => {
      let embeddedId = cat._id;
      if (embeddedId && typeof embeddedId === 'object' && embeddedId.$oid) embeddedId = embeddedId.$oid;
      else if (embeddedId && embeddedId._id) embeddedId = embeddedId._id;
      else if (embeddedId) embeddedId = String(embeddedId);
      return embeddedId === catId;
    });
    if (match && Array.isArray(match.reviewerIds) && match?.reviewerIds?.length > 0) {
      abstract.reviewDetails = abstract.reviewDetails || {};
      abstract.reviewDetails.assignedTo = match.reviewerIds.map(id => id.toString());
      await abstract.save();
      updated++;
    }
  }
  return sendSuccess(res, 200, `Auto-assigned reviewers to ${updated} abstracts.`);
});

// -------------------------- Author workflow additions ---------------------------
/**
 * Author uploads registration proof (image/pdf). Only allowed on own abstract with status accepted.
 */
exports.uploadRegistrationProof = asyncHandler(async (req, res, next) => {
  const abstractId = req?.params?.id;
  const abstract = await Abstract.findById(abstractId);
  if (!abstract) return next(createApiError(404, 'Abstract not found'));

  // Verify owner
  if (req.author && (!abstract.author || !abstract?.author?.equals(req?.author?._id))) {
    return next(createApiError(403, 'Not authorized to upload proof for this abstract'));
  }

  if (!req.files || !req?.files?.file) {
    return next(createApiError(400, 'No file uploaded'));
  }
  const file = req?.files?.file;
  const uploadsDir = buildUploadDir('registration_proofs');
  if(!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir,{recursive:true});
  }
  const safeName = `${abstractId}_${Date.now()}_${file.name}`.replace(/\s+/g, '_');
  const destPath = `${uploadsDir}/${safeName}`;
  await file.mv(destPath);

  abstract.registrationProofUrl = buildFileUrl('registration_proofs', safeName);
  abstract.registrationVerified = false;
  await abstract.save();

  return sendSuccess(res, 200, 'Registration proof uploaded', { fileUrl: abstract.registrationProofUrl });
});

/**
 * Admin verifies proof (sets registrationVerified=true)
 */
exports.verifyRegistrationProof = asyncHandler(async (req, res, next) => {
  const abstractId = req?.params?.id;
  const abstract = await Abstract.findById(abstractId);
  if (!abstract) return next(createApiError(404, 'Abstract not found'));
  abstract.registrationVerified = true;
  await abstract.save();
  return sendSuccess(res, 200, 'Registration proof verified', abstract);
});

/**
 * Author uploads final submission file (after registration verified)
 */
exports.uploadFinalFile = asyncHandler(async (req, res, next) => {
  const abstractId = req?.params?.id;
  const abstract = await Abstract.findById(abstractId);
  if (!abstract) return next(createApiError(404, 'Abstract not found'));
  if (!abstract.registrationVerified) {
    return next(createApiError(400, 'Registration not verified yet'));
  }
  if (!req.files || !req?.files?.file) {
    return next(createApiError(400, 'No file uploaded'));
  }
  const file = req?.files?.file;
  const uploadsDir = buildUploadDir('final_abstracts');
  if(!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir,{recursive:true});
  }
  const safeName = `${abstractId}_${Date.now()}_${file.name}`.replace(/\s+/g, '_');
  await file.mv(`${uploadsDir}/${safeName}`);
  abstract.finalFileUrl = buildFileUrl('final_abstracts', safeName);
  abstract.finalStatus = 'submitted';
  await abstract.save();
  return sendSuccess(res, 200, 'Final file uploaded', { fileUrl: abstract.finalFileUrl });
});

module.exports = {
  getAbstracts: getAbstracts,
  getAbstractsByRegistration: getAbstractsByRegistration,
  getAbstract: exports.getAbstract,
  createAbstract: exports.createAbstract,
  updateAbstract: exports.updateAbstract,
  deleteAbstract: exports.deleteAbstract,
  updateAbstractStatus: exports.updateAbstractStatus,
  addReviewComment: exports.addReviewComment,
  uploadAbstractFile: exports.uploadAbstractFile,
  downloadAbstracts: exports.downloadAbstracts,
  getAbstractStatistics: exports.getAbstractStatistics,
  submitIndividualReview: exports.submitIndividualReview,
  assignAbstractReviewer: exports.assignAbstractReviewer,
  downloadAbstractAttachment: downloadAbstractAttachment,
  approveAbstract: exports.approveAbstract,
  rejectAbstract: exports.rejectAbstract,
  requestRevision: exports.requestRevision,
  resubmitRevisedAbstract: exports.resubmitRevisedAbstract,
  getAbstractsWithReviewProgress: getAbstractsWithReviewProgress,
  assignReviewersToAbstracts: assignReviewersToAbstracts,
  autoAssignReviewers: exports.autoAssignReviewers,
  uploadRegistrationProof: exports.uploadRegistrationProof,
  verifyRegistrationProof: exports.verifyRegistrationProof,
  uploadFinalFile: exports.uploadFinalFile
}; 
