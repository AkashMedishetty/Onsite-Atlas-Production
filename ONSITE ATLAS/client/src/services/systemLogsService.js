import axios from 'axios';
import { getAuthHeader } from '../utils/authUtils';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const getLogs = async ({ level = 'all', limit = 200 } = {}) => {
  const response = await axios.get(`${API_BASE}/system-logs`, {
    params: { level, limit },
    headers: { ...getAuthHeader() }
  });
  return response.data;
};

export const downloadLogs = async () => {
  const resp = await axios.get(`${API_BASE}/system-logs/download`, {
    responseType: 'blob',
    headers: { ...getAuthHeader() }
  });
  return resp;
};

export default {
  getLogs,
  downloadLogs
}; 