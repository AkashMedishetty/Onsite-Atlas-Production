const { validationResult } = require('express-validator');
const { sendErrorResponse } = require('../utils/responseUtils');

/**
 * Express-validator middleware to handle validation results
 * Works with express-validator validation chains
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next middleware function
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => 
      `${error.param}: ${error.msg}`
    );
    
    return sendErrorResponse(res, errorMessages.join(', '), 400);
  }
  
  next();
};

module.exports = {
  validate
}; 