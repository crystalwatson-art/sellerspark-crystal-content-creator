import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ReviewStore } from "../src/review-store.js";
import { createServer } from "../src/server.js";
import { createTikTokIntegration, MemoryTikTokConnectionStore, MemoryTikTokOAuthStateStore, TIKTOK_SCOPES } from "../src/tiktok-oauth.js";
import fictionalLicBrief from "../fixtures/fictional-research-brief.json" with { type: "json" };

const userId = "11111111-1111-4111-8111-111111111111";
const supabaseToken = "supabase-token-a";

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}

async function startServerForTest() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sellerspark-tiktok-api-"));
  const store = await new ReviewStore({ filePath: path.join(directory, "reviews.json") }).init();
  const tokenStore = new MemoryTikTokConnectionStore();
  await tokenStore.save(userId, {
    accessToken: "fictional-tiktok-access",
    refreshToken: "fictional-tiktok-refresh",
    accessTokenExpiresAt: Date.now() + 3600000,
    refreshTokenExpiresAt: Date.now() + 86400000,
    grantedScopes: [TIKTOK_SCOPES.identity, TIKTOK_SCOPES.followerStats, TIKTOK_SCOPES.draftUpload]
  });
  const tiktokIntegration = createTikTokIntegration({
    clientKey: "test-client-key",
    clientSecret: "test-client-secret",
    redirectUri: "https://example.test/api/tiktok/oauth/callback",
    tokenStore,
    stateStore: new MemoryTikTokOAuthStateStore(),
    fetchImpl: async (url) => {
      if (String(url).includes("/user/info/")) return jsonResponse({ data: { user: { follower_count: 37 } } });
      return jsonResponse({ data: { publish_id: "fictional-draft-id" } });
    }
  });
  const authVerifier = {
    async verify(request) {
      if (request.headers.authorization === "Bearer " + supabaseToken) return { userId, accessToken: supabaseToken };
      const error = new Error("Authentication is required for persistent review access.");
      error.code = "authorization_required";
      throw error;
    }
  };
  const server = createServer({
    reviewStore: store,
    demoReviewStore: store,
    providerMode: "template",
    authVerifier,
    tiktokIntegration
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test("TikTok API routes require verified auth while the fictional demo remains public and safe", async (t) => {
  const running = await startServerForTest();
  t.after(() => running.server.close());

  const unauthenticated = await fetch(running.base + "/api/tiktok/status");
  assert.equal(unauthenticated.status, 401);

  const status = await fetch(running.base + "/api/tiktok/status", { headers: { authorization: "Bearer " + supabaseToken } });
  const statusBody = await status.json();
  assert.equal(status.status, 200);
  assert.equal(statusBody.connected, true);
  assert.equal(statusBody.directPublishingEnabled, false);
  assert.equal(statusBody.automaticEngagementEnabled, false);

  const followerResponse = await fetch(running.base + "/api/tiktok/follower-count", { headers: { authorization: "Bearer " + supabaseToken } });
  assert.equal(followerResponse.status, 200);
  assert.equal((await followerResponse.json()).followerCount, 37);

  const draftWithoutApproval = await fetch(running.base + "/api/tiktok/draft-upload", {
    method: "POST",
    headers: { authorization: "Bearer " + supabaseToken, "content-type": "application/json" },
    body: JSON.stringify({ videoUrl: "https://cdn.example.test/fictional.mp4", humanApproved: false })
  });
  assert.equal(draftWithoutApproval.status, 422);
  assert.match((await draftWithoutApproval.json()).message, /Human approval/i);

  const draftWithApproval = await fetch(running.base + "/api/tiktok/draft-upload", {
    method: "POST",
    headers: { authorization: "Bearer " + supabaseToken, "content-type": "application/json" },
    body: JSON.stringify({ videoUrl: "https://cdn.example.test/fictional.mp4", humanApproved: true })
  });
  const draftBody = await draftWithApproval.json();
  assert.equal(draftWithApproval.status, 200);
  assert.equal(draftBody.status, "draft_handoff_requested");
  assert.equal(draftBody.automaticallyPublished, false);

  const fictionalResponse = await fetch(running.base + "/api/content", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fictionalLicBrief)
  });
  const fictional = await fictionalResponse.json();
  assert.equal(fictionalResponse.status, 200);
  assert.equal(fictional.drafts.length, 3);
});

test("TikTok OAuth start uses the verified bearer identity and never accepts a browser user id", async (t) => {
  const running = await startServerForTest();
  t.after(() => running.server.close());

  const response = await fetch(running.base + "/api/tiktok/oauth/start", {
    method: "POST",
    headers: { authorization: "Bearer " + supabaseToken }
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(body.authorizationUrl, /tiktok\.com\/v2\/auth\/authorize/);
  assert.doesNotMatch(body.authorizationUrl, /test-client-secret|supabase-token-a/);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("video views are authenticated and follower permission alone cannot read videos", async t => {
  const running = await startServerForTest();
  t.after(() => running.server.close());
  const anonymous = await fetch(running.base + "/api/tiktok/video-views");
  assert.equal(anonymous.status, 401);
  const missingScope = await fetch(running.base + "/api/tiktok/video-views", { headers: { authorization: "Bearer " + supabaseToken } });
  assert.equal(missingScope.status, 422);
  assert.equal((await missingScope.json()).code, "scope_missing");
  const badPage = await fetch(running.base + "/api/tiktok/video-views?cursor=bad", { headers: { authorization: "Bearer " + supabaseToken } });
  assert.equal((await badPage.json()).code, "invalid_cursor");
});

