import {
  buildResearchInput,
  classifyHttpStatus,
  createStructuredWriter,
  MODEL_OUTPUT_SCHEMA,
  WRITER_INSTRUCTIONS
} from "./openai-writer.js";

export const GROQ_WRITER = "groq";
export const GROQ_WRITER_LABEL = "Groq GPT-OSS 120B writer";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const GROQ_CHAT_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export function buildGroqRequest({ model, brief, recentDrafts = [], rewriteContext = null }) {
  return {
    model,
    messages: [
      { role: "system", content: WRITER_INSTRUCTIONS },
      {
        role: "user",
        content: JSON.stringify(buildResearchInput(brief, recentDrafts, rewriteContext))
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "content_creator_drafts",
        strict: true,
        schema: MODEL_OUTPUT_SCHEMA
      }
    },
    reasoning_effort: "medium"
  };
}

export function parseGroqResponse(response) {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("structured response was empty");
  }
  return JSON.parse(content);
}

function createGroqRequest({ apiKey, fetchImpl = globalThis.fetch }) {
  if (!apiKey || typeof fetchImpl !== "function") return null;

  return async (payload) => {
    const response = await fetchImpl(GROQ_CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = new Error("Groq request failed with status " + String(response.status));
      error.code = response.status === 429 ? "rate_limited" : "provider_error";
      error.httpStatus = response.status;
      error.statusClass = classifyHttpStatus(response.status).statusClass;
      error.retryAfter = response.headers?.get?.("retry-after") ?? null;
      throw error;
    }
    try {
      return await response.json();
    } catch {
      const error = new Error("Groq response was not readable as JSON");
      error.code = "invalid_response";
      error.httpStatus = response.status;
      error.statusClass = classifyHttpStatus(response.status).statusClass;
      throw error;
    }
  };
}

export function createGroqWriter({
  model = DEFAULT_GROQ_MODEL,
  ...options
} = {}) {
  return createStructuredWriter({
    ...options,
    model,
    writer: GROQ_WRITER,
    writerLabel: GROQ_WRITER_LABEL,
    buildRequest: buildGroqRequest,
    parseResponse: parseGroqResponse,
    createRequest: createGroqRequest,
    notConfiguredMessage: "Groq writer is not configured; no AI request was made."
  });
}
