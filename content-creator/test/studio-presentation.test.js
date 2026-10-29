import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/penthouse-workspace.css", import.meta.url);

test("Studio presentation keeps Crystal ownership and the multi-agent workflow visible", async () => {
  const html = await readFile(htmlPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.doesNotMatch(html, /class="sidebar"/);
  assert.match(html, /id="view-home"/);
  assert.match(html, /class="scene"/);
  assert.match(html, /id="studio-account-link"/);
  assert.match(html, />Crystal<\/strong>/);
  assert.match(html, /id="workflow"/);
  for (const label of ["Content Generator", "Router", "Validation", "Handoff", "Listing Optimizer", "Human approval gate"]) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /Nothing publishes automatically/);
  assert.match(styles, /--surface:rgba\(11,15,35,\.10\)/);
  assert.match(styles, /--violet:/);
  assert.match(styles, /--gold:/);
  assert.match(styles, /\[hidden\]\{display:none!important\}/);
  assert.match(styles, /\.workflow-track/);
  assert.match(styles, /@media\(max-width:600px\)/);
});

