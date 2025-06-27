const mongoose = require('mongoose');
const Resource = require('../models/Resource');
const ResourceSetting = require('../models/ResourceSetting');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Abstract = require('../models/Abstract');
const Workshop = require('../models/Workshop');
const { createApiError } = require('../middleware/error');
const asyncHandler = require('../middleware/async');
const Category = require('../models/Category');
const { sendSuccess, sendPaginated } = require('../utils/responseFormatter');
const logger = require('../utils/logger');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const pdfkit = require('pdfkit');
const pdfToPng = require('pdf-to-png');
const { convertPdfToPng } = require('../utils/pdfToImage');
// Stub for sharp – native binary not available on this VPS
const sharp = (_)=>({ metadata: async ()=>({ width:0, height:0 }) });
const { buildUploadDir, buildFileUrl } = require('../config/paths');

// Simple in-memory cache for per-event food settings (5-minute TTL)
const _foodSettingsCache = new Map(); // key: eventId, value: { data, expires }

// Cache kit items & certificate types per event (5-minute TTL)
const _eventOptionCache = new Map(); // { eventId: { kitItems, certificates, expires } }

/**
 * @desc    Get resource settings
 * @route   GET /api/resources/settings
 * @access  Private
 */
const getResourceSettings = asyncHandler(async (req, res) => {
  console.log('[getResourceSettings] Received query:', req.query);
  const { eventId, type } = req.query;

  // 1. Validate Input
  if (!eventId || !type) {
    console.log('[getResourceSettings] Missing eventId or type. Returning default.');
    return res.status(200).json({
      success: true,
      message: 'Default resource settings (missing parameters)',
      data: { settings: defaultResourceSettings(type || 'food') } // Wrap in {settings: ...}
    });
  }

  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    console.log(`[getResourceSettings] Invalid event ID format: ${eventId}. Returning default.`);
    return res.status(200).json({
      success: true,
      message: 'Default resource settings (invalid event ID)',
      data: { settings: defaultResourceSettings(type) } // Wrap in {settings: ...}
    });
  }

  // Normalize type received from frontend request query
  let requestType = type.toLowerCase();
  let dbQueryType = requestType; // Default to using the request type
  
  // Convert variants to the correct database type with proper casing
  if (requestType === 'kits' || requestType === 'kit' || requestType === 'kitbag') {
    dbQueryType = 'kitBag';  // Ensure correct casing
    console.log(`[getResourceSettings] Normalized request type '${requestType}' to db type 'kitBag'`);
  } else if (requestType === 'certificates' || requestType === 'certificate') {
    dbQueryType = 'certificate';
    console.log(`[getResourceSettings] Normalized request type '${requestType}' to db type 'certificate'`);
  } else if (requestType === 'certificateprinting') {
    dbQueryType = 'certificatePrinting';  // Ensure correct casing
    console.log(`[getResourceSettings] Normalized request type '${requestType}' to db type 'certificatePrinting'`);
  }

  // Check for valid type using case-insensitive comparison
  const validTypes = ['food', 'kitbag', 'certificate', 'certificateprinting'].map(t => t.toLowerCase());
  if (!validTypes.includes(dbQueryType.toLowerCase())) {
    console.log(`[getResourceSettings] Invalid resource type after normalization: ${dbQueryType}. Returning default.`);
    return res.status(200).json({
      success: true,
      message: `Default resource settings (invalid type: ${type})`,
      data: { settings: defaultResourceSettings(dbQueryType) } // Use normalized type for default lookup
    });
  }

  try {
    // 2. Find the Specific ResourceSetting Document using the DB type
    console.log(`[getResourceSettings] Querying ResourceSetting for event: ${eventId}, type: ${dbQueryType}`);
    const resourceSettingDoc = await ResourceSetting.findOne({
      event: eventId,
      type: dbQueryType // Now using properly cased dbQueryType
    });

    let settingsData;
    let message;
    let isEnabledFlag;

    if (resourceSettingDoc) {
      console.log(`[getResourceSettings] Found existing ResourceSetting document.`);
      isEnabledFlag = resourceSettingDoc.isEnabled;
      if (dbQueryType === 'certificatePrinting') {
        // For certificatePrinting, templates are stored directly on the document
        settingsData = { templates: resourceSettingDoc.certificatePrintingTemplates || [] }; 
        if (resourceSettingDoc.settings && Object.keys(resourceSettingDoc.settings).length > 0) {
          settingsData = { ...settingsData, ...resourceSettingDoc.settings };
        }
      } else {
        settingsData = resourceSettingDoc.settings || defaultResourceSettings(dbQueryType);
        // --- PATCH: Always include both days and meals for food ---
        if (dbQueryType === 'food') {
          // Ensure days exists
          settingsData.days = Array.isArray(settingsData.days) ? settingsData.days : [];
          // Flatten meals from days
          settingsData.meals = settingsData.days.flatMap(day => Array.isArray(day.meals) ? day.meals : []);
        }
        // --- PATCH: Ensure kitBag items and certificate types have valid _id as string ---
        if (dbQueryType === 'kitBag' && Array.isArray(settingsData.items)) {
          settingsData.items = settingsData.items.map(item => ({ ...item, _id: item._id ? item._id.toString() : undefined }));
        }
        if (dbQueryType === 'certificate' && Array.isArray(settingsData.types)) {
          settingsData.types = settingsData.types.map(type => ({ ...type, _id: type._id ? type._id.toString() : undefined }));
        }
      }
      message = `${type} settings retrieved successfully`;
    } else {
      console.log(`[getResourceSettings] No ResourceSetting document found. Returning default.`);
      isEnabledFlag = true; // Default to true if no document exists
      if (dbQueryType === 'certificatePrinting') {
        settingsData = { templates: defaultResourceSettings(dbQueryType).templates || [] };
      } else {
        settingsData = defaultResourceSettings(dbQueryType);
      }
      message = `Default ${type} settings returned (no specific config found)`;
    }

    // 3. Return Response in Expected Format
    let responseDataPayload;
    if (dbQueryType === 'certificatePrinting') {
      responseDataPayload = {
        certificatePrintingTemplates: settingsData.templates,
        settings: settingsData, // Keep this for any other general settings under .settings
        isEnabled: isEnabledFlag
      };
    } else {
      responseDataPayload = {
        settings: settingsData,
        isEnabled: isEnabledFlag
      };
    }

    console.log(`[getResourceSettings] Responding with settings for ${type}:`, responseDataPayload);
    return res.status(200).json({
      success: true,
      message: message,
      data: responseDataPayload
    });

  } catch (error) {
    console.error(`[getResourceSettings] Error retrieving settings for event ${eventId}, type ${dbQueryType}: ${error.message}`);
    console.error(error.stack);
    // Fallback to default on error
    return res.status(500).json({
      success: false, // Indicate error on server failure
      message: `Error getting ${type} settings, returned defaults`, // Use original request type
      data: { settings: defaultResourceSettings(dbQueryType) } // Use normalized type for default
    });
  }
});

/**
 * @desc    Update resource settings
 * @route   PUT /api/resources/settings
 * @access  Private
 */
exports.updateResourceSettings = asyncHandler(async (req, res, next) => {
  const { eventId, type } = req.query;
  const { settings, isEnabled } = req.body;

  console.log(`[updateResourceSettings] Incoming req.body for type ${type}:`, JSON.stringify(req.body, null, 2));

  if (!eventId) {
    return res.status(400).json({
      success: false,
      message: 'Event ID is required'
    });
  }

  if (!type) {
    return res.status(400).json({
      success: false,
      message: 'Resource type is required'
    });
  }

  // Normalize the resource type from the request for DB operations
  let requestType = type.toLowerCase();
  let dbType = requestType;
  if (requestType === 'kits' || requestType === 'kit' || requestType === 'kitbag') {
    dbType = 'kitBag';
    console.log(`[updateResourceSettings] Normalized request type '${requestType}' to db type 'kitBag'`);
  } else if (requestType === 'certificates' || requestType === 'certificate') {
    dbType = 'certificate';
    console.log(`[updateResourceSettings] Normalized request type '${requestType}' to db type 'certificate'`);
  } else if (requestType === 'certificateprinting') {
    dbType = 'certificatePrinting';
    console.log(`[updateResourceSettings] Normalized request type '${requestType}' to db type 'certificatePrinting'`);
  }

  // --- FLATTEN MEALS LOGIC ---
  if (dbType === 'food' && settings.days) {
    settings.meals = flattenMeals(settings);
    console.log(`[ResourceSettings] Flattened ${settings.meals.length} meals before save (type: food, event: ${eventId})`);
  }

  // Check for valid type using case-insensitive comparison
  const validTypes = ['food', 'kitbag', 'certificate', 'certificateprinting'].map(t => t.toLowerCase());
  if (!validTypes.includes(dbType.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: `Invalid resource type: ${type}. Must be one of the supported resource types.`
    });
  }

  try {
    // Find settings using the DB type
    let resourceSettingsDoc = await ResourceSetting.findOne({
      event: eventId,
      type: dbType // Use normalized DB type
    });

    // If settings don't exist, create new settings using DB type
    if (!resourceSettingsDoc) {
      resourceSettingsDoc = new ResourceSetting({
        event: eventId,
        type: dbType, // Use normalized DB type
        isEnabled: isEnabled !== undefined ? isEnabled : true, // Default to true when creating
        createdBy: req.user._id,
        updatedBy: req.user._id
      });
      if (dbType === 'certificatePrinting') {
        resourceSettingsDoc.certificatePrintingTemplates = settings?.templates || [];
        // Store other potential general settings for certificatePrinting if any, excluding templates
        const generalSettings = { ...settings };
        delete generalSettings.templates;
        resourceSettingsDoc.settings = generalSettings; 
      } else {
        resourceSettingsDoc.settings = settings || {};
      }
      console.log(`[updateResourceSettings] Creating new ResourceSetting for type: ${dbType}`);
    } else {
      // Update existing settings
      console.log(`[updateResourceSettings] Updating existing ResourceSetting for type: ${dbType}`);
      // --- SAFETY CHECK: Prevent accidental overwrite with empty settings ---
      let isIncomingEmpty = false;
      if (dbType === 'food' && settings && Array.isArray(settings.days) && settings.days.length === 0) isIncomingEmpty = true;
      if (dbType === 'kitBag' && settings && Array.isArray(settings.items) && settings.items.length === 0) isIncomingEmpty = true;
      if (dbType === 'certificate' && settings && Array.isArray(settings.types) && settings.types.length === 0) isIncomingEmpty = true;
      if (dbType === 'certificatePrinting' && settings && Array.isArray(settings.templates) && settings.templates.length === 0) isIncomingEmpty = true;
      // If incoming settings are empty and existing settings are non-empty, block update
      let isExistingNonEmpty = false;
      if (dbType === 'food' && resourceSettingsDoc.settings && Array.isArray(resourceSettingsDoc.settings.days) && resourceSettingsDoc.settings.days.length > 0) isExistingNonEmpty = true;
      if (dbType === 'kitBag' && resourceSettingsDoc.settings && Array.isArray(resourceSettingsDoc.settings.items) && resourceSettingsDoc.settings.items.length > 0) isExistingNonEmpty = true;
      if (dbType === 'certificate' && resourceSettingsDoc.settings && Array.isArray(resourceSettingsDoc.settings.types) && resourceSettingsDoc.settings.types.length > 0) isExistingNonEmpty = true;
      if (dbType === 'certificatePrinting' && resourceSettingsDoc.certificatePrintingTemplates && resourceSettingsDoc.certificatePrintingTemplates.length > 0 && settings && Array.isArray(settings.templates) && settings.templates.length === 0) isExistingNonEmpty = true;
      if (isIncomingEmpty && isExistingNonEmpty) {
        console.warn(`[updateResourceSettings] BLOCKED: Attempt to overwrite non-empty settings for type ${dbType} with empty settings. User: ${req.user.email}, Event: ${eventId}`);
        return res.status(400).json({
          success: false,
          message: `Blocked: Refusing to overwrite non-empty ${dbType} settings with empty data. If you intend to clear all settings, please do so explicitly.`,
        });
      }
      if (dbType === 'certificatePrinting') {
        console.log('[updateResourceSettings] CERTPRINT_UPDATE: Current doc.certificatePrintingTemplates BEFORE change:', JSON.stringify(resourceSettingsDoc.certificatePrintingTemplates, null, 2));
        console.log('[updateResourceSettings] CERTPRINT_UPDATE: Incoming settings.templates FROM CLIENT:', JSON.stringify(settings.templates, null, 2));
        
        if (settings?.templates !== undefined) {
          resourceSettingsDoc.certificatePrintingTemplates = settings.templates;
          console.log('[updateResourceSettings] CERTPRINT_UPDATE: Current doc.certificatePrintingTemplates AFTER assignment:', JSON.stringify(resourceSettingsDoc.certificatePrintingTemplates, null, 2));
        }
        // For certificatePrinting, we explicitly manage certificatePrintingTemplates.
        // We should clear or carefully manage the generic 'settings' field to avoid conflicts.
        // If 'settings' on the client for certificatePrinting ONLY contains 'enabled' and 'templates',
        // we can just ignore it here for the 'settings' field on the DB document for this type.
        // Or, if there are other general settings unrelated to templates, they would be handled here.
        // For now, let's ensure settings.templates doesn't pollute resourceSettingsDoc.settings.templates
        resourceSettingsDoc.settings = { enabled: settings?.enabled }; // Only store enabled, or other general non-template settings

      } else {
        // Logic for other types (food, kitBag, certificate)
        if (settings !== undefined) {
          resourceSettingsDoc.settings = settings;
        }
      }
      // Update isEnabled at the top level of the document for all types
      if (isEnabled !== undefined) {
        resourceSettingsDoc.isEnabled = isEnabled;
      }
      resourceSettingsDoc.updatedBy = req.user._id;
    }

    console.log(`[updateResourceSettings] Document details BEFORE save for type ${dbType}:`, JSON.stringify(resourceSettingsDoc.toObject(), null, 2));
       // --- PATCH: Auto-assign ObjectId to kitBag items and certificate types if missing ---
   // For kitBag: Only assign a new _id if missing or invalid, and mark as modified so Mongoose saves the change
   const { Types } = require('mongoose');
   if (dbType === 'kitBag' && resourceSettingsDoc.settings && Array.isArray(resourceSettingsDoc.settings.items)) {
     resourceSettingsDoc.settings.items = resourceSettingsDoc.settings.items.map(item => {
       // Only generate a new _id if missing or invalid; preserve existing valid _id
       if (!item._id || !Types.ObjectId.isValid(item._id)) {
         return { ...item, _id: new Types.ObjectId() };
       }
       return item;
     });
     resourceSettingsDoc.markModified('settings.items'); // Ensure Mongoose saves the updated array
   }
   // For certificate: Only assign a new _id if missing or invalid, and mark as modified so Mongoose saves the change
   if (dbType === 'certificate' && resourceSettingsDoc.settings && Array.isArray(resourceSettingsDoc.settings.types)) {
     resourceSettingsDoc.settings.types = resourceSettingsDoc.settings.types.map(type => {
       if (!type._id || !Types.ObjectId.isValid(type._id)) {
         return { ...type, _id: new Types.ObjectId() };
       }
       return type;
     });
     resourceSettingsDoc.markModified('settings.types'); // Ensure Mongoose saves the updated array
   }
   // Save the settings
    await resourceSettingsDoc.save();
    console.log(`[updateResourceSettings] Document details AFTER save for type ${dbType} (refetched might be needed to confirm DB state, but this is post-save call).`);

    // --- NEW: Ensure all categories have entitlements for all meals (food type only)
    if (dbType === 'food' && resourceSettingsDoc.settings.meals) {
      await ensureMealEntitlementsForAllCategories(eventId, resourceSettingsDoc.settings.meals);
    }

    // Return the updated settings
    return res.status(200).json({
      success: true,
      message: `${type} settings updated successfully`, // Use original request type in message
      data: resourceSettingsDoc // Return the whole doc as before
    });
  } catch (error) {
    console.error(`Error in updateResourceSettings for type ${dbType}: ${error.message}`);
    console.error(`Request data: eventId=${eventId}, type=${type}, normalized type=${dbType}`);
    return res.status(500).json({
      success: false,
      message: `Error updating ${type} settings: ${error.message}`,
      error: error.message
    });
  }
});

