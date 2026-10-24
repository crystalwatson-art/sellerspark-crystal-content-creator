import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID
} from "node:crypto";
import { isValidSupabaseUserId } from "./supabase-auth.js";

export const TIKTOK_AUTHORIZATION_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
export const TIKTOK_USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
export const TIKTOK_DRAFT_UPLOAD_URL = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
export const TIKTOK_CONNECTION_TABLE = "sellerspark_tiktok_connections";

export const TIKTOK_SCOPES = Object.freeze({
  identity: "user.info.basic",
  followerStats: "user.info.stats",
  draftUpload: "video.upload"
});

const STATE_TTL_MS = 10 * 60 * 1000;
function tiktokError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireUser(userId) {
  if (!isValidSupabaseUserId(userId)) {
    throw tiktokError("authorization_required", "A verified signed-in user is required.");
  }
  return userId;
}

function requireSupabaseToken(accessToken) {
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw tiktokError("authorization_required", "A verified signed-in user is required.");
  }
  return accessToken;
}

function scopesFrom(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string" && item.trim());
  if (typeof value === "string") return value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeTokenPayload(payload, previous = null) {
  const refreshToken = typeof payload?.refresh_token === "string" && payload.refresh_token
    ? payload.refresh_token
    : previous?.refreshToken;
  const refreshExpiresIn = typeof payload?.refresh_expires_in === "number" && Number.isFinite(payload.refresh_expires_in)
    ? payload.refresh_expires_in
    : previous?.refreshTokenExpiresAt
      ? Math.max(0, Math.floor((previous.refreshTokenExpiresAt - Date.now()) / 1000))
      : null;
  if (!payload || typeof payload.access_token !== "string" || !payload.access_token
    || typeof refreshToken !== "string" || !refreshToken
    || typeof payload.expires_in !== "number" || !Number.isFinite(payload.expires_in)
    || !Number.isFinite(refreshExpiresIn)) {
    throw tiktokError("provider_invalid_response", "TikTok authorization did not return a usable token.");
  }
  const grantedScopes = scopesFrom(payload.scope);
  const effectiveScopes = grantedScopes.length ? grantedScopes : (previous?.grantedScopes || []);
  return {
    accessToken: payload.access_token,
    refreshToken,
    accessTokenExpiresAt: Date.now() + Math.max(0, payload.expires_in) * 1000,
    refreshTokenExpiresAt: Date.now() + Math.max(0, refreshExpiresIn) * 1000,
    grantedScopes: effectiveScopes,
    openId: typeof payload.open_id === "string" ? payload.open_id : null
  };
}

function parseEncryptionKey(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error("TikTok token encryption requires a 32-byte server-side key.");
  }
  return Buffer.from(value, "hex");
}

export function createTokenCipher(encryptionKey) {
  const key = parseEncryptionKey(encryptionKey);
  return Object.freeze({
    encrypt(value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
      return {
        v: 1,
        iv: iv.toString("base64url"),
        tag: cipher.getAuthTag().toString("base64url"),
        data: ciphertext.toString("base64url")
      };
    },
    decrypt(serialized) {
      let envelope;
      try {
        envelope = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
        const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64url"));
        decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
        const plaintext = Buffer.concat([
          decipher.update(Buffer.from(envelope.data, "base64url")),
          decipher.final()
        ]).toString("utf8");
        return JSON.parse(plaintext);
      } catch {
        throw tiktokError("storage_corrupt", "Saved TikTok authorization could not be read safely.");
      }
    }
  });
}

function safeStorageError(response) {
  throw tiktokError(
    response?.status === 401 || response?.status === 403 ? "authorization_failed" : "storage_unavailable",
    "TikTok connection storage is temporarily unavailable."
  );
}

