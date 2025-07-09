import api from './api';

const workshopService={
  list: async(eventId)=>{
    const res=await api.get(`/events/${eventId}/workshops`);
    return res.data;
  },
  create: async(eventId,data)=>{
    const res=await api.post(`/events/${eventId}/workshops`,data);
    return res.data;
  },
  update: async(eventId,id,data)=>{
    const res=await api.put(`/events/${eventId}/workshops/${id}`,data);
    return res.data;
  },
  remove: async(eventId,id)=>{
    const res=await api.delete(`/events/${eventId}/workshops/${id}`);
    return res.data;
  }
};
export default workshopService; 