/**
 * @desc    Get resources (usage logs)
 * @route   GET /api/resources              (Requires eventId query param)
 * @route   GET /api/events/:id/resources   (Uses eventId from route param)
 * @access  Private
 */
exports.getResources = asyncHandler(async (req, res, next) => {
  const { type, page = 1, limit = 10 } = req.query;
  // Get eventId from route params first, fallback to query param
  const eventId = req.params.id || req.query.eventId; 

  // --- Require eventId --- 
  if (!eventId) {
    // If not admin, require eventId
    if (req.user.role !== 'admin') { 
        console.warn(`[getResources] Non-admin user ${req.user.id} attempted access without eventId.`);
        return next(createApiError(400, 'Event ID is required to view resources.'));
    }
    // Allow admin access without eventId (fetches all resources), but log it.
    console.warn(`[getResources] Admin ${req.user.id} accessing resources without eventId filter.`);
  }

  // Validate eventId if provided
  if (eventId && !mongoose.Types.ObjectId.isValid(eventId)) {
      return next(createApiError(400, 'Invalid Event ID format.'));
  }
  // --- End Require eventId ---

  const query = {};

  // Apply event filter if eventId is present
  if (eventId) {
    query.event = eventId;
    console.log(`[getResources] Filtering resources by event: ${eventId}`);
  }

  if (type) {
    query.type = type;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  try {
      const resources = await Resource.find(query)
        .sort({ actionDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('actionDate type resourceOption resourceOptionName registrationId firstName lastName categoryName categoryColor')
        .lean();
    
      const total = await Resource.countDocuments(query);
      
      console.log(`[getResources] Found ${resources.length} resources, total matching query: ${total}`);
      
      // Use sendPaginated helper
      return sendPaginated(res, {
          message: 'Resources retrieved successfully',
          data: resources,
          page: parseInt(page),
          limit: parseInt(limit),
          total: total
      });
      
  } catch (error) {
      console.error(`[getResources] Error fetching resources: ${error.message}`);
      next(error); // Pass error to central handler
  }
});

/**
 * @desc    Create resource
 * @route   POST /api/resources
 * @access  Private
 */
exports.createResource = asyncHandler(async (req, res, next) => {
  // Determine eventId (from route param or body)
  const eventId = req.params.id || req.body.eventId;
  // Get registrationId (should be in body for both route types)
  const { registrationId, type, details } = req.body;

  // --- Validation --- 
  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return next(createApiError(400, 'Valid Event ID is required (from route or body).'));
  }
  if (!registrationId || !mongoose.Types.ObjectId.isValid(registrationId)) {
      return next(createApiError(400, 'Valid Registration ID is required in the request body.'));
  }
  if (!type) {
      return next(createApiError(400, 'Resource type is required.'));
  }
  // --- End Validation ---

  // --- Authorization & Consistency Check ---
  // 1. Verify the registration exists and belongs to the correct event
  const registration = await Registration.findById(registrationId);
  if (!registration) {
      return next(createApiError(404, `Registration not found with ID: ${registrationId}`));
  }
  if (registration.event.toString() !== eventId) {
      console.warn(`[createResource AUTH] Attempt to log resource for registration ${registrationId} (event ${registration.event}) under event ${eventId}.`);
      return next(createApiError(400, 'Registration does not belong to the specified event.'));
  }
  // Optional: Add check if event exists if needed (findByIdAndUpdate below implies it)
  // const event = await Event.findById(eventId);
  // if (!event) { ... }
  // --- End Check --- 

  // Add user and event to the data to be created
  const resourceData = {
    ...req.body, // Include type, details, etc. from body
    event: eventId, // Set the event ID
    registration: registrationId, // Ensure registration ID is set
    issuedBy: req.user.id, // Set the user issuing the resource
    actionDate: new Date(), // Set the action time
    isVoided: false, // Default value
    createdBy: req.user._id, // Set the createdBy field
    updatedBy: req.user._id // Set the updatedBy field
  };
  
  // Remove eventId and registrationId from the base object if they existed in req.body 
  // to avoid passing them twice to Resource.create
  delete resourceData.eventId; 

  try {
      const resource = await Resource.create(resourceData);
      logger.info(`Resource ${type} logged for registration ${registrationId} in event ${eventId} by ${req.user.email}`);
      return sendSuccess(res, 201, 'Resource usage logged successfully', resource);
  } catch (error) {
      logger.error(`Error creating resource log: ${error.message}`, { error, data: resourceData });
      next(error); // Pass to central error handler
  }
});

/**
 * @desc    Get resource by ID
 * @route   GET /api/resources/:id
 * @access  Private
 */
exports.getResourceById = asyncHandler(async (req, res, next) => {
  const resource = await Resource.findById(req.params.id)
    .populate('registration', 'registrationId firstName lastName email')
    .populate('issuedBy', 'name email')
    .populate('voidedBy', 'name email');

  if (!resource) {
    return next(createApiError(404, `Resource not found with id of ${req.params.id}`));
  }

  res.status(200).json({
    success: true,
    data: resource
  });
});

/**
 * @desc    Update resource
 * @route   PUT /api/resources/:id
 * @access  Private
 */
exports.updateResource = asyncHandler(async (req, res, next) => {
  let resource = await Resource.findById(req.params.id);

  if (!resource) {
    return next(createApiError(404, `Resource not found with id of ${req.params.id}`));
  }

  resource = await Resource.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: resource
  });
});

/**
 * @desc    Delete resource
 * @route   DELETE /api/resources/:id
 * @access  Private
 */
exports.deleteResource = asyncHandler(async (req, res, next) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    return next(createApiError(404, `Resource not found with id of ${req.params.id}`));
  }

  await resource.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

/**
 * @desc    Void resource
 * @route   PATCH /api/resources/:id/void
 * @access  Private
 */
exports.voidResource = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;
  const resource = await Resource.findById(req.params.id).populate('registration');

  if (!resource) {
    return next(createApiError(404, `Resource not found with id of ${req.params.id}`));
  }

  if (resource.isVoided) {
    return next(createApiError(400, `Resource already voided`));
  }

  // Mark resource as voided
  resource.isVoided = true;
  resource.voidedBy = req.user.id;
  resource.voidedAt = Date.now();
  
  if (reason) {
    resource.voidReason = reason;
  }

  await resource.save();

  // Also update the registration's resource usage summary
  if (resource.registration) {
    try {
      const registration = await Registration.findById(resource.registration._id);
      
      if (registration) {
        // Determine which array to update based on resource type
        let resourceArray;
        if (resource.type === 'food') {
          resourceArray = 'resourceUsage.meals';
        } else if (resource.type === 'kits') {
          resourceArray = 'resourceUsage.kitItems'; 
        } else if (resource.type === 'certificates') {
          resourceArray = 'resourceUsage.certificates';
        }
        
        if (resourceArray) {
          // Use MongoDB's $pull operator to remove the entry with matching resourceId
          const updateQuery = {};
          updateQuery[`$pull`] = {};
          updateQuery[`$pull`][resourceArray] = { resourceId: resource._id };
          
          await Registration.findByIdAndUpdate(
            registration._id,
            updateQuery
          );
          
          // Add activity log entry about voiding
          registration.activities = registration.activities || [];
          registration.activities.push({
            action: `${resource.type.charAt(0).toUpperCase() + resource.type.slice(1)} Voided`,
            description: `${resource.type.charAt(0).toUpperCase() + resource.type.slice(1)} "${resource.details?.option}" was voided. Reason: ${reason || 'Not specified'}`,
            user: req.user.name,
            timestamp: new Date()
          });
          
          await registration.save();
        }
      }
    } catch (error) {
      console.error(`Error updating registration after resource void: ${error.message}`);
      // Continue regardless of error updating registration
    }
  }

  res.status(200).json({
    success: true,
    data: resource
  });
});

