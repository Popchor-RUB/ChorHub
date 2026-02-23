import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const state = useAuthStore.getState();

  if (state.adminSession?.token) {
    config.headers['Authorization'] = `Bearer ${state.adminSession.token}`;
  } else if (state.memberSession?.token) {
    config.headers['X-Member-Token'] = state.memberSession.token;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const state = useAuthStore.getState();
      if (state.adminSession) {
        state.logoutAdmin();
        window.location.href = `/admin/login`;
      } else if (state.memberSession) {
        state.logoutMember();
        window.location.href = `/login`;
      }
    }
    return Promise.reject(error);
  },
);

export const adminApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string }>('/auth/admin/login', { username, password }),

  passkeyChallenge: (username: string) =>
    api.post('/auth/admin/passkey/challenge', { username }),

  passkeyVerify: (adminId: string, assertion: unknown) =>
    api.post<{ token: string }>('/auth/admin/passkey/verify', { adminId, assertion }),

  passkeyRegisterChallenge: () =>
    api.post('/auth/admin/passkey/register/challenge'),

  passkeyRegisterVerify: (attestation: unknown) =>
    api.post('/auth/admin/passkey/register/verify', { attestation }),
};

export const memberAuthApi = {
  requestMagicLink: (email: string) =>
    api.post('/auth/magic-link/request', { email }),

  verifyMagicLink: (token: string) =>
    api.get<{ token: string; member: { id: string; firstName: string; lastName: string; choirVoice: string } }>(
      `/auth/magic-link/verify?token=${token}`,
    ),
};

export const rehearsalsApi = {
  getUpcoming: () => api.get('/rehearsals'),
  getAllForMember: () => api.get('/rehearsals?all=true'), // member auth, returns past + upcoming
  getAll: () => api.get('/rehearsals/all'),              // admin auth only
  create: (data: { date: string; title: string; description?: string }) =>
    api.post('/rehearsals', data),
  update: (id: string, data: Partial<{ date: string; title: string; description: string }>) =>
    api.patch(`/rehearsals/${id}`, data),
  remove: (id: string) => api.delete(`/rehearsals/${id}`),
};

export const attendanceApi = {
  setPlan: (rehearsalId: string, response: 'CONFIRMED' | 'DECLINED') =>
    api.put(`/attendance/plans/${rehearsalId}`, { response }),
  deletePlan: (rehearsalId: string) =>
    api.delete(`/attendance/plans/${rehearsalId}`),
  getRecords: (rehearsalId: string) => api.get(`/attendance/records/${rehearsalId}`),
  bulkSetRecords: (rehearsalId: string, memberIds: string[]) =>
    api.put(`/attendance/records/${rehearsalId}`, { memberIds }),
  getFutureOverview: () => api.get('/attendance/overview/future'),
  getPastOverview: () => api.get('/attendance/overview/past'),
};

export const adminMembersApi = {
  import: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/admin/members/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: () => api.get('/admin/members'),
  export: () => api.get('/admin/members/export', { responseType: 'blob' }),
  search: (q: string) => api.get(`/admin/members/search?q=${encodeURIComponent(q)}`),
  history: (id: string) => api.get(`/admin/members/${id}/history`),
  rehearsals: (id: string) => api.get(`/admin/members/${id}/rehearsals`),
};

export const generalInfoApi = {
  get: () => api.get('/general-info'),
  update: (markdownContent: string, sendPushNotification = false) =>
    api.patch('/general-info', { markdownContent, sendPushNotification }),
};

export const pushApi = {
  getVapidPublicKey: () => api.get<{ publicKey: string }>('/push/vapid-public-key'),
  subscribe: (sub: { endpoint: string; p256dh: string; auth: string }) =>
    api.post('/push/subscribe', sub),
  unsubscribe: (endpoint: string) =>
    api.delete('/push/unsubscribe', { data: { endpoint } }),
};
