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

test("password recovery restores the URL session and updates the password with its bearer token", async () => {
  const calls = [];
  const client = auth({
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return response(200, { user: { id: userId } });
    }
  });
  const session = client.restoreRecoverySession({
    hash: "#access_token=recovery-access&refresh_token=recovery-refresh&expires_in=3600&type=recovery"
  });
  assert.equal(session.accessToken, "recovery-access");
  await client.updatePassword("new-fictional-password");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://sellerspark-development.supabase.co/auth/v1/user");
  assert.equal(calls[0].options.method, "PUT");
  assert.equal(calls[0].options.headers.get("Authorization"), "Bearer recovery-access");
  assert.equal(calls[0].options.body, JSON.stringify({ password: "new-fictional-password" }));
});

test("default browser fetch keeps the global receiver during password updates", async () => {
  const originalFetch = globalThis.fetch;
  let receiver = null;
  globalThis.fetch = function () {
    receiver = this;
    if (this !== globalThis) {
      throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
    }
    return Promise.resolve(response(200, { user: { id: userId } }));
  };

  try {
    const client = new BrowserSupabaseAuth({
      url: "https://sellerspark-development.supabase.co",
      anonKey: "mock-public-anon-key",
      storage: storage(),
      clock: () => 1_000_000
    });
    client.restoreRecoverySession({
      hash: "#access_token=recovery-access&refresh_token=recovery-refresh&expires_in=3600&type=recovery"
    });

    await client.updatePassword("new-fictional-password");

    assert.equal(receiver, globalThis);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("password recovery rejects expired or incomplete links without making a request", async () => {
  let calls = 0;
  const client = auth({ fetchImpl: async () => { calls += 1; return response(200, {}); } });
  assert.equal(client.hasRecoveryRedirect({ hash: "#type=recovery&access_token=token" }), true);
  assert.throws(
    () => client.restoreRecoverySession({ hash: "#type=recovery&access_token=token&expires_at=999&type=recovery" }),
    (error) => error.code === "auth_failed" && /incomplete or expired/.test(error.message)
  );
  assert.throws(
    () => client.restoreRecoverySession({ hash: "#type=recovery" }),
    (error) => error.code === "auth_failed" && /incomplete or expired/.test(error.message)
  );
  assert.throws(
    () => client.restoreRecoverySession({ hash: "#type=recovery&access_token=token" }),
    (error) => error.code === "auth_failed" && /incomplete or expired/.test(error.message)
  );
  assert.equal(calls, 0);
  assert.equal(client.session, null);
});

test("password update failures expose safe messages and clear an unauthorized recovery session", async () => {
  const client = auth({ fetchImpl: async () => response(401, { message: "private provider detail" }) });
  client.restoreRecoverySession({ hash: "#access_token=recovery-access&expires_in=3600&type=recovery" });
  await assert.rejects(
    () => client.updatePassword("new-fictional-password"),
    (error) => error.code === "auth_failed" && !error.message.includes("private provider detail")
  );
  assert.equal(client.session, null);
});


test("remembered sign-in survives a new browser session, rotates tokens and signs out completely", async () => {
  const persistentStorage = storage();
  const tabStorage = storage();
  let now = 1_000_000;
  const options = {
    url: "https://example.supabase.co", anonKey: "public-test-key", persistentStorage,
    clock: () => now,
    fetchImpl: async (url) => response(200, {
      access_token: String(url).includes("refresh_token") ? "rotated-access" : "initial-access",
      refresh_token: "synthetic-refresh", expires_in: 60, user: { id: userId }
    })
  };
  const first = new BrowserSupabaseAuth({ ...options, storage: tabStorage });
  await first.signIn("fictional@example.invalid", "synthetic-password", { remember: true });
  assert.equal(tabStorage.values.size, 0);
  assert.equal(persistentStorage.values.size, 1);
  assert.ok(![...persistentStorage.values.values()].join("").includes("synthetic-password"));
  now += 60_000;
  const reopened = new BrowserSupabaseAuth({ ...options, storage: storage() });
  assert.equal((await reopened.getSession()).accessToken, "rotated-access");
  const again = new BrowserSupabaseAuth({ ...options, storage: storage() });
  assert.equal(again.session.accessToken, "rotated-access");
  await again.signOut();
  assert.equal(persistentStorage.values.size, 0);
  assert.equal(new BrowserSupabaseAuth({ ...options, storage: storage() }).session, null);
});

test("unchecked sign-in stays temporary and clears an earlier remembered account", async () => {
  const persistentStorage = storage();
  const tabStorage = storage();
  const options = { url: "https://example.supabase.co", anonKey: "public-test-key", persistentStorage,
    fetchImpl: async () => response(200, { access_token: "synthetic-access", refresh_token: "synthetic-refresh", expires_in: 3600 }) };
  const client = new BrowserSupabaseAuth({ ...options, storage: tabStorage });
  await client.signIn("fictional@example.invalid", "synthetic-password", { remember: true });
  await client.signIn("fictional@example.invalid", "synthetic-password");
  assert.equal(persistentStorage.values.size, 0);
  assert.equal(tabStorage.values.size, 1);
  assert.equal(new BrowserSupabaseAuth({ ...options, storage: storage() }).session, null);
});

test("recovery sessions remain temporary even after remembered sign-in", async () => {
  const persistentStorage = storage();
  const tabStorage = storage();
  const client = new BrowserSupabaseAuth({ url: "https://example.supabase.co", anonKey: "public-test-key",
    storage: tabStorage, persistentStorage,
    fetchImpl: async () => response(200, { access_token: "synthetic-access", expires_in: 3600 }) });
  await client.signIn("fictional@example.invalid", "synthetic-password", { remember: true });
  client.restoreRecoverySession({ hash: "#type=recovery&access_token=synthetic-recovery&expires_in=3600" });
  assert.equal(persistentStorage.values.size, 0);
  assert.equal(tabStorage.values.size, 1);
});
