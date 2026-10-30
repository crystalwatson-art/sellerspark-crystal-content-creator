import { CARD_ACTIONS, applyCardFlowAction, sampleCardContent } from "../public/card-flow-state.js";
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
import { SupabaseReviewStore } from "./supabase-review-store.js";
import { SupabaseAuthVerifier } from "./supabase-auth.js";
import { createRevisionGenerator } from "./revision-generator.js";
import { createAgentModel } from "./agent-model.js";
import { createAgentSystem } from "./agent-system.js";
import { createGrowthPilot, createCampaignMetadata } from "./growth-pilot.js";
import { getTikTokConnectionPlan } from "./tiktok-connection.js";
import {
  createTikTokIntegration,
  createTokenCipher,
  safeTikTokError,
  SupabaseTikTokConnectionStore,
  SupabaseTikTokOAuthStateStore
} from "./tiktok-oauth.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(projectRoot, "public");
const fixturePath = path.join(projectRoot, "fixtures", "fictional-research-brief.json");
const brooklynFixturePath = path.join(projectRoot, "fixtures", "fictional-brooklyn-townhouse-brief.json");

const assets = new Map([
  ["/card-flow-state.js", { file: path.join(publicRoot, "card-flow-state.js"), type: "text/javascript; charset=utf-8" }],
  ["/proposals/card-flow.html", { file: path.join(publicRoot, "proposals", "card-flow.html"), type: "text/html; charset=utf-8" }],
  ["/", { file: path.join(publicRoot, "index.html"), type: "text/html; charset=utf-8" }],
  ["/index.html", { file: path.join(publicRoot, "index.html"), type: "text/html; charset=utf-8" }],
  ["/app.js", { file: path.join(publicRoot, "app.js"), type: "text/javascript; charset=utf-8" }],
  ["/growth-pilot.js", { file: path.join(publicRoot, "growth-pilot.js"), type: "text/javascript; charset=utf-8" }],
  ["/supabase-auth.js", { file: path.join(publicRoot, "supabase-auth.js"), type: "text/javascript; charset=utf-8" }],
  ["/styles.css", { file: path.join(publicRoot, "styles.css"), type: "text/css; charset=utf-8" }],
  ["/penthouse-studio.js", { file: path.join(publicRoot, "penthouse-studio.js"), type: "text/javascript; charset=utf-8" }],
  ["/studio-navigation.js", { file: path.join(publicRoot, "studio-navigation.js"), type: "text/javascript; charset=utf-8" }],
  ["/calendar-state.js", { file: path.join(publicRoot, "calendar-state.js"), type: "text/javascript; charset=utf-8" }],
  ["/calendar-ui.js", { file: path.join(publicRoot, "calendar-ui.js"), type: "text/javascript; charset=utf-8" }],
  ["/penthouse-workspace.css", { file: path.join(publicRoot, "penthouse-workspace.css"), type: "text/css; charset=utf-8" }],
  ["/penthouse-preview.html", { file: path.join(publicRoot, "penthouse-preview.html"), type: "text/html; charset=utf-8" }],
  ["/assets/penthouse-night.webp", { file: path.join(publicRoot, "assets/penthouse-night.webp"), type: "image/webp" }],
  ["/assets/penthouse-day.webp", { file: path.join(publicRoot, "assets/penthouse-day.webp"), type: "image/webp" }],
  ["/fixtures/fictional-research-brief.json", { file: fixturePath, type: "application/json; charset=utf-8" }],
  ["/fixtures/fictional-brooklyn-townhouse-brief.json", { file: brooklynFixturePath, type: "application/json; charset=utf-8" }]
]);

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
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
    unsupported_claims: "Resolve the missing evidence or unsupported claims before accepting this draft.",
    invalid_revision: "Enter revised script text or choose a suggested change.",
    no_change: "This wording is already as short as this suggestion can make it. Edit the script or choose another suggestion.",
    nothing_to_undo: "There is no earlier change to undo.",
    revision_unavailable: "A safe revision was not available. The original draft was kept.",
    revision_limit_reached: "The maximum of two automatic revision attempts has been reached.",
    unknown_action: "That review action is not supported.",
    store_corrupt: "Saved review data could not be read safely. Do not overwrite it; inspect the local store before continuing."
  };
  return messages[reason] || "The review action could not be completed safely.";
}

