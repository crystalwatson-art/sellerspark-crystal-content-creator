import test from "node:test";
import assert from "node:assert/strict";
import fictionalBrief from "../fixtures/fictional-research-brief.json" with { type: "json" };
import fictionalBrooklynBrief from "../fixtures/fictional-brooklyn-townhouse-brief.json" with { type: "json" };
import { createContentDraft } from "../src/content-creator.js";
import { evaluateDraftSetQuality } from "../src/editorial-quality.js";

function evaluate(drafts, brief = fictionalBrief) {
  return evaluateDraftSetQuality(drafts, {
    audienceLabel: brief.audience === "lic_condo_owner"
      ? "Long Island City condo owners"
      : "Brooklyn townhouse owners",
    researchTopics: brief.topics
  });
}

test("fictional LIC drafts pass the heuristic checks without predicting performance", () => {
  const result = createContentDraft(fictionalBrief);

  assert.equal(result.editorialQuality.assessment, "editorial_review");
  assert.equal(result.editorialQuality.assessmentMethod, "heuristic_content_checks");
  assert.equal(result.editorialQuality.score, "24/24");
  assert.equal(result.editorialQuality.readyForHumanReview, true);
  assert.deepEqual(result.editorialQuality.setChecks, {
    exactlyThreeDrafts: true,
    distinctAngles: true,
    distinctHooks: true,
    audienceSeparated: true,
    topicGrounded: true
  });
  assert.match(result.editorialQuality.scoreMeaning, /not semantic judgment/i);
  assert.match(result.editorialQuality.uncertainty, /human editor/i);
  assert.equal("predictedPerformance" in result.editorialQuality, false);
});

test("fictional Brooklyn drafts stay audience-specific and retain topic grounding", () => {
  const result = createContentDraft(fictionalBrooklynBrief);

  assert.equal(result.audienceLabel, "Brooklyn townhouse owners");
  assert.equal(result.editorialQuality.score, "24/24");
  assert.ok(result.drafts.every((draft) => draft.hook.includes("Brooklyn townhouse")));
  assert.ok(result.editorialQuality.drafts.every((draft) => draft.criteria.homeowner_relevance.pass));
  assert.ok(result.editorialQuality.drafts.every((draft) => draft.takeawayEvidence.length >= 1));
});

test("generic scripts stuffed with expected keywords cannot receive a perfect score", () => {
  const drafts = ["Education", "Mistakes", "Decisions"].map((angle, index) => ({
    audienceLabel: "Long Island City condo owners",
    angle,
    hook: `Selling your Long Island City condo? Ask this question ${index + 1}.`,
    script: "Write one question before a seller conversation. Note what you know and learn what you need next. This helps Long Island City condo owners prepare.",
    takeaway: "Write one question and note what you need to learn before deciding on a conversation.",
    caption: "Follow for seller guidance and practical homeowner questions.",
    suggestedNextStep: "Contact Shalinthia for a respectful seller conversation.",
    sourceRefs: [{ id: "fictional-source-01" }]
  }));
  const quality = evaluate(drafts);

  assert.equal(quality.readyForHumanReview, false);
  assert.ok(Number.parseInt(quality.score, 10) < 24);
  assert.ok(quality.drafts.some((draft) => draft.warnings.some((warning) => /distinct|topic/i.test(warning))));
});

test("three scripts repeating the same advice are flagged", () => {
  const drafts = createContentDraft(fictionalBrief).drafts.map((draft, index) => ({
    ...draft,
    hook: `${draft.hook} Draft ${index + 1}`,
    script: "Write down one question, bring it to a seller conversation, and note what you still need to learn.",
    takeaway: "Write down one question, bring it to the conversation, and note what you still need to learn."
  }));
  const quality = evaluate(drafts);

  assert.equal(quality.setChecks.distinctHooks, true);
  assert.equal(quality.readyForHumanReview, false);
  assert.ok(quality.drafts.some((draft) => !draft.criteria.topic_distinctiveness.pass));
});

test("correct audience language cannot hide ignored assigned topics", () => {
  const drafts = createContentDraft(fictionalBrief).drafts.map((draft, index) => ({
    ...draft,
    hook: `Selling your Long Island City condo? Ask this general seller question ${index + 1}.`,
    script: "Long Island City condo owners should ask a question and have a conversation before they decide.",
    takeaway: "Ask a question and have a conversation before making a decision about selling."
  }));
  const quality = evaluate(drafts);

  assert.equal(quality.setChecks.audienceSeparated, true);
  assert.equal(quality.setChecks.topicGrounded, false);
  assert.equal(quality.readyForHumanReview, false);
  assert.ok(quality.drafts.some((draft) => !draft.criteria.homeowner_relevance.pass));
});

test("vague takeaways are not treated as practical viewer value", () => {
  const drafts = createContentDraft(fictionalBrief).drafts.map((draft) => ({
    ...draft,
    takeaway: "Think about it and take the next step when it feels right for you."
  }));
  const quality = evaluate(drafts);

  assert.equal(quality.readyForHumanReview, false);
  assert.ok(quality.drafts.some((draft) => !draft.criteria.practical_viewer_value.pass));
});

test("follow invitations without a useful reason to return are flagged", () => {
  const drafts = createContentDraft(fictionalBrief).drafts.map((draft) => ({
    ...draft,
    caption: "Follow me.",
    suggestedNextStep: "Contact Shalinthia when you are ready."
  }));
  const quality = evaluate(drafts);

  assert.equal(quality.readyForHumanReview, false);
  assert.ok(quality.drafts.some((draft) => !draft.criteria.reason_to_follow.pass));
});

test("unsupported claims fail source safety without being researched by the evaluator", () => {
  const drafts = createContentDraft(fictionalBrief).drafts.map((draft, index) => ({
    ...draft,
    script: `${draft.script} This guarantees a 12% higher sale price.`,
    hook: `${draft.hook} Draft ${index + 1}`
  }));
  const quality = evaluate(drafts);

  assert.equal(quality.readyForHumanReview, false);
  assert.ok(quality.drafts.every((draft) => !draft.criteria.credibility_source_safety.pass));
});

test("strong fictional examples grounded in supplied research retain a full heuristic score", () => {
  const result = createContentDraft(fictionalBrief);
  const quality = evaluate(result.drafts);

  assert.equal(quality.score, "24/24");
  assert.equal(quality.setChecks.topicGrounded, true);
  assert.equal(quality.readyForHumanReview, true);
});

test("a mixed audience is flagged instead of being presented as one campaign", () => {
  const drafts = createContentDraft(fictionalBrief).drafts.map((draft) => ({ ...draft }));
  drafts[2] = { ...drafts[2], audienceLabel: "Brooklyn townhouse owners" };

  const quality = evaluate(drafts);

  assert.equal(quality.setChecks.audienceSeparated, false);
  assert.equal(quality.readyForHumanReview, false);
});
