import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ReviewStore } from "../src/review-store.js";
import { SupabaseAuthVerifier } from "../src/supabase-auth.js";
import { SupabaseReviewStore } from "../src/supabase-review-store.js";
import { createServer } from "../src/server.js";
import fictionalLicBrief from "../fixtures/fictional-research-brief.json" with { type: "json" };

const ownerA = "11111111-1111-4111-8111-111111111111";
const ownerB = "22222222-2222-4222-8222-222222222222";
const reviewId = "review-12345678-1234-4123-8123-123456789012";

function response(status, body) {
  return { ok: status < 400, status, async json() { return body; } };
}

function reviewRow(owner_id = ownerA) {
  return {
    id: reviewId,
    owner_id,
    version: 1,
    created_at: "2026-10-23T00:00:00.000Z",
    updated_at: "2026-10-23T00:00:00.000Z",
    brief: { id: "fictional-persistent-review" },
    research_verification: { status: "verified_by_test_double" },
    listing_review: { audienceLabel: "Test owner", reviews: [{ draftId: "draft-1", status: "pending" }] }
  };
}

async function startServer({ authFetch, dbFetch, serverOptions = {} }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sellerspark-auth-server-"));
  const demoStore = await new ReviewStore({ filePath: path.join(directory, "demo.json") }).init();
  const dbStore = await new SupabaseReviewStore({
    url: "https://sellerspark-development.supabase.co",
    secretKey: "mock-server-only-secret",
    fetchImpl: dbFetch
  }).init();
  const authVerifier = new SupabaseAuthVerifier({
    url: "https://sellerspark-development.supabase.co",
    anonKey: "mock-server-only-auth-key",
    fetchImpl: authFetch
  });
  const server = createServer({ reviewStore: dbStore, demoReviewStore: demoStore, authVerifier, providerMode: "template", ...serverOptions });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return { server, base: `http://127.0.0.1:${address.port}` };
}

test("persistent review access rejects unauthenticated requests and never queries the database", async (t) => {
  let dbCalls = 0;
  const running = await startServer({
    authFetch: async () => response(200, { id: ownerA }),
    dbFetch: async () => { dbCalls += 1; return response(200, [reviewRow()]); }
  });
  t.after(() => running.server.close());
  const result = await fetch(running.base + "/api/reviews/" + reviewId);
  assert.equal(result.status, 401);
  assert.equal((await result.json()).message, "Authentication is required.");
  assert.equal(dbCalls, 0);
});

test("auth configuration exposes only the browser-safe Supabase values", async (t) => {
  const running = await startServer({
    authFetch: async () => response(200, { id: ownerA }),
    dbFetch: async () => response(200, []),
    serverOptions: {
      authConfig: {
        enabled: true,
        url: "https://sellerspark-development.supabase.co",
        anonKey: "mock-public-anon-key"
      }
    }
  });
  t.after(() => running.server.close());
  const result = await fetch(running.base + "/api/auth-config");
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), {
    enabled: true,
    url: "https://sellerspark-development.supabase.co",
    anonKey: "mock-public-anon-key"
  });
});

test("fictional demo remains available without an account and never uses persistent storage", async (t) => {
  let authCalls = 0;
  let dbCalls = 0;
  const running = await startServer({
    authFetch: async () => { authCalls += 1; return response(200, { id: ownerA }); },
    dbFetch: async () => { dbCalls += 1; return response(200, []); }
  });
  t.after(() => running.server.close());
  const result = await fetch(running.base + "/api/content", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fictionalLicBrief)
  });
  const payload = await result.json();
  assert.equal(result.status, 200);
  assert.equal(payload.drafts.length, 3);
  assert.equal(payload.persistenceStatus, "fictional_demo_store");
  assert.equal(authCalls, 0);
  assert.equal(dbCalls, 0);
});

test("verified owner identity scopes persistent review reads and ignores browser-supplied user IDs", async (t) => {
  const authCalls = [];
  const dbCalls = [];
  const running = await startServer({
    authFetch: async (url, options) => {
      authCalls.push({ url: String(url), options });
      return response(200, { id: options.headers.Authorization.endsWith("owner-b") ? ownerB : ownerA });
    },
    dbFetch: async (url) => {
      dbCalls.push(String(url));
      return String(url).includes("owner_id=eq." + ownerA) ? response(200, [reviewRow(ownerA)]) : response(200, []);
    }
  });
  t.after(() => running.server.close());

  const ownerResponse = await fetch(running.base + "/api/reviews/" + reviewId, {
    headers: { Authorization: "Bearer owner-a", "x-user-id": ownerB }
  });
  assert.equal(ownerResponse.status, 200);
  assert.equal((await ownerResponse.json()).listingReviewId, reviewId);
  assert.match(dbCalls[0], new RegExp("owner_id=eq\\." + ownerA));

  const otherResponse = await fetch(running.base + "/api/reviews/" + reviewId, {
    headers: { Authorization: "Bearer owner-b" }
  });
  assert.equal(otherResponse.status, 404);
  assert.equal(authCalls.length, 2);
});

test("authenticated content uses the verified owner for persistent review creation", async (t) => {
  const authHeaders = [];
  const dbCalls = [];
  const { createContentDraft } = await import("../src/content-creator.js");
  const running = await startServer({
    authFetch: async (_url, options) => {
      authHeaders.push(options.headers.Authorization);
      return response(200, { id: ownerA });
    },
    dbFetch: async (url, options = {}) => {
      dbCalls.push({ url: String(url), options });
      if (options.method === "POST") return response(201, [reviewRow(ownerA)]);
      return response(200, []);
    },
    serverOptions: {
      providerMode: "openai",
      openAIWriter: { generate: async () => ({ ...createContentDraft(fictionalLicBrief), status: "ready_for_review", writer: "mock", writerStatus: "generated" }) }
    }
  });
  t.after(() => running.server.close());
  const result = await fetch(running.base + "/api/content", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer owner-a" },
    body: JSON.stringify({ ...fictionalLicBrief, researchMode: "verified", _fixtureNotice: undefined })
  });
  assert.equal(result.status, 200);
  assert.equal(authHeaders.length, 1);
  assert.equal(dbCalls.length, 1);
  assert.match(dbCalls[0].options.body, new RegExp(ownerA));
});
