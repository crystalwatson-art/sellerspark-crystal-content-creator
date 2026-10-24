import assert from "node:assert/strict";
import test from "node:test";
import { SupabaseAuthVerifier } from "../src/supabase-auth.js";

const userId = "11111111-1111-4111-8111-111111111111";

function response(status, body) {
  return { ok: status < 400, status, async json() { return body; } };
}

test("Supabase Auth rejects missing or malformed bearer tokens without a request", async () => {
  let calls = 0;
  const verifier = new SupabaseAuthVerifier({
    url: "https://sellerspark-development.supabase.co",
    anonKey: "mock-server-only-auth-key",
    fetchImpl: async () => { calls += 1; return response(200, { id: userId }); }
  });
  await assert.rejects(() => verifier.verify({ headers: {} }), { code: "authorization_required" });
  await assert.rejects(() => verifier.verify({ headers: { authorization: "Basic not-a-bearer" } }), { code: "authorization_required" });
  assert.equal(calls, 0);
});

test("Supabase Auth validates the bearer token server-side and returns the verified owner ID and token", async () => {
  const calls = [];
  const verifier = new SupabaseAuthVerifier({
    url: "https://sellerspark-development.supabase.co/",
    anonKey: "mock-server-only-auth-key",
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return response(200, { id: userId, email: "not-returned-to-the-app@example.invalid" });
    }
  });
  const result = await verifier.verify({ headers: { authorization: "Bearer mock-access-token" } });
  assert.deepEqual(result, { userId, accessToken: "mock-access-token" });
  assert.equal(calls[0].url, "https://sellerspark-development.supabase.co/auth/v1/user");
  assert.equal(calls[0].options.headers.Authorization, "Bearer mock-access-token");
});

test("Supabase Auth rejects provider failures and malformed user identities safely", async () => {
  const unavailable = new SupabaseAuthVerifier({
    url: "https://sellerspark-development.supabase.co",
    anonKey: "mock-server-only-auth-key",
    fetchImpl: async () => response(503, { message: "private provider detail" })
  });
  await assert.rejects(
    () => unavailable.verify({ headers: { authorization: "Bearer mock-access-token" } }),
    (error) => error.code === "authorization_failed" && !error.message.includes("private provider detail")
  );

  const malformed = new SupabaseAuthVerifier({
    url: "https://sellerspark-development.supabase.co",
    anonKey: "mock-server-only-auth-key",
    fetchImpl: async () => response(200, { id: "not-a-user-id" })
  });
  await assert.rejects(
    () => malformed.verify({ headers: { authorization: "Bearer mock-access-token" } }),
    { code: "authorization_failed" }
  );
});