/**
 * @desc    Get resource statistics for a specific type for an event
 * @route   GET /api/resources/statistics/:eventId/:resourceType
 * @access  Private
 */
exports.getResourceTypeStatistics = asyncHandler(async (req, res, next) => {
  const { eventId, resourceType: requestType } = req.params; // Use requestType locally to avoid confusion

  console.log(`[getResourceTypeStatistics] Received request for event: ${eventId}, type: ${requestType}`);

  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
    console.log(`[getResourceTypeStatistics] Invalid or missing eventId: ${eventId}`);
    return next(createApiError(400, 'Valid Event ID is required'));
  }

  if (!requestType) {
    console.log(`[getResourceTypeStatistics] Missing resourceType`);
    return next(createApiError(400, 'Resource type is required'));
  }

  // --- Normalize Resource Type to canonical DB value (case-sensitive) ---
  const normalizeResourceType = (typeStr) => {
    if (!typeStr) return '';
    const lower = typeStr.toLowerCase();
    if (lower === 'food') return 'food';
    if (['kit', 'kits', 'kitbag', 'kitbag'].includes(lower)) return 'kitBag';
    if (['certificate', 'certificates'].includes(lower)) return 'certificate';
    if (['certificateprinting', 'certificate_printing', 'certificate-printing'].includes(lower)) return 'certificatePrinting';
    return lower; // fall-through for unexpected values
  };

  const dbType = normalizeResourceType(requestType);

  // Accept only canonical DB types listed in the enum of Resource.type
  const validDbTypes = ['food', 'kitBag', 'certificate', 'certificatePrinting'];
  if (!validDbTypes.includes(dbType)) {
    console.log(`[getResourceTypeStatistics] Invalid resource type after normalization: ${dbType}`);
    return next(createApiError(400, `Invalid resource type: ${requestType}. Must be one of: food, kit/kits, certificate/certificates, or certificatePrinting`));
  }

  console.log(`[getResourceTypeStatistics] Using DB type: ${dbType}`);

  try {
    // --- 1. Get Total Configured Items from ResourceSetting ---
    console.log(`[getResourceTypeStatistics] Fetching ResourceSetting for event ${eventId}, type ${dbType}`);
    const resourceSetting = await ResourceSetting.findOne({ event: eventId, type: dbType }).lean(); // Use lean for performance
    
    let totalConfigured = 0;
    if (resourceSetting && resourceSetting.settings) {
      switch (dbType) {
        case 'food':
          totalConfigured = resourceSetting.settings.meals?.length || 0;
          break;
        case 'kitBag':
          totalConfigured = resourceSetting.settings.items?.length || 0;
          break;
        case 'certificate':
          totalConfigured = resourceSetting.settings.types?.length || 0;
          break;
        case 'certificatePrinting':
           // Assuming 'templates' is the key, adjust if needed
          totalConfigured = resourceSetting.settings.templates?.length || 0; 
          break;
      }
       console.log(`[getResourceTypeStatistics] Found ${totalConfigured} configured ${dbType} items.`);
    } else {
       console.log(`[getResourceTypeStatistics] No ResourceSetting found or settings empty for ${dbType}. totalConfigured set to 0.`);
    }

    // --- 2. Aggregate Resource Usage Data (Non-Voided) ---
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const aggregationPipeline = [
      {
        $match: {
          event: new mongoose.Types.ObjectId(eventId),
          type: dbType,
          $or: [ { isVoided: false }, { isVoided: { $exists: false } } ] // Explicitly check for false or non-existent
        }
      },
      {
        $group: {
          _id: null,
          totalIssued: { $sum: 1 },
          issuedToday: {
            $sum: {
              $cond: [
                { $and: [ { $gte: ['$actionDate', todayStart] }, { $lte: ['$actionDate', todayEnd] } ] },
                1, 0
              ]
            }
          },
          uniqueAttendeesSet: { $addToSet: '$registration' }
        }
      },
      {
        $project: {
          _id: 0,
          totalIssued: 1,
          issuedToday: 1,
          uniqueAttendees: { $size: '$uniqueAttendeesSet' }
        }
      }
    ];

    console.log(`[getResourceTypeStatistics] Running aggregation for non-voided ${dbType}`);
    const usageResults = await Resource.aggregate(aggregationPipeline);
    
    let usageStats = {
      totalIssued: 0,
      issuedToday: 0,
      uniqueAttendees: 0
    };

    if (usageResults.length > 0) {
      usageStats = usageResults[0];
       console.log(`[getResourceTypeStatistics] Aggregation results (non-voided):`, usageStats);
    } else {
      console.log(`[getResourceTypeStatistics] No non-voided ${dbType} resources found.`);
    }

    // --- 2b. Breakdown by individual option (non-voided) ---
    const breakdownAggregation = [
      {
        $match: {
          event: new mongoose.Types.ObjectId(eventId),
          type: dbType,
          $or: [{ isVoided: false }, { isVoided: { $exists: false } }]
        }
      },
      {
        $group: {
          _id: '$details.option',
          totalIssued: { $sum: 1 },
          uniqueAttendeesSet: { $addToSet: '$registration' }
        }
      },
      {
        $project: {
          _id: 1,
          totalIssued: 1,
          uniqueAttendees: { $size: '$uniqueAttendeesSet' }
        }
      }
    ];

    const breakdownRaw = await Resource.aggregate(breakdownAggregation);

    // Build a display-name map using the event's ResourceSetting so we can translate option IDs to human-readable names
    const optionDisplayMap = {};
    if (dbType === 'food' && resourceSetting?.settings?.days) {
      resourceSetting.settings.days.forEach((day, dayIdx) => {
        (day.meals || []).forEach((meal) => {
          const display = `${meal.name} (${day.date ? new Date(day.date).toLocaleDateString() : 'Day ' + (dayIdx + 1)})`;
          // Map by composite key (legacy format)
          const legacyKey = `${dayIdx}_${meal.name}`;
          optionDisplayMap[legacyKey] = display;
          // Map by _id or id (newer records)
          if (meal._id) optionDisplayMap[meal._id.toString()] = display;
          if (meal.id) optionDisplayMap[meal.id.toString ? meal.id.toString() : meal.id] = display;
        });
      });
    } else if (dbType === 'kitBag' && resourceSetting?.settings?.items) {
      resourceSetting.settings.items.forEach((item) => {
        if (item._id) optionDisplayMap[item._id.toString()] = item.name;
        if (item.id) optionDisplayMap[item.id.toString ? item.id.toString() : item.id] = item.name;
        optionDisplayMap[item.name] = item.name;
      });
    } else if ((dbType === 'certificate' || dbType === 'certificatePrinting')) {
      const templates = resourceSetting?.certificatePrintingTemplates || resourceSetting?.settings?.types || [];
      templates.forEach((tpl) => {
        const key = (tpl._id || tpl.id || tpl.name).toString();
        optionDisplayMap[key] = tpl.name;
      });
    }

    const breakdown = breakdownRaw.map((b) => ({
      option: b._id,
      name: optionDisplayMap[b._id] || b._id,
      totalIssued: b.totalIssued,
      uniqueAttendees: b.uniqueAttendees
    }));

    // --- 3. Count Total Registrations ---
    console.log(`[getResourceTypeStatistics] Counting total registrations for event ${eventId}`);
    const totalRegistrations = await Registration.countDocuments({ event: eventId });
    console.log(`[getResourceTypeStatistics] Total registrations: ${totalRegistrations}`);

    // --- 4. Count Voided Resources of this Type ---
    console.log(`[getResourceTypeStatistics] Counting voided ${dbType} resources for event ${eventId}`);
    const totalVoided = await Resource.countDocuments({ 
      event: eventId, 
      type: dbType, 
      isVoided: true 
    });
    console.log(`[getResourceTypeStatistics] Total voided ${dbType}: ${totalVoided}`);
    
    // --- 5. Combine and Respond ---
    const finalStats = {
      totalConfigured: totalConfigured,
      totalIssued: usageStats.totalIssued,
      issuedToday: usageStats.issuedToday,
      uniqueAttendees: usageStats.uniqueAttendees,
      totalRegistrations: totalRegistrations, // Overall event registrations
      totalVoided: totalVoided,
      breakdown
    };

    console.log(`[getResourceTypeStatistics] Sending final stats for ${requestType}:`, finalStats);
    res.status(200).json({
      success: true,
      message: `Statistics for ${requestType} retrieved successfully`,
      data: finalStats
    });

  } catch (error) {
    console.error(`[getResourceTypeStatistics] Error fetching statistics for event ${eventId}, type ${requestType}: ${error.message}`);
    console.error(error.stack); // Log stack trace
    // Send a generic error but maybe with some default data structure?
     res.status(500).json({
      success: false,
      message: `Server error fetching statistics for ${requestType}`,
      error: error.message, // Include error message for debugging on client if needed
      data: { // Send default structure on error
         totalConfigured: 0,
         totalIssued: 0,
         issuedToday: 0,
         uniqueAttendees: 0,
         totalRegistrations: 0,
         totalVoided: 0
       }
    });
  }
});

/**
 * @desc    Validate a resource scan
 * @route   POST /api/events/:eventId/resources/validate
 * @access  Private
 */
exports.validateResourceScan = asyncHandler(async (req, res, next) => {
  // Get eventId from the request BODY, not params, for this global route
  const { eventId, qrCode, resourceType, resourceOptionId } = req.body; 

  // Validate inputs
  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
    return next(createApiError(400, 'Valid Event ID is required in the request body.'));
  }
  if (!qrCode) {
    return next(createApiError(400, 'QR code is required'));
  }
  if (!resourceType) {
    return next(createApiError(400, 'Resource type is required'));
  }
  if (!resourceOptionId) {
    return next(createApiError(400, 'Resource option ID is required'));
  }

  // Parallel fetch of event (existence) and registration record
  const [eventExists, registration] = await Promise.all([
    Event.exists({ _id: eventId }),
    Registration.findOne({
    $or: [
      { qrCode },
      { registrationId: qrCode }
    ],
    event: eventId
    })
      .populate({
        path: 'category',
        select: 'name permissions mealEntitlements kitItemEntitlements certificateEntitlements'
      })
      .lean()
  ]);

  if (!eventExists) {
    return next(createApiError(404, 'Event not found'));
  }

  if (!registration) {
    return next(createApiError(404, 'Registration not found'));
  }

  // Check if registration is active
  if (registration.status !== 'active') {
    return next(createApiError(400, `Registration is ${registration.status}`));
  }

  const category = registration.category; // already populated

  // --- SPECIFIC ENTITLEMENT CHECKS ---
  let hasPermission = false;
  let entitled = true;
  if (resourceType === 'food') {
    hasPermission = category.permissions.meals;
    entitled = category.mealEntitlements?.some(e => e.mealId?.toString() === resourceOptionId && e.entitled);
    if (!entitled) {
      console.log(`[validateResourceScan] Category ${category.name} is NOT entitled to meal ${resourceOptionId}`);
      return next(createApiError(400, 'This category is not entitled to this meal.'));
    }
  } else if (resourceType === 'kits' || resourceType === 'kitBag') {
    hasPermission = category.permissions.kitItems;
    entitled = category.kitItemEntitlements?.some(e => e.itemId?.toString() === resourceOptionId && e.entitled);
    if (!entitled) {
      console.log(`[validateResourceScan] Category ${category.name} is NOT entitled to kit item ${resourceOptionId}`);
      return next(createApiError(400, 'This category is not entitled to this kit item.'));
    }
  } else if (resourceType === 'certificates' || resourceType === 'certificate') {
    hasPermission = category.permissions.certificates;
    entitled = category.certificateEntitlements?.some(e => e.certificateId?.toString() === resourceOptionId && e.entitled);
    if (!entitled) {
      console.log(`[validateResourceScan] Category ${category.name} is NOT entitled to certificate ${resourceOptionId}`);
      return next(createApiError(400, 'This category is not entitled to this certificate.'));
    }
  } else if (resourceType === 'certificatePrinting') {
    hasPermission = category.permissions.certificates;
    // No entitlement check for certificatePrinting (assume all allowed if certificates allowed)
  }

  if (!hasPermission) {
    return next(createApiError(400, `This category does not have permission for ${resourceType}`));
  }

  // Check if this resource has already been used
  const existingResource = await Resource.findOne({
    event: eventId,
    registration: registration._id,
    type: resourceType,
    'details.option': resourceOptionId,
    status: 'used',
    isVoided: { $ne: true } // Exclude voided resources
  }).select('_id').lean();

  if (existingResource) {
    return next(createApiError(400, `This ${resourceType} has already been used by this registration`));
  }

  res.status(200).json({
    success: true,
    message: 'Scan validated successfully',
    data: {
      registration: {
        _id: registration._id,
        registrationId: registration.registrationId,
        firstName: registration.personalInfo?.firstName || '',
        lastName: registration.personalInfo?.lastName || '',
        categoryName: category.name
      }
    }
  });
});

