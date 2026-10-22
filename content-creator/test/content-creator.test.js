import test from "node:test";
import assert from "node:assert/strict";
import { createContentDraft, REQUIRED_DRAFT_COUNT } from "../src/content-creator.js";
import fictionalBrief from "../fixtures/fictional-research-brief.json" with { type: "json" };

function briefWithTopics(topics) {
  return { ...fictionalBrief, topics };
}

test("normal fictional brief produces exactly three complete draft packages", () => {
  const result = createContentDraft(fictionalBrief);

  assert.equal(result.status, "ready_for_review");
  assert.equal(result.writer, "offline_template");
  assert.equal(result.writerLabel, "Offline template writer");
  assert.equal(result.drafts.length, REQUIRED_DRAFT_COUNT);
  for (const draft of result.drafts) {
    assert.equal(typeof draft.hook, "string");
    assert.equal(typeof draft.script, "string");
    assert.equal(typeof draft.caption, "string");
    assert.equal(typeof draft.angle, "string");
    assert.equal(typeof draft.videoConcept, "string");
    assert.equal(draft.suggestedScenes.length, 3);
    assert.ok(Array.isArray(draft.hashtags));
    assert.equal(typeof draft.suggestedNextStep, "string");
    assert.equal(draft.sourceRefs.length, 1);
    assert.equal(draft.humanApprovalRequired, true);
    assert.equal(draft.automaticallyPublished, false);
    assert.equal(draft.customerContacted, false);
  }
  assert.equal(new Set(result.drafts.map((draft) => draft.angle)).size, 3);
  assert.equal(new Set(result.drafts.map((draft) => draft.hook)).size, 3);
  assert.ok(result.drafts.every((draft) => !/\{(?:property|audience|question)\}/.test(draft.hook + draft.script + draft.caption)));
  assert.notEqual(result.drafts[0].caption, result.drafts[0].script);
});

test("fictional Brooklyn townhouse brief uses the second supported audience", () => {
  const result = createContentDraft({
    ...fictionalBrief,
    audience: "brooklyn_townhouse_owner"
  });

  assert.equal(result.status, "ready_for_review");
  assert.equal(result.audienceLabel, "Brooklyn townhouse owners");
  assert.equal(result.drafts.length, 3);
  assert.ok(result.drafts.every((draft) => draft.hashtags.includes("#Brooklyn")));
  assert.ok(result.drafts.every((draft) =>
    [draft.hook, draft.script].every((text) => text.includes("Brooklyn townhouse"))
  ));
  assert.ok(result.drafts.every((draft) =>
    ![draft.hook, draft.script].some((text) => text.includes("Long Island City condo"))
  ));
});

test("scripts stay viewer-facing and use distinct creative language", () => {
  const result = createContentDraft(fictionalBrief);
  const scripts = result.drafts.map((draft) => draft.script);

  assert.equal(new Set(scripts).size, 3);
  assert.ok(scripts.every((script) => !/use the supplied brief as context/i.test(script)));
  assert.ok(scripts.every((script) => /write down|name the information/i.test(script)));
  assert.ok(result.drafts.every((draft) => /qualified local professional/i.test(draft.suggestedNextStep)));
  assert.ok(scripts.some((script) => /seller mistake/i.test(script)));
  assert.ok(scripts.some((script) => /before you decide/i.test(script)));
  assert.ok(result.drafts.every((draft) =>
    [draft.hook, draft.script, draft.caption].every((text) =>
      !/use the supplied brief|human review required|based on the research input|this is a fictional topic/i.test(text)
    )
  ));
});

test("duplicate topics are blocked instead of receiving fabricated variety", () => {
  const duplicateTopic = fictionalBrief.topics[0];
  const result = createContentDraft(briefWithTopics([duplicateTopic, duplicateTopic, duplicateTopic]));

  assert.equal(result.status, "needs_more_research");
  assert.deepEqual(result.drafts, []);
  assert.match(result.missingInformation.join(" "), /three distinct research topics/);
});

test("missing research returns needs_more_research without inventing drafts", () => {
  const result = createContentDraft(null);

  assert.equal(result.status, "needs_more_research");
  assert.deepEqual(result.drafts, []);
  assert.match(result.missingInformation.join(" "), /brief is missing or malformed/);
  assert.equal(result.automaticallyPublished, false);
});

test("malformed topics are reported without throwing", () => {
  const result = createContentDraft(briefWithTopics([
    null,
    {},
    fictionalBrief.topics[2]
  ]));

  assert.equal(result.status, "needs_more_research");
  assert.equal(result.drafts.length, 0);
  assert.match(result.missingInformation.join(" "), /topic 1 is malformed/);
  assert.match(result.missingInformation.join(" "), /topic 2 needs a title or question/);
  assert.equal(result.humanApprovalRequired, true);
});

