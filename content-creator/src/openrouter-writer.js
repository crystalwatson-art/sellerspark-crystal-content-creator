import {
  buildResearchInput,
  createHttpJsonRequest,
  createStructuredWriter,
  MODEL_OUTPUT_SCHEMA,
  WRITER_INSTRUCTIONS
} from "./openai-writer.js";

export const OPENROUTER_WRITER = "openrouter";
export const OPENROUTER_WRITER_LABEL = "OpenRouter free-model writer";
export const DEFAULT_OPENROUTER_MODEL = "openrouter/free";
export const OPENROUTER_CHAT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_OPENROUTER_MAX_TOKENS = 8000;

// This adapter deliberately forbids paid models, even if a caller overrides the model.
export function isFreeRouterModel(model) {
  return model === "openrouter/free" || (typeof model === "string" && model.endsWith(":free"));
}

export function buildOpenRouterRequest({ model, brief, recentDrafts = [], rewriteContext = null }) {
  if (!isFreeRouterModel(model)) throw new Error("Only explicit OpenRouter free models are permitted.");
  return {
    model,
    messages: [
        { role: "system", content: WRITER_INSTRUCTIONS + " Return one compact JSON object with exactly three drafts in the supplied order. Every draft must include all required fields: angle (exactly one of Seller education, Common seller mistakes, or Decision-making questions), hook, script, takeaway, caption, hashtags, suggestedNextStep, videoConcept, suggestedScenes with exactly three short items, and supportingClaimIds as an array. reasonToFollow is optional but should be included when supported by the supplied brief. Hashtags must be an array of 3 to 5 short strings, each beginning with # and containing no prose. Keep each hook under 16 words, script under 65 words, takeaway under 20 words, caption under 25 words, suggestedNextStep under 24 words, videoConcept under 20 words, and each scene under 12 words. Use an empty supportingClaimIds array when no supplied supported claim is used. No markdown fences, commentary, unsupported property details, or market claims." },
      { role: "user", content: JSON.stringify(buildResearchInput(brief, recentDrafts, rewriteContext)) }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "content_creator_drafts",
        strict: true,
        schema: MODEL_OUTPUT_SCHEMA
      }
    },
    max_tokens: DEFAULT_OPENROUTER_MAX_TOKENS
  };
}

function parserError(category, responseFormat, finishReason = null) {
  const error = new Error("OpenRouter returned an unreadable structured response");
  error.code = category;
  error.diagnostic = {
    category,
    responseFormat,
    finishReason
  };
  return error;
}

export function parseOpenRouterResponse(response) {
  const choice = response?.choices?.[0];
  const finishReason = choice?.finish_reason ?? choice?.stop_reason ?? null;
  if (finishReason === "length" || finishReason === "max_tokens") {
    throw parserError("truncated_response", "chat_completion", finishReason);
  }

  const content = choice?.message?.content;
  const text = typeof content === "string"
    ? content.trim()
    : Array.isArray(content)
      ? content.filter((part) => typeof part?.text === "string").map((part) => part.text).join("\n").trim()
      : "";
  if (!text) throw parserError("parse_failure", "chat_completion", finishReason);

  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : text;
  try {
    // Free models may add a JSON code fence; stripping only that outer fence
    // keeps the strict schema and factual validation below unchanged.
    return JSON.parse(candidate);
  } catch {
    throw parserError("parse_failure", "chat_completion", finishReason);
  }
}

export function createOpenRouterWriter({ model = DEFAULT_OPENROUTER_MODEL, ...options } = {}) {
  if (!isFreeRouterModel(model)) throw new Error("Paid OpenRouter models are disabled for SellerSpark.");
  return createStructuredWriter({
    ...options,
    model,
    writer: OPENROUTER_WRITER,
    writerLabel: OPENROUTER_WRITER_LABEL,
    buildRequest: buildOpenRouterRequest,
    parseResponse: parseOpenRouterResponse,
    createRequest: ({ apiKey, fetchImpl, timeoutMs }) => createHttpJsonRequest({
      apiKey, fetchImpl, timeoutMs, endpoint: OPENROUTER_CHAT_ENDPOINT, providerLabel: "OpenRouter"
    }),
    notConfiguredMessage: "OpenRouter is not configured; no AI request was made."
  });
}