function isFictionalDemoBrief(brief) {
  return brief?.researchMode === "fictional"
    && typeof brief?._fixtureNotice === "string"
    && brief._fixtureNotice.toUpperCase().startsWith("FICTIONAL TEST DATA");
}

function authorizationError(code = "authorization_required") {
  const error = new Error("Authentication is required for persistent review access.");
  error.code = code;
  return error;
}

function decorateCampaignResult(result, brief) {
  const metadata = createCampaignMetadata(brief);
  return {
    ...result,
    ...metadata,
    growthPilot: createGrowthPilot({
      audienceMode: metadata.campaignAudienceMode,
      startingFollowers: brief.startingFollowers,
      currentFollowers: brief.currentFollowers
    })
  };
}

export function createServer({
  reviewStore,
  demoReviewStore = null,
  authVerifier = null,
  authConfig = { enabled: false },
  revisionGenerator = null,
  providerMode = process.env.CONTENT_CREATOR_PROVIDER || "template",
  openAIWriter = null,
  groqWriter = null,
  geminiWriter = null,
  openRouterWriter = null,
  tiktokIntegration = null,
  agentSystem = null
} = {}) {
  if (!reviewStore) throw new Error("createServer requires a ReviewStore.");

  async function withListingReviewUsing(contentResult, brief, { store, actorId = null, actorToken = null, persistenceStatus }) {
    const listingReview = adaptContentResultToListingReview(contentResult);
    if (contentResult?.status !== "ready_for_review" || !listingReview.reviews.length) {
      return { ...contentResult, listingReview };
    }
    const createInput = {
      brief,
      researchVerification: contentResult.researchVerification,
      listingReview
    };
    if (actorId) createInput.actorId = actorId;
    if (actorToken) createInput.actorToken = actorToken;
    const stored = await store.create(createInput);
    return {
      ...contentResult,
      listingReview: stored.listingReview,
      listingReviewId: stored.id,
      listingReviewVersion: stored.version,
      persistenceStatus
    };
  }

  async function authenticate(request) {
    if (!authVerifier) throw authorizationError();
    return authVerifier.verify(request);
  }

  async function resolveReview(request, id) {
    if (demoReviewStore) {
      const demoRecord = await demoReviewStore.get(id);
      if (demoRecord) return { store: demoReviewStore, record: demoRecord, actorId: null, actorToken: null, persistenceStatus: "fictional_demo_store" };
    }
    const { userId, accessToken } = await authenticate(request);
    const record = await reviewStore.get(id, { actorId: userId, actorToken: accessToken });
    return { store: reviewStore, record, actorId: userId, actorToken: accessToken, persistenceStatus: "supabase" };
  }

  async function contentResultFor(brief, options = {}) {
    if (providerMode === "agents" && agentSystem) return decorateCampaignResult(await agentSystem.generate(brief, options), brief);
    if (providerMode === "template") return decorateCampaignResult(createContentDraft(brief), brief);
    if (providerMode === "groq" && groqWriter) {
      return decorateCampaignResult(await generateWithFailover({
        brief,
        primaryWriter: groqWriter,
        backupWriters: [
          { writer: openRouterWriter, label: "OpenRouter" },
          { writer: geminiWriter, label: "Gemini" }
        ],
        primaryLabel: "Groq",
        backupLabel: "Gemini",
        logger: logProviderFailure
      }), brief);
    }
    if (providerMode === "openai" && openAIWriter) return decorateCampaignResult(await openAIWriter.generate(brief), brief);
    return decorateCampaignResult({
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
    }, brief);
  }

  const server = http.createServer(async (request, response) => {
    try {
    const url = new URL(request.url, "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/api/agent-status") {
      sendJson(response, 200, { mode: providerMode === "agents" ? "agents" : providerMode === "template" ? "sample" : "writer", configured: Boolean(agentSystem?.configured), humanApprovalRequired: true });
      return;
    }

    if (request.method === "GET" && assets.has(url.pathname)) {
      const asset = assets.get(url.pathname);
      const content = await readFile(asset.file);
      response.writeHead(200, { "Content-Type": asset.type, "Cache-Control": "no-store" });
      response.end(content);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/auth-config") {
      const publicConfig = authConfig?.enabled
        ? { enabled: true, url: authConfig.url, anonKey: authConfig.anonKey }
        : { enabled: false };
      sendJson(response, 200, publicConfig);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/tiktok/status") {
      const plan = getTikTokConnectionPlan();
      if (!tiktokIntegration) {
        sendJson(response, 200, { ...plan, status: "not_configured", connected: false, scopes: [] });
        return;
      }
      try {
        const { userId } = await authenticate(request);
        const connectionStatus = await tiktokIntegration.status({ userId });
        sendJson(response, 200, { ...plan, ...connectionStatus, connected: connectionStatus.status === "connected" });
      } catch (error) {
        if (["authorization_required", "authorization_failed", "auth_unavailable"].includes(error?.code)) {
          sendJson(response, error.code === "auth_unavailable" ? 503 : 401, { status: "error", message: error.message });
          return;
        }
        const safe = safeTikTokError(error);
        sendJson(response, 503, { status: "error", message: safe.message });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tiktok/oauth/start") {
      try {
        const { userId } = await authenticate(request);
        if (!tiktokIntegration) throw Object.assign(new Error("TikTok connection is not configured for this environment."), { code: "not_configured" });
        const input = JSON.parse(await readBody(request, 4096) || "{}");
        const outcome = await tiktokIntegration.startAuthorization({ userId, includeVideoViews: input?.includeVideoViews === true });
        sendJson(response, 200, outcome);
      } catch (error) {
        if (["authorization_required", "authorization_failed", "auth_unavailable"].includes(error?.code)) {
          sendJson(response, error.code === "auth_unavailable" ? 503 : 401, { status: "error", message: error.message });
          return;
        }
        const safe = safeTikTokError(error);
        sendJson(response, safe.code === "not_configured" ? 503 : 422, { status: "error", message: safe.message });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/tiktok/oauth/callback") {
      const wantsJson = request.headers.accept?.includes("application/json");
      try {
        if (!tiktokIntegration) throw Object.assign(new Error("TikTok connection is not configured for this environment."), { code: "not_configured" });
        const outcome = await tiktokIntegration.completeAuthorization({
          code: url.searchParams.get("code"),
          state: url.searchParams.get("state"),
          error: url.searchParams.get("error")
        });
        if (wantsJson) sendJson(response, 200, outcome);
        else {
          response.writeHead(303, { Location: "/?tiktok=connected#growth", "Cache-Control": "no-store" });
          response.end();
        }
      } catch (error) {
        const safe = safeTikTokError(error);
        if (wantsJson) {
          sendJson(response, safe.code === "not_configured" ? 503 : 422, { status: "error", message: safe.message });
        } else {
          response.writeHead(303, { Location: "/?tiktok=error&reason=" + encodeURIComponent(safe.code) + "#growth", "Cache-Control": "no-store" });
          response.end();
        }
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/tiktok/follower-count") {
      try {
        const { userId } = await authenticate(request);
        if (!tiktokIntegration) throw Object.assign(new Error("TikTok connection is not configured for this environment."), { code: "not_configured" });
        sendJson(response, 200, await tiktokIntegration.followerCount({ userId }));
      } catch (error) {
        if (["authorization_required", "authorization_failed", "auth_unavailable"].includes(error?.code)) {
          sendJson(response, error.code === "auth_unavailable" ? 503 : 401, { status: "error", message: error.message });
          return;
        }
        const safe = safeTikTokError(error);
        sendJson(response, safe.code === "not_configured" ? 503 : 422, { status: "error", message: safe.message });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/tiktok/video-views") {
      try {
        const { userId } = await authenticate(request);
        if (!tiktokIntegration) throw Object.assign(new Error("TikTok connection is not configured for this environment."), { code: "not_configured" });
        const rawCursor = url.searchParams.get("cursor");
        const cursor = rawCursor === null ? null : /^\d+$/.test(rawCursor) ? Number(rawCursor) : NaN;
        sendJson(response, 200, await tiktokIntegration.videoViews({ userId, cursor }));
      } catch (error) {
        if (["authorization_required", "authorization_failed", "auth_unavailable"].includes(error?.code)) {
          sendJson(response, error.code === "auth_unavailable" ? 503 : 401, { status: "error", message: error.message });
          return;
        }
        const safe = safeTikTokError(error);
        sendJson(response, safe.code === "not_configured" ? 503 : 422, { status: "error", code: safe.code, message: safe.message });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tiktok/draft-upload") {
      let input;
      try {
        input = JSON.parse(await readBody(request, 64 * 1024));
      } catch {
        sendJson(response, 400, { status: "error", message: "TikTok draft handoff must be valid JSON." });
        return;
      }
      try {
        const { userId } = await authenticate(request);
        if (!tiktokIntegration) throw Object.assign(new Error("TikTok connection is not configured for this environment."), { code: "not_configured" });
        sendJson(response, 200, await tiktokIntegration.uploadDraft({
          userId,
          videoUrl: input.videoUrl,
          caption: input.caption,
          humanApproved: input.humanApproved
        }));
      } catch (error) {
        if (["authorization_required", "authorization_failed", "auth_unavailable"].includes(error?.code)) {
          sendJson(response, error.code === "auth_unavailable" ? 503 : 401, { status: "error", message: error.message });
          return;
        }
        const safe = safeTikTokError(error);
        sendJson(response, safe.code === "not_configured" ? 503 : 422, { status: "error", message: safe.message });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tiktok/disconnect") {
      try {
        const { userId } = await authenticate(request);
        if (!tiktokIntegration) throw Object.assign(new Error("TikTok connection is not configured for this environment."), { code: "not_configured" });
        sendJson(response, 200, await tiktokIntegration.disconnect({ userId }));
      } catch (error) {
        if (["authorization_required", "authorization_failed", "auth_unavailable"].includes(error?.code)) {
          sendJson(response, error.code === "auth_unavailable" ? 503 : 401, { status: "error", message: error.message });
          return;
        }
        const safe = safeTikTokError(error);
        sendJson(response, safe.code === "not_configured" ? 503 : 422, { status: "error", message: safe.message });
      }
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

      let result;
      let storedResult;
      try {
        if (isFictionalDemoBrief(brief) && !request.headers.authorization) {
          if (providerMode === "agents") {
            sendJson(response, 401, { status: "error", message: "Sign in to SellerSpark to generate and save AI drafts." });
            return;
          }
          if (!demoReviewStore) {
            sendJson(response, 503, { status: "error", message: "The fictional demo is not configured safely." });
            return;
          }
          result = await contentResultFor(brief);
          if (providerMode === "template" && isFictionalDemoBrief(brief) && Number.isInteger(brief.sampleSet) && brief.sampleSet > 0 && Array.isArray(result.drafts)) result.drafts = result.drafts.map((draft, i) => sampleCardContent(draft, brief.sampleSet + i));
          storedResult = await withListingReviewUsing(result, brief, {
            store: demoReviewStore,
            persistenceStatus: "fictional_demo_store"
          });
        } else {
          const { userId, accessToken } = await authenticate(request);
          result = await contentResultFor(brief, { historyScope: userId });
          if (providerMode === "template" && isFictionalDemoBrief(brief) && Number.isInteger(brief.sampleSet) && brief.sampleSet > 0 && Array.isArray(result.drafts)) result.drafts = result.drafts.map((draft, i) => sampleCardContent(draft, brief.sampleSet + i));
          storedResult = await withListingReviewUsing(result, brief, {
            store: reviewStore,
            actorId: userId,
            actorToken: accessToken,
            persistenceStatus: "supabase"
          });
        }
      } catch (error) {
        if (["authorization_required", "authorization_failed", "auth_unavailable"].includes(error?.code)) {
          sendJson(response, error.code === "auth_unavailable" ? 503 : 401, {
            status: "error",
            message: error.message
          });
          return;
        }
        throw error;
      }
      sendJson(response, 200, storedResult);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/reviews") {
      try {
        const { userId, accessToken } = await authenticate(request);
        const records = await reviewStore.list({ actorId: userId, actorToken: accessToken });
        sendJson(response, 200, { status: "ok", records, persistenceStatus: "supabase" });
      } catch (error) {
        const unauthorized = ["authorization_required", "authorization_failed"].includes(error?.code);
        sendJson(response, unauthorized ? 401 : 503, { status: "error", message: unauthorized ? "Sign in to open your saved drafts." : "Your saved drafts could not be loaded. Please try again." });
      }
      return;
    }

    const reviewMatch = url.pathname.match(/^\/api\/reviews\/([^/]+)$/);
    if (reviewMatch && request.method === "GET") {
      let context;
      try {
        context = await resolveReview(request, decodeURIComponent(reviewMatch[1]));
      } catch (error) {
        if (["authorization_required", "authorization_failed", "auth_unavailable"].includes(error?.code)) {
          sendJson(response, error.code === "auth_unavailable" ? 503 : 401, { status: "error", message: error.message });
          return;
        }
        throw error;
      }
      const record = context.record;
      if (!record) {
        sendJson(response, 404, { status: "error", message: "Review not found." });
        return;
      }
      sendJson(response, 200, {
        status: "ok",
        listingReviewId: record.id,
        listingReviewVersion: record.version,
        listingReview: record.listingReview,
        persistenceStatus: context.persistenceStatus
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
      let context;
      try {
        context = await resolveReview(request, id);
      } catch (error) {
        if (["authorization_required", "authorization_failed", "auth_unavailable"].includes(error?.code)) {
          sendJson(response, error.code === "auth_unavailable" ? 503 : 401, { status: "error", message: error.message });
          return;
        }
        throw error;
      }
      const record = context.record;
      if (!record) {
        sendJson(response, 404, { status: "error", message: "Review not found." });
        return;
      }
      if (!Number.isInteger(actionInput?.expectedVersion)) {
        sendJson(response, 400, { status: "error", message: "A review version is required." });
        return;
      }
      try {
        const updateOptions = context.actorId ? { actorId: context.actorId, actorToken: context.actorToken } : undefined;
        const updated = await context.store.update(id, actionInput.expectedVersion, async (next) => {
          let replacement = null, agentRun = null;
          let revisionInput = null;
          if (actionInput.action === "rewrite_current") {
            try { revisionInput = JSON.parse(actionInput.note); } catch { /* shared action validator reports invalid input */ }
          }
          if (providerMode === "agents" && agentSystem && (actionInput.action === "regenerate_current" || revisionInput?.preset)) {
            const review = next.listingReview.reviews.find(item => item.draftId === actionInput.draftId);
            if (!review) throw Object.assign(new Error(safeActionMessage("draft_not_found")), { code: "draft_not_found" });
            if (revisionInput?.preset && (review.automaticRevisionAttempts || 0) >= 2) throw Object.assign(new Error(safeActionMessage("revision_limit_reached")), { code: "revision_limit_reached" });
            if (revisionInput?.preset && !["Shorter", "Warmer", "More professional", "Stronger opening"].includes(revisionInput.preset)) throw Object.assign(new Error(safeActionMessage("invalid_revision")), { code: "invalid_revision" });
            const currentDrafts = createContentDraft(next.brief).drafts.map((draft, i) => ({ ...draft, ...next.listingReview.reviews[i].working, supportingClaimIds: (draft.claimsUsed || []).map(claim => claim.sourceId || claim.sourceRefId || claim.referenceId) }));
            const generated = await agentSystem.generate(next.brief, { currentDrafts, targetDraftId: actionInput.draftId, historyScope: context.actorId || "review:" + id, instruction: revisionInput?.preset ? "Revise this card's wording: " + revisionInput.preset : "Replace only this card with an entirely different idea grounded in its topic." });
            if (generated.status !== "ready_for_review") throw Object.assign(new Error(generated.missingInformation?.at(-1) || safeActionMessage("revision_unavailable")), { code: "revision_unavailable" });
            const target = generated.drafts.find(draft => draft.id === actionInput.draftId);
            replacement = Object.fromEntries(["hook","script","caption","takeaway","videoConcept","suggestedScenes","hashtags","suggestedNextStep","reasonToFollow"].map(field => [field, target[field]]));
            agentRun = generated.agentRun;
          }
          const result = CARD_ACTIONS.has(actionInput.action)
            ? applyCardFlowAction(next.listingReview, actionInput, { fictional: next.researchVerification?.status === "fictional_test_only", replacement })
            : await applyListingReviewAction(
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
          if (agentRun) {
            const review = next.listingReview.reviews.find(item => item.draftId === actionInput.draftId);
            review.agentRuns ||= [];
            review.agentRuns.push(agentRun);
          }
        }, updateOptions);
        sendJson(response, 200, {
          status: "ok",
          listingReviewId: updated.id,
          listingReviewVersion: updated.version,
          listingReview: updated.listingReview,
          persistenceStatus: context.persistenceStatus
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
        const status = error?.code === "not_found"
          ? 404
          : error?.code === "authorization_failed"
            ? 401
            : ["store_corrupt", "storage_unavailable", "auth_unavailable"].includes(error?.code)
              ? 503
              : 422;
        const message = error?.code === "authorization_failed"
          ? "Review access was not authorized."
          : ["store_corrupt", "storage_unavailable", "auth_unavailable"].includes(error?.code)
            ? "Review storage is temporarily unavailable."
            : error?.message || "The review action could not be completed safely.";
        sendJson(response, status, { status: "error", message });
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

export function createRequestHandler(options = {}) {
  const server = createServer(options);
  return server.listeners("request")[0];
}

export async function createConfiguredRequestHandler() {
  const providerMode = process.env.CONTENT_CREATOR_PROVIDER || (process.env.OPENROUTER_API_KEY ? "agents" : "template");
  const backupProvider = process.env.CONTENT_CREATOR_BACKUP_PROVIDER || "none";
  const draftHistory = createDraftHistory();
  const agentSystem = providerMode === "agents" ? createAgentSystem({ model: createAgentModel({ apiKey: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL }), history: draftHistory, budgetMs: 55000 }) : null;
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
  const dataDir = process.env.SELLERSPARK_DATA_DIR || (process.env.VERCEL ? "/tmp/sellerspark" : path.join(os.homedir(), ".sellerspark"));
  const filePath = process.env.SELLERSPARK_REVIEW_STORE_PATH || path.join(dataDir, "listing-review-store.json");
  const storageMode = process.env.SELLERSPARK_REVIEW_STORAGE || "local";
  let reviewStore;
  let tiktokIntegration = null;
  let authVerifier = null;
  let authConfig = { enabled: false };
  if (storageMode === "supabase") {
    const supabaseUrl = process.env.SELLERSPARK_SUPABASE_URL;
    const supabaseAnonKey = process.env.SELLERSPARK_SUPABASE_ANON_KEY;
    reviewStore = await new SupabaseReviewStore({
      url: supabaseUrl,
      anonKey: supabaseAnonKey
    }).init();
    authVerifier = new SupabaseAuthVerifier({
      url: supabaseUrl,
      anonKey: supabaseAnonKey
    });
    authConfig = { enabled: true, url: supabaseUrl, anonKey: supabaseAnonKey };
    const tiktokConfig = {
      clientKey: process.env.TIKTOK_CLIENT_KEY,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET,
      redirectUri: process.env.TIKTOK_REDIRECT_URI,
      encryptionKey: process.env.TIKTOK_TOKEN_ENCRYPTION_KEY
    };
    const supabaseServerKey = process.env.SELLERSPARK_SUPABASE_SERVICE_ROLE_KEY;
    if (tiktokConfig.clientKey && tiktokConfig.clientSecret && tiktokConfig.redirectUri && tiktokConfig.encryptionKey && supabaseServerKey) {
      const tokenCipher = createTokenCipher(tiktokConfig.encryptionKey);
      const tokenStore = new SupabaseTikTokConnectionStore({
        url: supabaseUrl,
        serverKey: supabaseServerKey,
        cipher: tokenCipher
      });
      const stateStore = new SupabaseTikTokOAuthStateStore({
        url: supabaseUrl,
        serverKey: supabaseServerKey
      });
      tiktokIntegration = createTikTokIntegration({
        clientKey: tiktokConfig.clientKey,
        clientSecret: tiktokConfig.clientSecret,
        redirectUri: tiktokConfig.redirectUri,
        tokenStore,
        stateStore
      });
    }
  } else if (storageMode === "local") {
    reviewStore = await new ReviewStore({ filePath }).init();
  } else {
    throw new Error("SELLERSPARK_REVIEW_STORAGE must be local or supabase.");
  }
  const demoReviewStore = await new ReviewStore({ filePath: path.join(dataDir, "fictional-demo-review-store.json") }).init();
  const revisionGenerator = providerMode === "groq" && groqWriter
    ? createRevisionGenerator({ primaryWriter: groqWriter, backupWriter: openRouterWriter || geminiWriter, logger: logProviderFailure })
    : providerMode === "openai" && openAIWriter
      ? createRevisionGenerator({ primaryWriter: openAIWriter, logger: logProviderFailure })
      : null;
  return createRequestHandler({ reviewStore, demoReviewStore, authVerifier, authConfig, revisionGenerator, providerMode, openAIWriter, groqWriter, geminiWriter, openRouterWriter, tiktokIntegration, agentSystem });
}

export async function startServer({ port = Number(process.env.PORT || 3000) } = {}) {
  const handler = await createConfiguredRequestHandler();
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  console.log("SellerSpark Content Creator demo: http://127.0.0.1:" + port);
  return server;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) await startServer();

