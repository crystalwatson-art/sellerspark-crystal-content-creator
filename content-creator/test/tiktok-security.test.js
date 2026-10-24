import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTikTokIntegration, MemoryTikTokConnectionStore } from "../src/tiktok-oauth.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(root, "supabase", "migrations", "20261024000000_create_tiktok_connections.sql");

test("TikTok token and OAuth-state tables are not readable by ordinary Supabase clients", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /revoke all on table public\.sellerspark_tiktok_connections from anon;/);
  assert.match(sql, /revoke all on table public\.sellerspark_tiktok_connections from authenticated;/);
  assert.match(sql, /grant select, insert, update, delete on table public\.sellerspark_tiktok_connections to service_role;/);
  assert.match(sql, /revoke all on table public\.sellerspark_tiktok_oauth_states from anon;/);
  assert.match(sql, /revoke all on table public\.sellerspark_tiktok_oauth_states from authenticated;/);
  assert.match(sql, /grant select, insert, update, delete on table public\.sellerspark_tiktok_oauth_states to service_role;/);
  assert.doesNotMatch(sql, /grant\s+[^;]*\s+on table public\.sellerspark_tiktok_connections to authenticated/i);
  assert.doesNotMatch(sql, /grant\s+[^;]*\s+on table public\.sellerspark_tiktok_oauth_states to authenticated/i);
});

test("TikTok production configuration requires a server-only Supabase key", async () => {
  const source = await readFile(path.join(root, "src", "server.js"), "utf8");
  assert.match(source, /SELLERSPARK_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /new SupabaseTikTokOAuthStateStore/);
  assert.doesNotMatch(source, /new SupabaseTikTokConnectionStore\(\{[\s\S]*anonKey: supabaseAnonKey/);
});

test("TikTok integration refuses an in-memory OAuth state fallback when no store is supplied", () => {
  assert.throws(() => createTikTokIntegration({
    clientKey: "fictional-client-key",
    clientSecret: "fictional-client-secret",
    redirectUri: "https://example.test/callback",
    tokenStore: new MemoryTikTokConnectionStore(),
    fetchImpl: async () => ({ ok: true, async json() { return {}; } })
  }), /server-side OAuth state store/);
});
