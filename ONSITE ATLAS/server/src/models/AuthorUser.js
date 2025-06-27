const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * AuthorUser – separate lightweight account type for users who only submit abstracts.
 * We keep it isolated from the admin/staff User collection to avoid unintended privilege overlap.
 * If at some point you decide to merge with the main User model, it is very easy to migrate.
 */
const authorUserSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    unique: true,
  },
  mobile: {
    type: String,
    required: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Instance method to compare passwords
authorUserSchema.methods.checkPassword = async function (plainPwd) {
  return bcrypt.compare(plainPwd, this.passwordHash);
};

module.exports = mongoose.model('AuthorUser', authorUserSchema); 