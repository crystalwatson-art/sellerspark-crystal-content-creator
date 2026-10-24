const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function authError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function bearerToken(request) {
  const header = request?.headers?.authorization;
  if (typeof header !== "string") throw authError("authorization_required", "Authentication is required.");
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw authError("authorization_required", "Authentication is required.");
  return match[1];
}

export class SupabaseAuthVerifier {
  constructor({ url, anonKey, fetchImpl = globalThis.fetch } = {}) {
    if (typeof url !== "string" || !/^https:\/\/[^/]+/.test(url)) {
      throw new Error("SupabaseAuthVerifier requires a server-only HTTPS URL.");
    }
    if (typeof anonKey !== "string" || !anonKey.trim()) {
      throw new Error("SupabaseAuthVerifier requires a server-only Supabase Auth key.");
    }
    if (typeof fetchImpl !== "function") throw new Error("SupabaseAuthVerifier requires fetch.");
    this.url = url.replace(/\/+$/, "");
    this.anonKey = anonKey;
    this.fetchImpl = fetchImpl;
  }

  async verify(request) {
    const token = bearerToken(request);
    let response;
    try {
      response = await this.fetchImpl(this.url + "/auth/v1/user", {
        headers: {
          apikey: this.anonKey,
          Authorization: "Bearer " + token
        }
      });
    } catch {
      throw authError("auth_unavailable", "Authentication could not be checked safely.");
    }
    if (!response?.ok) throw authError("authorization_failed", "Authentication was not accepted.");
    let user;
    try {
      user = await response.json();
    } catch {
      throw authError("authorization_failed", "Authentication was not accepted.");
    }
    if (!user || typeof user.id !== "string" || !UUID_PATTERN.test(user.id)) {
      throw authError("authorization_failed", "Authentication was not accepted.");
    }
    return { userId: user.id, accessToken: token };
  }
}

export function isValidSupabaseUserId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