export class SupabaseTikTokConnectionStore {
  constructor({ url, anonKey, cipher, fetchImpl = globalThis.fetch } = {}) {
    if (typeof url !== "string" || !/^https:\/\/[^/]+/.test(url)) throw new Error("TikTok store requires a Supabase HTTPS URL.");
    if (typeof anonKey !== "string" || !anonKey.trim()) throw new Error("TikTok store requires a Supabase public API key.");
    if (!cipher || typeof cipher.encrypt !== "function" || typeof cipher.decrypt !== "function") throw new Error("TikTok store requires a token cipher.");
    if (typeof fetchImpl !== "function") throw new Error("TikTok store requires fetch.");
    this.endpoint = url.replace(/\/+$/, "") + "/rest/v1/" + TIKTOK_CONNECTION_TABLE;
    this.anonKey = anonKey;
    this.cipher = cipher;
    this.fetchImpl = fetchImpl;
  }

  headers(supabaseAccessToken, extra = {}) {
    return {
      apikey: this.anonKey,
      Authorization: "Bearer " + requireSupabaseToken(supabaseAccessToken),
      "Content-Type": "application/json",
      ...extra
    };
  }

  async get(userId, supabaseAccessToken) {
    const ownerId = requireUser(userId);
    const url = new URL(this.endpoint);
    url.searchParams.set("select", "token_blob,granted_scopes,expires_at");
    url.searchParams.set("owner_id", "eq." + ownerId);
    const response = await this.fetchImpl(url, { headers: this.headers(supabaseAccessToken) });
    if (!response?.ok) return safeStorageError(response);
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows[0]) return null;
    const token = this.cipher.decrypt(rows[0].token_blob);
    return {
      ...token,
      grantedScopes: scopesFrom(rows[0].granted_scopes || token.grantedScopes),
      accessTokenExpiresAt: rows[0].expires_at ? Date.parse(rows[0].expires_at) : token.accessTokenExpiresAt
    };
  }

  async save(userId, supabaseAccessToken, token) {
    const ownerId = requireUser(userId);
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: this.headers(supabaseAccessToken, {
        Prefer: "resolution=merge-duplicates,return=representation"
      }),
      body: JSON.stringify({
        owner_id: ownerId,
        token_blob: this.cipher.encrypt(token),
        granted_scopes: token.grantedScopes,
        expires_at: new Date(token.accessTokenExpiresAt).toISOString(),
        updated_at: new Date().toISOString()
      })
    });
    if (!response?.ok) return safeStorageError(response);
    return { connected: true, grantedScopes: token.grantedScopes, accessTokenExpiresAt: token.accessTokenExpiresAt };
  }

  async remove(userId, supabaseAccessToken) {
    const ownerId = requireUser(userId);
    const url = new URL(this.endpoint);
    url.searchParams.set("owner_id", "eq." + ownerId);
    const response = await this.fetchImpl(url, {
      method: "DELETE",
      headers: this.headers(supabaseAccessToken)
    });
    if (!response?.ok) return safeStorageError(response);
    return { connected: false };
  }
}

export class MemoryTikTokConnectionStore {
  constructor() {
    this.records = new Map();
  }

  async get(userId, supabaseAccessToken) {
    requireUser(userId);
    requireSupabaseToken(supabaseAccessToken);
    return this.records.get(userId) || null;
  }

  async save(userId, supabaseAccessToken, token) {
    requireUser(userId);
    requireSupabaseToken(supabaseAccessToken);
    this.records.set(userId, token);
    return { connected: true, grantedScopes: token.grantedScopes, accessTokenExpiresAt: token.accessTokenExpiresAt };
  }

  async remove(userId, supabaseAccessToken) {
    requireUser(userId);
    requireSupabaseToken(supabaseAccessToken);
    this.records.delete(userId);
    return { connected: false };
  }
}

