/**
 * Frontend API helpers.
 *
 * login() saves a token. apiGet/apiPost/etc. send that token on every request.
 * The backend decides which company the user belongs to — we never send tenantId.
 */

const AUTH_KEY = "cannadb_auth";

// Reads the saved login token from localStorage, or null if not logged in.
function getToken() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.token ?? null;
  } catch {
    return null;
  }
}

// Saves the login token to localStorage after a successful login.
function setToken(token) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ token }));
}

// Returns true when the user has a saved token (may still be expired).
export function isLoggedIn() {
  return Boolean(getToken());
}

// Builds request headers with the login token attached.
function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

// Parses JSON and throws a readable error if the server returned an error status.
async function handleResponse(response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

// Shared fetch wrapper used by apiGet, apiPost, etc.
async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...options.headers },
  });
  return handleResponse(response);
}

// GET request — used to load lists and single records.
export function apiGet(url) {
  return apiRequest(url);
}

// POST request — used to create new records.
export function apiPost(url, body) {
  return apiRequest(url, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

// PATCH request — used to update part of an existing record.
export function apiPatch(url, body) {
  return apiRequest(url, {
    method: "PATCH",
    body: JSON.stringify(body ?? {}),
  });
}

// PUT request — used to replace/update a full record.
export function apiPut(url, body) {
  return apiRequest(url, {
    method: "PUT",
    body: JSON.stringify(body ?? {}),
  });
}

// DELETE request — used to remove a record.
export function apiDelete(url) {
  return apiRequest(url, { method: "DELETE" });
}

// Calls the login endpoint and saves the token on success.
export async function login(email, password) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Login failed");
  }

  setToken(data.token);
  return data;
}

// Removes the saved token so the user is logged out.
export function logout() {
  localStorage.removeItem(AUTH_KEY);
}

// Checks that the saved token is still valid (called when the app first loads).
export function fetchCurrentUser() {
  return apiGet("/api/auth/me");
}
