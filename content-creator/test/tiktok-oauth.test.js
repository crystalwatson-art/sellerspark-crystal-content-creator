import test from "node:test";
import assert from "node:assert/strict";
import {
  createTikTokIntegration,
  createTokenCipher,
  MemoryTikTokConnectionStore,
  MemoryTikTokOAuthStateStore,
  SupabaseTikTokConnectionStore,
  SupabaseTikTokOAuthStateStore,
  TIKTOK_DRAFT_UPLOAD_URL,
  TIKTOK_OAUTH_STATE_TABLE,
  TIKTOK_SCOPES,
  TIKTOK_TOKEN_URL,
  TIKTOK_USER_INFO_URL
} from "../src/tiktok-oauth.js";

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const serverKey = "fictional-server-only-key";
const encryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; }
  };
}

function configured(fetchImpl, store = new MemoryTikTokConnectionStore()) {
  return {
    store,
    integration: createTikTokIntegration({
      clientKey: "test-client-key",
      clientSecret: "test-client-secret",
      redirectUri: "https://example.test/api/tiktok/oauth/callback",
      tokenStore: store,
      fetchImpl,
      stateStore: new MemoryTikTokOAuthStateStore()
    })
  };
}

test("token encryption keeps TikTok credentials out of the stored envelope", () => {
  const cipher = createTokenCipher(encryptionKey);
  const envelope = cipher.encrypt({ accessToken: "fictional-access-token", refreshToken: "fictional-refresh-token" });
  assert.equal(typeof envelope, "object");
  assert.doesNotMatch(JSON.stringify(envelope), /fictional-access-token|fictional-refresh-token/);
  assert.deepEqual(cipher.decrypt(envelope), {
    accessToken: "fictional-access-token",
    refreshToken: "fictional-refresh-token"
  });
});

test("OAuth start requires a trusted user and requests only approved read plus draft scopes", async () => {
  const { integration } = configured(async () => jsonResponse({}));
  const result = await integration.startAuthorization({ userId: userA });
  const url = new URL(result.authorizationUrl);
  assert.equal(result.status, "authorization_required");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.deepEqual(url.searchParams.get("scope").split(","), [
    TIKTOK_SCOPES.identity,
    TIKTOK_SCOPES.followerStats,
    TIKTOK_SCOPES.draftUpload
  ]);
  assert.ok(url.searchParams.get("state"));
  assert.equal(result.stateCookie, undefined);
  assert.doesNotMatch(JSON.stringify(result), /test-client-secret|supabase-token/);
  await assert.rejects(
    integration.startAuthorization({ userId: "browser-supplied-id" }),
    (error) => error.code === "authorization_required"
  );
});

test("OAuth callback exchanges the code server-side and scopes ownership to the initiating user", async () => {
  const calls = [];
  const { integration, store } = configured(async (url, options) => {
    calls.push({ url: String(url), options });
    return jsonResponse({
      access_token: "fictional-tiktok-access",
      refresh_token: "fictional-tiktok-refresh",
      expires_in: 3600,
      refresh_expires_in: 86400,
      scope: "user.info.basic,user.info.stats,video.upload",
      open_id: "fictional-open-id"
    });
  });
  const start = await integration.startAuthorization({ userId: userA });
  const state = new URL(start.authorizationUrl).searchParams.get("state");
  const result = await integration.completeAuthorization({ code: "fictional-code", state });
  assert.equal(result.status, "connected");
  assert.deepEqual(result.scopes, ["user.info.basic", "user.info.stats", "video.upload"]);
  assert.equal(calls[0].url, TIKTOK_TOKEN_URL);
  assert.match(calls[0].options.body, /client_secret=test-client-secret/);
  assert.equal((await store.get(userA)).accessToken, "fictional-tiktok-access");
  assert.equal(await store.get(userB), null);
  await assert.rejects(
    integration.completeAuthorization({ code: "fictional-code", state }),
    (error) => error.code === "authorization_state_invalid"
  );
});

