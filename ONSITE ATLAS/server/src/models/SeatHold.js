const mongoose = require('mongoose');

/**
 * Holds a workshop seat for a limited period while payment is pending.
 */
const seatHoldSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  workshopId: { type: mongoose.Schema.Types.ObjectId, required: true },
  registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('SeatHold', seatHoldSchema); 