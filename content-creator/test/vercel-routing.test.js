import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Vercel catch-all route reuses the existing API handler", async () => {
  const route = await readFile(new URL("../api/[...path].js", import.meta.url), "utf8");
  assert.match(route, /export \{ default \} from ["']\.\/index\.js["'];/);
});
