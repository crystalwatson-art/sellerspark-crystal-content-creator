import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveStudioPage, liveFollowerLabel } from "../public/studio-navigation.js";

test("penthouse retains each functional app control exactly once", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, "duplicate IDs break existing control bindings");
  for (const match of app.matchAll(/document\.querySelector\("#([^"]+)"\)/g)) {
    assert.ok(ids.includes(match[1]), `missing existing binding ${match[1]}`);
  }
  for (const id of ["auth-sign-in", "auth-sign-out", "auth-recovery-submit", "run-fictional-test", "connect-tiktok", "sync-tiktok-followers", "update-growth-pilot", "optimizer-accept", "optimizer-reject", "optimizer-revision", "optimizer-restore", "modal-copy", "reset-cancel", "reset-confirm", "optimizer-draft-list", "approval-draft-list"]) {
    assert.ok(ids.includes(id), `missing action ${id}`);
  }
  assert.match(html, /src="\/app.js"/);
  assert.match(html, /src="\/penthouse-studio.js"/);
  assert.doesNotMatch(html, /UI preview only|working reviews remain in SellerSpark|images\.unsplash/);
});

test("old workspace links remain usable and malformed routes recover to home", () => {
  for (const [hash, expected] of [["#studio", "home"], ["#overview", "home"], ["#draft-queue", "creator"], ["#workflow", "creator"], ["#tiktok", "growth"], ["#campaign", "growth"], ["#approval", "approval"], ["#account", "account"], ["#%E0%A4%A", "home"], ["#__proto__", "home"]]) {
    assert.equal(resolveStudioPage(hash), expected);
  }
});

test("dashboard cannot present manual or stale follower counts as live", () => {
  assert.equal(liveFollowerLabel("Not connected", 99), "Not connected");
  assert.equal(liveFollowerLabel("Not configured", 99), "Setup needed");
  assert.equal(liveFollowerLabel("Connected"), "Connected · Sync needed");
  assert.equal(liveFollowerLabel("Connected", "99"), "Connected · Sync needed");
  assert.equal(liveFollowerLabel("Connected", -1), "Connected · Sync needed");
  assert.equal(liveFollowerLabel("Connected", 0), "0");
  assert.equal(liveFollowerLabel("Connected", 1234), "1,234");
});

test("former preview forwards query and fragment to the one working interface", async () => {
  const html = await readFile(new URL("../public/penthouse-preview.html", import.meta.url), "utf8");
  assert.match(html, /location\.replace\('\/'\+location\.search\+location\.hash\)/);
  assert.doesNotMatch(html, /route-view|data:image/);
});

test("one calendar, regeneration and video views replace duplicate presentation blocks", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.equal((html.match(/id="campaign-calendar"/g) || []).length, 1);
  assert.doesNotMatch(html, /mini-calendar|open-followers|followers-panel/);
  for (const id of ["regenerate-drafts", "open-views", "views-panel", "authorize-video-views", "refresh-video-views", "video-views-list", "views-next", "views-previous"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
});
