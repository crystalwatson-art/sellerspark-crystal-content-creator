import http from "node:http";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createContentDraft } from "./content-creator.js";
import { createOpenAIWriter } from "./openai-writer.js";
import { createGroqWriter, DEFAULT_GROQ_MODEL } from "./groq-writer.js";
import { createGeminiWriter, DEFAULT_GEMINI_MODEL } from "./gemini-writer.js";
import { createOpenRouterWriter, DEFAULT_OPENROUTER_MODEL } from "./openrouter-writer.js";
import { createDraftHistory } from "./draft-history.js";
import { adaptContentResultToListingReview, applyListingReviewAction } from "./listing-optimizer.js";
import { generateWithFailover } from "./provider-failover.js";
import { ReviewStore } from "./review-store.js";
import { createRevisionGenerator } from "./revision-generator.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(projectRoot, "public");
const fixturePath = path.join(projectRoot, "fixtures", "fictional-research-brief.json");
const brooklynFixturePath = path.join(projectRoot, "fixtures", "fictional-brooklyn-townhouse-brief.json");

const assets = new Map([
  ["/", { file: path.join(publicRoot, "index.html"), type: "text/html; charset=utf-8" }],
  ["/index.html", { file: path.join(publicRoot, "index.html"), type: "text/html; charset=utf-8" }],
  ["/app.js", { file: path.join(publicRoot, "app.js"), type: "text/javascript; charset=utf-8" }],
  ["/styles.css", { file: path.join(publicRoot, "styles.css"), type: "text/css; charset=utf-8" }],
  ["/fixtures/fictional-research-brief.json", { file: fixturePath, type: "application/json; charset=utf-8" }],
  ["/fixtures/fictional-brooklyn-townhouse-brief.json", { file: brooklynFixturePath, type: "application/json; charset=utf-8" }]
]);

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function logProviderFailure(event) {
  console.warn(JSON.stringify({
    event: event.event,
    provider: event.provider,
    writerStatus: event.writerStatus,
    category: event.category,
    httpStatus: event.httpStatus,
    statusClass: event.statusClass
  }));
}

async function readBody(request, limit = 1024 * 1024) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("request body is too large");
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function safeReviewContentResult(record) {
  return {
    status: "ready_for_review",
    audience: record.listingReview.audience,
    audienceLabel: record.listingReview.audienceLabel,
    researchVerification: record.researchVerification,
    drafts: record.listingReview.reviews.map((review) => ({
      ...review.original,
      id: review.draftId,
      audience: review.audience,
      audienceLabel: review.audienceLabel,
      sourceRefs: review.sourceRefs,
      warnings: review.warnings,
      unsupportedClaims: review.unsupportedClaims
    }))
  };
}

function safeActionMessage(reason) {
  const messages = {
    draft_not_found: "That draft is no longer available in this review.",
    revision_unavailable: "A safe revision was not available. The original draft was kept.",
    revision_limit_reached: "The maximum of two automatic revision attempts has been reached.",
    unknown_action: "That review action is not supported.",
    store_corrupt: "Saved review data could not be read safely. Do not overwrite it; inspect the local store before continuing."
  };
  return messages[reason] || "The review action could not be completed safely.";
}

