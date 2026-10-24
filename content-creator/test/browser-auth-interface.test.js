import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("browser auth UI is optional and the client uses server-provided public config", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const auth = await readFile(new URL("../public/supabase-auth.js", import.meta.url), "utf8");
  assert.match(html, /id="auth-form"/);
  assert.match(html, /Fictional demo available without sign-in/);
  assert.match(app, /\/api\/auth-config/);
  assert.match(app, /authorizedFetch/);
  assert.match(app, /function requestContentBrief\(brief, signal\)/);
  assert.match(app, /SellerSparkContentCreator/);
  assert.match(app, /currentPersistenceStatus === "supabase"/);
  assert.match(auth, /auth\/v1\/token\?grant_type=password/);
  assert.match(auth, /auth\/v1\/token\?grant_type=refresh_token/);
  assert.match(auth, /auth\/v1\/logout/);
  assert.doesNotMatch(auth, /SUPABASE_SECRET|SERVICE_ROLE|service_role/i);
});
