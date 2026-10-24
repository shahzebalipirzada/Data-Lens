import axios from 'axios';

// Same-origin "/api" by default (Vite proxy in dev, nginx in Docker).
// Set VITE_API_URL when the API lives on another domain.
const baseURL = (import.meta.env.VITE_API_URL || '') + '/api';

export const api = axios.create({ baseURL, withCredentials: true });

// The short-lived access token lives only in memory. The refresh token is an httpOnly cookie
// the browser sends by itself, so JavaScript never touches it.
let accessToken = null;
let onSessionLost = () => {};

export const setAccessToken = (token) => { accessToken = token; };
export const setSessionLostHandler = (fn) => { onSessionLost = fn; };

api.interceptors.request.use((config) => {
  config._sentWith = accessToken; // remember which token this request used
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing = null;
export function refreshSession() {
  // Single flight: concurrent 401s share one refresh request (the refresh token is single-use)
  if (!refreshing) {
    refreshing = axios
      .post(`${baseURL}/auth/refresh`, null, { withCredentials: true })
      .then((res) => {
        accessToken = res.data.accessToken;
        return res.data;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      try {
        // If another request already refreshed while this one was in flight, reuse that token
        if (original._sentWith === accessToken) await refreshSession();
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        accessToken = null;
        onSessionLost();
      }
    }
    return Promise.reject(error);
  }
);

export function errorMessage(err, fallback = 'Something went wrong') {
  const data = err?.response?.data;
  if (data?.details?.length) return data.details.map((d) => d.message).join('. ');
  return data?.error || err?.message || fallback;
}
