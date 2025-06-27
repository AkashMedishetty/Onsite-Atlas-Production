import api from './api';

const systemSettingsService = {
  getSettings: async () => {
    const res = await api.get('/system-settings');
    return res.data;
  },
  updateSettings: async (data) => {
    const res = await api.put('/system-settings', data);
    return res.data;
  }
};

export default systemSettingsService; 