test("follower count uses the server-held TikTok token and cannot cross user records", async () => {
  const calls = [];
  const { integration } = configured(async (url, options) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ data: { user: { follower_count: 37 } } });
  });
  const tokenStore = new MemoryTikTokConnectionStore();
  await tokenStore.save(userA, {
    accessToken: "fictional-tiktok-access",
    refreshToken: "fictional-tiktok-refresh",
    accessTokenExpiresAt: Date.now() + 3600000,
    refreshTokenExpiresAt: Date.now() + 86400000,
    grantedScopes: [TIKTOK_SCOPES.identity, TIKTOK_SCOPES.followerStats, TIKTOK_SCOPES.draftUpload]
  });
  const actual = configured(async (url, options) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ data: { user: { follower_count: 37 } } });
  }, tokenStore).integration;
  const result = await actual.followerCount({ userId: userA });
  assert.equal(result.followerCount, 37);
  assert.equal(calls.at(-1).url.startsWith(TIKTOK_USER_INFO_URL), true);
  assert.equal(calls.at(-1).options.headers.Authorization, "Bearer fictional-tiktok-access");
  assert.doesNotMatch(JSON.stringify(result), /fictional-tiktok-access/);
  await assert.rejects(
    actual.followerCount({ userId: userB }),
    (error) => error.code === "not_connected"
  );
});

test("expired access tokens refresh once on the server before a follower read", async () => {
  const calls = [];
  const tokenStore = new MemoryTikTokConnectionStore();
  await tokenStore.save(userA, {
    accessToken: "fictional-expired-access",
    refreshToken: "fictional-refresh-token",
    accessTokenExpiresAt: Date.now() - 1000,
    refreshTokenExpiresAt: Date.now() + 86400000,
    grantedScopes: [TIKTOK_SCOPES.followerStats]
  });
  const { integration } = configured(async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url) === TIKTOK_TOKEN_URL) {
      return jsonResponse({ access_token: "fictional-refreshed-access", expires_in: 3600 });
    }
    return jsonResponse({ data: { user: { follower_count: 41 } } });
  }, tokenStore);
  const result = await integration.followerCount({ userId: userA });
  assert.equal(result.followerCount, 41);
  assert.equal(calls.length, 2);
  assert.match(calls[0].options.body, /grant_type=refresh_token/);
  assert.equal(calls[1].options.headers.Authorization, "Bearer fictional-refreshed-access");
});

test("draft upload requires human approval, video.upload, and returns no publish action", async () => {
  const calls = [];
  const tokenStore = new MemoryTikTokConnectionStore();
  await tokenStore.save(userA, {
    accessToken: "fictional-tiktok-access",
    refreshToken: "fictional-tiktok-refresh",
    accessTokenExpiresAt: Date.now() + 3600000,
    refreshTokenExpiresAt: Date.now() + 86400000,
    grantedScopes: [TIKTOK_SCOPES.identity, TIKTOK_SCOPES.followerStats, TIKTOK_SCOPES.draftUpload]
  });
  const { integration } = configured(async (url, options) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ data: { publish_id: "fictional-draft-id" } });
  }, tokenStore);
  await assert.rejects(
    integration.uploadDraft({ userId: userA, videoUrl: "https://cdn.example.test/fictional.mp4" }),
    (error) => error.code === "human_approval_required"
  );
  const result = await integration.uploadDraft({
    userId: userA,
    videoUrl: "https://cdn.example.test/fictional.mp4",
    caption: "Fictional caption",
    humanApproved: true
  });
  assert.equal(result.status, "draft_handoff_requested");
  assert.equal(result.humanApprovalRequired, true);
  assert.equal(result.automaticallyPublished, false);
  assert.equal(result.customerContacted, false);
  assert.equal(calls[0].url, TIKTOK_DRAFT_UPLOAD_URL);
  assert.doesNotMatch(calls[0].options.body, /video\.publish/);
  await assert.rejects(
    integration.uploadDraft({ userId: userA, videoUrl: "http://localhost/fictional.mp4", humanApproved: true }),
    (error) => error.code === "invalid_video_url"
  );
});

