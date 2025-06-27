import apiAuthor from './apiAuthor';
import { AUTHOR_TOKEN_KEY } from '../config';

const authorAuthService = {
  signup: async (eventId, name, email, mobile, password) => {
    try {
      const response = await apiAuthor.post('/author-auth/signup', { eventId, name, email, mobile, password });
      if (response.data && response.data.token) {
        localStorage.setItem(AUTHOR_TOKEN_KEY, response.data.token);
      }
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Signup failed'
      };
    }
  },
  login: async (email, password) => {
    try {
      const response = await apiAuthor.post('/author-auth/login', { email, password });
      if (response.data && response.data.token) {
        localStorage.setItem(AUTHOR_TOKEN_KEY, response.data.token);
      }
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Login failed'
      };
    }
  },
  logout: () => {
    localStorage.removeItem(AUTHOR_TOKEN_KEY);
  }
};

export default authorAuthService; 