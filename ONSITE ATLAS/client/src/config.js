/**
 * Configuration for the client application
 */

// API configuration (use environment variable or relative path)
export const API_URL = import.meta.env.VITE_API_URL || '/api';
export const API_BASE_URL_STATIC = import.meta.env.VITE_API_BASE_URL_STATIC || '';

// App configuration
export const APP_NAME = 'ONSITE ATLAS';
export const APP_VERSION = '1.0.0';

// Feature flags
export const FEATURES = {
  ABSTRACTS_ENABLED: true,
  PAYMENT_GATEWAY_ENABLED: false,
  DEBUG_MODE: false
};

// Default pagination
export const DEFAULT_PAGE_SIZE = 10;

// Auth configuration
export const TOKEN_KEY = 'atlas_auth_token';
export const REGISTRANT_TOKEN_KEY = 'atlas_registrant_token';
export const AUTHOR_TOKEN_KEY = 'atlas_author_token';

// ... rest of the file remains unchanged ... 