import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlPath = new URL("../public/index.html", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);

test("dashboard exposes fictional mode and popup controls without a JSON editor", async () => {
  const html = await readFile(htmlPath, "utf8");

  assert.match(html, /id="run-fictional-test"/);
  assert.match(html, /id="reset-button"/);
  assert.match(html, /id="theme-toggle"/);
  assert.match(html, /id="draft-modal"/);
  assert.match(html, /id="modal-prev"/);
  assert.match(html, /id="modal-next"/);
  assert.match(html, /id="modal-copy"/);
  assert.match(html, /id="modal-takeaway"/);
  assert.match(html, /id="result-diagnostic"/);
  assert.match(html, /id="writer-status-value"/);
  assert.match(html, /id="writer-explanation"/);
  assert.match(html, /id="writer-next-step"/);
  assert.doesNotMatch(html, /Structured research brief/);
  assert.doesNotMatch(html, /Brief JSON/);
  assert.doesNotMatch(html, /<textarea\b/);
  assert.doesNotMatch(html, /Show structured handoff JSON/);
});

test("client wiring includes reset, theme, popup navigation, and contained close behavior", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function resetWorkspace\(\)/);
  assert.match(app, /result\.writerLabel/);
  assert.match(app, /result\.writerStatus/);
  assert.match(app, /modalTakeaway\.textContent = typeof draft\.takeaway === "string"/);
  assert.match(app, /Takeaway unavailable\. This draft needs review before approval\./);
  assert.match(app, /"\\nTakeaway: " \+ draft\.takeaway/);
  assert.match(app, /function renderWriterDiagnostic\(result\)/);
  assert.match(app, /The AI provider is temporarily rate-limited\./);
  assert.match(app, /The Content Creator stopped before producing drafts\./);
  assert.match(app, /The app will not switch providers automatically\./);
  assert.match(app, /function openDraft\(index\)/);
  assert.match(app, /function closeDraft\(\)/);
  assert.match(app, /modalPrevious\.addEventListener/);
  assert.match(app, /modalNext\.addEventListener/);
  assert.match(app, /modalCopy\.addEventListener/);
  assert.match(app, /resetButton\.addEventListener/);
  assert.match(app, /themeToggle\.addEventListener/);
  assert.match(app, /document\.body\.classList\.add\("modal-open"\)/);
  assert.match(app, /document\.body\.classList\.remove\("modal-open"\)/);
});
