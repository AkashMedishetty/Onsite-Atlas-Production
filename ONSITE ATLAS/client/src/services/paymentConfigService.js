import api from './api';

const paymentConfigService = {
  get: async (eventId) => {
    const res = await api.get(`/events/${eventId}/payment-config`);
    return res.data;
  },
  update: async (eventId, data) => {
    const res = await api.put(`/events/${eventId}/payment-config`, data);
    return res.data;
  },
};

export default paymentConfigService; 