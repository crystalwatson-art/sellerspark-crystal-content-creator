import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ReviewStore } from "../src/review-store.js";

async function tempStore() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sellerspark-review-store-"));
  return path.join(directory, "reviews.json");
}

const sampleReview = {
  agent: "listing_optimizer",
  status: "ready_for_human_review",
  audience: "lic_condo_owner",
  audienceLabel: "Long Island City condo owners",
  reviews: [{ draftId: "fictional-draft-01", original: { hook: "Fictional hook" }, working: { hook: "Fictional hook" }, revisionHistory: [] }],
  revisionLimit: 2,
  humanApprovalRequired: true,
  publicationDisabled: true
};

test("review store keeps stable IDs and survives a new store instance", async () => {
  const filePath = await tempStore();
  const first = await new ReviewStore({ filePath }).init();
  const created = await first.create({
    brief: {
      id: "fictional-brief",
      audience: "lic_condo_owner",
      researchMode: "fictional_test_only",
      topics: [{ id: "topic-1", title: "Fictional topic", sourceRefs: [{ id: "fictional-source" }] }],
      secretShouldNotPersist: "fictional secret-shaped value"
    },
    researchVerification: { status: "fictional_test_only", warnings: ["Fictional warning"] },
    listingReview: sampleReview
  });

  assert.match(created.id, /^review-/);
  assert.equal(created.version, 1);
  const second = await new ReviewStore({ filePath }).init();
  const recovered = await second.get(created.id);
  assert.equal(recovered.id, created.id);
  assert.equal(recovered.version, 1);
  assert.equal(recovered.brief.secretShouldNotPersist, undefined);
  assert.equal(recovered.listingReview.reviews[0].original.hook, "Fictional hook");
});

test("review store rejects stale updates without overwriting newer work", async () => {
  const filePath = await tempStore();
  const store = await new ReviewStore({ filePath }).init();
  const created = await store.create({ brief: { id: "fictional" }, listingReview: sampleReview });
  const updated = await store.update(created.id, 1, (record) => {
    record.listingReview.reviews[0].working.hook = "Fictional updated hook";
  });
  assert.equal(updated.version, 2);
  await assert.rejects(
    store.update(created.id, 1, () => {}),
    (error) => error.code === "conflict" && error.current.version === 2
  );
  assert.equal((await store.get(created.id)).listingReview.reviews[0].working.hook, "Fictional updated hook");
});

test("review store fails safely on corrupt data and does not overwrite it", async () => {
  const filePath = await tempStore();
  await writeFile(filePath, "not valid fictional review JSON\n", "utf8");
  const store = await new ReviewStore({ filePath }).init();
  assert.equal(store.status().corrupt, true);
  await assert.rejects(store.get("review-missing"), (error) => error.code === "store_corrupt");
  await assert.rejects(store.create({ brief: {}, listingReview: sampleReview }), (error) => error.code === "store_corrupt");
  assert.equal(await readFile(filePath, "utf8"), "not valid fictional review JSON\n");
});
