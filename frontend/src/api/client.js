/**
 * AgroInsight - API Client
 * ==========================
 * Axios instance that automatically attaches the JWT access token to every
 * request, and transparently refreshes it on a 401 before retrying once.
 *
 * Tokens live in memory (a module-level variable) and are mirrored to
 * sessionStorage only (never localStorage), per spec, so a page reload
 * within the same tab keeps the session but closing the tab clears it.
 */

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

let accessToken = sessionStorage.getItem("agroinsight_access_token") || null;
let refreshToken = sessionStorage.getItem("agroinsight_refresh_token") || null;

// Subscribers notified whenever auth state changes (login/logout/refresh),
// so AuthContext can stay in sync without polling.
const authListeners = new Set();

function notifyAuthListeners() {
  authListeners.forEach((fn) => fn({ accessToken, refreshToken }));
}

export function onAuthChange(callback) {
  authListeners.add(callback);
  return () => authListeners.delete(callback);
}

export function setTokens({ access_token, refresh_token }) {
  accessToken = access_token ?? accessToken;
  refreshToken = refresh_token ?? refreshToken;

  if (accessToken) sessionStorage.setItem("agroinsight_access_token", accessToken);
  if (refreshToken) sessionStorage.setItem("agroinsight_refresh_token", refreshToken);

  notifyAuthListeners();
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  sessionStorage.removeItem("agroinsight_access_token");
  sessionStorage.removeItem("agroinsight_refresh_token");
  notifyAuthListeners();
}

export function getAccessToken() {
  return accessToken;
}

export function isAuthenticated() {
  return Boolean(accessToken);
}

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshInFlight = null;

async function performRefresh() {
  if (!refreshToken) throw new Error("No refresh token available");

  // axios.create() is used directly (not apiClient) to avoid recursively
  // triggering this same interceptor.
  const response = await axios.post(
    `${BASE_URL}/auth/refresh`,
    {},
    { headers: { Authorization: `Bearer ${refreshToken}` } }
  );
  setTokens({ access_token: response.data.access_token });
  return response.data.access_token;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (response?.status === 401 && !config._retried && refreshToken) {
      config._retried = true;
      try {
        if (!refreshInFlight) {
          refreshInFlight = performRefresh().finally(() => {
            refreshInFlight = null;
          });
        }
        const newAccessToken = await refreshInFlight;
        config.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(config);
      } catch {
        clearTokens();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