test("malformed provider responses become safe errors without leaking provider payloads", async () => {
  const tokenStore = new MemoryTikTokConnectionStore();
  await tokenStore.save(userA, {
    accessToken: "fictional-tiktok-access",
    refreshToken: "fictional-tiktok-refresh",
    accessTokenExpiresAt: Date.now() + 3600000,
    refreshTokenExpiresAt: Date.now() + 86400000,
    grantedScopes: [TIKTOK_SCOPES.followerStats]
  });
  const { integration } = configured(async () => jsonResponse({ data: { user: { follower_count: "not-a-count", private_error: "do not expose" } } }), tokenStore);
  await assert.rejects(
    integration.followerCount({ userId: userA }),
    (error) => error.code === "provider_invalid_response" && !error.message.includes("do not expose")
  );
});

test("Supabase token storage uses only the server key and sends encrypted token blobs", async () => {
  const calls = [];
  const store = new SupabaseTikTokConnectionStore({
    url: "https://supabase.example.test",
    serverKey,
    cipher: createTokenCipher(encryptionKey),
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (options.method === "POST") return jsonResponse([]);
      return jsonResponse([]);
    }
  });
  await store.save(userA, {
    accessToken: "fictional-tiktok-access",
    refreshToken: "fictional-tiktok-refresh",
    accessTokenExpiresAt: Date.now() + 3600000,
    refreshTokenExpiresAt: Date.now() + 86400000,
    grantedScopes: [TIKTOK_SCOPES.followerStats]
  });
  const requestBody = JSON.parse(calls[0].options.body);
  assert.equal(calls[0].options.headers.Authorization, "Bearer " + serverKey);
  assert.equal(calls[0].options.headers.apikey, serverKey);
  assert.equal(requestBody.owner_id, userA);
  assert.equal(typeof requestBody.token_blob, "object");
  assert.doesNotMatch(JSON.stringify(requestBody.token_blob), /fictional-tiktok-access|fictional-tiktok-refresh/);
  assert.match(calls[0].url, /sellerspark_tiktok_connections/);
});

test("durable OAuth state hashes the raw state and consumes it once", async () => {
  const calls = [];
  const store = new SupabaseTikTokOAuthStateStore({
    url: "https://supabase.example.test",
    serverKey,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (options.method === "POST") return jsonResponse([]);
      return jsonResponse([{ owner_id: userA }]);
    }
  });
  await store.create({ state: "fictional-oauth-state", ownerId: userA, expiresAt: Date.now() + 600000 });
  const createdBody = JSON.parse(calls[0].options.body);
  assert.equal(createdBody.owner_id, userA);
  assert.match(createdBody.state_hash, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(createdBody), /fictional-oauth-state/);
  const consumed = await store.consume("fictional-oauth-state");
  assert.deepEqual(consumed, { ownerId: userA });
  assert.match(calls[1].url, new RegExp(TIKTOK_OAUTH_STATE_TABLE));
  assert.match(calls[1].url, /consumed_at=is\.null/);
  assert.match(calls[1].url, /expires_at=gt\./);
  assert.equal(calls[1].options.headers.Authorization, "Bearer " + serverKey);
});

test("OAuth state replay and expiry are rejected by the local state contract", async () => {
  let now = 1000;
  const store = new MemoryTikTokOAuthStateStore({ clock: () => now });
  await store.create({ state: "fictional-state", ownerId: userA, expiresAt: 2000 });
  assert.deepEqual(await store.consume("fictional-state"), { ownerId: userA });
  assert.equal(await store.consume("fictional-state"), null);
  await store.create({ state: "expired-state", ownerId: userA, expiresAt: 2000 });
  now = 2001;
  assert.equal(await store.consume("expired-state"), null);
});
