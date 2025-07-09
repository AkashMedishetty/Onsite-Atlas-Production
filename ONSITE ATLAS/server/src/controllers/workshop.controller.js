const Event = require('../models/Event');
const { createApiError } = require('../middleware/error');
const { sendSuccess } = require('../utils/responseFormatter');

exports.listWorkshops = async (req,res,next)=>{
  try{
    const {eventId}=req.params;
    const event=await Event.findById(eventId).select('workshops');
    if(!event) return next(createApiError(404,'Event not found'));
    return sendSuccess(res,200,'Workshops',event.workshops||[]);
  } catch (error) {next(err);} };

exports.createWorkshop=async(req,res,next)=>{
  try{
    const {eventId}=req.params;
    const event=await Event.findById(eventId);
    if(!event) return next(createApiError(404,'Event not found'));
    event.workshops.push(req.body);
    await event.save();
    return sendSuccess(res,201,'Workshop created',event.workshops[event.workshops.length-1]);
  } catch (error) {next(err);} };

exports.updateWorkshop=async(req,res,next)=>{
  try{
    const {eventId,workshopId}=req.params;
    const event=await Event.findById(eventId);
    if(!event) return next(createApiError(404,'Event not found'));
    const w=event.workshops.id(workshopId);
    if(!w) return next(createApiError(404,'Workshop not found'));
    Object.assign(w,req.body);
    await event.save();
    return sendSuccess(res,200,'Workshop updated',w);
  } catch (error) {next(err);} };

exports.deleteWorkshop=async(req,res,next)=>{
  try{
    const {eventId,workshopId}=req.params;
    const event=await Event.findById(eventId);
    if(!event) return next(createApiError(404,'Event not found'));
    const w=event.workshops.id(workshopId);
    if(!w) return next(createApiError(404,'Workshop not found'));
    w.remove();
    await event.save();
    return sendSuccess(res,200,'Workshop deleted');
  } catch (error) {next(err);} }; 