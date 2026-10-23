import {
  buildResearchInput,
  createHttpJsonRequest,
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

function createGroqRequest({ apiKey, fetchImpl = globalThis.fetch, timeoutMs }) {
  return createHttpJsonRequest({
    apiKey,
    fetchImpl,
    endpoint: GROQ_CHAT_ENDPOINT,
    providerLabel: "Groq",
    timeoutMs
  });
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