/**
 * @desc    Record resource usage
 * @route   POST /api/events/:eventId/resources/usage
 * @access  Private
 */
exports.recordResourceUsage = asyncHandler(async (req, res, next) => {
  // Get eventId from the BODY for this global route
  const { eventId, registrationId, resourceType, resourceOptionId } = req.body; 

  // Validate inputs
  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
    return next(createApiError(400, 'Valid Event ID is required in the request body.'));
  }
  if (!registrationId) {
    return next(createApiError(400, 'Registration ID is required'));
  }
  if (!resourceType) {
    return next(createApiError(400, 'Resource type is required'));
  }
  if (!resourceOptionId) {
    return next(createApiError(400, 'Resource option ID is required'));
  }

  // Find the event
  const event = await Event.findById(eventId);
  if (!event) {
    return next(createApiError(404, 'Event not found'));
  }

  // Find the registration
  const registration = await Registration.findOne({
    $or: [
      { qrCode: registrationId },
      { registrationId }
    ],
    event: eventId
  });

  if (!registration) {
    return next(createApiError(404, 'Registration not found'));
  }

  // Map UI resource types to database resource types if needed
  // The database schema expects: 'food', 'kitBag', 'certificate'
  let dbResourceType = resourceType;
  
  // Remove the incorrect mapping that causes validation errors
  // DO NOT map 'kitBag' to 'kits' - 'kitBag' is the correct value for the database

  // Clean up resourceOptionId by removing any "0_" prefix
  let cleanedOptionId = resourceOptionId;
  if (resourceOptionId && resourceOptionId.startsWith('0_')) {
    cleanedOptionId = resourceOptionId.substring(2);
    console.log(`[recordResourceUsage] Cleaned resourceOptionId: ${resourceOptionId} -> ${cleanedOptionId}`); // Log cleaning
  } else {
    console.log(`[recordResourceUsage] Using resourceOptionId as is (no prefix): ${resourceOptionId}`);
  }

  // Option 1: Allow forced reprints for certificatePrinting
  // If req.body.force is true and resourceType is 'certificatePrinting', skip duplicate check
  const forceFlag = req.body.force === true || req.body.force === 'true';
  const isForceReprint = forceFlag && dbResourceType === 'certificatePrinting';

  // --- Check if this specific meal has already been used TODAY --- 
  let mealAlreadyUsedToday = false;
  if (dbResourceType === 'food') {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    console.log(`[recordResourceUsage] Checking for existing FOOD record: event=${eventId}, reg=${registration._id}, option=${cleanedOptionId}, date=${todayStart.toISOString()} to ${todayEnd.toISOString()}`); // Log check params

    const existingFoodResourceToday = await Resource.findOne({
      event: eventId,
      registration: registration._id,
      type: 'food',
      'details.option': cleanedOptionId, // *** USE CLEANED ID ***
      status: 'used',
      actionDate: {
        $gte: todayStart,
        $lte: todayEnd
      },
      isVoided: { $ne: true } // Exclude voided resources
    });

    if (existingFoodResourceToday) {
        console.log(`[recordResourceUsage] Found existing FOOD record for today: ${existingFoodResourceToday._id}`); // Log found record
        mealAlreadyUsedToday = true;
    } else {
        console.log(`[recordResourceUsage] No existing FOOD record found for today.`);
    }
  }
  // --- End Check ---

  // Check if this resource has already been used (Original Check - Now uses cleaned ID)
  console.log(`[recordResourceUsage] Checking for existing ANY record: event=${eventId}, reg=${registration._id}, type=${dbResourceType}, option=${cleanedOptionId}`); // Log check params
  const existingResource = await Resource.findOne({
    event: eventId,
    registration: registration._id,
    type: dbResourceType,
    'details.option': cleanedOptionId, // *** USE CLEANED ID ***
    status: 'used',
    isVoided: { $ne: true } // Exclude voided resources
  });

  if (existingResource) {
    console.log(`[recordResourceUsage] Found existing ANY record: ${existingResource._id}`); // Log found record
  }

  // --- Combine checks --- 
  if (mealAlreadyUsedToday) { // Prioritize the date-specific check for food
    console.log(`[recordResourceUsage] Blocking duplicate FOOD scan for today.`); // Log block reason
    return next(createApiError(400, `This meal has already been scanned for this registration today.`));
  } else if (!isForceReprint && dbResourceType !== 'food' && existingResource) { // Use original check for non-food items, unless force reprint
    console.log(`[recordResourceUsage] Blocking duplicate NON-FOOD scan.`); // Log block reason
    return next(createApiError(400, `This ${resourceType} has already been used by this registration.`));
  }
  // --- End Combined Checks ---

  console.log(`[recordResourceUsage] Proceeding to create new resource record.`); // Log proceed

  // ----------------------------------------------------------
  // Fetch extra data needed for denormalised fields ----------
  // ----------------------------------------------------------
  // Ensure we have the category document populated (for name & colour)
  let categoryName = '';
  let categoryColor = '';
  if (registration.category) {
    // Populate only if not already populated (instanceof mongoose.Document means populated)
    if (typeof registration.category === 'object' && registration.category.name) {
      categoryName = registration.category.name;
      categoryColor = registration.category.color || '';
    } else {
      const catDoc = await Category.findById(registration.category).select('name color').lean();
      if (catDoc) {
        categoryName = catDoc.name;
        categoryColor = catDoc.color || '';
      }
    }
  }

  // Determine human-readable option name (meal / kit / certificate)
  let optionName = cleanedOptionId;
  if (dbResourceType === 'food') {
    const meal = event.meals?.find(m => m._id?.toString() === cleanedOptionId);
    if (meal) optionName = meal.name;
  } else if (dbResourceType === 'kitBag') {
    const kit = event.kitItems?.find(k => k._id?.toString() === cleanedOptionId);
    if (kit) optionName = kit.name;
  } else if (dbResourceType === 'certificate' || dbResourceType === 'certificatePrinting') {
    const cert = event.certificateTypes?.find(c => c._id?.toString() === cleanedOptionId);
    if (cert) optionName = cert.name;
  }

  // ----------------------------------------------------------
  // Create resource WITH denormalised fields -----------------
  // ----------------------------------------------------------
  const resource = new Resource({
    event: eventId,
    registration: registration._id,
    type: dbResourceType,
    status: 'used',
    details: {
      option: cleanedOptionId // Use cleaned version for new records
    },
    resourceOption: cleanedOptionId,
    resourceOptionName: optionName,
    actionDate: new Date(),
    actionBy: req.user._id,
    createdBy: req.user._id,
    // --- denormalised registration fields ---
    registrationId: registration.registrationId,
    firstName: registration.personalInfo?.firstName || '',
    lastName: registration.personalInfo?.lastName || '',
    categoryName,
    categoryColor
  });

  await resource.save();

  // Add to registration activity log
  const resourceTypeDisplay = resourceType.charAt(0).toUpperCase() + resourceType.slice(1);

  // Add to registration activities
  const activities = registration.activities || [];
  activities.push({
    action: `${resourceTypeDisplay} Used`,
    description: `${resourceTypeDisplay} "${optionName}" was used`,
    user: req.user.name,
    timestamp: new Date()
  });
  
  registration.activities = activities;
  
  // Add to resource usage summary in registration
  // Determine the right array to update based on resource type
  let resourceField;
  if (dbResourceType === 'food') {
    resourceField = 'resourceUsage.meals';
  } else if (dbResourceType === 'kitBag') {
    resourceField = 'resourceUsage.kitItems';
  } else if (dbResourceType === 'certificate' || dbResourceType === 'certificatePrinting') {
    resourceField = 'resourceUsage.certificates';
  }
  
  // Update the appropriate array in resourceUsage
  if (resourceField) {
    const resourceSummary = {
      resourceId: resource._id,
      option: cleanedOptionId,
      optionName: optionName,
      date: new Date()
    };
    
    // Use MongoDB's $push operator to add to the array
    registration.resourceUsage = registration.resourceUsage || {};
    registration.resourceUsage.meals = registration.resourceUsage.meals || [];
    registration.resourceUsage.kitItems = registration.resourceUsage.kitItems || [];
    registration.resourceUsage.certificates = registration.resourceUsage.certificates || [];
    
    if (dbResourceType === 'food') {
      registration.resourceUsage.meals.push(resourceSummary);
    } else if (dbResourceType === 'kitBag') {
      registration.resourceUsage.kitItems.push(resourceSummary);
    } else if (dbResourceType === 'certificate' || dbResourceType === 'certificatePrinting') {
      registration.resourceUsage.certificates.push(resourceSummary);
    }
  }
  
  await registration.save();

  res.status(201).json({
    success: true,
    message: `${resourceTypeDisplay} usage recorded successfully`,
    data: resource
  });
});

/**
 * @desc    Get recent resource scans
 * @route   GET /api/events/:eventId/resources/scans
 * @access  Private
 */
