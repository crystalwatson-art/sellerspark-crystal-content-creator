import test from "node:test";
import assert from "node:assert/strict";
import { createTikTokIntegration, MemoryTikTokConnectionStore, MemoryTikTokOAuthStateStore, TIKTOK_SCOPES, TIKTOK_VIDEO_LIST_URL } from "../src/tiktok-oauth.js";

const user = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
async function setup(fetchImpl, scopes = [TIKTOK_SCOPES.videoViews]) {
  const store = new MemoryTikTokConnectionStore();
  await store.save(user, { accessToken: "fictional-access", refreshToken: "fictional-refresh", accessTokenExpiresAt: Date.now() + 3600000, refreshTokenExpiresAt: Date.now() + 86400000, grantedScopes: scopes });
  return createTikTokIntegration({ clientKey: "test-key", clientSecret: "test-secret", redirectUri: "https://example.test/callback", tokenStore: store, stateStore: new MemoryTikTokOAuthStateStore(), fetchImpl });
}
const response = body => ({ ok: true, async json() { return body; } });

test("video-list scope is added only to a deliberate video-views authorization", async () => {
  const integration = await setup(async () => response({}));
  const normal = await integration.startAuthorization({ userId: user });
  assert.ok(!normal.scopes.includes("video.list"));
  const views = await integration.startAuthorization({ userId: user, includeVideoViews: true });
  assert.ok(views.scopes.includes("video.list"));
  assert.ok(!views.scopes.includes("video.publish"));
  assert.ok(new URL(views.authorizationUrl).searchParams.get("scope").includes("video.list"));
});

test("views require verified owner and granted video access before provider requests", async () => {
  let requests = 0;
  const integration = await setup(async () => { requests++; return response({}); }, [TIKTOK_SCOPES.followerStats]);
  await assert.rejects(integration.videoViews({ userId: "untrusted" }), e => e.code === "authorization_required");
  await assert.rejects(integration.videoViews({ userId: other }), e => e.code === "not_connected");
  await assert.rejects(integration.videoViews({ userId: user }), e => e.code === "scope_missing");
  assert.equal(requests, 0);
});

test("views return per-video zero and positive counts with safe cursor pagination and no tokens", async () => {
  const calls = [];
  const integration = await setup(async (url, options) => {
    calls.push({ url: String(url), options });
    return response({ data: { videos: [{ id: "1", title: "Example", view_count: 0 }, { id: "2", title: "Another", view_count: 123 }], has_more: true, cursor: 1600000000000 }, error: { code: "ok" } });
  });
  const result = await integration.videoViews({ userId: user, cursor: 1700000000000 });
  assert.deepEqual(result.videos.map(v => v.viewCount), [0, 123]);
  assert.equal(result.hasMore, true);
  assert.equal(result.cursor, 1600000000000);
  assert.ok(calls[0].url.startsWith(TIKTOK_VIDEO_LIST_URL));
  assert.match(calls[0].url, /view_count/);
  assert.equal(calls[0].options.headers.Authorization, "Bearer fictional-access");
  assert.deepEqual(JSON.parse(calls[0].options.body), { max_count: 20, cursor: 1700000000000 });
  assert.doesNotMatch(JSON.stringify(result), /fictional-access|fictional-refresh|test-secret/);
});

test("invalid view counts and provider errors are not converted to zero", async () => {
  for (const payload of [
    { data: { videos: [{ id: "1", title: "Bad", view_count: -1 }], has_more: false } },
    { data: { videos: [{ id: "1", title: "Bad", view_count: "120" }], has_more: false } },
    { data: { videos: [{ id: "1", title: "Bad" }], has_more: false } },
    { data: { videos: [], has_more: false }, error: { code: "scope_not_authorized", message: "private provider detail" } },
    { data: { videos: [], has_more: true, cursor: 100 } }
  ]) {
    const integration = await setup(async () => response(payload));
    await assert.rejects(integration.videoViews({ userId: user, cursor: 100 }), e => e.code === "provider_invalid_response" && !e.message.includes("private provider detail"));
  }
});

test("no public videos is a valid empty page, not a fabricated account total", async () => {
  const integration = await setup(async () => response({ data: { videos: [], has_more: false } }));
  const result = await integration.videoViews({ userId: user });
  assert.deepEqual(result.videos, []);
  assert.equal(result.hasMore, false);
  assert.equal(result.cursor, null);
  assert.equal(result.totalViews, undefined);
  await assert.rejects(integration.videoViews({ userId: user, cursor: -1 }), e => e.code === "invalid_cursor");
});
