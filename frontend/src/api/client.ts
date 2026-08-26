import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const http = axios.create({ baseURL });

const TOKEN_KEY = "surftec_token";
const PORTAL_TOKEN_KEY = "surftec_portal_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
export function getPortalToken() {
  return localStorage.getItem(PORTAL_TOKEN_KEY);
}
export function setPortalToken(token: string) {
  localStorage.setItem(PORTAL_TOKEN_KEY, token);
}

http.interceptors.request.use((config) => {
  const portalMode = config.headers?.["X-Portal"] === "1";
  const token = portalMode ? getPortalToken() : getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
