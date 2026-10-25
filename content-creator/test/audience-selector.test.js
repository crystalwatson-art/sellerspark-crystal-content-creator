import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlPath = new URL("../public/index.html", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);

test("research audience selector offers exactly the two approved audiences", async () => {
  const html = await readFile(htmlPath, "utf8");
  const selector = html.match(/<select id="audience-value"[\s\S]*?<\/select>/)?.[0] || "";
  assert.match(selector, /value="lic_condo_owner">Long Island City condo owners/);
  assert.match(selector, /value="brooklyn_townhouse_owner">Brooklyn townhouse owners/);
  assert.equal((selector.match(/<option\b/g) || []).length, 2);
});

test("fictional audience selection maps to the matching research fixture and clears active review state", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /lic_condo_owner:\s*"\/fixtures\/fictional-research-brief\.json"/);
  assert.match(app, /brooklyn_townhouse_owner:\s*"\/fixtures\/fictional-brooklyn-townhouse-brief\.json"/);
  assert.match(app, /const fixturePath = RESEARCH_FIXTURES\[audienceValue\.value\]/);
  assert.match(app, /audienceValue\.disabled = true/);
  assert.match(app, /audienceValue\.disabled = false/);
  assert.match(app, /audienceValue\.addEventListener\("change", \(\) =>/);
  assert.match(app, /localStorage\.removeItem\(WORKSPACE_STORAGE_KEY\)/);
  assert.match(app, /currentListingReview = null/);
});
