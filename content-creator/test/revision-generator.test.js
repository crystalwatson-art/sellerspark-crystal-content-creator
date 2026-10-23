import test from "node:test";
import assert from "node:assert/strict";
import { createRevisionGenerator } from "../src/revision-generator.js";

const simulatedBrief = {
  id: "simulated-verified-brief",
  audience: "lic_condo_owner",
  researchMode: "verified",
  topics: [{ id: "topic-1", title: "Simulated source-backed question", question: "What should a seller ask first?", sourceRefs: [{ id: "simulated-source", url: "https://example.test/fictional-source", date: "2026-10-20" }] }]
};

const original = {
  id: "verified-draft-01",
  audience: "lic_condo_owner",
  audienceLabel: "Long Island City condo owners",
  researchTopicId: "topic-1",
  hook: "Original fictional hook",
  script: "Original fictional script.",
  takeaway: "Original fictional takeaway.",
  videoConcept: "Original fictional concept.",
  caption: "Original fictional caption.",
  hashtags: ["#FictionalSellerTips"],
  suggestedNextStep: "Ask a fictional question.",
  sourceRefs: [{ id: "simulated-source", url: "https://example.test/fictional-source", date: "2026-10-20" }],
  warnings: ["Simulated source verification only."],
  uncertaintyWarnings: ["This test brief is not live verification."],
  unsupportedClaims: [],
  claimsUsed: [{ id: "claim-1", text: "Fictional supported claim", sourceRefId: "simulated-source" }]
};

function writerResult(writer = "groq") {
  return {
    status: "ready_for_review",
    writer,
    drafts: [{
      ...original,
      hook: "New fictional seller question hook",
      script: "New fictional spoken script with one practical step.",
      takeaway: "New fictional takeaway for review.",
      caption: "New fictional caption with complementary context.",
      suggestedNextStep: "Bring the fictional question to a future seller conversation.",
      unsupportedClaims: [],
      warnings: []
    }]
  };
}

test("revision generator preserves audience, citations, warnings, and human controls", async () => {
  const generator = createRevisionGenerator({ primaryWriter: { generate: async () => writerResult() } });
  const result = await generator(original, { brief: simulatedBrief, attempt: 1 });
  assert.equal(result.status, "available");
  assert.equal(result.draft.audience, original.audience);
  assert.deepEqual(result.draft.sourceRefs, original.sourceRefs);
  assert.deepEqual(result.draft.warnings, original.warnings);
  assert.deepEqual(result.draft.uncertaintyWarnings, original.uncertaintyWarnings);
  assert.equal(result.draft.humanApprovalRequired, true);
  assert.equal(result.draft.automaticallyPublished, false);
  assert.notEqual(result.draft.hook, original.hook);
});

test("revision generator uses one mocked Gemini backup after a mocked Groq failure", async () => {
  let primaryCalls = 0;
  let backupCalls = 0;
  const generator = createRevisionGenerator({
    primaryWriter: { generate: async () => { primaryCalls += 1; return { writer: "groq", writerStatus: "provider_unavailable", status: "needs_more_research", drafts: [] }; } },
    backupWriter: { generate: async () => { backupCalls += 1; return writerResult("gemini"); } }
  });
  const result = await generator(original, { brief: simulatedBrief, attempt: 1 });
  assert.equal(result.status, "available");
  assert.equal(result.source, "gemini");
  assert.equal(primaryCalls, 1);
  assert.equal(backupCalls, 1);
});

test("revision generator reports unavailable instead of fabricating copy when providers fail", async () => {
  const generator = createRevisionGenerator({
    primaryWriter: { generate: async () => ({ writer: "groq", writerStatus: "provider_unavailable", status: "needs_more_research", drafts: [] }) },
    backupWriter: { generate: async () => ({ writer: "gemini", writerStatus: "provider_error", status: "needs_more_research", drafts: [] }) }
  });
  const result = await generator(original, { brief: simulatedBrief, attempt: 1 });
  assert.equal(result.status, "unavailable");
  assert.equal(result.draft, null);
});
