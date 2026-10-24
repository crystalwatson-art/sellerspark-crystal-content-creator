const SESSION_KEY = "sellerspark-supabase-session-v1";

function clientError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizedSession(payload, now) {
  if (!payload || typeof payload.access_token !== "string" || !payload.access_token) {
    throw clientError("auth_failed", "Sign-in did not return a usable session.");
  }
  const expiresAt = Number.isFinite(payload.expires_at)
    ? payload.expires_at * 1000
    : Number.isFinite(payload.expires_in)
      ? now() + payload.expires_in * 1000
      : null;
  return {
    accessToken: payload.access_token,
    refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : null,
    expiresAt,
    userId: typeof payload.user?.id === "string" ? payload.user.id : null
  };
}

export class BrowserSupabaseAuth {
  constructor({ url = "", anonKey = "", fetchImpl = globalThis.fetch, storage = globalThis.sessionStorage, clock = () => Date.now() } = {}) {
    this.fetchImpl = fetchImpl;
    this.storage = storage;
    this.clock = clock;
    this.listeners = new Set();
    this.configure({ url, anonKey });
    this.session = this.readStoredSession();
  }

  configure({ url = "", anonKey = "" } = {}) {
    this.url = typeof url === "string" ? url.replace(/\/+$/, "") : "";
    this.anonKey = typeof anonKey === "string" ? anonKey : "";
  }

  get enabled() {
    return Boolean(this.url && this.anonKey && typeof this.fetchImpl === "function");
  }

  readStoredSession() {
    try {
      const parsed = JSON.parse(this.storage?.getItem(SESSION_KEY) || "null");
      return parsed?.accessToken ? parsed : null;
    } catch {
      return null;
    }
  }

  saveSession(session) {
    this.session = session;
    try {
      if (session) this.storage?.setItem(SESSION_KEY, JSON.stringify(session));
      else this.storage?.removeItem(SESSION_KEY);
    } catch {
      // The session remains usable in memory when browser storage is unavailable.
    }
    this.listeners.forEach((listener) => listener(session));
  }

  onAuthStateChange(listener) {
    if (typeof listener !== "function") return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  headers(accessToken = null) {
    const headers = new Headers({
      apikey: this.anonKey,
      "Content-Type": "application/json"
    });
    if (accessToken) headers.set("Authorization", "Bearer " + accessToken);
    return headers;
  }

  async signIn(email, password) {
    if (!this.enabled) throw clientError("auth_not_configured", "Sign-in is not configured for this preview.");
    if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
      throw clientError("auth_input_required", "Enter your email and password to sign in.");
    }
    let response;
    try {
      response = await this.fetchImpl(this.url + "/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ email: email.trim(), password })
      });
    } catch {
      throw clientError("auth_unavailable", "Sign-in is temporarily unavailable.");
    }
    if (!response?.ok) throw clientError("auth_failed", "Sign-in was not accepted.");
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw clientError("auth_failed", "Sign-in did not return a usable session.");
    }
    const session = normalizedSession(payload, this.clock);
    this.saveSession(session);
    return session;
  }

  async refreshSession() {
    if (!this.enabled || !this.session?.refreshToken) {
      this.saveSession(null);
      return null;
    }
    let response;
    try {
      response = await this.fetchImpl(this.url + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ refresh_token: this.session.refreshToken })
      });
    } catch {
      this.saveSession(null);
      return null;
    }
    if (!response?.ok) {
      this.saveSession(null);
      return null;
    }
    try {
      const session = normalizedSession(await response.json(), this.clock);
      this.saveSession(session);
      return session;
    } catch {
      this.saveSession(null);
      return null;
    }
  }

  async getSession() {
    if (!this.session?.accessToken) return null;
    if (!this.session.expiresAt || this.session.expiresAt - this.clock() > 30_000) return this.session;
    return this.refreshSession();
  }

  async signOut() {
    const session = this.session;
    if (this.enabled && session?.accessToken) {
      try {
        await this.fetchImpl(this.url + "/auth/v1/logout", {
          method: "POST",
          headers: this.headers(session.accessToken)
        });
      } catch {
        // Local sign-out still completes if the provider cannot be reached.
      }
    }
    this.saveSession(null);
  }

  async authorizedFetch(input, options = {}) {
    const session = await this.getSession();
    if (!session) throw clientError("auth_required", "Sign in again to access this saved review.");
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", "Bearer " + session.accessToken);
    const response = await this.fetchImpl(input, { ...options, headers });
    if (response?.status === 401) this.saveSession(null);
    return response;
  }
}

export function authClientErrorMessage(error) {
  if (error?.code === "auth_required" || error?.code === "auth_failed") return error.message;
  if (error?.code === "auth_unavailable") return "Authentication is temporarily unavailable. Try again later.";
  return error?.message || "Authentication could not be completed safely.";
}
