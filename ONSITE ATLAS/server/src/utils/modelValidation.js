
const mongoose = require('mongoose');
const validator = require('validator');

/**
 * Common validation utilities for Mongoose models
 */
class ModelValidation {
  
  /**
   * Email validation
   */
  static emailValidator = {
    validator: function(email) {
      return !email || validator.isEmail(email);
    },
    message: 'Please provide a valid email address'
  };
  
  /**
   * Phone number validation (international format)
   */
  static phoneValidator = {
    validator: function(phone) {
      return !phone || /^[+]?[1-9]?[0-9]{7,15}$/.test(phone.replace(/[\s\-\(\)]/g, ''));
    },
    message: 'Please provide a valid phone number'
  };
  
  /**
   * ObjectId validation
   */
  static objectIdValidator = {
    validator: function(id) {
      return !id || mongoose.Types.ObjectId.isValid(id);
    },
    message: 'Invalid ObjectId format'
  };
  
  /**
   * URL validation
   */
  static urlValidator = {
    validator: function(url) {
      return !url || validator.isURL(url);
    },
    message: 'Please provide a valid URL'
  };
  
  /**
   * Date validation (future dates)
   */
  static futureDateValidator = {
    validator: function(date) {
      return !date || new Date(date) > new Date();
    },
    message: 'Date must be in the future'
  };
  
  /**
   * String length validation
   */
  static stringLengthValidator(min = 0, max = 1000) {
    return {
      validator: function(str) {
        return !str || (str.length >= min && str.length <= max);
      },
      message: `String must be between ${min} and ${max} characters`
    };
  }
  
  /**
   * Required field with custom message
   */
  static requiredField(message = 'This field is required') {
    return [true, message];
  }
  
  /**
   * Enum validation with custom message
   */
  static enumValidator(values, message = 'Invalid value') {
    return {
      validator: function(value) {
        return !value || values.includes(value);
      },
      message: message
    };
  }
}

module.exports = ModelValidation;
