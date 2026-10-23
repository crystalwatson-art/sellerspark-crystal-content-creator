import test from "node:test";
import assert from "node:assert/strict";
import fictionalBrief from "../fixtures/fictional-research-brief.json" with { type: "json" };
import { createGeminiWriter } from "../src/gemini-writer.js";
import { generateWithFailover, isFailoverEligible } from "../src/provider-failover.js";

function failureResult(writer, writerStatus) {
  return {
    writer,
    writerLabel: writer,
    writerStatus,
    status: "needs_more_research",
    drafts: [],
    diagnostic: { category: writerStatus, httpStatus: writerStatus === "rate_limited" ? 429 : null, statusClass: writerStatus === "rate_limited" ? "4xx" : null },
    humanApprovalRequired: true,
    automaticallyPublished: false,
    customerContacted: false
  };
}

test("Groq rate limit fails over once to mocked Gemini", async () => {
  let primaryCalls = 0;
  let backupCalls = 0;
  const logs = [];
  const backup = createGeminiWriter({
    model: "mock-gemini-model",
    request: async () => {
      backupCalls += 1;
      return { output_text: JSON.stringify({ drafts: [
        { angle: "Seller education", hook: "Fresh backup hook one", script: "Write one question before a seller conversation.", takeaway: "Bring one question.", caption: "Fictional caption one.", hashtags: ["#HomeSelling"], suggestedNextStep: "Save the question for a local professional.", videoConcept: "Fictional concept one.", suggestedScenes: ["One", "Two", "Three"], supportingClaimIds: [] },
        { angle: "Common seller mistakes", hook: "Fresh backup hook two", script: "Make a short list before choosing a next step.", takeaway: "A short list helps.", caption: "Fictional caption two.", hashtags: ["#SellerPrep"], suggestedNextStep: "Write one follow-up question.", videoConcept: "Fictional concept two.", suggestedScenes: ["One", "Two", "Three"], supportingClaimIds: [] },
        { angle: "Decision-making questions", hook: "Fresh backup hook three", script: "Ask what you want explained before deciding.", takeaway: "Name the next question.", caption: "Fictional caption three.", hashtags: ["#SellerQuestions"], suggestedNextStep: "Save this prompt for later.", videoConcept: "Fictional concept three.", suggestedScenes: ["One", "Two", "Three"], supportingClaimIds: [] }
      ] }) };
    }
  });
  const result = await generateWithFailover({
    brief: fictionalBrief,
    primaryWriter: { generate: async () => { primaryCalls += 1; return failureResult("groq", "rate_limited"); } },
    backupWriter: backup,
    logger: (event) => logs.push(event)
  });

  assert.equal(primaryCalls, 1);
  assert.equal(backupCalls, 1);
  assert.equal(result.writer, "gemini");
  assert.equal(result.status, "ready_for_review");
  assert.equal(result.failover.outcome, "backup_succeeded");
  assert.equal(result.humanApprovalRequired, true);
  assert.equal(result.automaticallyPublished, false);
  assert.equal(result.customerContacted, false);
  assert.equal(logs.length, 1);
  assert.deepEqual(Object.keys(logs[0]).sort(), ["category", "event", "httpStatus", "provider", "statusClass", "writer", "writerStatus"].sort());
});

test("timeout with no configured backup uses templates only when the same brief is safe", async () => {
  const result = await generateWithFailover({
    brief: fictionalBrief,
    primaryWriter: { generate: async () => failureResult("groq", "provider_unavailable") },
    backupWriter: null
  });

  assert.equal(result.writer, "offline_template");
  assert.equal(result.writerStatus, "fallback_template");
  assert.equal(result.writerLabel, "Offline template fallback writer");
  assert.equal(result.status, "ready_for_review");
  assert.equal(result.failover.outcome, "template_succeeded");
  assert.equal(result.drafts.length, 3);
});

test("backup failure is bounded and still uses the safe template fallback", async () => {
  let backupCalls = 0;
  const result = await generateWithFailover({
    brief: fictionalBrief,
    primaryWriter: { generate: async () => failureResult("groq", "network_error") },
    backupWriter: {
      generate: async () => {
        backupCalls += 1;
        return failureResult("gemini", "rate_limited");
      }
    }
  });

  assert.equal(backupCalls, 1);
  assert.equal(result.writerStatus, "fallback_template");
  assert.equal(result.failover.primary.writerStatus, "network_error");
  assert.equal(result.failover.backup.writerStatus, "rate_limited");
  assert.equal(result.drafts.length, 3);
});

test("invalid AI output is not treated as provider unavailability", async () => {
  let backupCalls = 0;
  const result = await generateWithFailover({
    brief: fictionalBrief,
    primaryWriter: { generate: async () => failureResult("groq", "invalid_response") },
    backupWriter: { generate: async () => { backupCalls += 1; return failureResult("gemini", "generated"); } }
  });

  assert.equal(backupCalls, 0);
  assert.equal(result.writerStatus, "invalid_response");
  assert.equal(result.failover, undefined);
  assert.equal(isFailoverEligible(result), false);
});

test("provider failure logs never include credentials or raw provider text", async () => {
  const logs = [];
  await generateWithFailover({
    brief: fictionalBrief,
    primaryWriter: { generate: async () => failureResult("groq", "provider_error") },
    logger: (event) => logs.push(event)
  });

  const serialized = JSON.stringify(logs);
  assert.doesNotMatch(serialized, /API_KEY|Bearer|secret|token/i);
  assert.equal(logs[0].provider, "primary writer");
});

for (const rejectedStatus of ["invalid_response", "unsafe_output", "stale_output", "unsupported_claims"]) {
  test(`backup ${rejectedStatus} blocks offline template substitution`, async () => {
    let calls = 0;
    const result = await generateWithFailover({
      brief: fictionalBrief,
      primaryWriter: { generate: async () => failureResult("groq", "rate_limited") },
      backupWriter: { generate: async () => { calls++; return failureResult("gemini", rejectedStatus); } }
    });
    assert.equal(calls, 1);
    assert.equal(result.writer, "gemini");
    assert.equal(result.writerStatus, rejectedStatus);
    assert.equal(result.status, "needs_more_research");
    assert.equal(result.drafts.length, 0);
    assert.equal(result.failover.outcome, "backup_rejected");
    assert.equal(result.humanApprovalRequired, true);
    assert.equal(result.automaticallyPublished, false);
  });
}
