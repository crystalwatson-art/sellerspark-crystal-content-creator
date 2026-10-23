import test from "node:test";
import assert from "node:assert/strict";
import { createContentDraft } from "../src/content-creator.js";
import {
  MAX_AUTOMATIC_REVISIONS,
  adaptContentResultToListingReview,
  createListingReviewSession,
  evaluateContentDraft
} from "../src/listing-optimizer.js";
import fictionalLicBrief from "../fixtures/fictional-research-brief.json" with { type: "json" };
import fictionalBrooklynBrief from "../fixtures/fictional-brooklyn-townhouse-brief.json" with { type: "json" };

test("fictional LIC content connects to three reviewable optimizer records", () => {
  const contentResult = createContentDraft(fictionalLicBrief);
  const review = adaptContentResultToListingReview(contentResult);

  assert.equal(review.status, "ready_for_human_review");
  assert.equal(review.reviews.length, 3);
  assert.equal(review.audienceLabel, "Long Island City condo owners");
  assert.equal(review.humanApprovalRequired, true);
  assert.equal(review.automaticallyPublished, false);
  assert.equal(review.customerContacted, false);
  assert.equal(review.publicationDisabled, true);
  assert.equal(review.revisionLimit, 2);
  assert.equal(review.reviews[0].original.hook, contentResult.drafts[0].hook);
  assert.ok(review.reviews.every((item) => item.suggestedImprovements.length > 0));
  assert.ok(review.reviews.every((item) => item.suggestedImprovements.every((suggestion) => suggestion.reason)));
  assert.ok(review.reviews.every((item) => item.proposed));
  assert.ok(review.reviews.every((item) => item.changes.length > 0));
  assert.ok(review.reviews.every((item) => item.proposedSource === "local_fictional_demo"));
  assert.deepEqual(review.reviews[0].original.sourceRefs, contentResult.drafts[0].sourceRefs);
});

test("fictional Brooklyn content stays separated from the LIC audience", () => {
  const contentResult = createContentDraft(fictionalBrooklynBrief);
  const review = adaptContentResultToListingReview(contentResult);

  assert.equal(review.audienceLabel, "Brooklyn townhouse owners");
  assert.ok(review.reviews.every((item) => item.audienceLabel === "Brooklyn townhouse owners"));
  assert.ok(review.reviews.every((item) => !item.original.hook.includes("Long Island City condo")));
});

test("optimizer preserves factual warnings and missing evidence without inventing a correction", () => {
  const draft = {
    id: "fictional-draft-01",
    audience: "lic_condo_owner",
    audienceLabel: "Long Island City condo owners",
    hook: "A fictional hook",
    script: "A fictional script",
    caption: "A fictional caption",
    sourceRefs: [],
    warnings: ["Fictional warning: source date needs review."],
    unsupportedClaims: [{ reason: "fictional claim has no checked source" }]
  };
  const evaluation = evaluateContentDraft(draft, {
    researchVerification: {
      status: "needs_more_research",
      missingEvidence: ["fictional evidence quote is missing"],
      warnings: ["fictional verification warning"]
    }
  });

  assert.ok(evaluation.missingEvidence.some((item) => /No source reference/.test(item)));
  assert.ok(evaluation.missingEvidence.includes("fictional evidence quote is missing"));
  assert.ok(evaluation.factualSupportWarnings.some((item) => /fictional claim/.test(item)));
  assert.ok(evaluation.factualSupportWarnings.includes("fictional verification warning"));
});

test("accept, reject, and revision actions create visible review history", () => {
  const contentResult = createContentDraft(fictionalLicBrief);
  const session = createListingReviewSession(contentResult);

  assert.equal(session.accept("content-draft-01").state.reviews[0].status, "accepted");
  assert.equal(session.reject("content-draft-02").state.reviews[1].status, "rejected");
  const revision = session.requestRevision("content-draft-03", "Fictional reviewer asks for a clearer question.");
  assert.equal(revision.state.reviews[2].status, "revision_requested");
  assert.equal(revision.state.reviews[2].automaticRevisionAttempts, 1);
  assert.equal(revision.state.reviews[2].revisionHistory.length, 1);
  assert.equal(revision.state.humanApprovalRequired, true);
  assert.equal(revision.state.publicationDisabled, true);
});

test("automatic revision requests stop at the existing maximum of two", () => {
  const session = createListingReviewSession(createContentDraft(fictionalLicBrief));

  assert.equal(session.requestRevision("content-draft-01").ok, true);
  assert.equal(session.requestRevision("content-draft-01").ok, true);
  const blocked = session.requestRevision("content-draft-01");

  assert.equal(MAX_AUTOMATIC_REVISIONS, 2);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "revision_limit_reached");
  assert.equal(blocked.state.reviews[0].status, "revision_limit_reached");
  assert.equal(blocked.state.reviews[0].automaticRevisionAttempts, 2);
  assert.equal(blocked.state.reviews[0].revisionHistory.length, 3);
});

test("accept applies only the selected proposed revision and preserves the original", () => {
  const contentResult = createContentDraft(fictionalLicBrief);
  const session = createListingReviewSession(contentResult);
  const original = session.getState().reviews[0].original;
  const proposed = session.getState().reviews[0].proposed;

  const accepted = session.accept("content-draft-01");

  assert.equal(accepted.ok, true);
  assert.equal(accepted.state.reviews[0].status, "accepted");
  assert.equal(accepted.state.reviews[0].working.hook, proposed.hook);
  assert.equal(accepted.state.reviews[0].original.hook, original.hook);
  assert.equal(accepted.state.reviews[1].working.hook, contentResult.drafts[1].hook);
});

