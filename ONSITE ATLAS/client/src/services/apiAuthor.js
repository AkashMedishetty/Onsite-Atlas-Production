import axios from 'axios';
import { API_URL, AUTHOR_TOKEN_KEY } from '../config';
import { getAuthorAuthHeader } from '../utils/authUtils';
import { toast } from 'react-toastify';

const apiAuthor = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

apiAuthor.interceptors.request.use(
  (config) => {
    const authHeaders = getAuthorAuthHeader();
    if (authHeaders.Authorization) {
      config.headers['Authorization'] = authHeaders.Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiAuthor.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(AUTHOR_TOKEN_KEY);
      toast.error(error.response?.data?.message || 'Session expired. Please log in again.');
    }
    return Promise.reject(error);
  }
);

export default apiAuthor; 