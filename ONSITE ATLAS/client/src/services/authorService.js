import api from './api';

const authorService = {
  async getAuthors(eventId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = `/events/${eventId}/abstract-authors${query ? `?${query}` : ''}`;
    return api.get(url);
  },
  async exportAuthors(eventId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = `/events/${eventId}/abstract-authors/export${query ? `?${query}` : ''}`;
    const response = await api.get(url, { responseType: 'blob' });
    // attach filename
    const disposition = response.headers['content-disposition'];
    let filename = 'authors_export.csv';
    if(disposition){
      const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^;"]+)/i);
      if(match && match[1]) filename = decodeURIComponent(match[1].replace(/"/g,''));
    }
    return { data: response.data, filename };
  }
};

export default authorService; 