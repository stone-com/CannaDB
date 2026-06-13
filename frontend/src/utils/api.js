/**
 * Simple API helpers for login + authenticated requests.
 *
 * After login we save a token in localStorage.
 * installAuthFetch() adds that token to every /api request automatically.
 */

const TOKEN_KEY = "cannadb_auth_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn() {
  return Boolean(getToken());
}

// Call once when the app starts.
export function installAuthFetch() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;

    // Public routes do not need a token.
    const isPublicRoute =
      url.startsWith("/api/auth/login") || url.startsWith("/api/health");

    if (url.startsWith("/api/") && !isPublicRoute) {
      const token = getToken();
      const headers = new Headers(init.headers || {});

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      init = { ...init, headers };
    }

    return originalFetch(input, init);
  };
}

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

export async function logout() {
  clearToken();
}
