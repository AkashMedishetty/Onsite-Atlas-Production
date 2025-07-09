#!/usr/bin/env node
require("./config/patchConsole");
const logger = require('./config/logger');

logger.info('===== SERVER MODULE LOADED =====');

// Add clustering support for utilizing all CPU cores
const cluster = require('cluster');
const os = require('os');
const numCPUs = os.cpus().length;

// Determine if clustering should be enabled (can be controlled via env var)
const CLUSTERING_ENABLED = process.env.CLUSTERING_ENABLED !== 'false';

// If clustering is enabled and this is the master process
if (CLUSTERING_ENABLED && cluster.isMaster) {
  logger.info(`Master process ${process.pid} is running`);
  logger.info(`Server will utilize ${numCPUs} CPU cores`);
  
  // Fork workers based on number of CPUs
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    logger.info(`Forked worker ${worker.process.pid}`);
  }
  
  // Handle worker exit and restart them
  cluster.on('exit', (worker, code, signal) => {
    logger.info(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    const newWorker = cluster.fork();
    logger.info(`Started new worker ${newWorker.process.pid}`);
  });
  
  // Monitor workers periodically
  setInterval(() => {
    const workerCount = Object.keys(cluster.workers).length;
    logger.info(`Master ${process.pid} is monitoring ${workerCount} workers`);
  }, 60000);

  // Handle graceful shutdown for master process
  process.on('SIGTERM', () => {
    logger.info('Master received SIGTERM, shutting down workers...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('Master received SIGINT, shutting down workers...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
    process.exit(0);
  });

  logger.info('Master process initialized and managing workers');
  
} else {
  // Worker process or clustering disabled - run the actual server
  logger.info(`Worker process ${process.pid} starting...`);
  
  // Force Node.js to run this module to completion by exporting
  // from the main module instead of just declaring variables
  module.exports = {};

  try {
    logger.info('Importing dependencies...');
    const mongoose = require('mongoose');
    const app = require('./app');
    const config = require('./config/config');
    const { connectDB } = require('./config/database');
    const http = require('http');
    const socketio = require('socket.io');
    const cron = require('node-cron');
    const PaymentLink = require('./models/PaymentLink');
    const jwt = require('jsonwebtoken');
    logger.info('All dependencies imported successfully');

    logger.info('===== SERVER INITIALIZATION STARTED =====');

    // Make these variables global to prevent garbage collection
    global.server = null;
    global.shutdownInProgress = false;

    // Connect to database and start server
    const startServer = async () => {
      logger.info('startServer function called');
      
      try {
        // Connect to MongoDB
        logger.info('Connecting to MongoDB...');
        const dbConnection = await connectDB();
        
        if (dbConnection) {
          logger.info('Database connection successful');
        } else {
          logger.info('Database connection failed, running in limited functionality mode');
        }

        logger.info('Creating HTTP server...');
        // Start Express server
        const server = http.createServer(app);
        
        // Initialize WebSocket service for real-time notifications
        const { initializeWebSocket } = require('./websocket');
        const io = initializeWebSocket(server);
        app.locals.io = io;

        // Keep existing event room functionality for backward compatibility
        io.on('connection', (socket) => {
          socket.on('join', async (eventId) => {
            try {
              const token = socket.handshake.auth?.token;
              if (!token) return;
              const decoded = jwt.verify(token, process.env.JWT_SECRET);
              // simplistic role check; adjust as needed
              const User = require('./models/User');
              const user = await User.findById(decoded.id);
              if (!user) return;
              if (!eventId) return;
              // TODO: verify user has access to the event (skipped for brevity)
              socket.join(eventId.toString());
            } catch (err) {
              logger.error('Socket auth error:', err.message);
            }
          });
        });

        // Only set up cron jobs in one worker to avoid duplication
        const workerId = cluster.worker ? cluster.worker.id : 1;
        if (workerId === 1) {
          logger.info('Setting up cron jobs in primary worker...');
          
          // Start the EventDeletionJobService for PurpleHat Advanced Security Protocol
          try {
            const eventDeletionJobService = require('./services/EventDeletionJobService');
            eventDeletionJobService.start();
            logger.info('✅ EventDeletionJobService started successfully');
          } catch (error) {
            logger.error('❌ Failed to start EventDeletionJobService:', error);
          }
          
        // Every 5 minutes: expire payment links & release expired seat holds
        cron.schedule('*/5 * * * *', async () => {
          const now = new Date();
          // Payment links
          const expired = await PaymentLink.updateMany({ expiresAt: { $lte: now }, status: 'active' }, { status: 'expired' });
          if (expired.modifiedCount) {
              logger.info('Expired payment links:', expired.modifiedCount);
          }

          // Seat holds without registration or with registration but payment not completed & expired
          try {
            const SeatHold = require('./models/SeatHold');
            const seatHoldCleanup = await SeatHold.deleteMany({ expiresAt: { $lte: now } });
            if (seatHoldCleanup.deletedCount) {
                logger.info('Released seat holds:', seatHoldCleanup.deletedCount);
            }
          } catch (err) {
              logger.error('SeatHold cleanup error:', err);
          }
        });
        }

        global.server = server.listen(config.port, () => {
          const processInfo = cluster.worker ? `Worker ${cluster.worker.id} (PID: ${process.pid})` : `Process ${process.pid}`;
          logger.info(`${processInfo} - Server running on port ${config.port} in ${config.env} mode`);
          logger.info(`Health check available at: /health (port ${config.port})`);
          logger.info(`${processInfo} - Server started on port ${config.port} in ${config.env} mode`);
        });

        logger.info('HTTP server created, setting up error handlers...');
        
        // Handle server errors
        global.server.on('error', (error) => {
          logger.error('Server error:', error);
          logger.error(`Server error: ${error.message}`);
        });

        logger.info('Server error handlers set up');
        
        // Keep Node.js process alive
        process.stdin.resume();
        logger.info('Process stdin resumed to keep process alive');
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
          logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
          logger.error(`Unhandled Rejection: ${reason}`);
          // Don't exit the process, just log the error
        });
        
        logger.info('All event handlers have been set up');
        
        return global.server; // Return the server instance
      } catch (error) {
        logger.error(`Server startup error: ${error.message}`);
        logger.error(`Server startup error: ${error.message}`);
        
        // Start the server anyway, even if database connection failed
        logger.info('Starting server despite error...');
        const server = http.createServer(app);
        
        // Initialize WebSocket service for real-time notifications (fallback)
        const { initializeWebSocket } = require('./websocket');
        const io = initializeWebSocket(server);
        app.locals.io = io;

        io.on('connection', (socket) => {
          socket.on('join', async (eventId) => {
            try {
              const token = socket.handshake.auth?.token;
              if (!token) return;
              const decoded = jwt.verify(token, process.env.JWT_SECRET);
              // simplistic role check; adjust as needed
              const User = require('./models/User');
              const user = await User.findById(decoded.id);
              if (!user) return;
              if (!eventId) return;
              // TODO: verify user has access to the event (skipped for brevity)
              socket.join(eventId.toString());
            } catch (err) {
              logger.error('Socket auth error:', err.message);
            }
          });
        });

        // Only set up cron jobs in one worker to avoid duplication
        const workerId = cluster.worker ? cluster.worker.id : 1;
        if (workerId === 1) {
          logger.info('Setting up cron jobs in primary worker (limited mode)...');
        // Every 5 minutes: expire payment links & release expired seat holds
        cron.schedule('*/5 * * * *', async () => {
          const now = new Date();
          // Payment links
          const expired = await PaymentLink.updateMany({ expiresAt: { $lte: now }, status: 'active' }, { status: 'expired' });
          if (expired.modifiedCount) {
              logger.info('Expired payment links:', expired.modifiedCount);
          }

          // Seat holds without registration or with registration but payment not completed & expired
          try {
            const SeatHold = require('./models/SeatHold');
            const seatHoldCleanup = await SeatHold.deleteMany({ expiresAt: { $lte: now } });
            if (seatHoldCleanup.deletedCount) {
                logger.info('Released seat holds:', seatHoldCleanup.deletedCount);
            }
          } catch (err) {
              logger.error('SeatHold cleanup error:', err);
          }
        });
        }

        global.server = server.listen(config.port, () => {
          const processInfo = cluster.worker ? `Worker ${cluster.worker.id} (PID: ${process.pid})` : `Process ${process.pid}`;
          logger.info(`${processInfo} - Server running in LIMITED MODE on port ${config.port} in ${config.env} mode`);
          logger.info(`Health check available at: /health (port ${config.port})`);
          logger.info(`${processInfo} - Server started in LIMITED MODE on port ${config.port} in ${config.env} mode`);
        });
        
        return global.server;
      }
    };

    // This function helps ensure the server process stays alive
    function keepAlive() {
      if (global.shutdownInProgress) return;
      
      // Schedule next keepAlive call
      const timeout = setTimeout(keepAlive, 1000 * 10); // Every 10 seconds for debugging
      timeout.unref(); // Allow process to exit if this is the only thing keeping it alive during shutdown
      logger.info('[KEEPALIVE] Keep-alive function called');
    }

    // Start keepAlive immediately
    logger.info('Starting keep-alive mechanism...');
    keepAlive();

    // Keep the server running with a timer that never completes
    logger.info('Setting up heartbeat interval...');
    const heartbeatTimer = setInterval(() => {
      if (!global.shutdownInProgress) {
        logger.info("[DEBUG] Server heartbeat");
      }
    }, 15000).unref(); // Every 15 seconds, allow clean shutdown
    global.heartbeatTimer = heartbeatTimer;

    // Preserve reference to server instance
    global.serverInstance = null;

    // Make sure this main execution doesn't complete - keep process alive
    logger.info('Setting up primary keep-alive timer...');
    const keepAliveTimer = setInterval(() => {
      // Do nothing; this just keeps the event loop active
      logger.info('[MAIN TIMER] Server is still running');
    }, 20000); // Run every 20 seconds for debugging
    global.keepAliveTimer = keepAliveTimer;

    // Keep a reference to key objects to prevent garbage collection
    global.keepAliveReferences = { app, mongoose };

    // Start the server and store the instance
    logger.info('Calling startServer function...');
    startServer()
      .then(instance => {
        global.serverInstance = instance;
        logger.info('Server initialization complete and running');
        
        // Heartbeat logging
        const heartbeatInterval = setInterval(() => {
          const memoryUsage = process.memoryUsage();
          const processInfo = cluster.worker ? `Worker ${cluster.worker.id}` : 'Process';
          logger.info(`[HEARTBEAT] ${processInfo} is running. Memory usage: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`);
        }, 30000); // Log every 30 seconds
        
        // Store reference to prevent garbage collection
        global.heartbeatInterval = heartbeatInterval;
        
        // Export the server instance to prevent garbage collection
        module.exports.server = global.serverInstance;
        
        logger.info('Server startup process completed');
      })
      .catch(error => {
        logger.error('Failed to start server:', error);
      });

    logger.info('Main module execution continues past server initialization');

    // Handle graceful shutdown
    const exitHandler = () => {
      logger.info('Exit handler called');
      global.shutdownInProgress = true;
      
      // Stop EventDeletionJobService
      try {
        const eventDeletionJobService = require('./services/EventDeletionJobService');
        eventDeletionJobService.stop();
        logger.info('✅ EventDeletionJobService stopped');
      } catch (error) {
        logger.error('❌ Error stopping EventDeletionJobService:', error);
      }
      
      if (global.server) {
        global.server.close(() => {
          logger.info('Server closed');
          
          // Clean up timers
          clearInterval(global.keepAliveTimer);
          clearInterval(global.heartbeatInterval);
          clearInterval(global.heartbeatTimer);
          
          process.exit(1);
        });
      } else {
        process.exit(1);
      }
    };

    const unexpectedErrorHandler = (error) => {
      logger.error('Unexpected error occurred:', error);
      logger.error(error);
      exitHandler();
    };

    // Listen for termination signals
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received');
      logger.info('SIGTERM received');
      global.shutdownInProgress = true;
      
      // Stop EventDeletionJobService
      try {
        const eventDeletionJobService = require('./services/EventDeletionJobService');
        eventDeletionJobService.stop();
        logger.info('✅ EventDeletionJobService stopped');
      } catch (error) {
        logger.error('❌ Error stopping EventDeletionJobService:', error);
      }
      
      if (global.server) {
        global.server.close(() => {
          logger.info('Server closed after SIGTERM');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received');
      logger.info('SIGINT received');
      global.shutdownInProgress = true;
      
      // Stop EventDeletionJobService
      try {
        const eventDeletionJobService = require('./services/EventDeletionJobService');
        eventDeletionJobService.stop();
        logger.info('✅ EventDeletionJobService stopped');
      } catch (error) {
        logger.error('❌ Error stopping EventDeletionJobService:', error);
      }
      
      if (global.server) {
        global.server.close(() => {
          logger.info('Server closed after SIGINT');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });

    // Only exit on critical errors
    process.on('uncaughtException', unexpectedErrorHandler);

    // Add server to exports to prevent garbage collection
    module.exports.serverInstance = global.serverInstance;

    logger.info('===== SERVER INITIALIZATION FINISHED =====');
  } catch (error) {
    logger.error('CRITICAL ERROR DURING SERVER INITIALIZATION:', error.message);
    logger.error(error.stack);
    logger.error(`CRITICAL ERROR DURING SERVER INITIALIZATION: ${error.message}`);
    throw error; // Re-throw to ensure it's visible
  }
} 