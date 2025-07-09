const Event = require('../models/Event');
const SeatHold = require('../models/SeatHold');
const mongoose = require('mongoose');
const { sendSuccess } = require('../utils/responseFormatter');
const createApiError = require('../middleware/error').createApiError;

/**
 * Compute pricing and optionally hold workshop seats.
 * This is a simplistic first version – real pricingRules evaluation TBD.
 */
exports.quoteRegistration = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { audience, category, workshopIds = [] } = req.body;

    if (!mongoose.Types.ObjectId.isValid(eventId)) return next(createApiError(400, 'Invalid eventId'));
    const event = await Event.findById(eventId);
    if (!event) return next(createApiError(404, 'Event not found'));

    // ----------------------------
    // 1. Price Rule Evaluation
    // ----------------------------
    const now = new Date();
    const activeRules = (event.pricingRules || []).filter(r => {
      if (!r.active) return false;
      if (r.startDate && now < r.startDate) return false;
      if (r.endDate && now > r.endDate) return false;
      if (r.audience && r.audience !== audience) return false;
      if (r.category && r.category !== category) return false;
      return true;
    });

    if (!activeRules.length) {
      return next(createApiError(400, 'No pricing rule matches the provided audience/category/date'));
    }

    // Sort by priority DESC then price ASC
    activeRules.sort((a,b)=>{
      if (a.priority !== b.priority) return b.priority - a.priority; // higher priority first
      return a.priceCents - b.priceCents;
    });

    // If top rule is exclusive and more than one rule of same priority exists, ensure exclusivity
    const topRule = activeRules[0];
    if (topRule.exclusive && activeRules.length > 1 && activeRules[1].priority === topRule.priority) {
      return next(createApiError(400, 'Ambiguous pricing: multiple rules match with same priority but marked exclusive.'));
    }

    // Detect ambiguous same-priority diff-price (non-exclusive)
    if (!topRule.exclusive) {
      const samePriority = activeRules.filter(r=> r.priority === topRule.priority);
      if (samePriority.length > 1) {
        // We'll use lowest price but log warning
        console.warn('[PricingRules] Ambiguous overlap for event', eventId, samePriority.map(r=>r._id.toString()));
      }
    }

    const baseRule = topRule; // already sorted

    let amountCents = baseRule.priceCents;

    // ----------------------------
    // 2. Workshops processing
    // ----------------------------
    const selectedWorkshops = (event.workshops || []).filter(w => workshopIds.includes(w._id.toString()));

    // Validate each workshop
    for (const w of selectedWorkshops) {
      if (!w.active) return next(createApiError(400, `Workshop ${w.name} is not active`));
      if (w.allowedAudiences && w.allowedAudiences.length && !w.allowedAudiences.includes(audience)) {
        return next(createApiError(400, `Workshop ${w.name} not allowed for audience ${audience}`));
      }

      // Seat availability check
      if (w.seatLimit && w.seatLimit > 0) {
        const Registration = require('../models/Registration');
        const totalConfirmed = await Registration.countDocuments({ event: eventId, 'workshopsSelected.workshopId': w._id });
        const held = await SeatHold.countDocuments({ event: eventId, workshopId: w._id, expiresAt: { $gt: now } });
        if (totalConfirmed + held >= w.seatLimit) {
          return next(createApiError(400, `Workshop ${w.name} is sold out`));
        }
      }

      amountCents += w.priceCents;
    }

    // Taxes & Fees
    const gstPct = event.paymentConfig?.extra?.gstPercentage || 0;
    const vatPct = event.paymentConfig?.extra?.vatPercentage || 0;
    const convPct = event.paymentConfig?.extra?.convenienceFeePercentage || 0;
    const fixedFee = event.paymentConfig?.extra?.fixedFee || 0;

    const inclusive = event.paymentConfig?.extra?.inclusiveTax === true;
    if(inclusive){
      // prices already include tax; no markup, but we keep amountCents
    }else{
      amountCents = Math.round(amountCents * (1 + (gstPct+vatPct+convPct)/100) + fixedFee*100);
    }

    // Event-level audience workshop limit
    const awl = event.audienceWorkshopLimit?.get?.(audience);
    if (awl && workshopIds.length > awl) {
      return next(createApiError(400, `Audience ${audience} can pick maximum ${awl} workshops`));
    }

    // ----------------------------
    // 3. Create seat holds (5 min)
    // ----------------------------
    const holds = [];
    const holdMinutes = event.paymentConfig?.extra?.seatHoldTtlMinutes || 5;
    const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);
    for (const w of selectedWorkshops) {
      const hold = await SeatHold.create({ event: eventId, workshopId: w._id, expiresAt });
      holds.push(hold._id);
    }

    return sendSuccess(res, 200, 'Quote generated', {
      amountCents,
      currency: baseRule.currency || 'INR',
      seatHoldIds: holds,
      baseRuleId: baseRule._id,
      workshopIds,
    });
  } catch (error) {
    next(err);
  }
}; 