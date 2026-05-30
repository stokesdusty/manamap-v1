import axios, { type AxiosRequestConfig } from 'axios';
import { getTokens, setTokens, clearTokens } from '../lib/storage';
import { clearAuth } from '../lib/authCallbacks';
import type { AuthTokens } from '@manamap/shared';

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 10_000,
});

api.interceptors.request.use(async (config) => {
  const tokens = await getTokens();
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

interface RetryableConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

api.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const original = error.config as RetryableConfig | undefined;
    if (!original || error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token) => {
            if (original.headers) original.headers['Authorization'] = `Bearer ${token}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const stored = await getTokens();
      if (!stored?.refreshToken) throw new Error('no refresh token');

      const { data } = await axios.post<AuthTokens>(`${BASE_URL}/api/v1/auth/refresh`, {
        refreshToken: stored.refreshToken,
      });

      await setTokens(data);
      processQueue(null, data.accessToken);
      if (original.headers) original.headers['Authorization'] = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError);
      await clearTokens();
      await clearAuth();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
