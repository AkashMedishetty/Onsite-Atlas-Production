const Event = require('../models/Event');
const mongoose = require('mongoose');
const { createApiError } = require('../middleware/error');
const { sendSuccess } = require('../utils/responseFormatter');

exports.listRules = async (req,res,next)=>{
  try{
    const {eventId}=req.params;
    console.log('[listRules] eventId:', eventId);
    
    const event = await Event.findById(eventId);
    console.log('[listRules] event found:', !!event);
    if(!event) return next(createApiError(404,'Event not found'));
    
    console.log('[listRules] event.pricingRules length:', event.pricingRules?.length || 0);
    
    return res.json({success:true,message:'Pricing rules',data:event.pricingRules});
  }catch(error){
    return next(error);
  }
};

exports.createRule=async (req,res,next)=>{
  try{
    const {eventId}=req.params;
    const event=await Event.findById(eventId);
    if(!event) return next(createApiError(404,'Event not found'));
    event.pricingRules.push(req.body);
    await event.save();
    return sendSuccess(res,201,'Rule created',event.pricingRules[event.pricingRules.length-1]);
  } catch (error) {next(err);} };

exports.updateRule=async(req,res,next)=>{
  try{
    const {eventId,ruleId}=req.params;
    const event=await Event.findById(eventId);
    if(!event) return next(createApiError(404,'Event not found'));
    const rule=event.pricingRules.id(ruleId);
    if(!rule) return next(createApiError(404,'Rule not found'));
    Object.assign(rule,req.body);
    await event.save();
    return sendSuccess(res,200,'Rule updated',rule);
  } catch (error) {next(err);} };

exports.deleteRule=async(req,res,next)=>{
  try{
    const {eventId,ruleId}=req.params;
    const event=await Event.findById(eventId);
    if(!event) return next(createApiError(404,'Event not found'));
    const rule=event.pricingRules.id(ruleId);
    if(!rule) return next(createApiError(404,'Rule not found'));
    rule.remove();
    await event.save();
    return sendSuccess(res,200,'Rule deleted');
  } catch (error) {next(err);} };

exports.bulkSaveRules = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { rules } = req.body;
    if (!Array.isArray(rules)) return next(createApiError(400, 'Rules must be an array'));
    const event = await Event.findById(eventId);
    if (!event) return next(createApiError(404, 'Event not found'));
    const before = event.pricingRules ? JSON.parse(JSON.stringify(event.pricingRules)) : [];
    event.pricingRules = rules;
    await event.save();
    const after = event.pricingRules ? JSON.parse(JSON.stringify(event.pricingRules)) : [];
    const userId = req.user?._id || null;
    const AuditLog = require('../models/AuditLog');
const StandardErrorHandler = require('../utils/standardErrorHandler');
    await AuditLog.create({ event: event._id, user: userId, action: 'pricingRules.bulkUpdate', before, after });
    return sendSuccess(res, 200, 'Bulk pricing rules saved', event.pricingRules);
  } catch (error) { next(err); }
}; 