import apiClient, { setTokens, clearTokens } from "./client";

export async function register(payload) {
  const { data } = await apiClient.post("/auth/register", payload);
  setTokens(data);
  return data;
}

export async function login(email, password) {
  const { data } = await apiClient.post("/auth/login", { email, password });
  setTokens(data);
  return data;
}

export async function logout() {
  try {
    await apiClient.post("/auth/logout");
  } finally {
    clearTokens();
  }
}

export async function fetchCurrentUser() {
  const { data } = await apiClient.get("/auth/me");
  return data.user;
}
