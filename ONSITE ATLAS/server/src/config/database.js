const mongoose = require('mongoose');
const logger = require('../utils/logger');
const os = require('os');

/**
 * Connect to MongoDB Atlas
 * @returns {Promise} Mongoose connection promise
 */
const connectDB = async () => {
  console.log('=== DATABASE CONNECT FUNCTION STARTED ===');
  
  try {
    console.log('Attempting to connect to MongoDB Atlas...');
    
    // Check for MongoDB URL
    if (!process.env.MONGODB_URL) {
      const error = new Error('MongoDB URL is not set in environment variables.');
      console.error(error.message);
      logger.error(error.message);
      throw error;
    }
    
    // Log connection string with redacted password for debugging
    const redactedURL = process.env.MONGODB_URL ? process.env.MONGODB_URL.replace(/:[^:]*@/, ':****@') : 'NOT SET';
    console.log(`Connection string: ${redactedURL}`);
    
    // Calculate optimal pool size based on system resources
    // We use CPU count to determine if we're running in a cluster
    const numCPUs = os.cpus().length;
    const isClusterMode = process.env.CLUSTERING_ENABLED !== 'false';
    
    // Calculate optimal pool size
    // For 1500 concurrent users with 4 CPUs:
    // - If running in cluster mode: 40 connections per worker (10 * numCPUs)
    // - If running single process: 100 connections (25 * numCPUs)
    const poolSize = isClusterMode 
      ? Math.min(100, 10 * numCPUs) // 10 connections per CPU core in cluster mode
      : Math.min(200, 25 * numCPUs); // 25 connections per CPU core in single process
    
    console.log(`MongoDB connection pool size: ${poolSize}`);
    
    // Set up connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      connectTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000,   // 45 seconds
      maxPoolSize: poolSize,    // Size of the connection pool per worker
      minPoolSize: Math.max(5, Math.floor(poolSize / 4)), // Min 5 or 25% of max pool
      serverSelectionTimeoutMS: 30000, // Timeout for server selection
      heartbeatFrequencyMS: 10000, // Frequency of replica set monitoring
    };
    
    // Connect to MongoDB Atlas
    console.log('Attempting mongoose.connect...');
    const connection = await mongoose.connect(process.env.MONGODB_URL, options);
    
    console.log(`MongoDB Atlas Connected: ${connection.connection.host}`);
    logger.info(`MongoDB Atlas Connected: ${connection.connection.host} (Pool size: ${poolSize})`);
    
    // Set up connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      logger.error(`MongoDB connection error: ${err.message}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
      logger.warn('MongoDB disconnected');
    });
    
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connected event fired');
    });
    
    return connection;
  } catch (error) {
    console.error(`Failed to connect to MongoDB Atlas: ${error.message}`);
    logger.error(`Failed to connect to MongoDB Atlas: ${error.message}`);
    
    // Provide clear error messages about potential causes
    if (error.message.includes('Authentication failed')) {
      console.error('ERROR: MongoDB Atlas authentication failed. Check your username and password in the connection string.');
      logger.error('MongoDB Atlas authentication failed. Check your username and password in the connection string.');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
      console.error('ERROR: Could not reach MongoDB Atlas. Check your internet connection and the hostname in your connection string.');
      logger.error('Could not reach MongoDB Atlas. Check your internet connection and the hostname.');
    }
    
    // Check if we should fail fast or run in offline mode
    const ALLOW_OFFLINE_MODE = process.env.ALLOW_OFFLINE_MODE === 'true';
    
    if (ALLOW_OFFLINE_MODE) {
      console.warn('RUNNING IN OFFLINE MODE: Database operations will be disabled');
      logger.warn('Server running in offline mode - database operations disabled');
      
      // Set a flag to indicate offline mode
      global.OFFLINE_MODE = true;
      
      // Return null to indicate no database connection
      // Controllers should check for this and handle accordingly
      return null;
    } else {
      // Fail fast - don't start the server without a database connection
      console.error('CRITICAL: Cannot start server without database connection');
      console.error('Set ALLOW_OFFLINE_MODE=true environment variable to run in offline mode');
      logger.error('Server startup failed - cannot connect to database');
      
      // Re-throw the error to prevent server startup
      throw new Error(`Database connection failed: ${error.message}`);
    }
  } finally {
    console.log('=== DATABASE CONNECT FUNCTION COMPLETED ===');
  }
};

/**
 * Check if the application is running in offline mode
 * @returns {boolean} True if running in offline mode
 */
const isOfflineMode = () => {
  return global.OFFLINE_MODE === true || mongoose.connection.readyState !== 1;
};

/**
 * Ensure database is connected before executing operations
 * @param {string} operationName - Name of the operation for logging
 * @throws {Error} If database is not connected and not in offline mode
 */
const ensureConnected = (operationName = 'Database operation') => {
  if (isOfflineMode()) {
    throw new Error(`${operationName} failed: Application is running in offline mode`);
  }
  
  if (mongoose.connection.readyState !== 1) {
    throw new Error(`${operationName} failed: Database not connected`);
  }
};

module.exports = { connectDB, isOfflineMode, ensureConnected }; 
