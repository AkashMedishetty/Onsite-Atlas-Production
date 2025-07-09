const mongoose = require('mongoose');

const installmentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  dueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'due', 'paid', 'overdue', 'failed'],
    default: 'pending'
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  paidAt: Date,
  overdueNotificationSent: {
    type: Boolean,
    default: false
  },
  remindersSent: {
    type: Number,
    default: 0
  },
  lastReminderSent: Date
}, {
  timestamps: true
});

const paymentPlanSchema = new mongoose.Schema({
  registration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
    required: true
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  provider: {
    type: String,
    required: true
  },
  installments: [installmentSchema],
  autoCharge: {
    type: Boolean,
    default: false
  },
  savedPaymentMethod: {
    provider: String,
    paymentMethodId: String,
    last4: String,
    type: String, // card, bank_account, etc.
    expiryMonth: Number,
    expiryYear: Number
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'defaulted'],
    default: 'active'
  },
  completedAt: Date,
  cancelledAt: Date,
  defaultedAt: Date,
  cancellationReason: String,
  metadata: {
    originalAmount: Number,
    discountApplied: Number,
    taxAmount: Number,
    setupFee: Number
  },
  reminderSettings: {
    enabled: {
      type: Boolean,
      default: true
    },
    daysBefore: {
      type: Number,
      default: 3
    },
    maxReminders: {
      type: Number,
      default: 3
    },
    escalationDays: {
      type: Number,
      default: 7
    }
  }
}, {
  timestamps: true
});

// Indexes
paymentPlanSchema.index({ registration: 1, status: 1 });
paymentPlanSchema.index({ event: 1, status: 1 });
paymentPlanSchema.index({ 'installments.dueDate': 1, 'installments.status': 1 });
paymentPlanSchema.index({ status: 1, createdAt: 1 });

// Virtual for total paid amount
paymentPlanSchema.virtual('totalPaid').get(function() {
  return this.installments
    .filter(installment => installment.status === 'paid')
    .reduce((total, installment) => total + installment.amount, 0);
});

// Virtual for remaining amount
paymentPlanSchema.virtual('remainingAmount').get(function() {
  return this.totalAmount - this.totalPaid;
});

// Virtual for next due installment
paymentPlanSchema.virtual('nextDueInstallment').get(function() {
  return this.installments
    .filter(installment => installment.status === 'due')
    .sort((a, b) => a.dueDate - b.dueDate)[0];
});

// Virtual for overdue installments
paymentPlanSchema.virtual('overdueInstallments').get(function() {
  const now = new Date();
  return this.installments.filter(installment => 
    installment.status === 'due' && installment.dueDate < now
  );
});

// Static methods
paymentPlanSchema.statics.getPlansWithDueInstallments = async function() {
  const now = new Date();
  return await this.find({
    status: 'active',
    'installments.status': 'due',
    'installments.dueDate': { $lte: now }
  }).populate('registration event');
};

paymentPlanSchema.statics.getPlansNeedingReminders = async function() {
  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() + 3); // 3 days from now
  
  return await this.find({
    status: 'active',
    'installments.status': 'due',
    'installments.dueDate': { $lte: reminderDate },
    'installments.remindersSent': { $lt: 3 },
    $or: [
      { 'installments.lastReminderSent': { $exists: false } },
      { 'installments.lastReminderSent': { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    ]
  }).populate('registration event');
};

paymentPlanSchema.statics.getOverduePlans = async function() {
  const now = new Date();
  return await this.find({
    status: 'active',
    'installments.status': 'due',
    'installments.dueDate': { $lt: now },
    'installments.overdueNotificationSent': false
  }).populate('registration event');
};

// Instance methods
paymentPlanSchema.methods.markInstallmentPaid = async function(installmentId, paymentId) {
  const installment = this.installments.id(installmentId);
  if (!installment) {
    throw new Error('Installment not found');
  }
  
  installment.status = 'paid';
  installment.paidAt = new Date();
  installment.paymentId = paymentId;
  
  // Mark next installment as due if exists
  const nextInstallment = this.installments.find(i => 
    i.status === 'pending' && i.dueDate > installment.dueDate
  );
  if (nextInstallment) {
    nextInstallment.status = 'due';
  }
  
  // Check if all installments are paid
  const allPaid = this.installments.every(i => i.status === 'paid');
  if (allPaid) {
    this.status = 'completed';
    this.completedAt = new Date();
  }
  
  return await this.save();
};

paymentPlanSchema.methods.markInstallmentOverdue = async function(installmentId) {
  const installment = this.installments.id(installmentId);
  if (!installment) {
    throw new Error('Installment not found');
  }
  
  installment.status = 'overdue';
  installment.overdueNotificationSent = true;
  
  return await this.save();
};

paymentPlanSchema.methods.sendReminder = async function(installmentId) {
  const installment = this.installments.id(installmentId);
  if (!installment) {
    throw new Error('Installment not found');
  }
  
  installment.remindersSent += 1;
  installment.lastReminderSent = new Date();
  
  // Send notification
  const NotificationService = require('../services/NotificationService');
  await NotificationService.triggerWorkflow(
    'payment_reminder',
    this.event,
    this._id,
    {
      installmentAmount: installment.amount,
      dueDate: installment.dueDate,
      totalRemaining: this.remainingAmount
    }
  );
  
  return await this.save();
};

paymentPlanSchema.methods.cancel = async function(reason) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  
  // Cancel all pending/due installments
  this.installments.forEach(installment => {
    if (installment.status === 'pending' || installment.status === 'due') {
      installment.status = 'cancelled';
    }
  });
  
  return await this.save();
};

paymentPlanSchema.methods.reschedule = async function(newSchedule) {
  if (this.status !== 'active') {
    throw new Error('Can only reschedule active payment plans');
  }
  
  // Update installment due dates
  newSchedule.forEach((scheduleItem, index) => {
    const installment = this.installments[index];
    if (installment && installment.status !== 'paid') {
      installment.dueDate = scheduleItem.dueDate;
      if (scheduleItem.amount) {
        installment.amount = scheduleItem.amount;
      }
    }
  });
  
  return await this.save();
};

paymentPlanSchema.methods.addInstallment = async function(amount, dueDate) {
  this.installments.push({
    amount,
    dueDate,
    status: 'pending'
  });
  
  this.totalAmount += amount;
  
  return await this.save();
};

paymentPlanSchema.methods.getPaymentSummary = function() {
  return {
    totalAmount: this.totalAmount,
    totalPaid: this.totalPaid,
    remainingAmount: this.remainingAmount,
    installmentsTotal: this.installments.length,
    installmentsPaid: this.installments.filter(i => i.status === 'paid').length,
    installmentsPending: this.installments.filter(i => i.status === 'pending').length,
    installmentsDue: this.installments.filter(i => i.status === 'due').length,
    installmentsOverdue: this.installments.filter(i => i.status === 'overdue').length,
    nextDueInstallment: this.nextDueInstallment,
    overdueInstallments: this.overdueInstallments,
    status: this.status,
    autoCharge: this.autoCharge
  };
};

// Pre-save middleware
paymentPlanSchema.pre('save', function(next) {
  // Update overdue installments
  const now = new Date();
  this.installments.forEach(installment => {
    if (installment.status === 'due' && installment.dueDate < now) {
      installment.status = 'overdue';
    }
  });
  
  next();
});

module.exports = mongoose.model('PaymentPlan', paymentPlanSchema);
