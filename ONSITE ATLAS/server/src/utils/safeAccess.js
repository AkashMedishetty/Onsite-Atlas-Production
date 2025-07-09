
/**
 * Null/undefined safety utilities
 */
class SafeAccess {
  
  /**
   * Safe property access with default value
   */
  static get(obj, path, defaultValue = null) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current == null || typeof current !== 'object') {
        return defaultValue;
      }
      current = current[key];
    }
    
    return current != null ? current : defaultValue;
  }
  
  /**
   * Safe array access with bounds checking
   */
  static getArray(arr, index, defaultValue = null) {
    if (!Array.isArray(arr) || index < 0 || index >= arr.length) {
      return defaultValue;
    }
    return arr[index];
  }
  
  /**
   * Safe string operations
   */
  static getString(str, defaultValue = '') {
    return typeof str === 'string' ? str : defaultValue;
  }
  
  /**
   * Safe number operations
   */
  static getNumber(num, defaultValue = 0) {
    const parsed = Number(num);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  /**
   * Validate required fields in object
   */
  static validateRequired(obj, requiredFields, customMessage = null) {
    const missing = [];
    
    for (const field of requiredFields) {
      if (this.get(obj, field) == null) {
        missing.push(field);
      }
    }
    
    if (missing.length > 0) {
      const message = customMessage || `Missing required fields: ${missing.join(', ')}`;
      throw new Error(message);
    }
    
    return true;
  }
  
  /**
   * Safe database query result handling
   */
  static validateDbResult(result, errorMessage = 'Resource not found') {
    if (!result) {
      const error = new Error(errorMessage);
      error.statusCode = 404;
      throw error;
    }
    return result;
  }
}

module.exports = SafeAccess;
