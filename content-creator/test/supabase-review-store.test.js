import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { SupabaseReviewStore } from "../src/supabase-review-store.js";

const actorId = "11111111-1111-4111-8111-111111111111";
const otherActorId = "22222222-2222-4222-8222-222222222222";

function row(overrides = {}) {
  return {
    id: "review-12345678-1234-4123-8123-123456789012",
    owner_id: actorId,
    version: 1,
    created_at: "2026-10-23T00:00:00.000Z",
    updated_at: "2026-10-23T00:00:00.000Z",
    brief: { id: "fictional-lic" },
    research_verification: { status: "fictional_test_only" },
    listing_review: { reviews: [{ draftId: "draft-1" }] },
    ...overrides
  };
}

function mockFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const next = responses.shift();
    if (!next) throw new Error("unexpected mocked Supabase request");
    return {
      ok: next.status < 400,
      status: next.status,
      async json() { return next.body; }
    };
  };
  return { calls, fetchImpl };
}

function makeStore(responses) {
  const mocked = mockFetch(responses);
  const store = new SupabaseReviewStore({
    url: "https://sellerspark-development.supabase.co",
    anonKey: "mock-public-anon-key",
    fetchImpl: mocked.fetchImpl
  });
  return store.init().then(() => ({ store, calls: mocked.calls }));
}

test("Supabase store persists records and scopes reads by trusted actor", async () => {
  const { store, calls } = await makeStore([
    { status: 201, body: [row()] },
    { status: 200, body: [row()] }
  ]);
  const created = await store.create({ brief: { id: "fictional-lic" }, listingReview: { reviews: [] }, actorId, actorToken: "verified-owner-token" });
  const loaded = await store.get(created.id, { actorId, actorToken: "verified-owner-token" });
  assert.equal(loaded.id, created.id);
  assert.match(calls[0].options.headers.Authorization, /Bearer verified-owner-token/);
  assert.match(calls[1].url, /owner_id=eq\.11111111-1111-4111-8111-111111111111/);
  assert.doesNotMatch(calls[0].options.body, /otherActor/);
});

test("missing or invalid actor identity is rejected before any database request", async () => {
  const { store, calls } = await makeStore([]);
  await assert.rejects(() => store.get("review-12345678-1234-4123-8123-123456789012"), { code: "authorization_required" });
  await assert.rejects(() => store.get("review-12345678-1234-4123-8123-123456789012", { actorId: otherActorId.slice(0, -1), actorToken: "verified-owner-token" }), { code: "authorization_required" });
  assert.equal(calls.length, 0);
});

test("saved history requires a verified owner and token and requests a bounded stable order", async () => {
  const { store, calls } = await makeStore([{ status: 200, body: [row()] }]);
  await assert.rejects(() => store.list(), { code: "authorization_required" });
  await assert.rejects(() => store.list({ actorId }), { code: "authorization_required" });
  assert.equal(calls.length, 0);
  const saved = await store.list({ actorId, actorToken: "owner-token" });
  assert.equal(saved[0].id, row().id);
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get("owner_id"), "eq." + actorId);
  assert.equal(url.searchParams.get("order"), "updated_at.desc,id.desc");
  assert.equal(url.searchParams.get("limit"), "100");
});

test("version checks reject stale updates and keep concurrent work safe", async () => {
  const { store, calls } = await makeStore([
    { status: 200, body: [row()] },
    { status: 200, body: [row({ version: 2, updated_at: "2026-10-23T00:01:00.000Z" })] }
  ]);
  await assert.rejects(
    () => store.update("review-12345678-1234-4123-8123-123456789012", 0, () => {}, { actorId, actorToken: "verified-owner-token" }),
    { code: "conflict" }
  );
  assert.equal(calls.length, 1);
});

test("concurrent updates allow only one owner-scoped version transition", async () => {
  let current = row();
  let patchCount = 0;
  const mocked = mockFetch([]);
  mocked.fetchImpl = async (url, options = {}) => {
    mocked.calls.push({ url: String(url), options });
    if (options.method === "PATCH") {
      patchCount += 1;
      if (patchCount === 1) {
        current = row({ version: 2, updated_at: "2026-10-23T00:01:00.000Z" });
        return { ok: true, status: 200, async json() { return [current]; } };
      }
      return { ok: true, status: 200, async json() { return []; } };
    }
    return { ok: true, status: 200, async json() { return [current]; } };
  };
  const store = await new SupabaseReviewStore({
    url: "https://sellerspark-development.supabase.co",
    anonKey: "mock-public-anon-key",
    fetchImpl: mocked.fetchImpl
  }).init();
  const results = await Promise.allSettled([
    store.update(current.id, 1, (next) => { next.listingReview.reviews[0].status = "accepted"; }, { actorId, actorToken: "verified-owner-token" }),
    store.update(current.id, 1, (next) => { next.listingReview.reviews[0].status = "rejected"; }, { actorId, actorToken: "verified-owner-token" })
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected" && result.reason.code === "conflict").length, 1);
  assert.equal(current.version, 2);
});

test("database errors are sanitized and do not expose provider response text", async () => {
  const { store } = await makeStore([{ status: 403, body: { message: "private database detail" } }]);
  await assert.rejects(
    () => store.get("review-12345678-1234-4123-8123-123456789012", { actorId, actorToken: "verified-owner-token" }),
    (error) => error.code === "authorization_failed" && !error.message.includes("private database detail")
  );
});

test("prepared migration enables forced RLS, owner policies, and no anon grants", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261023000000_create_listing_reviews.sql", import.meta.url), "utf8");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /auth\.uid\(\)\s+is not null/i);
  assert.match(sql, /auth\.uid\(\)\s*=\s*owner_id/i);
  assert.match(sql, /revoke all on table public\.sellerspark_listing_reviews from anon/i);
  assert.doesNotMatch(sql, /service_role|SUPABASE_SECRET_KEY|eyJ[A-Za-z0-9_-]+/i);
});

