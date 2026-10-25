import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appPath = new URL("../public/app.js", import.meta.url);

test("audience workspaces use separate keys and preserve legacy records", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /const WORKSPACE_STORAGE_KEY = "sellerspark-listing-review-workspaces-v2"/);
  assert.match(app, /const LEGACY_WORKSPACE_STORAGE_KEY = "sellerspark-listing-review-workspace-v1"/);
  assert.match(app, /const GROWTH_PILOT_STORAGE_KEY = "sellerspark-growth-pilot-by-audience-v2"/);
  assert.match(app, /const LEGACY_GROWTH_PILOT_STORAGE_KEY = "sellerspark-growth-pilot-v1"/);
  assert.match(app, /return legacy && audience \? \{ \[audience\]: legacy \} : \{\}/);
  assert.match(app, /map\[currentWorkspaceAudience\] = workspaceSnapshot\(\)/);
});

test("switching audiences saves the outgoing workspace and restores the selected workspace", async () => {
  const app = await readFile(appPath, "utf8");
  const listener = app.match(/audienceValue\.addEventListener\("change", \(\) => \{[\s\S]*?\n\}\);/)?.[0] || "";
  assert.match(listener, /persistWorkspace\(\)/);
  assert.match(listener, /clearActiveWorkspace\(\)/);
  assert.match(listener, /currentWorkspaceAudience = nextAudience/);
  assert.match(listener, /restoreWorkspace\(\)/);
  assert.match(listener, /restoreGrowthPilot\(\)/);
});

test("workspace selection persists and authenticated cached reviews refresh from the server", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /localStorage\.setItem\(AUDIENCE_SELECTION_STORAGE_KEY, currentWorkspaceAudience\)/);
  assert.match(app, /currentReviewId && currentPersistenceStatus === "supabase" && authClient\.session/);
  assert.match(app, /if \(session && currentReviewId && currentPersistenceStatus === "supabase"\) void refreshReviewFromServer\(\)/);
});