exports.getRecentScans = asyncHandler(async (req, res, next) => {
  // Get eventId from either params or query
  let eventId = req.params.eventId || req.query.eventId;
  const { type, limit = 10 } = req.query;

  // Validate inputs
  if (!eventId) {
    return next(createApiError(400, 'Event ID is required'));
  }

  // Fetch resource settings for the event once, if needed for formatting
  let foodSettings = null;
  if (!type || type === 'food' || type === 'all') {
    const cached = _foodSettingsCache.get(eventId);
    if (cached && cached.expires > Date.now()) {
      foodSettings = cached.data;
    } else {
    try {
        const settingDoc = await ResourceSetting.findOne({ event: eventId, type: 'food' })
          .select('settings')
          .lean();
        foodSettings = settingDoc?.settings || null;
        _foodSettingsCache.set(eventId, { data: foodSettings, expires: Date.now() + 5 * 60 * 1000 }); // 5-min TTL
      } catch (err) {
        console.error('[getRecentScans] Error fetching food settings:', err.message);
      }
    }
  }

  // Function to format meal name using fetched settings
  const formatMealName = (optionId) => {
    if (!foodSettings || !optionId || typeof optionId !== 'string') return optionId || 'Unknown';
    const parts = optionId.split('_');
    if (parts.length < 2) return optionId; // Invalid format
    const dayIndex = parseInt(parts[0], 10);
    const mealName = parts.slice(1).join('_'); // Handle meal names with underscores

    const day = foodSettings.days?.[dayIndex];
    if (!day) return mealName; // Day not found

    const meal = day.meals?.find(m => m.name === mealName);
    if (!meal) return mealName; // Meal not found

    const dayDate = new Date(day.date);
    const formattedDate = dayDate.toLocaleDateString();
    return `${meal.name} (${formattedDate})`;
  };

  console.log(`Finding recent resource scans for event ${eventId}, type: ${type || 'all'}`);
  
  // Build query
  const query = {
    event: eventId,
    status: 'used'
  };

  if (type) {
    // Use the exact type as provided - mapping happens on the client
    query.type = type;
  }

  console.log('Resource scan query:', JSON.stringify(query));

  // Find recent resources with detailed population
  const resources = await Resource.find(query)
    .sort({ actionDate: -1 })
    .limit(parseInt(limit))
    .select('actionDate type resourceOption resourceOptionName registrationId firstName lastName categoryName categoryColor')
    .lean();

  console.log(`Found ${resources.length} recent scans`);
  
  if (resources.length > 0) {
    console.log('Sample scan resource:', JSON.stringify(resources[0]));
  }

  // Build kit and certificate maps similar to food
  const kitMap = {};
  let kitSettingsDoc = null;
  if (!type || type === 'kitBag' || type === 'all') {
    try {
      kitSettingsDoc = await ResourceSetting.findOne({ event: eventId, type: 'kitBag' })
        .select('settings')
        .lean();
      kitSettingsDoc?.settings?.items?.forEach(item => {
        if (item._id) kitMap[item._id.toString()] = item.name;
        if (item.id) kitMap[item.id.toString ? item.id.toString() : item.id] = item.name;
        kitMap[item.name] = item.name;
      });
    } catch (err) {
      console.error('[getRecentScans] Error fetching kit settings:', err.message);
    }
  }

  const certMap = {};
  if (!type || type === 'certificate' || type === 'certificatePrinting' || type === 'all') {
    try {
      // Certificate Printing templates
      const certPrintDoc = await ResourceSetting.findOne({ event: eventId, type: 'certificatePrinting' })
        .select('certificatePrintingTemplates settings.types')
        .lean();
      const printingTemplates = certPrintDoc?.certificatePrintingTemplates || certPrintDoc?.settings?.types || [];
      printingTemplates.forEach(tpl => {
        const key = (tpl._id || tpl.id || tpl.name).toString();
        certMap[key] = tpl.name;
      });

      // Certificate issuance types
      const certIssueDoc = await ResourceSetting.findOne({ event: eventId, type: 'certificate' })
        .select('settings.types')
        .lean();
      const issueTypes = certIssueDoc?.settings?.types || [];
      issueTypes.forEach(tpl => {
        const key = (tpl._id || tpl.id || tpl.name).toString();
        certMap[key] = tpl.name;
      });
    } catch (err) {
      console.error('[getRecentScans] Error fetching certificate settings:', err.message);
    }
  }

  // Format the response for consistent client-side handling
  const formattedResources = resources.map(resource => {
    // Get registration info safely
    const registration = resource.registration || {};
    const personalInfo = registration.personalInfo || {};
    const category = registration.category || {};
    
    // Get user info safely
    const actionBy = resource.actionBy?.name || 'Scan';
    
    // Determine the correct resource option name
    let resourceOptionName = resource.resourceOption || resource.details?.option || 'Unknown';
    if (resource.type === 'food') {
      resourceOptionName = formatMealName(resource.resourceOption || resource.details?.option);
    } else if (resource.type === 'kitBag') {
      resourceOptionName = kitMap[resource.details?.option] || resource.resourceOptionName || resourceOptionName;
    } else if (resource.type === 'certificate' || resource.type === 'certificatePrinting') {
      const certKey = resource.details?.option || resource.resourceOption;
      resourceOptionName = certMap[certKey] || resource.resourceOptionName || resourceOptionName;
    } // Add similar logic for other types if needed

    return {
      _id: resource._id,
      timestamp: resource.actionDate || resource.createdAt,
      resourceType: resource.type,
      details: resource.details || {},
      status: resource.status,
      resourceOption: {
        _id: resource.resourceOption,
        name: resource.resourceOptionName || resourceOptionName
      },
      registration: {
        registrationId: resource.registrationId,
        firstName: resource.firstName,
        lastName: resource.lastName,
        category: { name: resource.categoryName, color: resource.categoryColor }
      },
      actionBy,
      createdAt: resource.createdAt
    };
  });

  res.status(200).json({
    success: true,
    count: formattedResources.length,
    data: formattedResources
  });
});

/**
 * @desc    Get all resources used by a registration
 * @route   GET /api/events/:eventId/registrations/:registrationId/resources
 * @access  Private
 */
const getResourceUsage = asyncHandler(async (req, res) => {
  // ... existing getResourceUsage code ...
});

/**
 * @desc    Void a specific resource usage record
 * @route   PUT /api/events/:eventId/registrations/:registrationId/resources/:resourceUsageId/void
 * @access  Private (Staff/Admin)
 */
const voidResourceUsage = asyncHandler(async (req, res, next) => {
  const { eventId, registrationId, resourceUsageId } = req.params;

  // Log received IDs for debugging
  console.log('[voidResourceUsage] Received:', { eventId, registrationId, resourceUsageId });

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(eventId) || 
      !mongoose.Types.ObjectId.isValid(registrationId) || 
      !mongoose.Types.ObjectId.isValid(resourceUsageId)) {
    console.error('[voidResourceUsage] Invalid ID format:', { eventId, registrationId, resourceUsageId });
    return next(createApiError(400, 'Invalid ID format'));
  }

  // Find the specific resource usage record
  const resourceUsage = await Resource.findById(resourceUsageId);

  if (!resourceUsage) {
    console.error('[voidResourceUsage] Resource usage record not found:', resourceUsageId);
    return next(createApiError(404, 'Resource usage record not found'));
  }

  // Void ALL matching resources for this registration/event/type/option
  await Resource.updateMany(
    {
      event: resourceUsage.event,
      registration: resourceUsage.registration,
      type: resourceUsage.type,
      "details.option": resourceUsage.details.option,
      status: "used",
      isVoided: { $ne: true }
    },
    {
      $set: {
        status: "voided",
        isVoided: true,
        voidedAt: new Date(),
        voidedBy: req.user._id,
        updatedAt: new Date()
      }
    }
  );

  // Re-fetch the voided resource for response
  const updatedResource = await Resource.findById(resourceUsageId);

  // Log the action
  logger.info(`All matching resource usages voided for registration ${resourceUsage.registration}, event ${resourceUsage.event}, type ${resourceUsage.type}, option ${resourceUsage.details.option} by user ${req.user.id}`);

  // Return the updated record
  sendSuccess(res, 200, 'All matching resource usages voided successfully', updatedResource);
});

/**
 * Helper function to generate default settings for different resource types
 */
const defaultResourceSettings = (type) => {
  // First convert type to lowercase for case-insensitive comparison
  const normalizedType = type ? type.toLowerCase() : '';
  
  // Check against lowercase versions of DB types
  switch (normalizedType) { 
    case 'food':
      return { enabled: true, meals: [], days: [] }; 
    case 'kitbag': // Lowercase version of kitBag
    case 'kit':    // Also handle 'kit'
    case 'kits':   // Also handle 'kits'
      return { enabled: true, items: [] };
    case 'certificate': // Lowercase version of original
    case 'certificates': // Also handle 'certificates'
      return { enabled: true, types: [] };
    case 'certificateprinting':
      return { enabled: true, templates: [] };
    default:
      console.log(`[defaultResourceSettings] Unknown resource type: ${type}, using default enabled:false`);
      return { enabled: false }; 
  }
};

/**
 * @desc    Get statistics for a specific resource type/option
 * @route   GET /api/events/:id/resources/stats
 * @access  Private
 */
exports.getResourceStats = asyncHandler(async (req, res, next) => {
  const { id: eventId } = req.params; // Get eventId from route parameter
  const { type, optionId } = req.query; // Get type and optionId from query parameters

  // Validate required parameters
  if (!eventId || !type || !optionId) {
    return next(createApiError(400, 'Event ID, resource type, and resource option ID are required in query parameters.'));
  }

  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return next(createApiError(400, 'Invalid Event ID format.'));
  }

  // Normalize type for database query
  let dbType = type.toLowerCase();
  if (dbType === 'kits' || dbType === 'kit') dbType = 'kitBag';
  if (dbType === 'certificates') dbType = 'certificate';
  if (dbType === 'certificateprinting') dbType = 'certificatePrinting';

  // Convert validation array to lowercase for case-insensitive comparison
  const validTypes = ['food', 'kitbag', 'certificate', 'certificateprinting'].map(t => t.toLowerCase());
  if (!validTypes.includes(dbType.toLowerCase())) {
    return next(createApiError(400, `Invalid resource type: ${type}. Must be one of: food, kit, certificate, or certificatePrinting`));
  }

  try {
    const baseQuery = {
      event: eventId,
      type: dbType,
      'details.option': optionId, // Corrected field name
      isVoid: { $ne: true } // Exclude voided resources
    };

    // Calculate total count
    const totalCount = await Resource.countDocuments(baseQuery);

    // Calculate count for today
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // Start of tomorrow

    const todayQuery = {
      ...baseQuery,
      timestamp: {
        $gte: today,
        $lt: tomorrow
      }
    };
    const todayCount = await Resource.countDocuments(todayQuery);

    // Calculate unique attendees
    // We need to group by registration ID and count the distinct groups
    const uniqueAttendeesResult = await Resource.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$registration' } }, // Group by registration reference
      { $count: 'uniqueCount' }          // Count the number of groups
    ]);
    
    const uniqueAttendeesCount = uniqueAttendeesResult.length > 0 ? uniqueAttendeesResult[0].uniqueCount : 0;

    const statsData = {
      count: totalCount,
      today: todayCount,
      uniqueAttendees: uniqueAttendeesCount
    };

    sendSuccess(res, 200, statsData, 'Resource statistics retrieved successfully');

  } catch (error) {
    logger.error(`Error getting resource stats for event ${eventId}, type ${type}, option ${optionId}: ${error.message}`);
    next(createApiError(500, 'Error retrieving resource statistics', error.message));
  }
});

/**
 * @desc    Get a single resource (usage log)
 * @route   GET /api/resources/:id
 * @access  Private
 */
exports.getResourceById = asyncHandler(async (req, res, next) => {
  const resource = await Resource.findById(req.params.id)
    .populate('registration', 'registrationId firstName lastName email')
    .populate('issuedBy', 'name email')
    .populate('voidedBy', 'name email');

  if (!resource) {
    return next(createApiError(404, `Resource not found with id of ${req.params.id}`));
  }

  res.status(200).json({
    success: true,
    data: resource
  });
});

/**
 * @desc    Get aggregated resource usage statistics for a specific event
 * @route   GET /api/events/:id/resources/statistics
 * @access  Private
 */
