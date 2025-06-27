const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const fileUpload = require('express-fileupload');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const ApiError = require('./utils/ApiError');
const { errorHandler } = require('./middleware/errorHandler');
const { protect } = require('./middleware/auth.middleware');
const config = require('./config/config');
const path = require('path');
const { UPLOADS_BASE_DIR } = require('./config/paths');
const mongoose = require('mongoose');
const logger = require('./utils/logger');
const sponsorPortalRoutes = require('./routes/sponsorPortal.routes');
const clientPortalRoutes = require('./routes/clientPortal.routes');
const systemSettingsRoutes = require('./routes/systemSettings.routes');
const os = require('os');
const backupRoutes = require('./routes/backup.routes');
const systemLogsRoutes = require('./routes/systemLogs.routes');

// Initialize express app
const app = express();
app.set('trust proxy', 'loopback');

// Set security HTTP headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginResourcePolicy: false, // Explicitly disable Helmet's CORP middleware
  frameguard: false, // Disable X-Frame-Options header
  crossOriginEmbedderPolicy: false // Disable COEP header from backend (for testing)
}));

// Set up rate limiting
// For 1500 concurrent users on a 4-core system:
// - Global rate limit: 500 requests per minute per IP
// - Stricter limits for authentication and abstract submission endpoints
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // 500 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later'
  }
});

// Stricter rate limit for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many authentication attempts, please try again after 15 minutes'
  }
});

// Apply global rate limiter to all routes
app.use(globalLimiter);

// Apply stricter rate limit to authentication endpoints
app.use('/api/auth', authLimiter);
app.use('/api/registrant-portal/login', authLimiter);
app.use('/api/registrant-portal/forgot-password', authLimiter);
app.use('/api/registrant-portal/reset-password', authLimiter);

// Only parse JSON and urlencoded for non-multipart requests
app.use((req, res, next) => {
  if (req.is('multipart/form-data')) return next();
  express.json({ limit: '10mb' })(req, res, next);
});
app.use((req, res, next) => {
  if (req.is('multipart/form-data')) return next();
  express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
});

app.use(cookieParser());

// Add File Upload Middleware
app.use(fileUpload());

// Sanitize request data
app.use(xss());
app.use(mongoSanitize());

// Enable gzip compression
app.use(compression());

// Enable CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173', // Frontend origin configurable via env
  credentials: true, // Allow cookies/auth headers
  exposedHeaders: ['Content-Disposition'] // Expose Content-Disposition header
}));

// Request logging
if (config.env !== 'test') {
  app.use(morgan('dev'));
}

// Static files
app.use('/uploads', express.static(UPLOADS_BASE_DIR));

// API routes
app.use('/api', routes);

// Add badge template routes explicitly here
try {
  console.log('Loading badge template routes in app.js...');
  const badgeTemplateRoutes = require('./routes/badge-templates.routes.js'); 
  app.use('/api/badge-templates', badgeTemplateRoutes);
  console.log('Badge template routes registered at /api/badge-templates');
} catch (error) {
  console.error('ERROR LOADING BADGE TEMPLATE ROUTES in app.js:', error);
}

// Add direct routes for resources and categories to handle various client path formats
const resourceRoutes = require('./routes/resources.routes');
const categoryRoutes = require('./routes/categories.routes');
const eventRoutes = require('./routes/event.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

// Mount eventRoutes to handle all /api/events paths
app.use('/api/events', eventRoutes);

// Direct route registration for key API endpoints that need to be accessible at the root level
app.use('/api/resources', resourceRoutes);
app.use('/api/categories', categoryRoutes);

// Add protected direct routes
app.use('/api/events/:id/dashboard', protect, (req, res, next) => {
  const { getEventDashboard } = require('./controllers/dashboard.controller');
  return getEventDashboard(req, res, next);
});

app.use('/api/events/:id/statistics', protect, (req, res, next) => {
  const { getEventStatistics } = require('./controllers/event.controller');
  return getEventStatistics(req, res, next);
});

// Add sponsor portal routes
app.use('/api/sponsor-portal-auth', sponsorPortalRoutes);

// Add client portal routes
app.use('/api/client-portal-auth', clientPortalRoutes);

// Add system settings routes
app.use('/api/system-settings', systemSettingsRoutes);

// Add backup routes
app.use('/api/backup', backupRoutes);

// Add system logs routes
app.use('/api/system-logs', systemLogsRoutes);

// Health check endpoint with basic system stats
const healthHandler = (req, res) => {
  const memoryUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const rss = memoryUsage.rss;
  const memPercent = ((rss / totalMem) * 100).toFixed(2);

  const [load1, load5, load15] = os.loadavg();

  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    uptime: process.uptime(),
    timestamp: Date.now(),
    memory: {
      rss: +(rss / 1024 / 1024).toFixed(2),
      total: +(totalMem / 1024 / 1024).toFixed(2),
      percent: memPercent
    },
    cpu: {
      load1: load1.toFixed(2),
      load5: load5.toFixed(2),
      load15: load15.toFixed(2)
    }
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Handle 404
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Not Found' });
});

// Convert errors to ApiError (if you had a complex errorConverter, ensure it's compatible or remove)
// The errorHandler from utils/ApiError.js is simpler and might not need a separate converter
// app.use(errorConverter); // Keeping this commented as the new errorHandler is basic

// Handle errors
app.use(errorHandler);

module.exports = app; 