import test from "node:test";
import assert from "node:assert/strict";
import { createContentDraft } from "../src/content-creator.js";
import fictionalBrief from "../fixtures/fictional-research-brief.json" with { type: "json" };

test("valid fictional brief produces reviewable TikTok draft packages", () => {
  const result = createContentDraft(fictionalBrief);

  assert.equal(result.status, "ready_for_review");
  assert.equal(result.drafts.length, 2);
  for (const draft of result.drafts) {
    assert.equal(typeof draft.hook, "string");
    assert.equal(typeof draft.script, "string");
    assert.equal(typeof draft.caption, "string");
    assert.ok(Array.isArray(draft.hashtags));
    assert.equal(typeof draft.suggestedNextStep, "string");
    assert.ok(draft.sourceRefs.length > 0);
    assert.equal(draft.humanApprovalRequired, true);
    assert.equal(draft.automaticallyPublished, false);
    assert.equal(draft.customerContacted, false);
  }
});

test("fictional Brooklyn townhouse brief uses the second supported audience", () => {
  const result = createContentDraft({
    ...fictionalBrief,
    audience: "brooklyn_townhouse_owner",
    topics: [fictionalBrief.topics[0]]
  });

  assert.equal(result.status, "ready_for_review");
  assert.equal(result.audienceLabel, "Brooklyn townhouse sellers");
  assert.ok(result.drafts[0].hashtags.includes("#Brooklyn"));
  assert.equal(result.drafts[0].audience, "brooklyn_townhouse_owner");
});

test("missing research returns needs_more_research without inventing a draft", () => {
  const result = createContentDraft(null);

  assert.equal(result.status, "needs_more_research");
  assert.deepEqual(result.drafts, []);
  assert.match(result.missingInformation.join(" "), /brief is missing/);
  assert.equal(result.automaticallyPublished, false);
});

test("unsupported claims are omitted and surfaced for later review", () => {
  const brief = {
    ...fictionalBrief,
    topics: [{
      ...fictionalBrief.topics[0],
      claims: [
        {
          text: "Fictional unsupported market promise",
          sourceId: "missing-fictional-source",
          supported: false
        }
      ]
    }]
  };

  const result = createContentDraft(brief);
  const draft = result.drafts[0];

  assert.equal(result.status, "needs_more_research");
  assert.equal(draft.claimsUsed.length, 0);
  assert.equal(result.unsupportedClaims.length, 1);
  assert.match(draft.warnings.join(" "), /unsupported claim omitted/);
  assert.doesNotMatch(draft.script, /unsupported market promise/i);
});

test("output preserves the supplied source-reference shape", () => {
  const sourceRefs = [
    {
      id: "fictional-source-custom",
      title: "Fictional Custom Reference",
      url: "https://fictional.example/custom",
      date: "2026-10-21",
      extraField: "preserve me"
    }
  ];
  const result = createContentDraft({
    ...fictionalBrief,
    topics: [{ ...fictionalBrief.topics[0], sourceRefs }]
  });

  assert.deepEqual(result.drafts[0].sourceRefs, sourceRefs);
  assert.equal(result.handoff.sourceRefsPreserved, true);
});
