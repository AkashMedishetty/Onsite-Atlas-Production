import api from './api';

const pricingService={
  list: async(eventId)=>{
    const res=await api.get(`/events/${eventId}/pricing-rules`);
    return res.data;
  },
  create: async(eventId,data)=>{
    const res=await api.post(`/events/${eventId}/pricing-rules`,data);
    return res.data;
  },
  update: async(eventId,ruleId,data)=>{
    const res=await api.put(`/events/${eventId}/pricing-rules/${ruleId}`,data);
    return res.data;
  },
  remove: async(eventId,ruleId)=>{
    const res=await api.delete(`/events/${eventId}/pricing-rules/${ruleId}`);
    return res.data;
  },
  bulkSave: async (eventId, rules) => {
    const res = await api.post(`/events/${eventId}/pricing-rules/bulk`, { rules });
    return res.data;
  }
};
export default pricingService; 