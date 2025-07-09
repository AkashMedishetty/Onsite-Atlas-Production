# Registrant Portal & Badge Generation Workflow Documentation

## Overview
The registrant portal provides a comprehensive self-service interface for event attendees to manage their registration, access event resources, submit abstracts, and download certificates and badges. This documentation covers the complete workflow from authentication through badge generation.

## Table of Contents
1. [Authentication & Access](#authentication--access)
2. [Profile Management](#profile-management)
3. [Dashboard & Event Information](#dashboard--event-information)
4. [Workshop Management](#workshop-management)
5. [Resource Management](#resource-management)
6. [Abstract Submission](#abstract-submission)
7. [Certificate Management](#certificate-management)
8. [Badge Generation & Download](#badge-generation--download)
9. [Payment Integration](#payment-integration)
10. [API Endpoints](#api-endpoints)
11. [Security & Validation](#security--validation)
12. [Implementation Status](#implementation-status)

---

## Authentication & Access

### Login Process
**Endpoint**: `POST /api/registrant-portal/login`

**Authentication Method**: Registration ID + Mobile Number + Event Context

**Implementation Details**:
```javascript
// Login requires three key pieces of information
const { registrationId, mobileNumber, eventId } = req.body;

// Multi-factor validation
1. Registration ID must exist
2. Mobile number must match registration record
3. Event context must be valid
4. Registration must belong to the specified event
```

**Security Features**:
- Event-scoped authentication prevents cross-event access
- JWT tokens with configurable expiration
- HTTP-only cookies for token storage
- Secure cookie settings in production

**Response Format**:
```json
{
  "status": "success",
  "success": true,
  "token": "jwt_token_here",
  "data": {
    "personalInfo": { /* registration data */ },
    "defaultEventId": "event_object_id"
  }
}
```

**Error Handling**:
- Invalid credentials return 401
- Missing event context returns 400
- Database errors return 500

---

## Profile Management

### Get Current Registrant
**Endpoint**: `GET /api/registrant-portal/current`

**Populated Data**:
- Event details (name, dates)
- Category information (name, color)
- Custom field definitions and values

### Update Profile
**Endpoint**: `PUT /api/registrant-portal/profile`

**Updateable Fields**:
- Personal information (firstName, lastName, email, phone)
- Professional details (organization, designation, country)
- Custom field values (validated against field definitions)

**Validation & Security**:
- Custom field IDs validated as ObjectIds
- Field existence verified before updates
- New token generated after successful update
- Populated response with updated data

**Implementation Details**:
```javascript
// Custom field update logic
customFieldValues.forEach(item => {
  const existingFieldIndex = registration.customFields.findIndex(
    field => field.field && field.field.toString() === item.fieldId
  );
  
  if (existingFieldIndex >= 0) {
    registration.customFields[existingFieldIndex].value = item.value;
  } else {
    if (mongoose.Types.ObjectId.isValid(item.fieldId)) {
      registration.customFields.push({
        field: item.fieldId,
        value: item.value
      });
    }
  }
});
```

---

## Dashboard & Event Information

### Dashboard Data
**Endpoint**: `GET /api/registrant-portal/dashboard`

**Query Parameters**:
- `event`: Optional event ID override

**Comprehensive Data Retrieval**:
1. **Registration Details**: Complete profile with populated references
2. **Abstract Submissions**: All abstracts for the event
3. **Payment Information**: Sorted payment history
4. **Resource Usage**: Resource consumption tracking
5. **Announcements**: Latest 10 active announcements

**Security Validations**:
- Registrant ID extracted from JWT context
- Event ID from query or authentication context
- Registration-event matching validation prevents data leakage

**Data Structure**:
```json
{
  "success": true,
  "data": {
    "registration": { /* populated registration */ },
    "abstracts": [ /* abstract submissions */ ],
    "payments": [ /* payment history */ ],
    "resourceUsage": [ /* resource consumption */ ],
    "announcements": [ /* active announcements */ ]
  }
}
```

### Event Details
**Endpoint**: `GET /api/registrant-portal/events/:eventId`

**Features**:
- Event information retrieval by ID
- Optional access control (commented implementation available)
- ObjectId validation

---

## Workshop Management

### Available Workshops
**Endpoint**: `GET /api/registrant-portal/workshops/available`

**Business Logic**:
- Only future workshops displayed
- Capacity calculations with availability
- Registration status per workshop
- Event-scoped workshop filtering

**Response Enhancement**:
```javascript
const workshopsWithAvailability = workshops.map(workshop => {
  const registrationCount = workshop.registrations ? workshop.registrations.length : 0;
  const isRegistered = workshop.registrations && 
    workshop.registrations.some(reg => reg.toString() === req.registrant.id);
  
  return {
    ...workshop.toObject(),
    availableSeats: workshop.capacity - registrationCount,
    isRegistered
  };
});
```

### Workshop Registration
**Endpoint**: `POST /api/registrant-portal/workshops/:workshopId/register`

**Validation Steps**:
1. Registration existence verification
2. Workshop availability in same event
3. Duplicate registration prevention
4. Capacity limit enforcement

**Bidirectional Updates**:
- Workshop registration list updated
- Registrant workshop list updated
- Atomic operations ensure consistency

### Workshop Cancellation
**Endpoint**: `DELETE /api/registrant-portal/workshops/:workshopId/cancel`

**Features**:
- Registration status verification
- Bidirectional cleanup
- Availability restoration

### Registered Workshops
**Endpoint**: `GET /api/registrant-portal/workshops/registered`

**Data Provided**:
- Workshop details with population
- Schedule information
- Location and capacity details

---

## Resource Management

### Resource History
**Endpoint**: `GET /api/registrant-portal/resources/history`

**Features**:
- Complete resource consumption tracking
- Issuer information with population
- Type-based grouping for organization
- Chronological sorting

**Data Organization**:
```javascript
const groupedResources = resourceRecords.reduce((acc, record) => {
  const type = record.resource ? record.resource.type : 'other';
  if (!acc[type]) acc[type] = [];
  acc[type].push(record);
  return acc;
}, {});
```

### Available Resources
**Endpoint**: `GET /api/registrant-portal/resources/available`

**Access Control**:
- Category-based resource filtering
- Usage status tracking
- Permission validation

**Business Logic**:
```javascript
// Category-based filtering
const availableResources = resources.filter(resource => {
  // No restrictions = available to all
  if (!resource.allowedCategories || resource.allowedCategories.length === 0) {
    return true;
  }
  
  // Category membership check
  return resource.allowedCategories.some(
    cat => cat._id.toString() === registration.category._id.toString()
  );
});
```

**Usage Tracking**:
- Historical usage records
- Void status consideration
- Usage date tracking

---

## Abstract Submission

### Abstract Listing
**Endpoint**: `GET /api/registrant-portal/events/:eventId/abstracts`

**Features**:
- Event-scoped abstract retrieval
- Registrant-owned abstracts only
- Chronological sorting

### Abstract Submission
**Endpoint**: `POST /api/registrant-portal/events/:eventId/abstracts`

**Validation Process**:
1. Event ID format validation
2. Registration-event relationship verification
3. Automatic metadata addition

**Data Enhancement**:
```javascript
const abstractData = {
  ...req.body,
  registration: registrantId,
  event: eventId,
  submissionDate: new Date(),
  status: 'submitted'
};
```

### Abstract Retrieval
**Endpoint**: `GET /api/registrant-portal/events/:eventId/abstracts/:abstractId`

**Advanced Features**:
- Category name resolution from event settings
- SubTopic name resolution
- Robust ObjectId matching
- Fallback mechanisms for data integrity

**Category Resolution Logic**:
```javascript
// Multiple matching strategies
let foundCategory = null;

// Primary: ObjectId matching
if (categoryIdString) {
  foundCategory = eventCategories.find(cat => 
    String(cat._id && cat._id.$oid ? cat._id.$oid : cat._id) === categoryIdString
  );
}

// Fallback: String-based topic matching
if (!foundCategory && abstract.topic && typeof abstract.topic === 'string') {
  foundCategory = eventCategories.find(cat => 
    (cat.name || '').toLowerCase().trim() === abstract.topic.toLowerCase().trim()
  );
}
```

### Abstract Updates
**Endpoint**: `PUT /api/registrant-portal/events/:eventId/abstracts/:abstractId`

**Security Features**:
- Critical field protection (registration, event, status)
- Ownership verification
- Validation enforcement

---

## Certificate Management

### Certificate Listing
**Endpoint**: `GET /api/registrant-portal/certificates`

**Status Management**:
- **Issued**: Certificate available for download
- **Processing**: Event ended, certificate being generated
- **Pending**: Event not yet concluded

**Business Logic**:
```javascript
if (registration.certificateIssued) {
  // Certificate ready for download
  status: 'issued'
} else if (moment(registration.event.endDate).isBefore(moment())) {
  // Event ended, processing
  status: 'processing'
} else {
  // Event ongoing
  status: 'pending'
}
```

### Certificate Download
**Endpoint**: `GET /api/registrant-portal/certificates/:id`

**Validation Process**:
1. Certificate ID format validation
2. Ownership verification
3. Issuance status confirmation
4. Event completion verification

**Certificate Data Structure**:
```javascript
const certificateData = {
  participantName: `${registration.personalInfo?.firstName} ${registration.personalInfo?.lastName}`,
  eventName: registration.event?.name,
  eventDate: moment(registration.event?.startDate).format('MMMM DD, YYYY'),
  venue: registration.event?.venue,
  categoryName: registration.category?.name,
  registrationId: registration.registrationId,
  issuedDate: moment(registration.certificateIssuedDate).format('MMMM DD, YYYY'),
  qrCode: `${process.env.FRONTEND_URL}/verify-certificate/${registration.registrationId}`
};
```

---

## Badge Generation & Download

### Badge Download
**Endpoint**: `GET /api/registrant-portal/events/:eventId/registrants/:registrantId/badge`

**Query Parameters**:
- `preview=true`: Inline display for preview

**Security Validations**:
1. Event ID and Registrant ID format validation
2. Registration existence verification
3. Self-access enforcement (logged-in user can only download own badge)
4. Event-registration relationship validation

### Badge Template Resolution

**Priority Order**:
1. **Event Default Template**: Primary source from BadgeTemplate collection
2. **Event Badge Settings**: Fallback configuration

**Template Structure**:
```javascript
const badgeLayoutConfig = {
  orientation: 'portrait',
  size: { width: 3.5, height: 5 },
  unit: 'in',
  background: '#FFFFFF',
  backgroundImage: templateDoc.backgroundImage,
  logoUrl: templateDoc.logo,
  elements: templateDoc.elements.map(el => ({ ...el.toObject() }))
};
```

### QR Code Generation

**Features**:
- High error correction level
- Black modules on white background
- Registration ID as data source
- Error handling with fallback

**Implementation**:
```javascript
qrCodeImage = await qrcode.toDataURL(qrCodeDataString, { 
  errorCorrectionLevel: 'H', 
  margin: 1, 
  color: { 
    dark: '#000000',    // Black modules
    light: '#FFFFFF'    // White background
  }
});
```

### PDF Generation

**Technical Specifications**:
- PDFKit-based generation
- Absolute positioning system
- Unit conversion support (inches, cm, mm)
- Element layering

**Dynamic Content Resolution**:
```javascript
switch (element.fieldType) {
  case 'name': 
    dynamicContent = `${registration.personalInfo.firstName || ''} ${registration.personalInfo.lastName || ''}`.trim(); 
    break;
  case 'organization': 
    dynamicContent = registration.personalInfo.organization || ''; 
    break;
  case 'registrationId': 
    dynamicContent = registration.registrationId || ''; 
    break;
  case 'category': 
    dynamicContent = category ? category.name : ''; 
    break;
  case 'country': 
    dynamicContent = registration.personalInfo.country || ''; 
    break;
  case 'eventName': 
    dynamicContent = event.name || ''; 
    break;
}
```

**Element Types Supported**:
1. **Text Elements**: With font, size, color, alignment
2. **QR Code Elements**: With size and positioning
3. **Image Elements**: With fit, alignment, and scaling options
4. **Line Elements**: With width and color
5. **Shape Elements**: (TODO - rectangles, circles)

**Unit Conversion**:
```javascript
const convertToPixels = (value, unit) => {
  const DPIN = 100; // Dots per inch for PDFKit
  if (unit === 'in') return value * DPIN;
  if (unit === 'cm') return value * (DPIN / 2.54);
  if (unit === 'mm') return value * (DPIN / 25.4);
  return value;
};
```

---

## Payment Integration

### Payment Information
**Status**: Partially implemented via re-exported controller functions

**Available Functions**:
- Invoice retrieval (`getInvoice`)
- Payment history (stub implementation)

**Missing Features**:
- Payment retry mechanisms
- Payment status updates
- Refund handling

---

## API Endpoints

### Complete Endpoint List

#### Authentication
- `POST /api/registrant-portal/login` - Registrant authentication
- `GET /api/registrant-portal/current` - Get current registrant

#### Profile Management
- `PUT /api/registrant-portal/profile` - Update profile information
- `GET /api/registrant-portal/events/:eventId` - Get event details

#### Dashboard
- `GET /api/registrant-portal/dashboard` - Get dashboard data

#### Workshop Management
- `GET /api/registrant-portal/workshops/available` - List available workshops
- `POST /api/registrant-portal/workshops/:workshopId/register` - Register for workshop
- `DELETE /api/registrant-portal/workshops/:workshopId/cancel` - Cancel workshop registration
- `GET /api/registrant-portal/workshops/registered` - Get registered workshops

#### Resource Management
- `GET /api/registrant-portal/resources/history` - Get resource usage history
- `GET /api/registrant-portal/resources/available` - Get available resources

#### Abstract Management
- `GET /api/registrant-portal/events/:eventId/abstracts` - List abstracts for event
- `POST /api/registrant-portal/events/:eventId/abstracts` - Submit abstract for event
- `GET /api/registrant-portal/events/:eventId/abstracts/:abstractId` - Get specific abstract
- `PUT /api/registrant-portal/events/:eventId/abstracts/:abstractId` - Update abstract

#### Certificate Management
- `GET /api/registrant-portal/certificates` - List certificates
- `GET /api/registrant-portal/certificates/:id` - Download certificate

#### Badge Management
- `GET /api/registrant-portal/events/:eventId/registrants/:registrantId/badge` - Download badge
- `GET /api/registrant-portal/qr-code` - Get QR code data

#### Stub/Incomplete Endpoints
- `POST /api/registrant-portal/register` - Registrant registration (501)
- `POST /api/registrant-portal/verify-account` - Account verification (501)
- `GET /api/registrant-portal/payments` - Get payments (501)
- `GET /api/registrant-portal/announcements` - Get announcements (501)
- `GET /api/registrant-portal/resources/:id/download` - Download resource (501)

---

## Security & Validation

### Authentication Middleware
- JWT token validation required for all protected routes
- Registrant context injection via `req.registrant`
- Event-scoped access control

### Input Validation
- MongoDB ObjectId format validation
- Required field enforcement
- Custom field validation with ObjectId checks
- File upload restrictions (where applicable)

### Access Control
- Self-service restrictions (users can only access own data)
- Event-scoped data isolation
- Category-based resource filtering
- Workshop capacity enforcement

### Error Handling
- Consistent error response format
- Detailed logging for debugging
- Graceful fallbacks for missing data
- Secure error messages (no sensitive data exposure)

---

## Implementation Status

### Fully Implemented ✅
1. **Authentication System**: Complete with event-scoped login
2. **Profile Management**: Full CRUD with custom fields
3. **Dashboard Integration**: Comprehensive data aggregation
4. **Workshop Management**: Complete registration workflow
5. **Resource Tracking**: Usage history and availability
6. **Abstract Management**: Complete CRUD with validation
7. **Badge Generation**: Full PDF generation with templates
8. **Certificate Management**: Complete workflow implementation

### Partially Implemented ⚠️
1. **Payment Integration**: Invoice retrieval only
2. **Resource Downloads**: Endpoint structure exists, implementation pending
3. **Announcement System**: Database queries implemented, endpoint stub

### Missing/Stub Implementations ❌
1. **Registrant Registration**: New user registration workflow
2. **Account Verification**: Email/SMS verification system
3. **Payment History**: Comprehensive payment management
4. **Automated Notifications**: Email/SMS triggers
5. **Advanced Reporting**: Analytics and usage reports

### Architectural Concerns
1. **Error Handling**: Inconsistent error response formats across some endpoints
2. **Logging**: Extensive logging may impact performance in production
3. **File Storage**: Badge and certificate storage strategy undefined
4. **Scalability**: PDF generation in-memory may not scale for large events
5. **Caching**: No caching strategy for frequently accessed data

### Recommended Enhancements
1. **Background Job Processing**: For badge/certificate generation
2. **File Storage Integration**: S3/cloud storage for generated files
3. **Redis Caching**: For dashboard data and templates
4. **Rate Limiting**: API endpoint protection
5. **Audit Trails**: Comprehensive action logging
6. **Multi-language Support**: Internationalization framework
7. **Mobile API Optimization**: Specific endpoints for mobile apps
8. **Offline Support**: Progressive Web App capabilities

---

## Frontend Integration Notes

### Authentication Flow
- JWT tokens stored in HTTP-only cookies
- Token refresh mechanism needed
- Event context management required

### Data Binding
- Consistent response format expected by frontend
- Success/status field variations need standardization
- Error handling standardization required

### File Handling
- Badge preview vs download modes
- Certificate status-based UI updates
- Resource download progress indicators

### Real-time Updates
- WebSocket integration points identified
- Announcement notification system
- Payment status updates

This comprehensive documentation demonstrates the depth of analysis needed for each feature area. The registrant portal represents one of the most complex workflows in the system, with intricate security, validation, and business logic requirements.
