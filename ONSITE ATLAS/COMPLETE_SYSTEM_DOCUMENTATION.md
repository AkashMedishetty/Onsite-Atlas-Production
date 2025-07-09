# ONSITE ATLAS - Complete System Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Authentication & Authorization](#authentication--authorization)
4. [User Management](#user-management)
5. [Event Management](#event-management)
6. [Registration System](#registration-system)
7. [Payment Processing](#payment-processing)
8. [Abstract Management](#abstract-management)
9. [Badge & Resource Management](#badge--resource-management)
10. [Notification System](#notification-system)
11. [Analytics & Reporting](#analytics--reporting)
12. [Admin Portal Features](#admin-portal-features)
13. [API Documentation](#api-documentation)
14. [Workflow Issues & Improvements](#workflow-issues--improvements)
15. [Database Schema](#database-schema)

---

## System Overview

ONSITE ATLAS is a comprehensive conference management platform that handles the complete lifecycle of academic and professional conferences. The system provides:

- **Multi-tenant Architecture**: Support for multiple events/conferences
- **Role-based Access Control**: Admin, organizer, reviewer, attendee, speaker roles
- **Payment Integration**: Multiple payment gateways (Stripe, PayPal, etc.)
- **Abstract Management**: Submission, review, and acceptance workflows
- **Registration Management**: Complex registration with multiple components
- **Real-time Notifications**: Email, SMS, WhatsApp integration
- **Resource Management**: Document sharing, badge generation
- **Analytics Dashboard**: Comprehensive reporting and insights

---

## Architecture & Technology Stack

### Frontend (Client)
- **Framework**: React with TypeScript
- **State Management**: Context API and local state
- **Routing**: React Router
- **UI Components**: Custom component library
- **API Communication**: Axios for HTTP requests
- **Build Tool**: Vite/Create React App

### Backend (Server)
- **Framework**: Node.js with Express
- **Database**: PostgreSQL with Sequelize ORM
- **Authentication**: JWT tokens, bcrypt for password hashing
- **File Storage**: Local file system with upload management
- **Payment Processing**: Multi-gateway abstraction layer
- **Email Service**: Multiple provider support (SendGrid, SMTP)
- **SMS/WhatsApp**: Twilio integration

### Key Directories Structure
```
ONSITE ATLAS/
├── client/                 # React frontend application
├── server/                 # Node.js backend application
├── docs/                   # API documentation
├── workflow-improvements/  # System workflow documentation
└── COMPLETE_SYSTEM_DOCUMENTATION.md
```

---

## 1. Authentication & Authorization

### Login System
- **Multiple Login Methods**: Email/password, social login integration
- **Session Management**: JWT-based authentication with refresh tokens
- **Password Security**: bcrypt hashing, password reset workflows
- **Role-based Access**: Granular permissions system

### User Roles & Permissions
1. **Super Admin**: Full system access
2. **Event Admin**: Event-specific administrative access
3. **Organizer**: Event management and registration oversight
4. **Reviewer**: Abstract review capabilities
5. **Speaker**: Abstract submission and management
6. **Attendee**: Registration and event participation
7. **Sponsor**: Sponsor portal access
8. **Client**: Client portal access

### Authentication Workflow
[To be detailed based on code analysis...]

---

## 2. User Management

### User Registration
- **Account Creation**: Email verification workflow
- **Profile Management**: Personal information, preferences
- **Account Linking**: Connect multiple roles to single account

### User Profile Features
[To be detailed based on code analysis...]

---

## 3. Event Management

### Event Creation & Configuration
- **Event Setup**: Basic information, dates, venues
- **Component Configuration**: Registration components, pricing
- **Template Management**: Email templates, landing pages
- **Settings Management**: Event-specific configurations

### Event Lifecycle
[To be detailed based on existing workflow documentation...]

---

## 4. Registration System

### Registration Components
- **Main Event Registration**: Primary conference registration
- **Daily Access**: Day-specific access options
- **Workshops**: Workshop registration with capacity limits
- **Sessions**: Session-specific registration
- **Virtual Access**: Online participation options
- **Networking Events**: Social event registration
- **Accompanying Persons**: Guest registration management

### Registration Workflow
[To be detailed based on existing workflow documentation...]

---

## 5. Payment Processing

### Payment Gateways
- **Multi-Gateway Support**: Stripe, PayPal, and others
- **Payment Methods**: Credit cards, bank transfers, digital wallets
- **Currency Support**: Multi-currency processing
- **Invoice Generation**: Automated invoice creation and delivery

### Payment Workflow
[To be detailed based on existing workflow documentation...]

---

## 6. Abstract Management

### Abstract Submission
- **Submission Portal**: User-friendly submission interface
- **File Upload**: Support for documents, images
- **Metadata Management**: Categories, keywords, authors
- **Deadline Management**: Submission and revision deadlines

### Review Process
- **Reviewer Assignment**: Manual and automated assignment
- **Review Interface**: Structured review forms
- **Scoring System**: Configurable scoring criteria
- **Decision Workflow**: Accept, reject, revision requests

### Abstract Workflow
[To be detailed based on code analysis...]

---

## 7. Badge & Resource Management

### Badge Generation
- **Template System**: Customizable badge designs
- **Data Integration**: Automatic population from registration data
- **Print Management**: Batch printing capabilities
- **QR Code Integration**: Unique identification codes

### Resource Sharing
- **Document Management**: Conference materials distribution
- **Access Control**: Role-based resource access
- **Version Control**: Document versioning system

---

## 8. Notification System

### Communication Channels
- **Email Notifications**: Automated and manual email campaigns
- **SMS Integration**: Text message notifications
- **WhatsApp Integration**: WhatsApp messaging support
- **In-app Notifications**: Real-time system notifications

### Notification Types
[To be detailed based on existing notification documentation...]

---

## 9. Analytics & Reporting

### Dashboard Features
- **Registration Analytics**: Registration trends and statistics
- **Payment Analytics**: Financial reporting and tracking
- **Abstract Analytics**: Submission and review metrics
- **User Engagement**: Activity tracking and insights

### Report Generation
[To be detailed based on code analysis...]

---

## 10. Admin Portal Features

### System Administration
- **User Management**: Admin user creation and management
- **Event Management**: Cross-event administration
- **System Settings**: Global configuration options
- **Audit Logs**: System activity tracking

### Event Administration
[To be detailed based on code analysis...]

---

## 11. API Documentation

The system provides comprehensive REST APIs covering:
- Authentication endpoints
- Event management APIs
- Registration APIs
- Payment processing APIs
- Abstract management APIs
- Analytics APIs
- Resource management APIs

Detailed API documentation is available in the `docs/api/` directory.

---

## 12. Workflow Issues & Improvements

Based on the comprehensive analysis, the following areas have been identified for improvement:

### Critical Issues
1. **Payment Status Synchronization**: Inconsistencies between payment gateways and registration status
2. **Abstract Review Automation**: Partial automation in reviewer assignment and notifications
3. **User Role Management**: Complex permission system needs streamlining
4. **Error Handling**: Insufficient error recovery mechanisms

### Missing Features
1. **Refund Processing**: No automated refund workflow
2. **Mobile Optimization**: Limited mobile-responsive features
3. **Multi-language Support**: No internationalization support
4. **Advanced Analytics**: Limited predictive analytics capabilities

### Recommended Improvements
[Detailed recommendations based on workflow analysis...]

---

## 13. Database Schema

The system uses PostgreSQL with the following key entities:
- Users and authentication
- Events and configurations
- Registrations and components
- Payments and transactions
- Abstracts and reviews
- Resources and templates
- Notifications and logs

Detailed schema documentation is available in `server/src/docs/database-schema.md`.

---

## 14. Deployment & Operations

### Environment Setup
[To be detailed based on deployment guide...]

### Monitoring & Maintenance
[To be detailed based on operational requirements...]

---

## Status: Work in Progress

This documentation is being systematically developed to cover every feature and workflow in the ONSITE ATLAS system. Each section will be expanded with detailed implementation analysis, code paths, and workflow documentation.

**Next Steps:**
1. Complete authentication system analysis
2. Detail user management workflows
3. Expand event management documentation
4. Document all API endpoints comprehensively
5. Provide implementation recommendations for identified issues

---

*Last Updated: [Current Date]*
*Documentation Status: Initial Framework - In Development*
