import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
export const BACKEND_URL = API_BASE.replace('/api', '');

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor - add token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - auto-refresh on 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry refresh/logout calls themselves
      if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/logout')) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        isRefreshing = false;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        const res = await api.post('/auth/refresh', { refreshToken });
        const { token, refreshToken: newRefreshToken } = res.data.data;
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', newRefreshToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        processQueue(null, token);
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (phone) => api.post('/auth/login', { phone }),
  verifyOTP: (phone, otp) => api.post('/auth/verify-otp', { phone, otp }),
  resendOTP: (phone) => api.post('/auth/resend-otp', { phone }),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
  getMe: () => api.get('/auth/me'),
};

// User API
export const userAPI = {
  updateProfile: (data) => api.put('/users/profile', data),
  uploadAvatar: (formData) => api.post('/users/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getCredit: () => api.get('/users/credit'),
  updateLanguage: (language) => api.put('/users/language', { language }),
};

// Booking API
export const bookingAPI = {
  getAvailableSlots: (date, courtId) => api.get('/bookings/available-slots', { params: { date, courtId } }),
  getAvailableCoaches: (date, startTime, endTime) => api.get('/bookings/available-coaches', { params: { date, startTime, endTime } }),
  create: (data) => api.post('/bookings', data),
  confirmPayment: (id, data) => api.post(`/bookings/${id}/confirm-payment`, data),
  uploadPaymentSlip: (id, formData) => api.post(`/bookings/${id}/payment-slip`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getUpcoming: () => api.get('/bookings/upcoming'),
  getHistory: (params) => api.get('/bookings/history', { params }),
  getById: (id) => api.get(`/bookings/${id}`),
  cancel: (id, data) => api.put(`/bookings/${id}/cancel`, data),
};

// Court API
export const courtAPI = {
  getAll: () => api.get('/courts'),
  getById: (id) => api.get(`/courts/${id}`),
  create: (data) => api.post('/courts', data),
  update: (id, data) => api.put(`/courts/${id}`, data),
  delete: (id) => api.delete(`/courts/${id}`),
};

// Coach API
export const coachAPI = {
  getAll: () => api.get('/coaches'),
  getById: (id) => api.get(`/coaches/${id}`),
  getSchedule: (id, startDate, endDate) => api.get(`/coaches/${id}/schedule`, { params: { startDate, endDate } }),
  getStats: (id, month, year) => api.get(`/coaches/${id}/stats`, { params: { month, year } }),
  create: (data) => api.post('/coaches', data),
  update: (id, data) => api.put(`/coaches/${id}`, data),
  uploadAvatar: (id, formData) => api.post(`/coaches/${id}/avatar`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  delete: (id) => api.delete(`/coaches/${id}`),
};

// Admin API
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getTodayBookings: () => api.get('/admin/dashboard/today-bookings'),
  getBookings: (params) => api.get('/admin/bookings', { params }),
  confirmPayment: (id) => api.put(`/admin/bookings/${id}/confirm-payment`),
  updateBookingStatus: (id, status) => api.put(`/admin/bookings/${id}/status`, { status }),
  processRefund: (id) => api.put(`/admin/bookings/${id}/process-refund`),
  reassignCoach: (id, data) => api.put(`/admin/bookings/${id}/reassign-coach`, data),
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  getBusinessSummary: (period) => api.get('/admin/business-summary', { params: { period } }),
};

// Settings API
export const settingsAPI = {
  getAll: (category) => api.get('/settings', { params: { category } }),
  getPublic: () => api.get('/settings/public'),
  update: (key, data) => api.put(`/settings/${key}`, data),
  bulkUpdate: (settings) => api.post('/settings/bulk', { settings }),
  delete: (key) => api.delete(`/settings/${key}`),
};

export default api;
