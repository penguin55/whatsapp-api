import type { ApiResponse, Profile, QrStatus, Session } from './types';

let csrfToken = '';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
    headers.set('x-csrf-token', csrfToken);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
  });
  const payload = (await response.json().catch(() => ({}))) as Partial<ApiResponse<T>>;
  if (!response.ok) {
    throw new ApiError(payload.error ?? `Request failed (${response.status})`, response.status);
  }
  return payload.data as T;
}

function useProfile(profile: Profile): Profile {
  csrfToken = profile.csrf_token;
  return profile;
}

export const api = {
  session: () => request<Profile>('/api/auth/dashboard/session').then(useProfile),
  login: (username: string, password: string) =>
    request<Profile>('/api/auth/dashboard/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }).then(useProfile),
  async logout() {
    await request('/api/auth/dashboard/logout', { method: 'POST' });
    csrfToken = '';
  },
  sessions: () => request<Session[]>('/api/sessions'),
  createSession: (input: { session_id?: string; webhook_url?: string }) =>
    request<QrStatus>('/api/session/create', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  deleteSession: (id: string) =>
    request(`/api/session/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  qr: (id: string) => request<QrStatus>(`/api/session/${encodeURIComponent(id)}/qr`),
};
