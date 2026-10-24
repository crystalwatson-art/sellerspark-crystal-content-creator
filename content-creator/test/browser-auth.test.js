import assert from "node:assert/strict";
import test from "node:test";
import { BrowserSupabaseAuth } from "../public/supabase-auth.js";

const userId = "11111111-1111-4111-8111-111111111111";

function response(status, body) {
  return { ok: status < 400, status, async json() { return body; } };
}

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values
  };
}

function auth({ fetchImpl, clock = () => 1_000_000 }) {
  const browserStorage = storage();
  return new BrowserSupabaseAuth({
    url: "https://sellerspark-development.supabase.co",
    anonKey: "mock-public-anon-key",
    fetchImpl,
    storage: browserStorage,
    clock
  });
}

test("browser sign-in stores a session and authorized requests attach only the bearer token", async () => {
  const calls = [];
  const client = auth({
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).includes("grant_type=password")) {
        return response(200, { access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600, user: { id: userId } });
      }
      return response(200, { status: "ok" });
    }
  });
  await client.signIn("fictional@example.invalid", "fictional-password");
  const result = await client.authorizedFetch("/api/reviews/review-123", { headers: { "x-user-id": "not-trusted" } });
  assert.equal(result.status, 200);
  assert.equal(calls[0].options.headers.get("Authorization"), null);
  assert.equal(calls[1].options.headers.get("Authorization"), "Bearer access-token");
  assert.equal(calls[1].options.headers.get("x-user-id"), "not-trusted");
});

test("expired sessions refresh once before a persistent request and clear on failed refresh", async () => {
  let now = 1_000_000;
  const calls = [];
  const client = auth({
    clock: () => now,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).includes("grant_type=password")) return response(200, { access_token: "old", refresh_token: "refresh", expires_at: 999 });
      if (String(url).includes("grant_type=refresh_token")) return response(200, { access_token: "new", refresh_token: "new-refresh", expires_in: 3600, user: { id: userId } });
      return response(200, { status: "ok" });
    }
  });
  await client.signIn("fictional@example.invalid", "fictional-password");
  now = 2_000_000;
  await client.authorizedFetch("/api/reviews/review-123");
  assert.equal(calls[1].options.body, JSON.stringify({ refresh_token: "refresh" }));
  assert.equal(calls[2].options.headers.get("Authorization"), "Bearer new");

  const failed = auth({
    fetchImpl: async (url) => String(url).includes("grant_type=refresh_token") ? response(401, { message: "private auth detail" }) : response(200, { access_token: "old", refresh_token: "refresh", expires_at: 999 })
  });
  await failed.signIn("fictional@example.invalid", "fictional-password");
  await assert.rejects(() => failed.authorizedFetch("/api/reviews/review-123"), { code: "auth_required" });
  assert.equal(failed.session, null);
});

test("sign-out clears the browser session even when the provider is unavailable", async () => {
  let logoutCalls = 0;
  const client = auth({
    fetchImpl: async (url) => {
      if (String(url).includes("grant_type=password")) return response(200, { access_token: "access", refresh_token: "refresh", expires_in: 3600, user: { id: userId } });
      logoutCalls += 1;
      throw new Error("private provider detail");
    }
  });
  await client.signIn("fictional@example.invalid", "fictional-password");
  await client.signOut();
  assert.equal(logoutCalls, 1);
  assert.equal(client.session, null);
});

test("sign-in failures expose safe messages and never provider response text", async () => {
  const client = auth({ fetchImpl: async () => response(401, { message: "private provider detail" }) });
  await assert.rejects(
    () => client.signIn("fictional@example.invalid", "fictional-password"),
    (error) => error.code === "auth_failed" && !error.message.includes("private provider detail")
  );
});
