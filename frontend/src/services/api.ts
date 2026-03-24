import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { withBasePath } from '../utils/basePath';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const BASE_PATH = import.meta.env.VITE_BASE_PATH ?? '/';

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
        window.location.href = withBasePath('/admin/login', BASE_PATH);
      } else if (state.memberSession) {
        state.logoutMember();
        window.location.href = withBasePath('/login', BASE_PATH);
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

type MemberAuthResponse = { token: string; member: { id: string; firstName: string; lastName: string } };

export const memberAuthApi = {
  requestMagicLink: (email: string) =>
    api.post('/auth/magic-link/request', { email }),

  verifyMagicLink: (token: string) =>
    api.get<MemberAuthResponse>(`/auth/magic-link/verify?token=${token}`),

  verifyCode: (email: string, code: string) =>
    api.post<MemberAuthResponse>('/auth/magic-link/verify-code', { email, code }),
};

export const rehearsalsApi = {
  getUpcoming: () => api.get('/rehearsals'),
  getAllForMember: () => api.get('/rehearsals?all=true'), // member auth, returns past + upcoming
  getAll: () => api.get('/rehearsals/all'),              // admin auth only
  create: (data: {
    date: string;
    title: string;
    description?: string;
    location?: string;
    durationMinutes?: number;
  }) =>
    api.post('/rehearsals', data),
  update: (
    id: string,
    data: Partial<{
      date: string;
      title: string;
      description: string;
      location: string;
      durationMinutes: number;
    }>,
  ) =>
    api.patch(`/rehearsals/${id}`, data),
  remove: (id: string) => api.delete(`/rehearsals/${id}`),
};

const normalizedApiBaseUrl = BASE_URL.replace(/\/+$/, '');

export const memberCalendarApi = {
  getIcsUrl: () =>
    `${normalizedApiBaseUrl}/rehearsals/calendar.ics`,
  getWebcalUrl: () => {
    const icsUrl = memberCalendarApi.getIcsUrl();
    if (icsUrl.startsWith('https://')) return `webcal://${icsUrl.substring('https://'.length)}`;
    if (icsUrl.startsWith('http://')) return `webcal://${icsUrl.substring('http://'.length)}`;
    return icsUrl;
  },
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
  create: (data: { firstName: string; lastName: string; email: string; voiceId?: string }) =>
    api.post('/admin/members', data),
  import: (file: File, sendEmails: boolean) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('sendEmails', String(sendEmails));
    return api.post('/admin/members/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: () => api.get('/admin/members'),
  export: () => api.get('/admin/members/export', { responseType: 'blob' }),
  search: (q: string) => api.get(`/admin/members/search?q=${encodeURIComponent(q)}`),
  history: (id: string) => api.get(`/admin/members/${id}/history`),
  rehearsals: (id: string) => api.get(`/admin/members/${id}/rehearsals`),
  delete: (id: string) => api.delete(`/admin/members/${id}`),
  setAttendancePlan: (memberId: string, rehearsalId: string, response: 'CONFIRMED' | 'DECLINED' | null) =>
    api.put(`/admin/members/${memberId}/attendance-plans/${rehearsalId}`, { response }),
};

export const generalInfoApi = {
  get: () => api.get('/general-info'),
  update: (markdownContent: string, sendPushNotification = false) =>
    api.patch('/general-info', { markdownContent, sendPushNotification }),
};

export const adminPushApi = {
  getStats: () => api.get<{ subscriberCount: number }>('/push/admin/stats'),
  sendToAll: (title: string, body: string, url?: string) =>
    api.post('/push/admin/send', { title, body, url }),
};

export const pushApi = {
  getVapidPublicKey: () => api.get<{ publicKey: string }>('/push/vapid-public-key'),
  subscribe: (sub: { endpoint: string; p256dh: string; auth: string }) =>
    api.post('/push/subscribe', sub),
  unsubscribe: (endpoint: string) =>
    api.delete('/push/unsubscribe', { data: { endpoint } }),
};

export const choirVoicesApi = {
  list: () => api.get('/choir-voices'),
  create: (name: string, sortOrder?: number) => api.post('/choir-voices', { name, sortOrder }),
  update: (id: string, data: { name?: string; sortOrder?: number }) =>
    api.patch(`/choir-voices/${id}`, data),
  remove: (id: string) => api.delete(`/choir-voices/${id}`),
};

export const membersApi = {
  me: () => api.get('/members/me'),
  updateVoice: (voiceId: string | null) => api.patch('/members/me/voice', { voiceId }),
};
