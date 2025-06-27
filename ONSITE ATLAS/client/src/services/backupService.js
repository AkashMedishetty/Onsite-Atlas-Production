import axios from 'axios';
import { getAuthHeader } from '../utils/authUtils';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const getAuthHeaders = () => {
  return getAuthHeader();
};

const downloadBackup = async () => {
  const response = await axios.get(`${API_BASE}/backup`, {
    headers: {
      ...getAuthHeaders()
    },
    responseType: 'blob'
  });
  return response;
};

const restoreBackup = async (file) => {
  const formData = new FormData();
  formData.append('backup', file);
  const response = await axios.post(`${API_BASE}/backup`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...getAuthHeaders()
    }
  });
  return response.data;
};

export default {
  downloadBackup,
  restoreBackup
}; 