test("reject and restore keep the original working copy", () => {
  const session = createListingReviewSession(createContentDraft(fictionalLicBrief));
  const original = session.getState().reviews[0].original;

  session.accept("content-draft-01");
  const rejected = session.reject("content-draft-01");
  const restored = session.restoreOriginal("content-draft-01");

  assert.equal(rejected.state.reviews[0].working.hook, original.hook);
  assert.equal(rejected.state.reviews[0].status, "rejected");
  assert.equal(restored.state.reviews[0].working.hook, original.hook);
  assert.equal(restored.state.reviews[0].status, "original_restored");
  assert.ok(restored.state.reviews[0].revisionHistory.some((item) => item.action === "original_restored"));
});

test("request revision produces a new candidate before the two-attempt limit", () => {
  const session = createListingReviewSession(createContentDraft(fictionalBrooklynBrief));
  const before = session.getState().reviews[0].proposed.hook;

  const first = session.requestRevision("content-draft-01", "Fictional reviewer asks for a sharper opening.");
  const after = first.state.reviews[0].proposed.hook;

  assert.equal(first.ok, true);
  assert.equal(first.state.reviews[0].status, "revision_requested");
  assert.equal(first.state.reviews[0].automaticRevisionAttempts, 1);
  assert.notEqual(after, before);
  assert.equal(first.state.reviews[0].audienceLabel, "Brooklyn townhouse owners");
  assert.ok(first.state.reviews[0].revisionHistory.length > 0);
});

test("verified research without a configured revision provider reports the limitation truthfully", () => {
  const contentResult = {
    status: "ready_for_review",
    audience: "lic_condo_owner",
    audienceLabel: "Long Island City condo owners",
    researchVerification: { status: "verified", warnings: [], missingEvidence: [] },
    drafts: [{
      id: "verified-draft-01",
      audience: "lic_condo_owner",
      audienceLabel: "Long Island City condo owners",
      hook: "A supplied verified hook",
      script: "A supplied verified script.",
      takeaway: "A supplied verified takeaway.",
      videoConcept: "A supplied verified concept.",
      caption: "A supplied verified caption.",
      hashtags: ["#HomeSelling"],
      suggestedNextStep: "Ask a supplied verified question.",
      sourceRefs: [{ id: "source-1", title: "Fictional test source", date: "2026-10-20" }],
      warnings: [],
      unsupportedClaims: []
    }]
  };
  const session = createListingReviewSession(contentResult);
  const result = session.requestRevision("verified-draft-01");

  assert.equal(result.ok, false);
  assert.equal(result.reason, "revision_unavailable");
  assert.equal(result.state.reviews[0].status, "revision_unavailable");
  assert.match(result.state.reviews[0].revisionUnavailableReason, /No configured revision provider/);
});

test("verified research calls the configured revision generator instead of using an unavailable placeholder", async () => {
  const contentResult = {
    status: "ready_for_review",
    audience: "lic_condo_owner",
    audienceLabel: "Long Island City condo owners",
    researchVerification: { status: "verified", warnings: [], missingEvidence: [] },
    drafts: [{
      id: "verified-draft-01",
      audience: "lic_condo_owner",
      audienceLabel: "Long Island City condo owners",
      researchTopicId: "topic-1",
      hook: "Original fictional verified hook",
      script: "Original fictional verified script.",
      takeaway: "Original fictional verified takeaway.",
      videoConcept: "Original fictional verified concept.",
      caption: "Original fictional verified caption.",
      hashtags: ["#Fictional"],
      suggestedNextStep: "Ask a fictional verified question.",
      sourceRefs: [{ id: "simulated-source", title: "Fictional source", date: "2026-10-20" }],
      warnings: [],
      unsupportedClaims: []
    }]
  };
  let called = 0;
  const session = createListingReviewSession(contentResult, {
    revisionGenerator: async (draft) => {
      called += 1;
      return {
        status: "available",
        source: "mocked_groq",
        draft: { ...draft, hook: "Fresh fictional verified hook" },
        changes: [{ field: "hook", label: "Hook", before: draft.hook, after: "Fresh fictional verified hook", reason: "Fictional test reason" }]
      };
    },
    brief: { id: "simulated-verified-brief" }
  });
  const result = await session.requestRevision("verified-draft-01");
  assert.equal(called, 1);
  assert.equal(result.ok, true);
  assert.equal(result.state.reviews[0].proposed.hook, "Fresh fictional verified hook");
});

test("real-estate rules remain injectable instead of being hardcoded here", () => {
  let called = false;
  const result = adaptContentResultToListingReview(createContentDraft(fictionalLicBrief), {
    evaluatorName: "fictional_sha_rule_stub",
    evaluateDraft(draft, context) {
      called = true;
      assert.equal(context.audience, "lic_condo_owner");
      return {
        suggestedImprovements: [{ field: "script", recommendation: "Fictional modular rule", reason: "Fictional test reason" }],
        factualSupportWarnings: [],
        missingEvidence: []
      };
    }
  });

  assert.equal(called, true);
  assert.equal(result.evaluator, "fictional_sha_rule_stub");
  assert.equal(result.reviews[0].suggestedImprovements[0].recommendation, "Fictional modular rule");
});

test("blocked content cannot create a reviewable optimizer queue", () => {
  const contentResult = createContentDraft(null);
  const review = adaptContentResultToListingReview(contentResult);

  assert.equal(review.status, "blocked");
  assert.deepEqual(review.reviews, []);
  assert.equal(review.humanApprovalRequired, true);
  assert.equal(review.publicationDisabled, true);
});