export function createServer({
  reviewStore,
  revisionGenerator = null,
  providerMode = process.env.CONTENT_CREATOR_PROVIDER || "template",
  openAIWriter = null,
  groqWriter = null,
  geminiWriter = null,
  openRouterWriter = null
} = {}) {
  if (!reviewStore) throw new Error("createServer requires a ReviewStore.");

  async function withListingReview(contentResult, brief) {
    const listingReview = adaptContentResultToListingReview(contentResult);
    if (contentResult?.status !== "ready_for_review" || !listingReview.reviews.length) {
      return { ...contentResult, listingReview };
    }
    const stored = await reviewStore.create({
      brief,
      researchVerification: contentResult.researchVerification,
      listingReview
    });
    return {
      ...contentResult,
      listingReview: stored.listingReview,
      listingReviewId: stored.id,
      listingReviewVersion: stored.version,
      persistenceStatus: reviewStore.status().persistent ? "local_server_store" : "unavailable"
    };
  }

  async function contentResultFor(brief) {
    if (providerMode === "template") return createContentDraft(brief);
    if (providerMode === "groq" && groqWriter) {
      return generateWithFailover({
        brief,
        primaryWriter: groqWriter,
        backupWriters: [
          { writer: openRouterWriter, label: "OpenRouter" },
          { writer: geminiWriter, label: "Gemini" }
        ],
        primaryLabel: "Groq",
        backupLabel: "Gemini",
        logger: logProviderFailure
      });
    }
    if (providerMode === "openai" && openAIWriter) return openAIWriter.generate(brief);
    return {
      agent: "content_creator",
      writer: providerMode,
      writerLabel: "Unconfigured Content Creator writer",
      writerStatus: "not_configured",
      status: "needs_more_research",
      drafts: [],
      missingInformation: ["CONTENT_CREATOR_PROVIDER is not configured for a supported writer."],
      unsupportedClaims: [],
      humanApprovalRequired: true,
      automaticallyPublished: false,
      customerContacted: false
    };
  }

  const server = http.createServer(async (request, response) => {
    try {
    const url = new URL(request.url, "http://127.0.0.1");

    if (request.method === "GET" && assets.has(url.pathname)) {
      const asset = assets.get(url.pathname);
      const content = await readFile(asset.file);
      response.writeHead(200, { "Content-Type": asset.type, "Cache-Control": "no-store" });
      response.end(content);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/content") {
      let brief;
      try {
        brief = JSON.parse(await readBody(request));
      } catch (error) {
        sendJson(response, 400, {
          status: "error",
          message: error.message === "request body is too large"
            ? "The research brief is too large."
            : "Request body must be valid JSON."
        });
        return;
      }

      const result = await contentResultFor(brief);
      sendJson(response, 200, await withListingReview(result, brief));
      return;
    }

    const reviewMatch = url.pathname.match(/^\/api\/reviews\/([^/]+)$/);
    if (reviewMatch && request.method === "GET") {
      const record = await reviewStore.get(decodeURIComponent(reviewMatch[1]));
      if (!record) {
        sendJson(response, 404, { status: "error", message: "Review not found." });
        return;
      }
      sendJson(response, 200, {
        status: "ok",
        listingReviewId: record.id,
        listingReviewVersion: record.version,
        listingReview: record.listingReview,
        persistenceStatus: "local_server_store"
      });
      return;
    }

    const actionMatch = url.pathname.match(/^\/api\/reviews\/([^/]+)\/actions$/);
    if (actionMatch && request.method === "POST") {
      let actionInput;
      try {
        actionInput = JSON.parse(await readBody(request, 64 * 1024));
      } catch {
        sendJson(response, 400, { status: "error", message: "Review action must be valid JSON." });
        return;
      }
      const id = decodeURIComponent(actionMatch[1]);
      const record = await reviewStore.get(id);
      if (!record) {
        sendJson(response, 404, { status: "error", message: "Review not found." });
        return;
      }
      if (!Number.isInteger(actionInput?.expectedVersion)) {
        sendJson(response, 400, { status: "error", message: "A review version is required." });
        return;
      }
      try {
        const updated = await reviewStore.update(id, actionInput.expectedVersion, async (next) => {
          const result = await applyListingReviewAction(
            next.listingReview,
            { action: actionInput.action, draftId: actionInput.draftId, note: actionInput.note },
            {
              maxAutomaticRevisions: 2,
              contentResult: safeReviewContentResult(next),
              brief: next.brief,
              revisionGenerator
            }
          );
          if (!result.ok) {
            const error = new Error(safeActionMessage(result.reason));
            error.code = result.reason;
            throw error;
          }
          next.listingReview = result.state;
        });
        sendJson(response, 200, {
          status: "ok",
          listingReviewId: updated.id,
          listingReviewVersion: updated.version,
          listingReview: updated.listingReview,
          persistenceStatus: "local_server_store"
        });
      } catch (error) {
        if (error?.code === "conflict") {
          sendJson(response, 409, {
            status: "conflict",
            message: "This review changed elsewhere. Reload it before trying again.",
            listingReviewVersion: error.current.version,
            listingReview: error.current.listingReview
          });
          return;
        }
        const status = error?.code === "not_found" ? 404 : error?.code === "store_corrupt" ? 503 : 422;
        sendJson(response, status, { status: "error", message: error?.message || "The review action could not be completed safely." });
      }
      return;
    }

    sendJson(response, 404, { status: "error", message: "Not found." });
  } catch {
    sendJson(response, 500, { status: "error", message: "The local demo could not complete that request safely." });
  }
  });
  return server;
}

export async function startServer({ port = Number(process.env.PORT || 3000) } = {}) {
  const providerMode = process.env.CONTENT_CREATOR_PROVIDER || "template";
  const backupProvider = process.env.CONTENT_CREATOR_BACKUP_PROVIDER || "none";
  const draftHistory = createDraftHistory();
  const openAIWriter = providerMode === "openai"
    ? createOpenAIWriter({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL, history: draftHistory })
    : null;
  const groqWriter = providerMode === "groq"
    ? createGroqWriter({ apiKey: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL, history: draftHistory })
    : null;
  const geminiWriter = providerMode === "groq" && (backupProvider === "gemini" || backupProvider === "openrouter")
    ? createGeminiWriter({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, history: draftHistory })
    : null;
  const openRouterWriter = providerMode === "groq" && backupProvider === "openrouter"
    ? createOpenRouterWriter({ apiKey: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL, history: draftHistory })
    : null;
  const dataDir = process.env.SELLERSPARK_DATA_DIR || path.join(os.homedir(), ".sellerspark");
  const filePath = process.env.SELLERSPARK_REVIEW_STORE_PATH || path.join(dataDir, "listing-review-store.json");
  const reviewStore = await new ReviewStore({ filePath }).init();
  const revisionGenerator = providerMode === "groq" && groqWriter
    ? createRevisionGenerator({ primaryWriter: groqWriter, backupWriter: openRouterWriter || geminiWriter, logger: logProviderFailure })
    : providerMode === "openai" && openAIWriter
      ? createRevisionGenerator({ primaryWriter: openAIWriter, logger: logProviderFailure })
      : null;
  const server = createServer({ reviewStore, revisionGenerator, providerMode, openAIWriter, groqWriter, geminiWriter, openRouterWriter });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  console.log("SellerSpark Content Creator demo: http://127.0.0.1:" + port);
  return server;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) await startServer();
