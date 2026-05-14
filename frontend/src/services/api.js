import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000, // 60 second timeout for AI calls
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Fetch a paginated list endpoint.
 * Returns { data, pagination }
 */
export async function fetchPaginated(path, params = {}) {
  const res = await api.get(path, { params: { page: 1, limit: 20, ...params } });
  // Handle both paginated { data, pagination } and legacy flat array responses
  if (Array.isArray(res.data)) {
    return { data: res.data, pagination: { page: 1, limit: res.data.length, total: res.data.length, totalPages: 1 } };
  }
  return res.data;
}

export default api;