test("fewer than three topics are flagged instead of being padded with invented research", () => {
  const result = createContentDraft(briefWithTopics(fictionalBrief.topics.slice(0, 2)));

  assert.equal(result.status, "needs_more_research");
  assert.equal(result.drafts.length, 0);
  assert.match(result.missingInformation.join(" "), /at least three topics/);
});

test("missing source references are preserved as a warning", () => {
  const result = createContentDraft(briefWithTopics([
    { ...fictionalBrief.topics[0], sourceRefs: [] },
    fictionalBrief.topics[1],
    fictionalBrief.topics[2]
  ]));

  assert.equal(result.status, "needs_more_research");
  assert.match(result.missingInformation.join(" "), /has no source references/);
  assert.match(result.drafts[0].warnings.join(" "), /no supplied source references/);
});

test("uncertainty warnings stay attached to the review handoff", () => {
  const result = createContentDraft(briefWithTopics([
    { ...fictionalBrief.topics[0], uncertaintyWarnings: ["Fictional uncertainty: source needs a later date check."] },
    fictionalBrief.topics[1],
    fictionalBrief.topics[2]
  ]));

  assert.equal(result.status, "needs_more_research");
  assert.deepEqual(result.drafts[0].uncertaintyWarnings, ["Fictional uncertainty: source needs a later date check."]);
  assert.match(result.drafts[0].warnings.join(" "), /source needs a later date check/);
});

test("unsupported claims are omitted and surfaced for later review", () => {
  const result = createContentDraft(briefWithTopics([
    {
      ...fictionalBrief.topics[0],
      claims: [{
        text: "Fictional unsupported market promise",
        sourceId: "missing-fictional-source",
        supported: false
      }]
    },
    fictionalBrief.topics[1],
    fictionalBrief.topics[2]
  ]));
  const draft = result.drafts[0];

  assert.equal(result.status, "needs_more_research");
  assert.equal(draft.claimsUsed.length, 0);
  assert.equal(result.unsupportedClaims.length, 1);
  assert.match(draft.warnings.join(" "), /unsupported claim omitted/);
  assert.doesNotMatch(draft.script, /unsupported market promise/i);
});

test("supported claims and source dates remain attached to the handoff", () => {
  const source = fictionalBrief.topics[0].sourceRefs[0];
  const result = createContentDraft(briefWithTopics([
    {
      ...fictionalBrief.topics[0],
      claims: [{ text: "Fictional supported question", sourceId: source.id }]
    },
    fictionalBrief.topics[1],
    fictionalBrief.topics[2]
  ]));

  assert.equal(result.status, "ready_for_review");
  assert.deepEqual(result.drafts[0].sourceRefs[0], source);
  assert.equal(result.drafts[0].claimsUsed[0].sourceId, source.id);
  assert.equal(result.handoff.sourceRefsPreserved, true);
  assert.equal(result.handoff.sourceDatesPreserved, true);
});

test("output has a stable future-optimizer handoff shape", () => {
  const result = createContentDraft(fictionalBrief);
  const draft = result.drafts[0];

  assert.deepEqual(Object.keys(result).sort(), [
    "agent",
    "audience",
    "audienceLabel",
    "automaticallyPublished",
    "customerContacted",
    "drafts",
    "handoff",
    "humanApprovalRequired",
    "missingInformation",
    "researchBriefId",
    "status",
    "unsupportedClaims",
    "writer",
    "writerLabel"
  ]);
  assert.deepEqual(Object.keys(draft).sort(), [
    "angle",
    "audience",
    "audienceLabel",
    "automaticallyPublished",
    "caption",
    "claimsUsed",
    "customerContacted",
    "hashtags",
    "hook",
    "humanApprovalRequired",
    "id",
    "researchTopicId",
    "script",
    "sourceRefs",
    "suggestedNextStep",
    "suggestedScenes",
    "uncertaintyWarnings",
    "unsupportedClaims",
    "videoConcept",
    "warnings"
  ]);
});

test("unsupported audience is rejected without a research lookup", () => {
  const result = createContentDraft({
    ...fictionalBrief,
    audience: "fictional_audience"
  });

  assert.equal(result.status, "needs_more_research");
  assert.match(result.missingInformation.join(" "), /audience must be/);
  assert.deepEqual(result.drafts, []);
});

test("three malformed topics never produce draft objects", () => {
  const result = createContentDraft(briefWithTopics([null, {}, []]));
  assert.equal(result.status, "needs_more_research");
  assert.deepEqual(result.drafts, []);
  assert.equal(result.automaticallyPublished, false);
  assert.match(result.missingInformation.join(" "), /topic 1 is malformed/);
});
