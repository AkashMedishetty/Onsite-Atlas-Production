const logger = require('./logger');

/**
 * Standardized Error Handler Utility
 * Provides consistent error response formatting and logging across the API
 */
class StandardErrorHandler {

  /**
   * Standard error response structure
   */
  static formatErrorResponse(error, message = null) {
    return {
      success: false,
      error: {
        message: message || error.message || 'An error occurred',
        code: error.code || 'INTERNAL_ERROR',
        type: error.name || 'Error',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      }
    };
  }

  /**
   * Handle and respond to different types of errors
   * @param {Object} res - Express response object
   * @param {Error} error - Error object
   * @param {String} context - Context where error occurred
   * @param {String} customMessage - Custom error message
   */
  static handleError(res, error, context = 'Unknown', customMessage = null) {
    // Log the error with context
    logger.error(`Error in ${context}:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      context
    });

    // Determine status code based on error type
    let statusCode = 500;
    let errorMessage = customMessage || error.message || 'Internal server error';

    // Handle specific error types
    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = this.formatValidationError(error);
    } else if (error.name === 'CastError') {
      statusCode = 400;
      errorMessage = 'Invalid ID format';
    } else if (error.code === 11000) { // MongoDB duplicate key
      statusCode = 409;
      errorMessage = this.formatDuplicateKeyError(error);
    } else if (error.name === 'UnauthorizedError' || error.message.includes('unauthorized')) {
      statusCode = 401;
      errorMessage = customMessage || 'Unauthorized access';
    } else if (error.name === 'ForbiddenError' || error.message.includes('forbidden')) {
      statusCode = 403;
      errorMessage = customMessage || 'Access forbidden';
    } else if (error.name === 'NotFoundError' || error.message.includes('not found')) {
      statusCode = 404;
      errorMessage = customMessage || 'Resource not found';
    } else if (error.message.includes('timeout')) {
      statusCode = 408;
      errorMessage = 'Request timeout';
    } else if (error.name === 'PaymentError') {
      statusCode = 402;
      errorMessage = customMessage || 'Payment processing error';
    }

    // Send standardized error response
    return res.status(statusCode).json(this.formatErrorResponse({
      ...error,
      message: errorMessage
    }));
  }

  /**
   * Handle validation errors specifically
   */
  static formatValidationError(error) {
    if (error.errors) {
      const messages = Object.values(error.errors).map(err => err.message);
      return `Validation failed: ${messages.join(', ')}`;
    }
    return error.message || 'Validation failed';
  }

  /**
   * Handle MongoDB duplicate key errors
   */
  static formatDuplicateKeyError(error) {
    const field = Object.keys(error.keyValue || {})[0];
    return field ? `${field} already exists` : 'Duplicate entry detected';
  }

  /**
   * Async error wrapper for controllers
   * @param {Function} fn - Async function to wrap
   * @param {String} context - Context for error logging
   */
  static asyncHandler(fn, context = 'Controller') {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(error => {
        this.handleError(res, error, context);
      });
    };
  }

  /**
   * Success response helper
   */
  static sendSuccess(res, statusCode = 200, message = 'Success', data = null) {
    const response = {
      success: true,
      message,
      data
    };
    
    return res.status(statusCode).json(response);
  }

  /**
   * Error response helper
   */
  static sendError(res, statusCode = 500, message = 'Error', errors = null) {
    const response = {
      success: false,
      message,
      error: {
        code: 'API_ERROR',
        timestamp: new Date().toISOString(),
        ...(errors && { details: errors })
      }
    };
    
    return res.status(statusCode).json(response);
  }

  /**
   * Data response helper - for endpoints that return data without explicit success message
   */
  static sendData(res, data, message = 'Data retrieved successfully') {
    return res.status(200).json({
      success: true,
      message,
      data
    });
  }

  /**
   * List response helper - for paginated or filtered lists
   */
  static sendList(res, data, total = null, pagination = null) {
    const response = {
      success: true,
      message: 'List retrieved successfully',
      data,
      ...(total !== null && { total }),
      ...(pagination && { pagination })
    };
    
    return res.status(200).json(response);
  }

  /**
   * Paginated response helper
   * @param {Object} res - Express response object
   * @param {Array} data - Response data array
   * @param {Object} pagination - Pagination info
   * @param {String} message - Success message
   */
  static sendPaginatedSuccess(res, data = [], pagination = {}, message = 'Success') {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || data.length,
        pages: pagination.pages || Math.ceil((pagination.total || data.length) / (pagination.limit || 10))
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Not found response helper
   * @param {Object} res - Express response object
   * @param {String} resource - Resource name
   */
  static sendNotFound(res, resource = 'Resource') {
    return res.status(404).json({
      success: false,
      error: {
        message: `${resource} not found`,
        code: 'NOT_FOUND',
        type: 'NotFoundError',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Bad request response helper
   * @param {Object} res - Express response object
   * @param {String} message - Error message
   */
  static sendBadRequest(res, message = 'Bad request') {
    return res.status(400).json({
      success: false,
      error: {
        message,
        code: 'BAD_REQUEST',
        type: 'ValidationError',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Unauthorized response helper
   * @param {Object} res - Express response object
   * @param {String} message - Error message
   */
  static sendUnauthorized(res, message = 'Unauthorized access') {
    return res.status(401).json({
      success: false,
      error: {
        message,
        code: 'UNAUTHORIZED',
        type: 'UnauthorizedError',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Forbidden response helper
   * @param {Object} res - Express response object
   * @param {String} message - Error message
   */
  static sendForbidden(res, message = 'Access forbidden') {
    return res.status(403).json({
      success: false,
      error: {
        message,
        code: 'FORBIDDEN',
        type: 'ForbiddenError',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Service unavailable response helper
   * @param {Object} res - Express response object
   * @param {String} message - Error message
   */
  static sendServiceUnavailable(res, message = 'Service temporarily unavailable') {
    return res.status(503).json({
      success: false,
      error: {
        message,
        code: 'SERVICE_UNAVAILABLE',
        type: 'ServiceError',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Express error middleware
   */
  static errorMiddleware(error, req, res, next) {
    // If response already sent, delegate to default Express error handler
    if (res.headersSent) {
      return next(error);
    }

    const context = `${req.method} ${req.originalUrl}`;
    return this.handleError(res, error, context);
  }

  /**
   * Create custom error classes
   */
  static createCustomErrors() {
    // Payment Error
    class PaymentError extends Error {
      constructor(message, code = 'PAYMENT_ERROR') {
        super(message);
        this.name = 'PaymentError';
        this.code = code;
      }
    }

    // Not Found Error
    class NotFoundError extends Error {
      constructor(message = 'Resource not found') {
        super(message);
        this.name = 'NotFoundError';
        this.code = 'NOT_FOUND';
      }
    }

    // Validation Error
    class ValidationError extends Error {
      constructor(message, fields = {}) {
        super(message);
        this.name = 'ValidationError';
        this.code = 'VALIDATION_ERROR';
        this.fields = fields;
      }
    }

    // Unauthorized Error
    class UnauthorizedError extends Error {
      constructor(message = 'Unauthorized access') {
        super(message);
        this.name = 'UnauthorizedError';
        this.code = 'UNAUTHORIZED';
      }
    }

    // Forbidden Error
    class ForbiddenError extends Error {
      constructor(message = 'Access forbidden') {
        super(message);
        this.name = 'ForbiddenError';
        this.code = 'FORBIDDEN';
      }
    }

    return {
      PaymentError,
      NotFoundError,
      ValidationError,
      UnauthorizedError,
      ForbiddenError
    };
  }

}

// Export custom error classes
const CustomErrors = StandardErrorHandler.createCustomErrors();

module.exports = {
  StandardErrorHandler,
  ...CustomErrors
}; 