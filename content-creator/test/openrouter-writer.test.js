import test from "node:test";
import assert from "node:assert/strict";
import brief from "../fixtures/fictional-research-brief.json" with { type: "json" };
import { createOpenRouterWriter, buildOpenRouterRequest, parseOpenRouterResponse, DEFAULT_OPENROUTER_MAX_TOKENS, DEFAULT_OPENROUTER_MODEL } from "../src/openrouter-writer.js";
import { generateWithFailover } from "../src/provider-failover.js";
import { createContentDraft } from "../src/content-creator.js";

function failure(writerStatus) { return { writer: "mock", writerStatus, status: "needs_more_research", drafts: [], humanApprovalRequired: true }; }

test("OpenRouter only allows explicit free models", () => {
  assert.throws(() => createOpenRouterWriter({ model: "paid/model" }), /Paid OpenRouter/);
  assert.doesNotThrow(() => createOpenRouterWriter({ model: "openrouter/free" }));
  assert.doesNotThrow(() => createOpenRouterWriter({ model: "example/model:free" }));
  assert.equal(DEFAULT_OPENROUTER_MODEL, "openrouter/free");
  assert.equal(buildOpenRouterRequest({ model: DEFAULT_OPENROUTER_MODEL, brief }).model, DEFAULT_OPENROUTER_MODEL);
});

test("OpenRouter parses JSON and rejects malformed responses", () => {
  assert.deepEqual(parseOpenRouterResponse({ choices: [{ message: { content: '{"drafts":[]}' } }] }), { drafts: [] });
  assert.deepEqual(parseOpenRouterResponse({ choices: [{ message: { content: "```json\n{\"drafts\":[]}\n```" } }] }), { drafts: [] });
  assert.deepEqual(parseOpenRouterResponse({ choices: [{ message: { content: [{ type: "text", text: '{"drafts":[]}' }] } }] }), { drafts: [] });
  assert.throws(() => parseOpenRouterResponse({ choices: [{ message: { content: "not JSON" } }] }), (error) => error.code === "parse_failure");
  assert.throws(() => parseOpenRouterResponse({ choices: [{ finish_reason: "length", message: { content: "{\"drafts\":" } }] }), (error) => error.code === "truncated_response");
});

test("OpenRouter requests enough output space for three concise drafts", () => {
  const request = buildOpenRouterRequest({ model: DEFAULT_OPENROUTER_MODEL, brief });
  assert.equal(request.max_tokens, DEFAULT_OPENROUTER_MAX_TOKENS);
  assert.ok(DEFAULT_OPENROUTER_MAX_TOKENS > 5000);
  assert.match(request.messages[0].content, /supportingClaimIds as an array/);
  assert.match(request.messages[0].content, /hashtags must be an array of 3 to 5 short strings/i);
  assert.match(request.messages[0].content, /exactly three short items/);
  assert.match(request.messages[0].content, /under 65 words/);
  assert.equal(request.response_format.type, "json_schema");
  assert.equal(request.response_format.json_schema.strict, true);
  assert.equal(request.response_format.json_schema.schema.properties.drafts.items.required.includes("hashtags"), true);
});

test("OpenRouter diagnostics distinguish parsing from strict validation failure", async () => {
  const malformed = createOpenRouterWriter({ request: async () => ({ choices: [{ message: { content: "not JSON" } }] }) });
  const malformedResult = await malformed.generate(brief);
  assert.equal(malformedResult.generation.errorCategory, "parse_failure");
  assert.equal(malformedResult.diagnostic.category, "parse_failure");

  const incomplete = createOpenRouterWriter({ request: async () => ({ choices: [{ message: { content: JSON.stringify({ drafts: [] }) } }] }) });
  const incompleteResult = await incomplete.generate(brief);
  assert.equal(incompleteResult.generation.errorCategory, "validation_failure");
  assert.equal(incompleteResult.diagnostic.category, "validation_failure");
  assert.equal(incompleteResult.diagnostic.reasonCode, "draft_count");
  assert.match(incompleteResult.diagnostic.reason, /exactly three drafts/);
});

