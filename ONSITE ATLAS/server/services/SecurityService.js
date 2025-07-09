const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { promisify } = require('util');

const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const SecurityAlert = require('../models/SecurityAlert');

class SecurityService {
  constructor() {
    this.rateLimiters = new Map();
    this.suspiciousActivities = new Map();
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key';
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret';
  }

  /**
   * Enhanced token validation with blacklist checking
   */
  async validateToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      
      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Check if user still exists and is active
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('User account is inactive');
      }

      // Check for suspicious activity
      await this.checkSuspiciousActivity(decoded.userId, 'token_validation');

      return { valid: true, decoded, user };
    } catch (error) {
      await this.logSecurityEvent('token_validation_failed', null, { error: error.message });
      return { valid: false, error: error.message };
    }
  }

  /**
   * Rate limiting with configurable rules
   */
  createRateLimiter(identifier, options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      ...options
    };

    const limiter = rateLimit(defaultOptions);
    this.rateLimiters.set(identifier, limiter);
    return limiter;
  }

  /**
   * Get rate limiter by identifier
   */
  getRateLimiter(identifier) {
    return this.rateLimiters.get(identifier);
  }

  /**
   * Fraud detection based on patterns
   */
  async detectFraud(userId, activity, metadata = {}) {
    const fraudScore = await this.calculateFraudScore(userId, activity, metadata);
    
    if (fraudScore > 0.8) {
      await this.handleHighRiskActivity(userId, activity, fraudScore, metadata);
      return { isFraud: true, score: fraudScore, action: 'blocked' };
    } else if (fraudScore > 0.5) {
      await this.handleMediumRiskActivity(userId, activity, fraudScore, metadata);
      return { isFraud: false, score: fraudScore, action: 'flagged' };
    }

    return { isFraud: false, score: fraudScore, action: 'allowed' };
  }

  /**
   * Calculate fraud score based on various factors
   */
  async calculateFraudScore(userId, activity, metadata) {
    let score = 0;
    const factors = [];

    // Check for rapid successive requests
    const recentActivity = await this.getRecentActivity(userId, activity, 5); // last 5 minutes
    if (recentActivity.length > 10) {
      score += 0.3;
      factors.push('rapid_requests');
    }

    // Check for unusual IP patterns
    if (metadata.ip && await this.isUnusualIP(userId, metadata.ip)) {
      score += 0.2;
      factors.push('unusual_ip');
    }

    // Check for known malicious patterns
    if (await this.hasKnownMaliciousPatterns(metadata)) {
      score += 0.4;
      factors.push('malicious_patterns');
    }

    // Check for account age and activity patterns
    const user = await User.findById(userId);
    if (user && this.isNewAccount(user.createdAt)) {
      score += 0.1;
      factors.push('new_account');
    }

    // Check for payment fraud indicators
    if (activity === 'payment' && await this.hasPaymentFraudIndicators(metadata)) {
      score += 0.3;
      factors.push('payment_fraud');
    }

    await this.logSecurityEvent('fraud_detection', userId, {
      activity,
      score,
      factors,
      metadata
    });

    return Math.min(score, 1.0);
  }

  /**
   * Handle high-risk activities
   */
  async handleHighRiskActivity(userId, activity, score, metadata) {
    // Block user temporarily
    await this.temporaryBlockUser(userId, 'fraud_detection');
    
    // Create security alert
    await SecurityAlert.create({
      userId,
      type: 'fraud_detection',
      severity: 'high',
      activity,
      score,
      metadata,
      status: 'active',
      createdAt: new Date()
    });

    // Notify administrators
    await this.notifyAdministrators('high_risk_activity', {
      userId,
      activity,
      score,
      metadata
    });
  }

  /**
   * Handle medium-risk activities
   */
  async handleMediumRiskActivity(userId, activity, score, metadata) {
    // Flag for review
    await SecurityAlert.create({
      userId,
      type: 'fraud_detection',
      severity: 'medium',
      activity,
      score,
      metadata,
      status: 'flagged',
      createdAt: new Date()
    });

    // Log for monitoring
    await this.logSecurityEvent('medium_risk_activity', userId, {
      activity,
      score,
      metadata
    });
  }

  /**
   * Check for suspicious activity patterns
   */
  async checkSuspiciousActivity(userId, activity) {
    const key = `${userId}_${activity}`;
    const now = Date.now();
    
    if (!this.suspiciousActivities.has(key)) {
      this.suspiciousActivities.set(key, []);
    }

    const activities = this.suspiciousActivities.get(key);
    activities.push(now);

    // Keep only last 10 minutes of activity
    const tenMinutesAgo = now - (10 * 60 * 1000);
    const recentActivities = activities.filter(time => time > tenMinutesAgo);
    this.suspiciousActivities.set(key, recentActivities);

    // Check for suspicious patterns
    if (recentActivities.length > 20) {
      await this.logSecurityEvent('suspicious_activity', userId, {
        activity,
        count: recentActivities.length
      });
      return true;
    }

    return false;
  }

  /**
   * Comprehensive audit logging
   */
  async logSecurityEvent(event, userId, metadata = {}) {
    try {
      await AuditLog.create({
        userId,
        event,
        category: 'security',
        metadata,
        timestamp: new Date(),
        ip: metadata.ip || null,
        userAgent: metadata.userAgent || null
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Enhanced data encryption
   */
  encrypt(text) {
    if (!text) return text;
    
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Data decryption
   */
  decrypt(encryptedText) {
    if (!encryptedText) return encryptedText;
    
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  /**
   * Secure password hashing
   */
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Password verification
   */
  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  /**
   * Generate secure tokens
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Token blacklisting
   */
  async blacklistToken(token) {
    // In production, this would use Redis or database
    // For now, we'll use a simple in-memory approach
    if (!this.blacklistedTokens) {
      this.blacklistedTokens = new Set();
    }
    this.blacklistedTokens.add(token);
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token) {
    if (!this.blacklistedTokens) return false;
    return this.blacklistedTokens.has(token);
  }

  /**
   * Temporary user blocking
   */
  async temporaryBlockUser(userId, reason, duration = 30 * 60 * 1000) {
    const user = await User.findById(userId);
    if (user) {
      user.isBlocked = true;
      user.blockReason = reason;
      user.blockUntil = new Date(Date.now() + duration);
      await user.save();
    }
  }

  /**
   * Check compliance with various regulations
   */
  async checkCompliance(data, type) {
    const results = {
      compliant: true,
      issues: [],
      recommendations: []
    };

    switch (type) {
      case 'gdpr':
        return await this.checkGDPRCompliance(data);
      case 'pci_dss':
        return await this.checkPCIDSSCompliance(data);
      default:
        return results;
    }
  }

  /**
   * GDPR compliance checking
   */
  async checkGDPRCompliance(data) {
    const results = {
      compliant: true,
      issues: [],
      recommendations: []
    };

    // Check for explicit consent
    if (!data.hasConsent) {
      results.compliant = false;
      results.issues.push('Missing explicit user consent');
    }

    // Check for data minimization
    if (data.collectsUnnecessaryData) {
      results.compliant = false;
      results.issues.push('Collecting unnecessary personal data');
    }

    // Check for right to be forgotten implementation
    if (!data.hasDataDeletionCapability) {
      results.compliant = false;
      results.issues.push('No data deletion capability implemented');
    }

    return results;
  }

  /**
   * PCI DSS compliance checking
   */
  async checkPCIDSSCompliance(data) {
    const results = {
      compliant: true,
      issues: [],
      recommendations: []
    };

    // Check for proper encryption
    if (!data.encryptedStorage) {
      results.compliant = false;
      results.issues.push('Payment data not properly encrypted');
    }

    // Check for secure transmission
    if (!data.httpsOnly) {
      results.compliant = false;
      results.issues.push('Payment data not transmitted over HTTPS');
    }

    return results;
  }

  // Helper methods
  async getRecentActivity(userId, activity, minutes) {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return await AuditLog.find({
      userId,
      event: activity,
      timestamp: { $gte: since }
    });
  }

  async isUnusualIP(userId, ip) {
    const recentIPs = await AuditLog.distinct('ip', {
      userId,
      timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // last 30 days
    });
    
    return !recentIPs.includes(ip);
  }

  async hasKnownMaliciousPatterns(metadata) {
    // This would typically check against known malicious patterns
    // For now, simple heuristics
    if (metadata.userAgent && metadata.userAgent.includes('bot')) {
      return true;
    }
    return false;
  }

  isNewAccount(createdAt) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return createdAt > sevenDaysAgo;
  }

  async hasPaymentFraudIndicators(metadata) {
    // Check for common payment fraud patterns
    if (metadata.amount && metadata.amount > 10000) {
      return true;
    }
    return false;
  }

  async notifyAdministrators(type, data) {
    // This would integrate with the NotificationService
    console.log(`Admin notification: ${type}`, data);
  }
}

module.exports = new SecurityService();