export function createTikTokIntegration({
  clientKey,
  clientSecret,
  redirectUri,
  tokenStore,
  fetchImpl = globalThis.fetch,
  clock = () => Date.now(),
  stateStore = new Map(),
  stateCookieCipher = null
} = {}) {
  if (!tokenStore) throw new Error("TikTok integration requires a token store.");
  if (typeof fetchImpl !== "function") throw new Error("TikTok integration requires fetch.");

  const configured = Boolean(clientKey && clientSecret && redirectUri && /^https:\/\//.test(redirectUri));

  function requireConfigured() {
    if (!configured) throw tiktokError("not_configured", "TikTok connection is not configured for this environment.");
  }

  function cleanupStates() {
    for (const [state, value] of stateStore) {
      if (value.expiresAt <= clock()) stateStore.delete(state);
    }
  }

  async function startAuthorization({ userId, supabaseAccessToken }) {
    requireConfigured();
    const ownerId = requireUser(userId);
    const ownerToken = requireSupabaseToken(supabaseAccessToken);
    cleanupStates();
    const state = randomUUID();
    stateStore.set(state, { ownerId, ownerToken, expiresAt: clock() + STATE_TTL_MS });
    const params = new URLSearchParams({
      client_key: clientKey,
      response_type: "code",
      scope: [TIKTOK_SCOPES.identity, TIKTOK_SCOPES.followerStats, TIKTOK_SCOPES.draftUpload].join(","),
      redirect_uri: redirectUri,
      state
    });
    return {
      status: "authorization_required",
      authorizationUrl: TIKTOK_AUTHORIZATION_URL + "?" + params.toString(),
      scopes: [TIKTOK_SCOPES.identity, TIKTOK_SCOPES.followerStats, TIKTOK_SCOPES.draftUpload],
      stateCookie: stateCookieCipher
        ? stateCookieCipher.encrypt({ state, ownerId, ownerToken, expiresAt: clock() + STATE_TTL_MS })
        : null
    };
  }

  async function completeAuthorization({ code, state, stateCookie, error } = {}) {
    requireConfigured();
    cleanupStates();
    let pending = typeof state === "string" ? stateStore.get(state) : null;
    if (!pending && stateCookie && stateCookieCipher) {
      try {
        const decoded = stateCookieCipher.decrypt(stateCookie);
        if (decoded?.state === state && decoded.expiresAt > clock()) pending = decoded;
      } catch {
        pending = null;
      }
    }
    if (!pending || pending.expiresAt <= clock()) throw tiktokError("authorization_state_invalid", "TikTok authorization expired. Start again.");
    stateStore.delete(state);
    if (error) throw tiktokError("authorization_denied", "TikTok authorization was not completed.");
    if (typeof code !== "string" || !code) throw tiktokError("authorization_code_missing", "TikTok authorization did not return a code.");
    let response;
    try {
      response = await fetchImpl(TIKTOK_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri
        }).toString()
      });
    } catch {
      throw tiktokError("provider_unavailable", "TikTok authorization is temporarily unavailable.");
    }
    if (!response?.ok) throw tiktokError("provider_unavailable", "TikTok authorization was not accepted.");
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw tiktokError("provider_invalid_response", "TikTok authorization returned an invalid response.");
    }
    const token = normalizeTokenPayload(payload);
    await tokenStore.save(pending.ownerId, pending.ownerToken, token);
    return {
      status: "connected",
      userId: pending.ownerId,
      scopes: token.grantedScopes,
      accessTokenExpiresAt: token.accessTokenExpiresAt
    };
  }

  async function status({ userId, supabaseAccessToken }) {
    const ownerId = requireUser(userId);
    const record = await tokenStore.get(ownerId, supabaseAccessToken);
    return {
      status: record ? "connected" : "not_connected",
      scopes: record?.grantedScopes || [],
      accessTokenExpiresAt: record?.accessTokenExpiresAt || null,
      directPublishingEnabled: false,
      automaticEngagementEnabled: false
    };
  }

  async function accessTokenFor(ownerId, supabaseAccessToken) {
    const record = await tokenStore.get(ownerId, supabaseAccessToken);
    if (!record) throw tiktokError("not_connected", "Connect TikTok before using this feature.");
    if (record.accessTokenExpiresAt > clock() + 60_000) return record;
    let response;
    try {
      response = await fetchImpl(TIKTOK_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: clientKey,
          grant_type: "refresh_token",
          refresh_token: record.refreshToken
        }).toString()
      });
    } catch {
      throw tiktokError("provider_unavailable", "TikTok authorization renewal is temporarily unavailable.");
    }
    if (!response?.ok) throw tiktokError("authorization_failed", "TikTok authorization renewal was not accepted.");
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw tiktokError("provider_invalid_response", "TikTok authorization renewal returned an invalid response.");
    }
    const refreshed = normalizeTokenPayload(payload, record);
    await tokenStore.save(ownerId, supabaseAccessToken, refreshed);
    return refreshed;
  }

  async function followerCount({ userId, supabaseAccessToken }) {
    const ownerId = requireUser(userId);
    const record = await accessTokenFor(ownerId, supabaseAccessToken);
    if (!record.grantedScopes.includes(TIKTOK_SCOPES.followerStats)) {
      throw tiktokError("scope_missing", "TikTok follower statistics permission was not granted.");
    }
    const url = new URL(TIKTOK_USER_INFO_URL);
    url.searchParams.set("fields", "open_id,display_name,follower_count");
    let response;
    try {
      response = await fetchImpl(url, { headers: { Authorization: "Bearer " + record.accessToken } });
    } catch {
      throw tiktokError("provider_unavailable", "TikTok follower statistics are temporarily unavailable.");
    }
    if (!response?.ok) throw tiktokError("provider_unavailable", "TikTok follower statistics were not available.");
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw tiktokError("provider_invalid_response", "TikTok follower statistics returned an invalid response.");
    }
    const count = payload?.data?.user?.follower_count;
    if (!Number.isInteger(count) || count < 0) throw tiktokError("provider_invalid_response", "TikTok follower statistics were incomplete.");
    return { followerCount: count, observedAt: new Date(clock()).toISOString(), source: "TikTok User Info API" };
  }

  async function uploadDraft({ userId, supabaseAccessToken, videoUrl, caption = "", humanApproved = false } = {}) {
    const ownerId = requireUser(userId);
    if (humanApproved !== true) throw tiktokError("human_approval_required", "Human approval is required before a TikTok draft handoff.");
    let parsedUrl;
    try {
      parsedUrl = new URL(videoUrl);
    } catch {
      throw tiktokError("invalid_video_url", "A public HTTPS video URL is required for draft handoff.");
    }
    if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) {
      throw tiktokError("invalid_video_url", "A public HTTPS video URL is required for draft handoff.");
    }
    const record = await accessTokenFor(ownerId, supabaseAccessToken);
    if (!record.grantedScopes.includes(TIKTOK_SCOPES.draftUpload)) {
      throw tiktokError("scope_missing", "TikTok draft-upload permission was not granted.");
    }
    let response;
    try {
      response = await fetchImpl(TIKTOK_DRAFT_UPLOAD_URL, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + record.accessToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          source_info: { source: "PULL_FROM_URL", video_url: parsedUrl.toString() },
          post_info: { title: typeof caption === "string" ? caption.slice(0, 150) : "" }
        })
      });
    } catch {
      throw tiktokError("provider_unavailable", "TikTok draft handoff is temporarily unavailable.");
    }
    if (!response?.ok) throw tiktokError("provider_unavailable", "TikTok draft handoff was not accepted.");
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw tiktokError("provider_invalid_response", "TikTok draft handoff returned an invalid response.");
    }
    if (typeof payload?.data?.publish_id !== "string" || !payload.data.publish_id) {
      throw tiktokError("provider_invalid_response", "TikTok draft handoff did not return a reviewable draft.");
    }
    return {
      status: "draft_handoff_requested",
      publishId: payload.data.publish_id,
      humanApprovalRequired: true,
      automaticallyPublished: false,
      customerContacted: false
    };
  }

  async function disconnect({ userId, supabaseAccessToken }) {
    return tokenStore.remove(requireUser(userId), supabaseAccessToken);
  }

  return Object.freeze({
    configured,
    startAuthorization,
    completeAuthorization,
    status,
    followerCount,
    uploadDraft,
    disconnect
  });
}

export function safeTikTokError(error) {
  const allowed = new Set([
    "not_configured", "authorization_required", "authorization_failed", "authorization_state_invalid",
    "authorization_denied", "authorization_code_missing", "provider_unavailable", "provider_invalid_response",
    "storage_unavailable", "storage_corrupt", "scope_missing", "not_connected", "human_approval_required",
    "invalid_video_url"
  ]);
  return {
    code: allowed.has(error?.code) ? error.code : "integration_error",
    message: allowed.has(error?.code) ? error.message : "TikTok integration could not complete that request safely."
  };
}