const getEventResourceStatistics = asyncHandler(async (req, res, next) => {
  // The event ID should be available from the route parameter :id
  // due to how this route is defined in events.routes.js
  const eventId = req.params.id; 

  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
    return next(createApiError(400, 'Invalid or missing Event ID in route parameters.'));
  }

  try {
    // Aggregation pipeline for resource statistics
    const statsPipeline = [
      {
        $match: {
          event: new mongoose.Types.ObjectId(eventId),
          isVoided: { $ne: true } // Exclude voided transactions
        }
      },
      {
        $facet: {
          "totalUsage": [
            { $count: "count" }
          ],
          "byType": [
            { $group: { _id: "$type", count: { $sum: 1 } } },
            { $project: { _id: 0, type: "$_id", count: "$count" } }
          ],
          "byDetailFood": [
            { $match: { type: 'food' } },
            { $group: { _id: "$details.meal", count: { $sum: 1 } } }, // Group by meal name
            { $project: { _id: 0, meal: "$_id", count: "$count" } }
          ],
          "byDetailKit": [
            { $match: { type: 'kitBag' } },
            { $group: { _id: "$details.item", count: { $sum: 1 } } }, // Group by kit item name
            { $project: { _id: 0, item: "$_id", count: "$count" } }
          ],
          "byDetailCertificate": [
            { $match: { type: 'certificate' } },
            { $group: { _id: "$details.certificateType", count: { $sum: 1 } } }, // Group by certificate type
            { $project: { _id: 0, certificateType: "$_id", count: "$count" } }
          ],
          "byDetailCertificatePrinting": [
            { $match: { type: 'certificatePrinting' } },
            { $group: { _id: "$details.option", count: { $sum: 1 } } }, // Group by template/option id
            { $project: { _id: 0, template: "$_id", count: "$count" } }
          ],
           "byDay": [
             { $group: { 
                 _id: { $dateToString: { format: "%Y-%m-%d", date: "$actionDate" } }, 
                 count: { $sum: 1 } 
             } },
             { $sort: { _id: 1 } }, // Sort by date
             { $project: { _id: 0, date: "$_id", count: "$count" } }
          ]
        }
      }
    ];

    const results = await Resource.aggregate(statsPipeline);

    // Process the results from the $facet stage
    const statistics = {
      totalUsage: results[0]?.totalUsage[0]?.count || 0,
      byType: results[0]?.byType || [],
      byDetail: {
        food: results[0]?.byDetailFood || [],
        kitBag: results[0]?.byDetailKit || [],
        certificate: results[0]?.byDetailCertificate || [],
        certificatePrinting: results[0]?.byDetailCertificatePrinting || []
      },
      byDay: results[0]?.byDay || []
    };

    // Convert arrays of {type: count} to objects {type1: count1, type2: count2}
    statistics.byType = statistics.byType.reduce((acc, item) => {
      acc[item.type] = item.count;
      return acc;
    }, {});
    statistics.byDetail.food = statistics.byDetail.food.reduce((acc, item) => {
        acc[item.meal || 'Unknown'] = item.count;
        return acc;
    }, {});
     statistics.byDetail.kitBag = statistics.byDetail.kitBag.reduce((acc, item) => {
        acc[item.item || 'Unknown'] = item.count;
        return acc;
    }, {});
     statistics.byDetail.certificate = statistics.byDetail.certificate.reduce((acc, item) => {
        acc[item.certificateType || 'Unknown'] = item.count;
        return acc;
    }, {});
     statistics.byDetail.certificatePrinting = statistics.byDetail.certificatePrinting.reduce((acc, item) => {
        acc[item.template || 'Unknown'] = item.count;
        return acc;
    }, {});

    sendSuccess(res, 200, 'Resource usage statistics retrieved successfully', statistics);

  } catch (error) {
    console.error(`Error fetching resource statistics for event ${eventId}:`, error);
    next(createApiError(500, 'Server error fetching resource statistics', error.message));
  }
});

/**
 * @desc    Export resource usage logs for an event
 * @route   GET /api/events/:id/resources/export
 * @access  Private
 */