test("OpenRouter reports a stable required-field code without exposing model content", async () => {
  const baseline = createContentDraft(brief);
  const output = {
    drafts: baseline.drafts.map((draft) => ({
      angle: draft.angle,
      hook: draft.hook,
      script: draft.script,
      takeaway: draft.takeaway,
      caption: draft.caption,
      hashtags: draft.hashtags,
      suggestedNextStep: draft.suggestedNextStep,
      videoConcept: draft.videoConcept,
      suggestedScenes: draft.suggestedScenes,
      supportingClaimIds: []
    }))
  };
  output.drafts[0].takeaway = "";
  const writer = createOpenRouterWriter({ request: async () => ({ choices: [{ message: { content: JSON.stringify(output) } }] }) });
  const result = await writer.generate(brief);
  assert.equal(result.diagnostic.category, "validation_failure");
  assert.equal(result.diagnostic.reasonCode, "required_field");
  assert.doesNotMatch(result.diagnostic.reason, /fictional|timing|condo/i);
  assert.equal(result.drafts.length, 0);
});

test("OpenRouter keeps malformed hashtag shapes rejected", async () => {
  const baseline = createContentDraft(brief);
  const output = {
    drafts: baseline.drafts.map((draft) => ({
      angle: draft.angle,
      hook: draft.hook,
      script: draft.script,
      takeaway: draft.takeaway,
      caption: draft.caption,
      hashtags: draft.hashtags,
      suggestedNextStep: draft.suggestedNextStep,
      videoConcept: draft.videoConcept,
      suggestedScenes: draft.suggestedScenes,
      supportingClaimIds: []
    }))
  };
  output.drafts[0].hashtags = "#SellerTips";
  const writer = createOpenRouterWriter({ request: async () => ({ choices: [{ message: { content: JSON.stringify(output) } }] }) });
  const result = await writer.generate(brief);
  assert.equal(result.diagnostic.category, "validation_failure");
  assert.equal(result.diagnostic.reasonCode, "hashtags");
  assert.equal(result.drafts.length, 0);
});

test("OpenRouter unavailable does not fake approved content", async () => {
  const writer = createOpenRouterWriter({ request: async () => { const e = new Error("503"); e.httpStatus = 503; throw e; } });
  const result = await writer.generate(brief);
  assert.equal(result.writerStatus, "provider_unavailable");
  assert.equal(result.drafts.length, 0);
  assert.equal(result.automaticallyPublished, false);
});

test("Groq failure selects OpenRouter before Gemini, with bounded calls", async () => {
  const calls = [];
  const approved = { writer: "openrouter", writerStatus: "generated", status: "ready_for_review", drafts: [{ id: "safe" }], humanApprovalRequired: true };
  const result = await generateWithFailover({
    brief, primaryWriter: { generate: async () => { calls.push("groq"); return failure("rate_limited"); } },
    backupWriters: [
      { label: "OpenRouter", writer: { generate: async () => { calls.push("openrouter"); return approved; } } },
      { label: "Gemini", writer: { generate: async () => { calls.push("gemini"); return failure("provider_unavailable"); } } }
    ], templateFallback: false
  });
  assert.deepEqual(calls, ["groq", "openrouter"]);
  assert.equal(result.writer, "openrouter");
  assert.equal(result.failover.outcome, "backup_succeeded");
});

test("Both live backups unavailable remain bounded and fail safely", async () => {
  const calls = [];
  const result = await generateWithFailover({
    brief, primaryWriter: { generate: async () => { calls.push("groq"); return failure("rate_limited"); } },
    backupWriters: [
      { label: "OpenRouter", writer: { generate: async () => { calls.push("openrouter"); return failure("provider_unavailable"); } } },
      { label: "Gemini", writer: { generate: async () => { calls.push("gemini"); return failure("provider_unavailable"); } } }
    ], templateFallback: false
  });
  assert.deepEqual(calls, ["groq", "openrouter", "gemini"]);
  assert.equal(result.status, "needs_more_research");
  assert.equal(result.failover.outcome, "all_providers_unavailable");
});

test("OpenRouter rejection stops failover; does not bypass evidence safety", async () => {
  let geminiCalled = false;
  const result = await generateWithFailover({
    brief, primaryWriter: { generate: async () => failure("rate_limited") },
    backupWriters: [
      { label: "OpenRouter", writer: { generate: async () => failure("invalid_response") } },
      { label: "Gemini", writer: { generate: async () => { geminiCalled = true; return failure("provider_unavailable"); } } }
    ]
  });
  assert.equal(geminiCalled, false);
  assert.equal(result.failover.outcome, "backup_rejected");
});
