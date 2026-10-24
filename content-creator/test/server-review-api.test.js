import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ReviewStore } from "../src/review-store.js";
import { createServer } from "../src/server.js";
import fictionalLicBrief from "../fixtures/fictional-research-brief.json" with { type: "json" };
import fictionalBrooklynBrief from "../fixtures/fictional-brooklyn-townhouse-brief.json" with { type: "json" };

async function start(store, options = {}) {
  const server = createServer({ reviewStore: store, demoReviewStore: store, providerMode: "template", ...options });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return { server, base: `http://127.0.0.1:${address.port}` };
}

test("server persists fictional LIC review actions and rejects stale versions", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sellerspark-server-"));
  const filePath = path.join(directory, "reviews.json");
  const store = await new ReviewStore({ filePath }).init();
  const running = await start(store);
  t.after(() => running.server.close());

  const createdResponse = await fetch(running.base + "/api/content", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fictionalLicBrief)
  });
  const created = await createdResponse.json();
  assert.equal(createdResponse.status, 200);
  assert.equal(created.listingReviewVersion, 1);
  assert.equal(created.listingReview.reviews.length, 3);
  assert.equal(created.persistenceStatus, "fictional_demo_store");

  const acceptedResponse = await fetch(running.base + `/api/reviews/${encodeURIComponent(created.listingReviewId)}/actions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "accept",
      draftId: created.listingReview.reviews[0].draftId,
      expectedVersion: 1
    })
  });
  const accepted = await acceptedResponse.json();
  assert.equal(acceptedResponse.status, 200);
  assert.equal(accepted.listingReviewVersion, 2);
  assert.equal(accepted.listingReview.reviews[0].status, "accepted");

  const staleResponse = await fetch(running.base + `/api/reviews/${encodeURIComponent(created.listingReviewId)}/actions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "reject", draftId: created.listingReview.reviews[1].draftId, expectedVersion: 1 })
  });
  const stale = await staleResponse.json();
  assert.equal(staleResponse.status, 409);
  assert.equal(stale.status, "conflict");

  const recoveredStore = await new ReviewStore({ filePath }).init();
  const recovered = await recoveredStore.get(created.listingReviewId);
  assert.equal(recovered.version, 2);
  assert.equal(recovered.listingReview.reviews[0].status, "accepted");
});

test("server accepts the separate fictional Brooklyn handoff without changing audience", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sellerspark-server-"));
  const store = await new ReviewStore({ filePath: path.join(directory, "reviews.json") }).init();
  const running = await start(store);
  t.after(() => running.server.close());
  const response = await fetch(running.base + "/api/content", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fictionalBrooklynBrief)
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.audienceLabel, "Brooklyn townhouse owners");
  assert.ok(result.listingReview.reviews.every((review) => review.audienceLabel === "Brooklyn townhouse owners"));
});

// Verify automatic provider selection through the real HTTP route, not only the helper.
test("HTTP content endpoint quietly switches from exhausted Groq to Gemini", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sellerspark-routing-"));
  const store = await new ReviewStore({ filePath: path.join(directory, "reviews.json") }).init();
  const calls = [];
  const { createContentDraft } = await import("../src/content-creator.js");
  const running = await start(store, {
    providerMode: "groq",
    groqWriter: { generate: async () => { calls.push("groq"); return { writer: "groq", writerStatus: "rate_limited", status: "needs_more_research", drafts: [], humanApprovalRequired: true, automaticallyPublished: false }; } },
    geminiWriter: { generate: async (brief) => { calls.push("gemini"); return { ...createContentDraft(brief), writer: "gemini", writerStatus: "generated" }; } }
  });
  t.after(() => running.server.close());
  const response = await fetch(running.base + "/api/content", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(fictionalLicBrief) });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["groq", "gemini"]);
  assert.equal(result.writer, "gemini");
  assert.equal(result.failover.outcome, "backup_succeeded");
  assert.equal(result.listingReview.reviews.length, 3);
  assert.equal(result.humanApprovalRequired, true);
  assert.equal(result.automaticallyPublished, false);
});

test("HTTP content endpoint never substitutes offline drafts for rejected Gemini output", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sellerspark-routing-"));
  const store = await new ReviewStore({ filePath: path.join(directory, "reviews.json") }).init();
  const running = await start(store, {
    providerMode: "groq",
    groqWriter: { generate: async () => ({ writer: "groq", writerStatus: "rate_limited", status: "needs_more_research", drafts: [] }) },
    geminiWriter: { generate: async () => ({ writer: "gemini", writerStatus: "unsupported_claims", status: "needs_more_research", drafts: [], humanApprovalRequired: true, automaticallyPublished: false }) }
  });
  t.after(() => running.server.close());
  const response = await fetch(running.base + "/api/content", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(fictionalLicBrief) });
  const result = await response.json();
  assert.equal(result.writer, "gemini");
  assert.equal(result.failover.outcome, "backup_rejected");
  assert.equal(result.drafts.length, 0);
  assert.equal(result.listingReview.reviews.length, 0);
  assert.equal(result.automaticallyPublished, false);
});