const exportResourceUsage = asyncHandler(async (req, res, next) => {
  const { id: eventId } = req.params; // Get eventId from route parameter
  const { type, format = 'excel' } = req.query; // Get type and format from query

  // Validate inputs
  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
    return next(createApiError(400, 'Invalid or missing Event ID.'));
  }
  if (!type) {
    return next(createApiError(400, 'Resource type query parameter is required (e.g., type=food).'));
  }

  // Normalize requested type to the exact value stored in DB (camel-case where applicable)
  let dbType;
  switch (type.toLowerCase()) {
    case 'food':
      dbType = 'food';
      break;
    case 'kit':
    case 'kits':
    case 'kitbag':
    case 'kitbags':
      dbType = 'kitBag';
      break;
    case 'certificate':
    case 'certificates':
      dbType = 'certificate';
      break;
    case 'certificateprinting':
    case 'certificate-printing':
      dbType = 'certificatePrinting';
      break;
    default:
      dbType = type; // use as-is – validation below will catch unsupported types
  }

  const validDbTypes = ['food', 'kitBag', 'certificate', 'certificatePrinting'];
  if (!validDbTypes.includes(dbType)) {
    return next(createApiError(400, `Invalid resource type: ${type}`));
  }

  try {
    // Fetch all non-voided resources of the specified type for the event
    const resources = await Resource.find({ 
      event: eventId, 
      type: dbType, 
      isVoided: { $ne: true }
    })
    .populate('registration', 'registrationId personalInfo') // Populate attendee info
    .populate('actionBy', 'name email') // Populate who performed the action
    .sort({ actionDate: -1 }) // Sort by most recent first
    .lean(); // Use lean for performance

    if (resources.length === 0) {
        // Use sendSuccess for consistency, indicating no data found
        return sendSuccess(res, 404, `No ${type} usage logs found for this event to export.`); 
    }

    // --- Generate File based on format --- 
    if (format.toLowerCase() === 'excel') {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'OnSite Atlas';
        workbook.created = new Date();
        const worksheet = workbook.addWorksheet(`${type}_Usage_Log`);

        // Define Columns dynamically based on type?
        worksheet.columns = [
            { header: 'Timestamp', key: 'timestamp', width: 25 },
            { header: 'Attendee Reg ID', key: 'attendeeRegId', width: 20 },
            { header: 'Attendee Name', key: 'attendeeName', width: 30 },
            { header: 'Resource Detail', key: 'detail', width: 30 }, // Meal, Kit Item, Cert Type
            { header: 'Issued By Name', key: 'issuedByName', width: 30 },
            { header: 'Issued By Email', key: 'issuedByEmail', width: 30 },
        ];
        
        // Style Header
        worksheet.getRow(1).font = { bold: true };
        
        // Add Data Rows
        resources.forEach(log => {
            const attendeeName = log.registration?.personalInfo 
                ? `${log.registration.personalInfo.firstName || ''} ${log.registration.personalInfo.lastName || ''}`.trim()
                : 'N/A';
            
            let detailValue = log.resourceOptionName || 'N/A';
            if (!detailValue || /^[a-f0-9]{24}$/i.test(String(detailValue))) {
                if (log.details) {
                  detailValue = log.details.meal || log.details.item || log.details.certificateType || log.details.option || detailValue;
                }
            }

            worksheet.addRow({
                timestamp: log.actionDate ? new Date(log.actionDate).toLocaleString() : 'N/A',
                attendeeRegId: log.registration?.registrationId || 'N/A',
                attendeeName: attendeeName,
                detail: detailValue,
                issuedByName: log.actionBy?.name || 'N/A',
                issuedByEmail: log.actionBy?.email || 'N/A',
            });
        });

        // Set Response Headers for Excel
        const filename = `${type}_usage_${eventId}_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filename}"`
        );

        // Write workbook to response
        await workbook.xlsx.write(res);
        res.end();

    } else if (format.toLowerCase() === 'csv') {
        // Implement CSV generation if needed
        // Example: Use a library or manually construct CSV string
        let csvData = "Timestamp,Attendee Reg ID,Attendee Name,Resource Detail,Issued By Name,Issued By Email\n"; // Header
        resources.forEach(log => {
            const attendeeName = log.registration?.personalInfo ? `\"${log.registration.personalInfo.firstName || ''} ${log.registration.personalInfo.lastName || ''}\"` : 'N/A';
            let detailValue = log.resourceOptionName || 'N/A';
            if (!detailValue || /^[a-f0-9]{24}$/i.test(String(detailValue))) {
                if (log.details) {
                  detailValue = log.details.meal || log.details.item || log.details.certificateType || log.details.option || detailValue;
                }
            }
            // Escape commas in detailValue if necessary
            detailValue = `\"${String(detailValue).replace(/"/g, '""' )}\"`; 

            csvData += `${log.actionDate ? new Date(log.actionDate).toISOString() : 'N/A'},`;
            csvData += `${log.registration?.registrationId || 'N/A'},`;
            csvData += `${attendeeName},`;
            csvData += `${detailValue},`;
            csvData += `${log.actionBy?.name || 'N/A'},`;
            csvData += `${log.actionBy?.email || 'N/A'}\n`;
        });
        
        const filename = `${type}_usage_${eventId}_${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(csvData);

    } else {
      // Unsupported format
      return next(createApiError(400, `Unsupported export format: ${format}. Use 'excel' or 'csv'.`));
    }

  } catch (error) {
    logger.error(`Error exporting ${type} usage for event ${eventId}: ${error.message}`);
    next(createApiError(500, `Failed to export ${type} usage log.`, error.message));
  }
});

/**
 * @desc    Upload a certificate template file for the resource settings.
 * @route   POST /api/resources/certificate-template/upload
 * @access  Private
 */
const uploadCertificateTemplateFile = asyncHandler(async (req, res, next) => {
  const eventIdFromBody = req.body.eventId; // Extracted from form fields

  if (!req.files || !req.files.templateFile) {
    logger.warn('[uploadCertificateTemplateFile] No file uploaded. req.files is: %o', req.files);
    return next(createApiError('No templateFile was uploaded in the form.', 400));
  }
  const templateFile = req.files.templateFile;

  if (!eventIdFromBody) {
    logger.warn('[uploadCertificateTemplateFile] Event ID is missing from the request body.');
    return next(createApiError('Event ID is required to upload a template.', 400));
  }
  
  if (!mongoose.Types.ObjectId.isValid(eventIdFromBody)) {
      logger.warn(`[uploadCertificateTemplateFile] Invalid Event ID format: ${eventIdFromBody}`);
      return next(createApiError('Invalid Event ID format.', 400));
  }

  // --- File Validation ---
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (templateFile.size > maxSize) {
    logger.warn(`[uploadCertificateTemplateFile] File size (${templateFile.size}) exceeds max size (${maxSize})`);
    return next(createApiError(`File size exceeds the ${maxSize / (1024 * 1024)}MB limit.`, 400));
  }

  const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
  const fileExt = path.extname(templateFile.name).toLowerCase();

  if (!allowedMimeTypes.includes(templateFile.mimetype) || !allowedExtensions.includes(fileExt)) {
    logger.warn(`[uploadCertificateTemplateFile] Invalid file type: ${templateFile.mimetype} or extension: ${fileExt}`);
    return next(createApiError('Invalid file type. Only JPG, PNG, PDF are allowed.', 400));
  }
  // --- End File Validation ---

  // --- File Saving Logic ---
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const newFileName = `template-${uniqueSuffix}${fileExt}`;
  
  // Corrected: Point to the /server/public/uploads/certificate_templates directory
  const uploadDir = buildUploadDir('certificate_templates');
  const newFilePath = path.join(uploadDir, newFileName);

  let templatePdfUrl = null;
  let templateImageUrl = null;
  let templateUrl = null;

  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      logger.info(`[uploadCertificateTemplateFile] Created directory: ${uploadDir}`);
    }

    await templateFile.mv(newFilePath);
    logger.info(`[uploadCertificateTemplateFile] File moved successfully to: ${newFilePath}`);

    templateUrl = buildFileUrl('certificate_templates', newFileName);

    // If PDF, convert to PNG for preview/background
    if (fileExt === '.pdf') {
      try {
        const pngPath = await convertPdfToPng(newFilePath, uploadDir, `template-${uniqueSuffix}`);
        templatePdfUrl = templateUrl;
        templateImageUrl = buildFileUrl('certificate_templates', path.basename(pngPath));
        // Get PNG dimensions
        const image = sharp(pngPath);
        const metadata = await image.metadata();
        var imageWidth = metadata.width;
        var imageHeight = metadata.height;
        var imageAspect = imageWidth / imageHeight;
      } catch (convErr) {
        logger.error(`[uploadCertificateTemplateFile] PDF-to-PNG conversion failed: ${convErr.message}`);
        return next(createApiError('PDF uploaded, but failed to generate preview image. Please check the PDF format or contact support.', 500));
      }
    } else if (fileExt === '.png' || fileExt === '.jpg' || fileExt === '.jpeg') {
      // For images, use as both templateImageUrl and templateUrl
      templateImageUrl = templateUrl;
      templatePdfUrl = null;
      // Get image dimensions
      try {
        const image = sharp(newFilePath);
        const metadata = await image.metadata();
        var imageWidth = metadata.width;
        var imageHeight = metadata.height;
        var imageAspect = imageWidth / imageHeight;
      } catch (imgErr) {
        fs.unlinkSync(newFilePath);
        logger.error(`[uploadCertificateTemplateFile] Image dimension read failed: ${imgErr.message}`);
        return next(createApiError('Failed to read image dimensions for validation. Please upload a valid PNG/JPG.', 400));
      }
    }

    // Calculate warning for non-A4 landscape aspect ratio
    let aspectWarning = null;
    const expectedAspect = 297 / 210; // A4 landscape
    if (typeof imageAspect !== 'undefined' && Math.abs(imageAspect - expectedAspect) > 0.05) {
      aspectWarning = 'Warning: Uploaded template is not A4 landscape (297x210mm, aspect ratio ≈ 1.414). Field alignment and printing may be unreliable.';
    }

    res.status(200).json({
      success: true,
      message: 'Certificate template uploaded successfully.',
      data: {
        templateUrl: templateUrl, // legacy, for compatibility
        templatePdfUrl: templatePdfUrl,
        templateImageUrl: templateImageUrl,
        fileName: templateFile.name, 
        fileSize: templateFile.size,
        fileType: templateFile.mimetype,
        imageWidth: imageWidth,
        imageHeight: imageHeight,
        imageAspect: imageAspect,
        aspectWarning: aspectWarning
      }
    });

  } catch (error) {
    logger.error(`[uploadCertificateTemplateFile] Error during file saving process: ${error.message}`, error);
    if (fs.existsSync(newFilePath)) {
        fs.unlink(newFilePath, (unlinkErr) => {
            if (unlinkErr) logger.error(`[uploadCertificateTemplateFile] Failed to delete partially uploaded file on error: ${newFilePath}`, unlinkErr);
        });
    }
    return next(createApiError('File upload failed during server processing.', 500));
  }
  // --- End File Saving Logic ---
});

/**
 * @desc    Generate Certificate PDF
 * @note    Abstract fields in templates (e.g., Abstract.title) are now supported by always fetching the Abstract for the registration (if it exists), even if no abstractId is provided. This allows certificate templates to use Abstract fields for any registration that has an associated abstract.
 * @route   GET /api/resources/events/:eventId/certificate-templates/:templateId/registrations/:registrationId/generate-pdf?background=true|false
 * @access  Private
 * @param   background (optional, default true): if false, only text fields are rendered (for pre-printed certificates)
 */
exports.generateCertificatePdf = asyncHandler(async (req, res, next) => {
    const { eventId, templateId, registrationId } = req.params;
    const { workshopId, abstractId, background = 'true' } = req.query;
    const drawBackground = background !== 'false'; // default true

    if (!mongoose.Types.ObjectId.isValid(eventId) ||
        !mongoose.Types.ObjectId.isValid(templateId) || // templateId is the _id of the template object
        !mongoose.Types.ObjectId.isValid(registrationId)) {
        return next(createApiError(400, 'Invalid Event, Template, or Registration ID'));
    }

    // 1. Fetch ResourceSetting for certificatePrinting
    const resourceSetting = await ResourceSetting.findOne({
        event: eventId,
        type: 'certificatePrinting',
        isEnabled: true
    });

    if (!resourceSetting || !resourceSetting.certificatePrintingTemplates || resourceSetting.certificatePrintingTemplates.length === 0) {
        return next(createApiError(404, 'Certificate printing settings not found or no templates configured for this event.'));
    }

    // 2. Find the specific template
    // Mongoose subdocuments in an array have an _id field by default.
    const template = resourceSetting.certificatePrintingTemplates.id(templateId);

    if (!template) {
        return next(createApiError(404, `Certificate template with ID ${templateId} not found in this event's settings.`));
    }

    // 3. Fetch Registration data
    const registration = await Registration.findById(registrationId)
        .populate('category', 'name') // Populate category name
        .populate('event', 'name startDate endDate venue'); // Populate event details (though eventId is already available)

    if (!registration) {
        return next(createApiError(404, 'Registration not found.'));
    }
    if (registration.event._id.toString() !== eventId) {
        return next(createApiError(400, 'Registration does not belong to the specified event.'));
    }
    
    const event = registration.event; // Already populated

    // 4. Fetch contextual data (Abstract, Workshop) if IDs are provided
    let abstractData = null;
    if (abstractId && mongoose.Types.ObjectId.isValid(abstractId)) {
        abstractData = await Abstract.findById(abstractId).populate('registration');
        if (abstractData && abstractData.registration._id.toString() !== registrationId) {
             return next(createApiError(400, 'Abstract does not belong to the specified registration.'));
        }
    } else {
        // --- ADDED: Always fetch the first Abstract for this registration if it exists ---
        abstractData = await Abstract.findOne({ registration: registrationId, event: eventId });
        // No need to check registration match, as it's by query
    }

    let workshopData = null;
    if (workshopId && mongoose.Types.ObjectId.isValid(workshopId)) {
        workshopData = await Workshop.findById(workshopId);
        // Further validation: check if registration is part of this workshop's attendees/registrations
        const isRegisteredForWorkshop = workshopData && 
            (workshopData.registrations.some(rId => rId.toString() === registrationId) || 
             workshopData.attendees.some(att => att.registration.toString() === registrationId));
        if (!isRegisteredForWorkshop) {
            return next(createApiError(400, 'Registration is not associated with the specified workshop.'));
        }
    }

    try {
        // --- PDFKit: Always use A4 landscape (force with array, no layout flag) ---
        const PAGE_WIDTH = 841.89; // A4 landscape width in points
        const PAGE_HEIGHT = 595.28; // A4 landscape height in points
        const doc = new pdfkit({
            size: [PAGE_WIDTH, PAGE_HEIGHT]
            // layout: 'landscape' // REMOVE this line!
        });

        // Pipe the PDF to the response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="certificate-${registrationId}-${templateId}.pdf"`);
        doc.pipe(res);

        // Add background image, scaled to fit full page, only if requested
        let absoluteBackgroundPath;
        if (drawBackground && template.templateUrl) {
            logger.info(`[generateCertificatePdf] Template URL found: ${template.templateUrl}`);
            logger.info(`[generateCertificatePdf] Current __dirname: ${__dirname}`);
            const serverBasePath = path.join(__dirname, '..', '..');
            logger.info(`[generateCertificatePdf] Calculated server base path: ${serverBasePath}`);

            if (template.templateUrl.startsWith('/')) {
                const relativePathFromPublic = template.templateUrl.substring(1);
                absoluteBackgroundPath = path.join(serverBasePath, 'public', relativePathFromPublic);
                logger.info(`[generateCertificatePdf] Constructed absoluteBackgroundPath (from relative): ${absoluteBackgroundPath}`);
            } else {
                if (!template.templateUrl.startsWith('http')) {
                    absoluteBackgroundPath = path.join(serverBasePath, 'public', template.templateUrl);
                    logger.info(`[generateCertificatePdf] Constructed absoluteBackgroundPath (assumed relative, missing leading '/'): ${absoluteBackgroundPath}`);
                } else {
                    logger.warn(`[generateCertificatePdf] Template URL is an absolute URL: ${template.templateUrl}. Direct file system access not implemented for remote URLs.`);
                    // Handle http/https URLs if necessary (e.g. download to temp file)
                    // For now, this will lead to an error below if not handled.
                }
            }
        }
        const fileExists = drawBackground && absoluteBackgroundPath ? fs.existsSync(absoluteBackgroundPath) : false;
        if (drawBackground) {
        if (!absoluteBackgroundPath || !fileExists) {
            doc.fontSize(12).text(`Error: Certificate template background image not found. Path: ${absoluteBackgroundPath || 'not specified'}. Please contact support.`, 50, 50);
            doc.end();
                return;
        }
        try {
                // Always scale background to full A4 landscape
                doc.image(absoluteBackgroundPath, 0, 0, { width: PAGE_WIDTH, height: PAGE_HEIGHT });
        } catch (bgImgError) {
            logger.error(`[generateCertificatePdf] Error processing background image at ${absoluteBackgroundPath}: ${bgImgError.message}`, { stack: bgImgError.stack });
            doc.fontSize(12).text(`Error: Could not process certificate background image. Path: ${absoluteBackgroundPath}. Details: ${bgImgError.message}. Please contact support.`, 50, 50);
            doc.end();
                return;
            }
        }

        // --- Draw Fields ---
        for (const field of template.fields) {
            if (field.type !== 'text') continue; // Only handle text for now
            doc.save();
            const xPos = convertToPoints(field.position.x, template.templateUnit);
            const yPos = convertToPoints(field.position.y, template.templateUnit);
            const rotation = field.style?.rotation || 0;
            let textContent = field.staticText || '';
            if (field.dataSource && !field.dataSource.toLowerCase().startsWith('static.')) {
                 textContent = await getDataSourceValue(field.dataSource, registration, event, abstractData, workshopData);
            } else if (field.dataSource && field.dataSource.toLowerCase().startsWith('static.')) {
                textContent = field.dataSource.substring('static.'.length);
            }
            // Debug log for each field
            logger.info(`[generateCertificatePdf] Field: ${field.label}, DataSource: ${field.dataSource}, Value: ${textContent}`);
            let fontName = field.style.font || 'Helvetica';
            if (field.style.fontWeight === 'bold' && !fontName.toLowerCase().includes('bold')) {
                if (fontName === 'Helvetica') fontName = 'Helvetica-Bold';
                else if (fontName === 'Times-Roman') fontName = 'Times-Bold';
            }
            try {
                 doc.font(fontName);
            } catch (e) {
                logger.warn(`Failed to set font: ${fontName} for field ${field.label}. Defaulting to Helvetica.`);
                doc.font('Helvetica');
            }
            doc.fontSize(field.style.fontSize || 12);
            doc.fillColor(field.style.color || '#000000');
            const textOptions = {
                align: field.style.align || 'left',
            };
            if (field.style.maxWidth) {
                textOptions.width = convertToPoints(field.style.maxWidth, template.templateUnit);
            }
            if (rotation !== 0) {
                doc.translate(xPos, yPos);
                doc.rotate(rotation);
                doc.text(textContent || '', 0, 0, textOptions);
            } else {
                doc.text(textContent || '', xPos, yPos, textOptions);
            }
            doc.restore();
        }
        // Remove debug info line for production
        // doc.fontSize(8).fillColor('#888888').text(`DEBUG: Page size: ${PAGE_WIDTH}x${PAGE_HEIGHT}pt, forced landscape`, 10, PAGE_HEIGHT - 20);
        doc.end();

    } catch (error) {
        logger.error('Error generating certificate PDF:', error);
        return next(createApiError(500, 'Failed to generate certificate PDF.'));
    }
});

