import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import type { MemberCheckinQr } from '../types';
import { useAuthStore } from '../store/authStore';
import { withBasePath } from '../utils/basePath';

function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (!configured) return '/api';

  if (import.meta.env.DEV) {
    try {
      const url = new URL(configured);
      const browserHost = window.location.hostname;
      const isLocalhostConfig = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      const isLocalhostBrowser = browserHost === 'localhost' || browserHost === '127.0.0.1';

      if (isLocalhostConfig && !isLocalhostBrowser) {
        url.hostname = browserHost;
        return url.toString();
      }
    } catch {
      // Ignore non-absolute URLs such as '/api'.
    }
  }

  return configured;
}

const BASE_URL = resolveApiBaseUrl();
const BASE_PATH = import.meta.env.VITE_BASE_PATH ?? '/';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const state = useAuthStore.getState();
  const headers = axios.AxiosHeaders.from(config.headers);
  const isAdminRoute = window.location.pathname.startsWith(withBasePath('/admin', BASE_PATH));

  // Ensure we never send both auth mechanisms on the same request.
  headers.delete('Authorization');
  headers.delete('X-Member-Token');

  if (isAdminRoute && state.adminSession?.token) {
    headers.set('Authorization', `Bearer ${state.adminSession.token}`);
  } else if (!isAdminRoute && state.memberSession?.token) {
    headers.set('X-Member-Token', state.memberSession.token);
  } else if (state.adminSession?.token) {
    headers.set('Authorization', `Bearer ${state.adminSession.token}`);
  } else if (state.memberSession?.token) {
    headers.set('X-Member-Token', state.memberSession.token);
  }

  config.headers = headers;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const originalConfig = error.config as (InternalAxiosRequestConfig & { _authRetryCount?: number }) | undefined;
      const requestHeaders = axios.AxiosHeaders.from(originalConfig?.headers);
      const retryCount = originalConfig?._authRetryCount ?? 0;
      const hadAdminAuth = Boolean(requestHeaders.get('Authorization'));
      const hadMemberAuth = Boolean(requestHeaders.get('X-Member-Token'));

      // Ignore 401s from unauthenticated endpoints (e.g. wrong login code).
      if (!hadAdminAuth && !hadMemberAuth) {
        return Promise.reject(error);
      }

      // Retry once to avoid hard logout on transient deploy-time 401s.
      if (originalConfig && retryCount < 1) {
        originalConfig._authRetryCount = retryCount + 1;
        return new Promise((resolve) => setTimeout(resolve, 500))
          .then(() => api.request(originalConfig));
      }

      const state = useAuthStore.getState();

      if (hadAdminAuth && state.adminSession) {
        state.logoutAdmin();
        window.location.href = withBasePath('/admin/login', BASE_PATH);
      } else if (hadMemberAuth && state.memberSession) {
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
    isOptional?: boolean;
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
      isOptional: boolean;
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

export const checkinApi = {
  getMemberQr: () => api.get<MemberCheckinQr>('/members/me/checkin-qr'),
  getPublicKey: () => api.get<{ publicKey: string }>('/attendance/checkin/public-key'),
};
