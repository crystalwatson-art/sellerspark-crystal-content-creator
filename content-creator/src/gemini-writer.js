import {
  buildResearchInput,
  classifyHttpStatus,
  createStructuredWriter,
  MODEL_OUTPUT_SCHEMA,
  WRITER_INSTRUCTIONS
} from "./openai-writer.js";

export const GEMINI_WRITER = "gemini";
export const GEMINI_WRITER_LABEL = "Google Gemini 3.8 Flash writer";
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const GEMINI_INTERACTIONS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

export function buildGeminiRequest({ model, brief, recentDrafts = [], rewriteContext = null }) {
  return {
    model,
    input: [
      WRITER_INSTRUCTIONS,
      "Return only the JSON object required by the response format.",
      "Research input JSON:",
      JSON.stringify(buildResearchInput(brief, recentDrafts, rewriteContext))
    ].join("\n"),
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: MODEL_OUTPUT_SCHEMA
    }
  };
}

export function parseGeminiResponse(response) {
  const textOutput = typeof response?.output_text === "string"
    ? response.output_text
    : response?.outputs?.find?.((item) => item?.type === "text")?.text;
  const interactionStepOutput = Array.isArray(response?.steps)
    ? response.steps
      .flatMap((step) => Array.isArray(step?.content) ? step.content : [])
      .find((item) => item?.type === "text" && typeof item?.text === "string")?.text
    : null;
  const legacyOutput = response?.candidates?.[0]?.content?.parts?.find?.((part) => typeof part?.text === "string")?.text;
  const content = textOutput ?? interactionStepOutput ?? legacyOutput;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("structured response was empty");
  }
  return JSON.parse(content);
}

export function createGeminiRequest({ apiKey, fetchImpl = globalThis.fetch, timeoutMs = 10000 }) {
  if (!apiKey || typeof fetchImpl !== "function") return null;

  return async (payload) => {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0
      ? setTimeout(() => controller?.abort(), timeoutMs)
      : null;
    let response;
    try {
      response = await fetchImpl(GEMINI_INTERACTIONS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(payload),
        ...(controller ? { signal: controller.signal } : {})
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        const timeoutError = new Error("Gemini request timed out");
        timeoutError.code = "provider_timeout";
        throw timeoutError;
      }
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = new Error("Gemini request failed with status " + String(response.status));
      error.code = response.status === 429 ? "rate_limited" : "provider_error";
      error.httpStatus = response.status;
      error.statusClass = classifyHttpStatus(response.status).statusClass;
      throw error;
    }
    try {
      return await response.json();
    } catch {
      const error = new Error("Gemini response was not readable as JSON");
      error.code = "invalid_response";
      error.httpStatus = response.status;
      error.statusClass = classifyHttpStatus(response.status).statusClass;
      throw error;
    }
  };
}

export function createGeminiWriter({
  model = DEFAULT_GEMINI_MODEL,
  ...options
} = {}) {
  return createStructuredWriter({
    ...options,
    model,
    writer: GEMINI_WRITER,
    writerLabel: GEMINI_WRITER_LABEL,
    buildRequest: buildGeminiRequest,
    parseResponse: parseGeminiResponse,
    createRequest: createGeminiRequest,
    notConfiguredMessage: "Gemini backup writer is not configured; no AI request was made."
  });
}

