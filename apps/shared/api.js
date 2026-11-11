const cfg = window.APP_CONFIG || {};
export const API_BASE = cfg.apiBase || '/api';
export const MEDIA_BASE = cfg.mediaBase || '/media';
const TOKEN_KEY = cfg.tokenKey || 'properlift.token';
const USER_KEY = `${TOKEN_KEY}.user`;
function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {  }
}
let memoryToken = storageGet(TOKEN_KEY);
let memoryUser = null;
try { memoryUser = JSON.parse(storageGet(USER_KEY) || 'null'); } catch { memoryUser = null; }
export const session = {
  get token() { return memoryToken; },
  get user() { return memoryUser; },
  get loggedIn() { return Boolean(memoryToken); },
  set(token, user) {
    memoryToken = token;
    memoryUser = user;
    storageSet(TOKEN_KEY, token);
    storageSet(USER_KEY, JSON.stringify(user));
  },
  setUser(user) {
    memoryUser = user;
    storageSet(USER_KEY, JSON.stringify(user));
  },
  clear() {
    memoryToken = null;
    memoryUser = null;
    storageSet(TOKEN_KEY, null);
    storageSet(USER_KEY, null);
  },
};
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export async function api(path, { method = 'GET', body, file } = {}) {
  const headers = {};
  if (memoryToken) headers.Authorization = `Bearer ${memoryToken}`;
  let payload;
  if (file) {
    headers['Content-Type'] = file.type || 'application/octet-stream';
    payload = file;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'Network error: the server could not be reached.');
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch {  }
  if (!res.ok) {
    if (res.status === 401 && memoryToken) {
      session.clear();
      window.dispatchEvent(new Event('session-expired'));
    }
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  }
  return data;
}