// Utility to convert units to PDF points
function convertToPoints(value, unit = 'pt') {
  if (!value) return 0;
  if (unit === 'pt') return value;
  if (unit === 'mm') return value * 2.83465;
  if (unit === 'cm') return value * 28.3465;
  if (unit === 'in') return value * 72;
  if (unit === 'px') return value * 0.75; // assuming 96dpi
  return value;
}

/**
 * Utility to resolve a data source string (dot notation) from registration, event, abstract, or workshop.
 * Supports composite fields like 'Registration.personalInfo.fullName'.
 * @param {string} dataSource - e.g., 'Registration.personalInfo.firstName', 'Event.name', etc.
 * @param {object} registration - Registration document (populated)
 * @param {object} event - Event document (populated)
 * @param {object|null} abstractData - Abstract document (optional)
 * @param {object|null} workshopData - Workshop document (optional)
 * @returns {Promise<string>} - The resolved value as a string (empty if not found)
 */
async function getDataSourceValue(dataSource, registration, event, abstractData, workshopData) {
  if (!dataSource || typeof dataSource !== 'string') return '';
  try {
    // Support composite fields (e.g., fullName)
    if (dataSource === 'Registration.personalInfo.fullName') {
      const first = registration?.personalInfo?.firstName || '';
      const last = registration?.personalInfo?.lastName || '';
      return `${first} ${last}`.trim();
    }
    if (dataSource === 'Registration.category.name') {
      return registration?.category?.name || '';
    }
    if (dataSource === 'Event.name') {
      return event?.name || '';
    }
    if (dataSource === 'Event.venue.name') {
      return event?.venue?.name || '';
    }
    if (dataSource === 'Event.venue.city') {
      return event?.venue?.city || '';
    }
    if (dataSource === 'Event.startDate') {
      return event?.startDate ? new Date(event.startDate).toLocaleDateString() : '';
    }
    if (dataSource === 'Event.endDate') {
      return event?.endDate ? new Date(event.endDate).toLocaleDateString() : '';
    }
    if (dataSource === 'Abstract.title') {
      return abstractData?.title || '';
    }
    if (dataSource === 'Abstract.authors') {
      return abstractData?.authors || '';
    }
    if (dataSource === 'Abstract.presentingAuthor') {
      return abstractData?.presentingAuthor || '';
    }
    if (dataSource === 'Workshop.name') {
      return workshopData?.name || '';
    }
    // Generic dot notation (e.g., Registration.personalInfo.email)
    let root = null;
    if (dataSource.startsWith('Registration.')) root = registration;
    else if (dataSource.startsWith('Event.')) root = event;
    else if (dataSource.startsWith('Abstract.')) root = abstractData;
    else if (dataSource.startsWith('Workshop.')) root = workshopData;
    if (root) {
      const path = dataSource.split('.').slice(1); // Remove root
      let value = root;
      for (const key of path) {
        if (value && typeof value === 'object' && key in value) value = value[key];
        else return '';
      }
      if (typeof value === 'string' || typeof value === 'number') return String(value);
      if (value instanceof Date) return value.toLocaleDateString();
      return '';
    }
    // Fallback: return empty string
    return '';
  } catch (err) {
    logger.warn(`[getDataSourceValue] Failed to resolve dataSource '${dataSource}': ${err.message}`);
    return '';
  }
}

// Utility: Ensure all categories for an event have entitlements for all meals
async function ensureMealEntitlementsForAllCategories(eventId, meals) {
  const Category = require('../models/Category');
  const categories = await Category.find({ event: eventId });
  const validMealIds = new Set(meals.map(m => m._id.toString()));
  for (const category of categories) {
    let updated = false;
    // Remove entitlements for meals that no longer exist
    category.mealEntitlements = (category.mealEntitlements || []).filter(e =>
      e.mealId && validMealIds.has(e.mealId.toString())
    );
    // Add missing entitlements
    for (const meal of meals) {
      const mealId = meal._id && meal._id.toString();
      if (!mealId) continue;
      const found = category.mealEntitlements.find(e => e.mealId && e.mealId.toString() === mealId);
      if (!found) {
        category.mealEntitlements.push({ mealId: meal._id, entitled: true });
        updated = true;
        console.log(`[ensureMealEntitlementsForAllCategories] Added entitlement for meal ${meal.name} (${mealId}) to category ${category.name}`);
      }
    }
    if (updated) {
      await category.save();
      console.log(`[ensureMealEntitlementsForAllCategories] Updated category ${category.name} for event ${eventId}`);
    }
  }
}

// Utility: Flatten all meals from all days into a flat array (no duplicates)
function flattenMeals(settings) {
  const allMeals = [];
  const seen = new Set();
  (settings.days || []).forEach(day => {
    (day.meals || []).forEach(meal => {
      // If meal._id is missing, generate one
      if (!meal._id) {
        meal._id = new mongoose.Types.ObjectId();
      }
      // If entitled is missing, set to true by default
      if (meal.entitled === undefined) {
        meal.entitled = true;
      }
      const idStr = meal._id && meal._id.toString();
      if (idStr && !seen.has(idStr)) {
        allMeals.push(meal);
        seen.add(idStr);
      }
    });
  });
  return allMeals;
}

// ... existing code ...
// Insert before module.exports
/**
 * Unified validate+record scan endpoint
 */
async function scanResource(req, res, next) {
  try {
    let { eventId, qrCode, type, optionId } = req.body;
    // Legacy field mappings
    if (!type && req.body.resourceType) type = req.body.resourceType;
    if (!optionId && req.body.resourceOptionId) optionId = req.body.resourceOptionId;
    if (!qrCode && req.body.registrationId) qrCode = req.body.registrationId;

    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) return next(createApiError(400,'eventId required'));
    if (!qrCode) return next(createApiError(400,'qrCode required'));
    if (!type) return next(createApiError(400,'type required'));
    if (!optionId) return next(createApiError(400,'optionId required'));

    // Clean up legacy "0_" prefix for food option IDs (e.g., "0_Breakfast" -> "Breakfast")
    if (type === 'food' && typeof optionId === 'string' && optionId.startsWith('0_')) {
      optionId = optionId.substring(2);
    }

    const registration = await Registration.findOne({
      $or:[{qrCode},{registrationId:qrCode}],
      event:eventId
    }).populate({path:'category',select:'name color permissions mealEntitlements kitItemEntitlements certificateEntitlements'}).lean();
    if (!registration) return next(createApiError(404,'Registration not found'));
    if (registration.status!=='active') return next(createApiError(400,`Registration is ${registration.status}`));
    const category = registration.category;
    if (!category) return next(createApiError(404,'Category missing'));

    const permMap = {food:'meals',kitBag:'kitItems',kits:'kitItems',certificate:'certificates',certificatePrinting:'certificates'};
    let allowed = true;
    if (category.permissions && Object.prototype.hasOwnProperty.call(category.permissions, permMap[type])) {
      allowed = category.permissions[permMap[type]] !== false; // only false blocks
    }
    if (!allowed) return next(createApiError(400,`Category not permitted for ${type}`));

    // Helper: if entitlement list is missing or empty, default to allowing the option
    const entitleCheck = (arr, field) => {
      // If no entitlement list, allow by default
      if (!Array.isArray(arr) || arr.length === 0) return true;
      // Find matching entry (if any)
      const entry = arr.find(e => e[field]?.toString() === optionId);
      // If no specific entry, allow (opt-in model). Only block when entry exists AND explicitly entitled === false
      if (!entry) return true;
      return entry.entitled !== false; // treat missing/true as allowed
    };
    let entitled=true;
    if (type === 'certificatePrinting') {
      entitled = true; // printing station should not be blocked by entitlements
    } else if(type==='food') {
      entitled = entitleCheck(category.mealEntitlements,'mealId');
    } else if(type==='kitBag'||type==='kits') {
      entitled = entitleCheck(category.kitItemEntitlements,'itemId');
    } else if(type==='certificate') {
      entitled = entitleCheck(category.certificateEntitlements,'certificateId');
    }
    if(!entitled) return next(createApiError(400,'Not entitled to this option'));

    // Additional validation: Certificate printing requires at least one approved abstract
    if (type === 'certificatePrinting') {
      const approvedCount = await Abstract.countDocuments({
        event: eventId,
        registration: registration._id,
        status: 'approved'
      });
      if (approvedCount === 0) {
        return next(createApiError(400, 'No approved abstracts found for this registration'));
      }
    }

    const now=new Date();
    let optionName = optionId;
    if (type === 'food') {
      // try cache first
      let foodSettings = _foodSettingsCache.get(eventId)?.data;
      if (!foodSettings) {
        const settingDoc = await ResourceSetting.findOne({ event: eventId, type: 'food' }).select('settings').lean();
        foodSettings = settingDoc?.settings;
        _foodSettingsCache.set(eventId, { data: foodSettings, expires: Date.now() + 5*60*1000 });
      }
      if (foodSettings) {
        foodSettings.days?.forEach(day => {
          day.meals?.forEach(m => {
            if (m._id?.toString() === optionId) {
              const dateStr = day.date ? new Date(day.date).toLocaleDateString('en-GB') : '';
              optionName = dateStr ? `${m.name} (${dateStr})` : m.name;
            }
          });
        });
      }
    }

    if (type === 'kitBag' || type === 'kits' || type === 'certificate' || type === 'certificatePrinting') {
      let cached = _eventOptionCache.get(eventId);
      if (!cached || cached.expires < Date.now()) {
        const evt = await Event.findById(eventId).select('kitItems certificateTypes').lean();
        cached = {
          kitItems: evt?.kitItems || [],
          certificates: evt?.certificateTypes || [],
          expires: Date.now() + 5*60*1000
        };
        _eventOptionCache.set(eventId, cached);
      }

      if (type === 'kitBag' || type === 'kits') {
        const kit = cached.kitItems.find(k=>k._id?.toString()===optionId);
        if (kit) optionName = kit.name;
      } else {
        const cert = cached.certificates.find(c=>c._id?.toString()===optionId);
        if (cert) optionName = cert.name;
      }
    }

    const upsertResult=await Resource.findOneAndUpdate(
      {event:eventId,registration:registration._id,type,resourceOption:optionId,status:'used',isVoided:false},
      {$setOnInsert:{event:eventId,registration:registration._id,type,status:'used','details.option':optionId,resourceOption:optionId,actionDate:now,createdBy:req.user?._id,actionBy:req.user?._id,registrationId:registration.registrationId,firstName:registration.personalInfo?.firstName||'',lastName:registration.personalInfo?.lastName||'',categoryName:category.name,categoryColor:category.color,resourceOptionName: optionName, name: optionName}},
      {new:true,upsert:true,includeResultMetadata:true});

    const wasInserted = Boolean(upsertResult?.lastErrorObject?.upserted);

    if (!wasInserted) {
      // Duplicate scan – always return 400 so the client can decide whether to reprint
      return next(createApiError(400, `${type} already used by this registration`));
    }

    return res.status(201).json({
      success: true,
      data: upsertResult.value
    });
  } catch(err){
    next(err);
  }
}

exports.scanResource = scanResource;
// ... existing code ...

module.exports = {
  getResourceSettings,
  getResources: exports.getResources,
  createResource: exports.createResource,
  updateResourceSettings: exports.updateResourceSettings,
  validateResourceScan: exports.validateResourceScan,
  recordResourceUsage: exports.recordResourceUsage,
  getRecentScans: exports.getRecentScans,
  getResourceTypeStatistics: exports.getResourceTypeStatistics,
  getResourceUsage,
  voidResourceUsage,
  getResourceStats: exports.getResourceStats,
  getEventResourceStatistics,
  getResourceById: exports.getResourceById,
  updateResource: exports.updateResource,
  deleteResource: exports.deleteResource,
  voidResource: exports.voidResource,
  exportResourceUsage,
  uploadCertificateTemplateFile,
  generateCertificatePdf: exports.generateCertificatePdf,
  scanResource: exports.scanResource
}; 