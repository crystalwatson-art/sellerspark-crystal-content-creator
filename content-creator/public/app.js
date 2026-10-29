import { BrowserSupabaseAuth, authClientErrorMessage } from "./supabase-auth.js";
import { createGrowthPilotView } from "./growth-pilot.js";

const demoError = document.querySelector("#demo-error");
const statusValue = document.querySelector("#status-value");
const audienceValue = document.querySelector("#audience-value");
const audiencePill = document.querySelector("#audience-pill");
const summary = document.querySelector("#result-summary");
const resultDiagnostic = document.querySelector("#result-diagnostic");
const runTestButton = document.querySelector("#run-fictional-test");
const regenerateButton = document.querySelector("#regenerate-drafts");
const writerStatusValue = document.querySelector("#writer-status-value");
const writerExplanation = document.querySelector("#writer-explanation");
const writerNextStep = document.querySelector("#writer-next-step");
const drafts = document.querySelector("#drafts");
const emptyState = document.querySelector("#empty-state");
const resetConfirmation = document.querySelector("#reset-confirmation");
const resetCancel = document.querySelector("#reset-cancel");
const resetConfirm = document.querySelector("#reset-confirm");
const themeToggle = document.querySelector("#theme-toggle");
const resetButton = document.querySelector("#reset-button");
const campaignAudienceMode = document.querySelector("#campaign-audience-mode");
const startingFollowers = document.querySelector("#starting-followers");
const currentFollowers = document.querySelector("#current-followers");
const updateGrowthPilot = document.querySelector("#update-growth-pilot");
const growthGoal = document.querySelector("#growth-goal");
const growthProgress = document.querySelector("#growth-progress");
const growthChange = document.querySelector("#growth-change");
const growthNote = document.querySelector("#growth-note");
const campaignCalendar = document.querySelector("#campaign-calendar");
const calendarNote = document.querySelector("#calendar-note");
const tiktokConnectionHeading = document.querySelector("#tiktok-connection-heading");
const tiktokConnectionNote = document.querySelector("#tiktok-connection-note");
const connectTikTok = document.querySelector("#connect-tiktok");
const syncTikTokFollowers = document.querySelector("#sync-tiktok-followers");
const openVideoViews = document.querySelector("#open-views");
const viewsPanel = document.querySelector("#views-panel");
const viewsNote = document.querySelector("#views-note");
const videoViewsList = document.querySelector("#video-views-list");
const authorizeVideoViews = document.querySelector("#authorize-video-views");
const refreshVideoViews = document.querySelector("#refresh-video-views");
const previousVideoViews = document.querySelector("#views-previous");
const nextVideoViews = document.querySelector("#views-next");
const videoViewsPage = document.querySelector("#views-page");
const authStatus = document.querySelector("#auth-status");
const authForm = document.querySelector("#auth-form");
const authEmail = document.querySelector("#auth-email");
const authPassword = document.querySelector("#auth-password");
const authSignIn = document.querySelector("#auth-sign-in");
const authSignOut = document.querySelector("#auth-sign-out");
const authRecoveryForm = document.querySelector("#auth-recovery-form");
const authRecoveryPassword = document.querySelector("#auth-recovery-password");
const authRecoveryConfirm = document.querySelector("#auth-recovery-confirm");
const authRecoverySubmit = document.querySelector("#auth-recovery-submit");
const authError = document.querySelector("#auth-error");
const modal = document.querySelector("#draft-modal");
const modalNumber = document.querySelector("#modal-number");
const modalAngle = document.querySelector("#modal-angle");
const modalTitle = document.querySelector("#modal-title");
const modalAudience = document.querySelector("#modal-audience");
const modalHook = document.querySelector("#modal-hook");
const modalScript = document.querySelector("#modal-script");
const modalTakeaway = document.querySelector("#modal-takeaway");
const modalConcept = document.querySelector("#modal-concept");
const modalScenes = document.querySelector("#modal-scenes");
const modalCaption = document.querySelector("#modal-caption");
const modalHashtags = document.querySelector("#modal-hashtags");
const modalCta = document.querySelector("#modal-cta");
const modalFollowReason = document.querySelector("#modal-follow-reason");
const modalReferences = document.querySelector("#modal-references");
const modalWarningsBlock = document.querySelector("#modal-warnings-block");
const modalWarnings = document.querySelector("#modal-warnings");
const modalQuality = document.querySelector("#modal-quality");
const modalQualitySummary = document.querySelector("#modal-quality-summary");
const modalQualityList = document.querySelector("#modal-quality-list");
const optimizerStatus = document.querySelector("#optimizer-review-status");
const optimizerOriginal = document.querySelector("#optimizer-original");
const optimizerProposed = document.querySelector("#optimizer-proposed");
const optimizerChanges = document.querySelector("#optimizer-changes");
const optimizerSuggestions = document.querySelector("#optimizer-suggestions");
const optimizerWarningsBlock = document.querySelector("#optimizer-warnings-block");
const optimizerWarnings = document.querySelector("#optimizer-warnings");
const optimizerHistoryBlock = document.querySelector("#optimizer-history-block");
const optimizerHistory = document.querySelector("#optimizer-history");
const optimizerAccept = document.querySelector("#optimizer-accept");
const optimizerReject = document.querySelector("#optimizer-reject");
const optimizerRevision = document.querySelector("#optimizer-revision");
const optimizerRestore = document.querySelector("#optimizer-restore");
const modalPosition = document.querySelector("#modal-position");
const modalPrevious = document.querySelector("#modal-prev");
const modalNext = document.querySelector("#modal-next");
const modalCopy = document.querySelector("#modal-copy");

let currentDrafts = [];
let currentEditorialQuality = null;
let currentListingReview = null;
let currentReviewId = null;
let currentReviewVersion = null;
let currentPersistenceStatus = "fictional_demo_store";
let activeDraftIndex = 0;
let previouslyFocusedElement = null;
let activeRequestController = null;
let requestSequence = 0;
let reviewActionInFlight = false;
let recoveryMode = false;
let videoPages = [];
let videoPageIndex = 0;
let videoViewsAccess = false;
let videoViewsLoading = false;
let videoViewsRequest = 0;
let videoViewsOwner = null;
const authClient = new BrowserSupabaseAuth();
videoViewsOwner = authClient.session?.userId || null;

const WORKSPACE_STORAGE_KEY = "sellerspark-listing-review-workspaces-v2";
const LEGACY_WORKSPACE_STORAGE_KEY = "sellerspark-listing-review-workspace-v1";
const REVIEW_ARCHIVE_STORAGE_KEY = "sellerspark-listing-review-archive-v1";
const GROWTH_PILOT_STORAGE_KEY = "sellerspark-growth-pilot-by-audience-v2";
const LEGACY_GROWTH_PILOT_STORAGE_KEY = "sellerspark-growth-pilot-v1";
const AUDIENCE_SELECTION_STORAGE_KEY = "sellerspark-selected-research-audience-v1";
const DEFAULT_RESEARCH_AUDIENCE = "lic_condo_owner";
const RESEARCH_FIXTURES = Object.freeze({
  lic_condo_owner: "/fixtures/fictional-research-brief.json",
  brooklyn_townhouse_owner: "/fixtures/fictional-brooklyn-townhouse-brief.json"
});
const RESEARCH_AUDIENCE_LABELS = Object.freeze({
  lic_condo_owner: "Long Island City condo owners",
  brooklyn_townhouse_owner: "Brooklyn townhouse owners"
});
let currentWorkspaceAudience = DEFAULT_RESEARCH_AUDIENCE;
const REVIEWABLE_FIELDS = Object.freeze([
  ["hook", "Hook"],
  ["script", "Script"],
  ["takeaway", "Viewer takeaway"],
  ["videoConcept", "Video concept"],
  ["caption", "Caption"],
  ["hashtags", "Hashtags"],
  ["reasonToFollow", "Reason to follow"],
  ["suggestedNextStep", "Suggested call to action"]
]);

const writerDiagnostics = Object.freeze({
  not_configured: {
    label: "Not configured",
    explanation: "The selected AI writer is not configured for this workspace.",
    nextStep: "Keep offline template mode or ask an administrator to configure the server-side provider."
  },
  rate_limited: {
    label: "Rate limited",
    explanation: "The AI provider is temporarily rate-limited.",
    nextStep: "Wait and try again later. The app will not switch providers automatically."
  },
  authentication_failed: {
    label: "Authentication failed",
    explanation: "The provider rejected the server authentication.",
    nextStep: "Verify the server-side provider credential without exposing it."
  },
  access_denied: {
    label: "Access denied",
    explanation: "The provider denied the configured account or model.",
    nextStep: "Check account and model access on the server."
  },
  endpoint_or_model_not_found: {
    label: "Endpoint or model not found",
    explanation: "The provider could not find the configured endpoint or model.",
    nextStep: "Verify the server-side model setting and endpoint."
  },
  request_rejected: {
    label: "Request rejected",
    explanation: "The provider rejected the request format.",
    nextStep: "Review the structured-output request against the provider documentation."
  },
  provider_unavailable: {
    label: "Provider unavailable",
    explanation: "The provider was unavailable or timed out.",
    nextStep: "Wait and retry once the provider is available."
  },
  network_error: {
    label: "Network error",
    explanation: "The app could not reach the provider.",
    nextStep: "Check server network access and retry later."
  },
  provider_error: {
    label: "Provider error",
    explanation: "The app could not complete the provider request.",
    nextStep: "Review the safe server diagnostics before retrying."
  },
  error: {
    label: "Provider error",
    explanation: "The AI writer could not complete this request.",
    nextStep: "Check the server configuration and try again later."
  },
  invalid_response: {
    label: "Response rejected",
    explanation: "The AI writer returned content the app could not safely use.",
    nextStep: "Try again later or continue with offline templates."
  },
  not_fresh: {
    label: "Freshness check stopped",
    explanation: "The writer could not create fresh drafts within the allowed rewrite limit.",
    nextStep: "Try again with new research or wait for a later review."
  },
  blocked: {
    label: "Research needed",
    explanation: "The supplied research brief needs more information before writing can begin.",
    nextStep: "Provide a complete brief with three distinct topics and source references."
  },
  unavailable: {
    label: "Status unavailable",
    explanation: "The Content Creator stopped before producing drafts.",
    nextStep: "Review the supplied research brief and try again."
  }
});

function setDemoError(message = "") {
  demoError.textContent = message;
  demoError.hidden = !message;
  const visibleError = document.querySelector("#modal-error");
  visibleError.textContent = message;
  visibleError.hidden = !message;
}

function setAuthError(message = "") {
  authError.textContent = message;
  authError.hidden = !message;
}

function initializePasswordVisibilityToggles() {
  document.querySelectorAll("[data-password-toggle]").forEach((toggle) => {
    const input = document.getElementById(toggle.dataset.passwordToggle);
    if (!input) return;
    const label = toggle.dataset.passwordLabel || "password";
    toggle.addEventListener("click", () => {
      const shouldShow = input.type === "password";
      input.type = shouldShow ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(shouldShow));
      toggle.setAttribute("aria-label", (shouldShow ? "Hide " : "Show ") + label);
    });
  });
}

initializePasswordVisibilityToggles();

function renderAuthState(session = authClient.session) {
  if (!authClient.enabled) {
    authForm.hidden = true;
    authRecoveryForm.hidden = true;
    authSignOut.hidden = true;
    authStatus.textContent = "Fictional demo available without sign-in";
    return;
  }
  if (recoveryMode) {
    authForm.hidden = true;
    authRecoveryForm.hidden = false;
    authSignOut.hidden = true;
    authStatus.textContent = "Password recovery · choose a new password";
    return;
  }
  authForm.hidden = false;
  authRecoveryForm.hidden = true;
  const signedIn = Boolean(session?.accessToken);
  authEmail.hidden = signedIn;
  authPassword.hidden = signedIn;
  authPassword.closest(".password-field").hidden = signedIn;
  authSignIn.hidden = signedIn;
  authSignOut.hidden = !signedIn;
  authStatus.textContent = signedIn
    ? "Signed in · saved reviews use your account"
    : "Sign in to save and review persistent records";
}

function clearRecoveryUrl() {
  if (typeof globalThis.history?.replaceState !== "function" || typeof globalThis.location?.pathname !== "string") return;
  globalThis.history.replaceState({}, document.title, globalThis.location.pathname + globalThis.location.search);
}

async function initializeAuth() {
  try {
    const response = await fetch("/api/auth-config", { cache: "no-store" });
    const config = await response.json();
    if (config?.enabled && config.url && config.anonKey) {
      authClient.configure({ url: config.url, anonKey: config.anonKey });
      let session = null;
      if (authClient.hasRecoveryRedirect()) {
        try {
          session = authClient.restoreRecoverySession();
          recoveryMode = true;
        } catch (error) {
          setAuthError(authClientErrorMessage(error));
          authClient.saveSession(null);
        } finally {
          clearRecoveryUrl();
        }
      } else {
        session = await authClient.getSession();
      }
      renderAuthState(session);
      if (session && currentReviewId && currentPersistenceStatus === "supabase") void refreshReviewFromServer();
      void refreshTikTokStatus();
    } else {
      authClient.configure({ url: "", anonKey: "" });
      authClient.saveSession(null);
      renderAuthState(null);
      renderTikTokStatus({ status: "not_configured", scopes: [] });
    }
  } catch {
    authStatus.textContent = "Fictional demo available without sign-in";
    authForm.hidden = true;
    renderTikTokStatus({ status: "not_configured", scopes: [] });
  }
}

function renderTikTokStatus(status = {}) {
  const state = status.status || "not_configured";
  const connected = state === "connected";
  const configured = state !== "not_configured";
  tiktokConnectionHeading.textContent = connected ? "Connected" : configured ? "Not connected" : "Not configured";
  if (connected) {
    const scopes = Array.isArray(status.scopes) ? status.scopes.join(", ") : "approved permissions";
    tiktokConnectionNote.textContent = "Follower statistics are available through the authorized TikTok account. Permissions: " + scopes + ".";
  } else if (configured && authClient.session) {
    tiktokConnectionNote.textContent = "Connect a TikTok account to read follower statistics. The authorization request stays server-side and direct publishing remains disabled.";
  } else if (configured) {
    tiktokConnectionNote.textContent = "Sign in to SellerSpark, then connect TikTok with explicit account consent. No follower data is read without authorization.";
  } else {
    tiktokConnectionNote.textContent = "Official API setup is not configured for this environment. The fictional demo remains available without sign-in.";
  }
  connectTikTok.hidden = false;
  connectTikTok.disabled = !configured || !authClient.session || connected;
  connectTikTok.textContent = connected ? "TikTok connected" : "Connect TikTok";
  syncTikTokFollowers.hidden = false;
  syncTikTokFollowers.disabled = !connected;
  videoViewsAccess = connected && Boolean(authClient.session) && Array.isArray(status.scopes) && status.scopes.includes("video.list");
  authorizeVideoViews.hidden = videoViewsAccess;
  authorizeVideoViews.disabled = !configured || !authClient.session;
  if (!videoViewsAccess) {
    videoPages = [];
    videoPageIndex = 0;
    videoViewsList.replaceChildren();
    viewsNote.textContent = !configured ? "Finish the TikTok connection setup before reading video views."
      : !authClient.session ? "Sign in, connect TikTok, and authorize video access to see views."
      : "Choose Authorize video views to grant read-only access to your public videos. TikTok must approve this permission for the app.";
  }
  renderVideoViewControls();
}

function renderVideoViewControls() {
  refreshVideoViews.disabled = !videoViewsAccess || videoViewsLoading;
  previousVideoViews.disabled = videoViewsLoading || videoPageIndex === 0;
  nextVideoViews.disabled = !videoViewsAccess || videoViewsLoading || !videoPages[videoPageIndex]?.hasMore;
  videoViewsPage.textContent = "Page " + (videoPageIndex + 1);
}

function renderVideoViews() {
  videoViewsList.replaceChildren();
  const page = videoPages[videoPageIndex];
  for (const video of page?.videos || []) {
    const row = document.createElement("article");
    row.className = "video-views-row";
    const title = document.createElement("strong");
    title.textContent = video.title || "Untitled video";
    const count = document.createElement("span");
    count.textContent = video.viewCount.toLocaleString("en-US") + " views";
    row.append(title, count);
    videoViewsList.append(row);
  }
  if (page) viewsNote.textContent = page.videos.length
    ? "Views on your public videos · updated " + new Date(page.observedAt).toLocaleString() + ". These are per-video counts, not profile visits."
    : "TikTok returned no public videos on this page.";
  renderVideoViewControls();
}

async function loadVideoViews(cursor = null, pageIndex = 0) {
  if (!videoViewsAccess || videoViewsLoading) return;
  const requestId = ++videoViewsRequest;
  videoViewsLoading = true;
  viewsNote.textContent = "Reading video views from TikTok…";
  renderVideoViewControls();
  try {
    const suffix = cursor === null ? "" : "?cursor=" + encodeURIComponent(cursor);
    const response = await authClient.authorizedFetch("/api/tiktok/video-views" + suffix, { cache: "no-store" });
    const payload = await response.json();
    if (requestId !== videoViewsRequest) return;
    if (!response.ok || !Array.isArray(payload.videos)) {
      viewsNote.textContent = payload.message || "Video views could not be loaded. Your draft workspace is unchanged.";
      return;
    }
    if (pageIndex === 0) videoPages = [];
    videoPages[pageIndex] = payload;
    videoPageIndex = pageIndex;
    renderVideoViews();
  } catch {
    if (requestId === videoViewsRequest) viewsNote.textContent = "Video views are temporarily unavailable. Try again later.";
  } finally {
    if (requestId === videoViewsRequest) {
      videoViewsLoading = false;
      renderVideoViewControls();
    }
  }
}

async function refreshTikTokStatus() {
  if (!authClient.enabled) {
    renderTikTokStatus({ status: "not_configured", scopes: [] });
    return;
  }
  const session = await authClient.getSession();
  if (!session) {
    renderTikTokStatus({ status: "not_connected", scopes: [] });
    return;
  }
  try {
    const response = await authClient.authorizedFetch("/api/tiktok/status", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) renderTikTokStatus(payload);
    else tiktokConnectionNote.textContent = payload.message || "TikTok connection status is unavailable.";
  } catch {
    tiktokConnectionNote.textContent = "TikTok connection status is unavailable. The fictional demo is still usable.";
  }
}

async function startTikTokAuthorization({ includeVideoViews = false } = {}) {
  if (!authClient.session) {
    setAuthError("Sign in before connecting TikTok.");
    return;
  }
  connectTikTok.disabled = true;
  try {
    const response = await authClient.authorizedFetch("/api/tiktok/oauth/start", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeVideoViews: includeVideoViews === true })
    });
    const payload = await response.json();
    if (!response.ok || typeof payload.authorizationUrl !== "string") {
      tiktokConnectionNote.textContent = payload.message || "TikTok authorization could not be started safely.";
      return;
    }
    window.location.assign(payload.authorizationUrl);
  } catch (error) {
    tiktokConnectionNote.textContent = authClientErrorMessage(error);
  } finally {
    connectTikTok.disabled = false;
  }
}

async function syncTikTokFollowerCount() {
  syncTikTokFollowers.disabled = true;
  try {
    const response = await authClient.authorizedFetch("/api/tiktok/follower-count", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !Number.isInteger(payload.followerCount)) {
      tiktokConnectionNote.textContent = payload.message || "Follower statistics could not be read safely.";
      return;
    }
    currentFollowers.value = String(payload.followerCount);
    renderGrowthPilot();
    window.dispatchEvent(new CustomEvent("sellerspark:tiktok-metric", {
      detail: { followerCount: payload.followerCount, observedAt: payload.observedAt }
    }));
    growthNote.textContent = "Follower count synced from TikTok at " + new Date(payload.observedAt).toLocaleString() + ". This measures progress; it does not predict growth.";
  } catch (error) {
    tiktokConnectionNote.textContent = authClientErrorMessage(error);
  } finally {
    syncTikTokFollowers.disabled = false;
  }
}

function reviewFetch(url, options = {}) {
  return currentPersistenceStatus === "supabase"
    ? authClient.authorizedFetch(url, options)
    : fetch(url, options);
}

function isFictionalBrief(brief) {
  return brief?.researchMode === "fictional"
    && typeof brief?._fixtureNotice === "string"
    && brief._fixtureNotice.toUpperCase().startsWith("FICTIONAL TEST DATA");
}

async function requestContentBrief(brief, signal) {
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(brief),
    signal
  };
  return isFictionalBrief(brief)
    ? fetch("/api/content", options)
    : authClient.authorizedFetch("/api/content", options);
}

function setStatus(text, kind = "muted") {
  statusValue.textContent = text === "ready_for_review" ? "Ready for review" : text;
  statusValue.className = "status-badge " + kind;
}

function renderWriterDiagnostic(result) {
  const isReady = result.status === "ready_for_review";
  resultDiagnostic.hidden = isReady;
  if (isReady) return;

  if (result.researchVerification?.status === "needs_more_research") {
    const verification = result.researchVerification;
    writerStatusValue.textContent = "Research verification needed";
    writerExplanation.textContent = "Public-facing drafts were stopped because the supplied factual research is not verified enough to use safely.";
    writerNextStep.textContent = verification.unsupportedClaims?.length
      ? "Remove unsupported claims and provide a checked source record for each remaining claim."
      : "Provide an HTTPS source link, source date, verification checkedAt, evidence quote, and locator for each factual claim.";
    return;
  }

  const diagnostic = writerDiagnostics[result.writerStatus] || writerDiagnostics.unavailable;
  const httpStatus = Number.isInteger(result.diagnostic?.httpStatus)
    ? " · HTTP " + String(result.diagnostic.httpStatus)
    : result.diagnostic?.statusClass
      ? " · " + result.diagnostic.statusClass
      : "";
  writerStatusValue.textContent = diagnostic.label + httpStatus;
  writerExplanation.textContent = diagnostic.explanation;
  writerNextStep.textContent = diagnostic.nextStep;
}

function setTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  themeToggle.querySelector(".theme-label").textContent = isDark ? "Day view" : "Night view";
  themeToggle.querySelector(".theme-icon").textContent = isDark ? "☼" : "◐";
  localStorage.setItem("sellerspark-theme", isDark ? "dark" : "light");
}

function initializeTheme() {
  const penthouseTheme = localStorage.getItem("sellerspark-penthouse-theme");
  const savedTheme = localStorage.getItem("sellerspark-theme");
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  setTheme(penthouseTheme ? (penthouseTheme === "day" ? "light" : "dark") : savedTheme || (prefersDark ? "dark" : "light"));
}

function renderGrowthCalendar(calendar) {
  window.dispatchEvent(new CustomEvent("sellerspark:calendar-prompts", { detail: clone(calendar) }));
}

function isSupportedAudience(value) {
  return Object.hasOwn(RESEARCH_FIXTURES, value);
}

function resolveAudience(value, listingReview = null) {
  if (isSupportedAudience(value)) return value;
  if (listingReview && isSupportedAudience(listingReview.audience)) return listingReview.audience;
  return Object.entries(RESEARCH_AUDIENCE_LABELS).find(([, label]) => label === value)?.[0] || null;
}

function readStorageObject(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeStorageObject(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Browser storage is a convenience; the current review remains usable in memory.
  }
}

function readGrowthPilotMap() {
  const saved = readStorageObject(GROWTH_PILOT_STORAGE_KEY, {});
  if (Object.keys(saved).some((key) => isSupportedAudience(key))) return saved;
  const legacy = readStorageObject(LEGACY_GROWTH_PILOT_STORAGE_KEY, null);
  if (legacy && typeof legacy === "object") {
    return { [DEFAULT_RESEARCH_AUDIENCE]: legacy };
  }
  return {};
}

function persistGrowthPilot() {
  const map = readGrowthPilotMap();
  map[currentWorkspaceAudience] = {
    audienceMode: campaignAudienceMode.value,
    startingFollowers: startingFollowers.value,
    currentFollowers: currentFollowers.value
  };
  writeStorageObject(GROWTH_PILOT_STORAGE_KEY, map);
}

function renderGrowthPilot(values = {}) {
  const plan = createGrowthPilotView({
    audienceMode: values.audienceMode ?? campaignAudienceMode.value,
    startingFollowers: values.startingFollowers ?? startingFollowers.value,
    currentFollowers: values.currentFollowers ?? currentFollowers.value
  });
  campaignAudienceMode.value = plan.audienceMode;
  if (values.startingFollowers !== undefined) startingFollowers.value = values.startingFollowers ?? "";
  if (values.currentFollowers !== undefined) currentFollowers.value = values.currentFollowers ?? "";
  growthGoal.textContent = String(plan.tracker.goal) + " total followers";
  growthProgress.textContent = plan.tracker.progressPercent === null
    ? "Count needed"
    : String(plan.tracker.progressPercent) + "% of goal" + (plan.tracker.goalReached ? " · reached" : "");
  growthChange.textContent = plan.tracker.netChange === null
    ? "Not available"
    : (plan.tracker.netChange >= 0 ? "+" : "") + String(plan.tracker.netChange);
  growthNote.textContent = plan.tracker.errors?.length
    ? plan.tracker.errors.join(" ")
    : plan.tracker.note;
  calendarNote.textContent = "Planning for " + plan.audienceMode + " · draft prompts only. No auto-scheduling.";
  renderGrowthCalendar(plan.calendar);
  persistGrowthPilot();
  return plan;
}

function restoreGrowthPilot() {
  const saved = readGrowthPilotMap()[currentWorkspaceAudience] || {};
  renderGrowthPilot(saved);
}

function clone(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

function displayValue(value) {
  if (Array.isArray(value)) return value.join(" ");
  return typeof value === "string" && value.trim() ? value : "Not supplied";
}

function renderComparison(parent, content) {
  parent.replaceChildren();
  if (!content) {
    const empty = document.createElement("p");
    empty.className = "comparison-empty";
    empty.textContent = "No proposed revision is available for this research result.";
    parent.append(empty);
    return;
  }
  REVIEWABLE_FIELDS.forEach(([field, label]) => addText(parent, label, displayValue(content[field])));
}

function workspaceSnapshot() {
  return {
      drafts: clone(currentDrafts),
      editorialQuality: clone(currentEditorialQuality),
      listingReview: clone(currentListingReview),
      listingReviewId: currentReviewId,
      listingReviewVersion: currentReviewVersion,
      persistenceStatus: currentPersistenceStatus,
      audience: currentWorkspaceAudience,
      audiencePill: audiencePill.textContent,
      summary: summary.textContent,
      status: statusValue.textContent,
      savedAt: new Date().toISOString()
  };
}

function readWorkspaceMap() {
  const saved = readStorageObject(WORKSPACE_STORAGE_KEY, {});
  if (Object.keys(saved).some((key) => isSupportedAudience(key))) return saved;
  const legacy = readStorageObject(LEGACY_WORKSPACE_STORAGE_KEY, null);
  const audience = resolveAudience(legacy?.audience, legacy?.listingReview);
  return legacy && audience ? { [audience]: legacy } : {};
}

function writeWorkspaceMap(map) {
  writeStorageObject(WORKSPACE_STORAGE_KEY, map);
}

function persistWorkspace() {
  if (!currentDrafts.length || !currentListingReview) return;
  const map = readWorkspaceMap();
  map[currentWorkspaceAudience] = workspaceSnapshot();
  writeWorkspaceMap(map);
}

function restoreWorkspaceSnapshot(saved) {
  if (!saved || !Array.isArray(saved.drafts) || !saved.listingReview) {
    currentDrafts = [];
    regenerateButton.disabled = true;
    currentEditorialQuality = null;
    currentListingReview = null;
    currentReviewId = null;
    currentReviewVersion = null;
    currentPersistenceStatus = "fictional_demo_store";
    drafts.replaceChildren();
    emptyState.hidden = false;
    audiencePill.textContent = "Audience pending";
    summary.textContent = "Run fictional test mode to create a review-only queue.";
    setStatus("Ready to test", "muted");
    resultDiagnostic.hidden = true;
    setDemoError();
    return false;
  }
  currentDrafts = clone(saved.drafts);
  currentEditorialQuality = clone(saved.editorialQuality) || null;
  currentListingReview = clone(saved.listingReview);
  currentReviewId = saved.listingReviewId || null;
  currentReviewVersion = Number.isInteger(saved.listingReviewVersion) ? saved.listingReviewVersion : null;
  currentPersistenceStatus = saved.persistenceStatus || "fictional_demo_store";
  audiencePill.textContent = saved.audiencePill || currentListingReview.audienceLabel || "Audience needs review";
  summary.textContent = saved.summary || "Saved review restored locally for this browser.";
  setStatus(saved.status || "Ready for review", "success");
  emptyState.hidden = currentDrafts.length > 0;
  renderDraftCards();
  return true;
}

function archiveWorkspace() {
  if (currentPersistenceStatus === "supabase" || !currentListingReview) return;
  try {
    const existing = JSON.parse(localStorage.getItem(REVIEW_ARCHIVE_STORAGE_KEY) || "[]");
    const archive = Array.isArray(existing) ? existing : [];
    archive.unshift({
      savedAt: new Date().toISOString(),
      audience: currentListingReview.audience,
      audienceLabel: currentListingReview.audienceLabel,
      reviews: clone(currentListingReview.reviews)
    });
    localStorage.setItem(REVIEW_ARCHIVE_STORAGE_KEY, JSON.stringify(archive.slice(0, 10)));
  } catch {
    // Do not block a reset if browser storage is unavailable.
  }
}

function restoreWorkspace() {
  const saved = readWorkspaceMap()[currentWorkspaceAudience];
  if (!restoreWorkspaceSnapshot(saved)) return;
  if (currentReviewId && currentPersistenceStatus === "supabase" && authClient.session) void refreshReviewFromServer();
}

function addText(parent, label, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  const heading = document.createElement("strong");
  heading.textContent = label;
  const content = document.createElement("p");
  content.textContent = value;
  wrapper.append(heading, content);
  parent.append(wrapper);
}

function referenceLabel(reference) {
  const label = reference.title || reference.id || reference.sourceId || "Supplied source";
  return reference.date ? label + " · " + reference.date : label;
}

function renderDraftCards() {
  regenerateButton.disabled = Boolean(activeRequestController) || currentDrafts.length === 0;
  drafts.replaceChildren();
  currentDrafts.forEach((draft, index) => {
    const card = document.createElement("article");
    card.className = "draft-card";
    card.tabIndex = 0;
    card.setAttribute("aria-label", "Open draft " + String(index + 1));

    const cardTop = document.createElement("div");
    cardTop.className = "card-topline";
    const number = document.createElement("span");
    number.className = "draft-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const angle = document.createElement("span");
    angle.className = "angle-label";
    angle.textContent = draft.angle;
    cardTop.append(number, angle);

    const title = document.createElement("h3");
    title.textContent = draft.hook;
    const excerpt = document.createElement("p");
    excerpt.className = "card-excerpt";
    excerpt.textContent = draft.videoConcept;

    const cardBottom = document.createElement("div");
    cardBottom.className = "card-bottomline";
    const sourceCount = document.createElement("span");
    sourceCount.className = "source-count";
    sourceCount.textContent = draft.sourceRefs.length + " source" + (draft.sourceRefs.length === 1 ? "" : "s");
    const preview = document.createElement("button");
    preview.className = "preview-button";
    preview.type = "button";
    preview.textContent = "Preview draft →";
    preview.addEventListener("click", (event) => {
      event.stopPropagation();
      setReviewMode("creator");
      openDraft(index);
    });
    cardBottom.append(sourceCount, preview);

    card.append(cardTop, title, excerpt, cardBottom);
    card.addEventListener("click", () => { setReviewMode("creator"); openDraft(index); });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setReviewMode("creator");
      openDraft(index);
      }
    });
    drafts.append(card);
  });
}

function renderResult(result) {
  if (isSupportedAudience(result.audience)) {
    currentWorkspaceAudience = result.audience;
    audienceValue.value = result.audience;
    localStorage.setItem(AUDIENCE_SELECTION_STORAGE_KEY, currentWorkspaceAudience);
  }
  currentDrafts = Array.isArray(result.drafts) ? result.drafts : [];
  currentEditorialQuality = result.editorialQuality || null;
  currentListingReview = result.listingReview
    ? clone(result.listingReview)
    : null;
  currentReviewId = result.listingReviewId || null;
  currentReviewVersion = Number.isInteger(result.listingReviewVersion) ? result.listingReviewVersion : null;
  currentPersistenceStatus = result.persistenceStatus || "fictional_demo_store";
  emptyState.hidden = currentDrafts.length > 0;
  setDemoError();

  const writerLabel = result.writerLabel || result.writer || "Unidentified writer";
  summary.textContent = result.status === "ready_for_review"
    ? "Three distinct draft packages are ready for a future reviewer. Human approval is still required. Generated by " + writerLabel + ". Campaign mode: " + (result.campaignAudienceLabel || "Sellers") + "."
    : "The Content Creator stopped with information to resolve before review. Writer: " + writerLabel + ".";
  setStatus(result.status, result.status === "ready_for_review" ? "success" : "warning");
  renderWriterDiagnostic(result);
  audiencePill.textContent = result.audienceLabel || "Audience needs review";
  if (result.growthPilot?.tracker) {
    renderGrowthPilot({
      audienceMode: result.campaignAudienceMode || campaignAudienceMode.value,
      startingFollowers: result.growthPilot.tracker.startingFollowers ?? startingFollowers.value,
      currentFollowers: result.growthPilot.tracker.currentFollowers ?? currentFollowers.value
    });
  }
  renderDraftCards();
  persistWorkspace();
}

function renderList(parent, values, emptyText) {
  parent.replaceChildren();
  if (!values.length) {
    const item = document.createElement("li");
    item.textContent = emptyText;
    parent.append(item);
    return;
  }
  values.forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    parent.append(item);
  });
}

function renderEditorialQuality() {
  const quality = currentEditorialQuality?.drafts?.[activeDraftIndex];
  if (!quality) {
    modalQuality.hidden = true;
    return;
  }
  modalQuality.hidden = false;
  modalQualitySummary.textContent = quality.score + " heuristic editorial checks passed. These signals are not semantic judgment or a prediction of performance; human editorial review remains required.";
  renderList(modalQualityList, quality.warnings, quality.warnings.length ? "Address the listed checks before approval." : "All checks passed for this draft.");
}

function activeReview() {
  return currentListingReview?.reviews?.[activeDraftIndex] || null;
}

function reviewStatusLabel(status) {
  return String(status || "pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function recordReviewAction(review, action, note) {
  review.revisionHistory.push({
    action,
    note,
    at: new Date().toISOString()
  });
}

function syncWorkingDraft(review) {
  if (!review?.working || !currentDrafts[activeDraftIndex]) return;
  currentDrafts[activeDraftIndex] = {
    ...currentDrafts[activeDraftIndex],
    ...clone(review.working)
  };
  renderDraftCards();
  persistWorkspace();
}

function renderOptimizerReview() {
  const review = activeReview();
  const draft = currentDrafts[activeDraftIndex];
  if (!review || !draft) {
    optimizerStatus.textContent = "Review unavailable";
    renderComparison(optimizerOriginal, null);
    renderComparison(optimizerProposed, null);
    renderList(optimizerChanges, [], "No change details available.");
    renderList(optimizerSuggestions, [], "No suggestions available.");
    renderList(optimizerWarnings, [], "No warnings available.");
    renderList(optimizerHistory, [], "No review actions yet.");
    optimizerWarningsBlock.hidden = false;
    optimizerHistoryBlock.hidden = true;
    optimizerAccept.disabled = true;
    optimizerReject.disabled = true;
    optimizerRevision.disabled = true;
    optimizerRestore.disabled = true;
    return;
  }

  optimizerStatus.textContent = reviewStatusLabel(review.status);
  renderComparison(optimizerOriginal, review.original);
  renderComparison(optimizerProposed, review.proposed);
  renderList(
    optimizerChanges,
    review.changes.map((item) => item.label + ": " + displayValue(item.after) + " Why: " + item.reason),
    review.revisionUnavailableReason || "No substantive revision is available."
  );
  renderList(
    optimizerSuggestions,
    review.suggestedImprovements.map((item) => item.recommendation + " Why: " + item.reason),
    "No automatic improvement suggested. Confirm the supplied copy during human review."
  );
  const warnings = [...review.factualSupportWarnings, ...review.missingEvidence.map((item) => "Missing evidence: " + item)];
  renderList(optimizerWarnings, warnings, "No factual-support warnings recorded.");
  optimizerWarningsBlock.hidden = warnings.length === 0;
  renderList(
    optimizerHistory,
    review.revisionHistory.map((item) => reviewStatusLabel(item.action) + ": " + (item.note || "Review action recorded.")),
    "No review actions yet."
  );
  optimizerHistoryBlock.hidden = review.revisionHistory.length === 0;
  const busy = reviewActionInFlight;
  optimizerAccept.disabled = busy || !review.proposed || review.status === "accepted";
  optimizerReject.disabled = busy || review.status === "rejected";
  optimizerRevision.disabled = busy || !review.proposed || review.automaticRevisionAttempts >= (currentListingReview.revisionLimit || 2);
  optimizerRestore.disabled = busy || JSON.stringify(review.working) === JSON.stringify(review.original);
}

function renderModal() {
  const draft = currentDrafts[activeDraftIndex];
  if (!draft) return;

  modalNumber.textContent = "DRAFT " + String(activeDraftIndex + 1).padStart(2, "0");
  modalAngle.textContent = draft.angle;
  modalTitle.textContent = draft.hook;
  modalAudience.textContent = draft.audienceLabel;
  modalHook.textContent = draft.hook;
  modalScript.textContent = draft.script;
  modalTakeaway.textContent = typeof draft.takeaway === "string" && draft.takeaway.trim()
    ? draft.takeaway
    : "Takeaway unavailable. This draft needs review before approval.";
  modalConcept.textContent = draft.videoConcept;
  renderList(modalScenes, draft.suggestedScenes, "No scene suggestions supplied.");
  modalCaption.textContent = draft.caption;
  modalHashtags.textContent = draft.hashtags.join(" ");
  modalCta.textContent = draft.suggestedNextStep;
  modalFollowReason.textContent = typeof draft.reasonToFollow === "string" && draft.reasonToFollow.trim()
    ? draft.reasonToFollow
    : "Follow reason not supplied; keep this draft in human review.";
  renderList(modalReferences, draft.sourceRefs.map(referenceLabel), "No source references supplied.");
  renderList(modalWarnings, draft.warnings, "No warnings.");
  modalWarningsBlock.hidden = draft.warnings.length === 0;
  renderEditorialQuality();
  renderOptimizerReview();
  modalPosition.textContent = "Draft " + String(activeDraftIndex + 1) + " of " + String(currentDrafts.length);
  modalPrevious.disabled = activeDraftIndex === 0;
  modalNext.disabled = activeDraftIndex === currentDrafts.length - 1;
  modalCopy.textContent = "Copy";
}

function setReviewMode(mode) {
  modal.dataset.mode = ["creator", "optimizer", "approval"].includes(mode) ? mode : "creator";
  document.querySelector("#optimizer-review-heading").textContent = modal.dataset.mode === "approval"
    ? "Review the draft and make your decision"
    : "Original content beside a proposed revision";
  const next = document.querySelector("#modal-next-step");
  next.href = modal.dataset.mode === "creator" ? "#optimizer" : "#approval";
  next.textContent = modal.dataset.mode === "creator" ? "Open Listing Optimizer →" : "Review & approve →";
}

function openDraft(index) {
  if (!currentDrafts[index]) return;
  activeDraftIndex = index;
  previouslyFocusedElement = document.activeElement;
  renderModal();
  modal.hidden = false;
  document.body.classList.add("modal-open");
  document.querySelector("#modal-close").focus();
}

function closeDraft() {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === "function") {
    previouslyFocusedElement.focus();
  }
  previouslyFocusedElement = null;
}

function copyActiveDraft() {
  const draft = currentDrafts[activeDraftIndex];
  if (!draft) return;
  const copyText = [
    draft.hook,
    "\nScript: " + draft.script,
    "\nTakeaway: " + draft.takeaway,
    "\nVideo concept: " + draft.videoConcept,
    "\nScenes:\n- " + draft.suggestedScenes.join("\n- "),
    "\nCaption: " + draft.caption,
    "\nHashtags: " + draft.hashtags.join(" "),
    "\nWhy viewers may follow: " + (draft.reasonToFollow || "Not supplied"),
    "\nSuggested call to action: " + draft.suggestedNextStep
  ].join("\n");

  navigator.clipboard.writeText(copyText).then(() => {
    modalCopy.textContent = "Copied";
    window.setTimeout(() => {
      if (!modal.hidden) modalCopy.textContent = "Copy";
    }, 1400);
  }).catch(() => {
    setDemoError("Copy is unavailable in this browser. The draft remains available for review.");
  });
}

function requestReset() {
  if (!currentDrafts.length) {
    resetWorkspace();
    return;
  }
  resetConfirmation.hidden = false;
  resetConfirmation.showModal();
  resetConfirm.focus();
}

function resetWorkspace() {
  regenerateButton.disabled = true;
  requestSequence += 1;
  activeRequestController?.abort();
  activeRequestController = null;
  runTestButton.disabled = false;
  audienceValue.disabled = false;
  archiveWorkspace();
  const map = readWorkspaceMap();
  delete map[currentWorkspaceAudience];
  writeWorkspaceMap(map);
  closeDraft();
  currentDrafts = [];
  currentEditorialQuality = null;
  currentListingReview = null;
  currentReviewId = null;
  currentReviewVersion = null;
  currentPersistenceStatus = "fictional_demo_store";
  drafts.replaceChildren();
  emptyState.hidden = false;
  currentWorkspaceAudience = DEFAULT_RESEARCH_AUDIENCE;
  audienceValue.value = currentWorkspaceAudience;
  localStorage.setItem(AUDIENCE_SELECTION_STORAGE_KEY, currentWorkspaceAudience);
  restoreGrowthPilot();
  audiencePill.textContent = "Audience pending";
  summary.textContent = "Active review reset. Saved review history remains on this browser.";
  setStatus("Ready to test", "muted");
  resultDiagnostic.hidden = true;
  setDemoError();
  resetConfirmation.close();
  resetConfirmation.hidden = true;
}

function clearActiveWorkspace() {
  regenerateButton.disabled = true;
  requestSequence += 1;
  activeRequestController?.abort();
  activeRequestController = null;
  runTestButton.disabled = false;
  audienceValue.disabled = false;
  closeDraft();
  currentDrafts = [];
  currentEditorialQuality = null;
  currentListingReview = null;
  currentReviewId = null;
  currentReviewVersion = null;
  currentPersistenceStatus = "fictional_demo_store";
  drafts.replaceChildren();
  emptyState.hidden = false;
  audiencePill.textContent = "Audience pending";
  summary.textContent = "Audience changed. Run fictional test mode to create a new review-only queue.";
  setStatus("Ready to test", "muted");
  resultDiagnostic.hidden = true;
  setDemoError();
}

function applyReviewServerState(payload) {
  if (!payload?.listingReview) return;
  currentListingReview = clone(payload.listingReview);
  currentReviewId = payload.listingReviewId || currentReviewId;
  currentReviewVersion = Number.isInteger(payload.listingReviewVersion)
    ? payload.listingReviewVersion
    : currentReviewVersion;
  currentPersistenceStatus = payload.persistenceStatus || currentPersistenceStatus;
  currentListingReview.reviews.forEach((review, index) => {
    if (currentDrafts[index] && review.working) currentDrafts[index] = { ...currentDrafts[index], ...clone(review.working) };
  });
  renderDraftCards();
  persistWorkspace();
}

function applyFictionalReviewAction(action, draftId, note) {
  // The fictional demo is intentionally browser-local: Vercel's /tmp is not a durable review store.
  const state = clone(currentListingReview);
  const review = state?.reviews?.find((item) => item.draftId === draftId);
  if (!review) return { ok: false, message: "That draft is no longer available." };
  const record = (event, message) => review.revisionHistory.push({
    action: event, note: message, at: new Date().toISOString()
  });
  if (action === "accept") {
    if (!review.proposed) return { ok: false, message: "No proposed revision is available." };
    review.working = clone(review.proposed);
    review.status = "accepted";
    record("accepted", "Human reviewer accepted the proposed revision for the next approval step.");
  } else if (action === "reject") {
    review.working = clone(review.original);
    review.status = "rejected";
    record("rejected", note);
  } else if (action === "restore_original") {
    review.working = clone(review.original);
    review.status = "original_restored";
    record("original_restored", "Human reviewer restored the original draft.");
  } else if (action === "request_revision") {
    if (review.automaticRevisionAttempts >= 2) {
      return { ok: false, message: "The maximum of two automatic revision attempts has been reached." };
    }
    const nextAttempt = review.automaticRevisionAttempts + 1;
    const candidate = review.revisionCandidates?.[nextAttempt];
    if (!candidate?.draft || candidate.status === "unavailable") {
      return { ok: false, message: "A safe revision was not available. The original draft was kept." };
    }
    review.automaticRevisionAttempts = nextAttempt;
    review.proposed = clone(candidate.draft);
    review.proposedSource = candidate.source;
    review.revisionStatus = candidate.status;
    review.revisionUnavailableReason = candidate.reason || null;
    review.changes = clone(candidate.changes || []);
    review.status = "revision_requested";
    review.suggestedImprovements.push({
      field: "review", recommendation: note,
      reason: "A human reviewer supplied this request; the candidate still requires approval."
    });
    record("revision_requested", note);
  } else {
    return { ok: false, message: "That review action is not supported." };
  }
  return { ok: true, listingReview: state };
}

async function refreshReviewFromServer() {
  if (!currentReviewId || currentPersistenceStatus === "fictional_demo_store") return;
  try {
    const response = await reviewFetch("/api/reviews/" + encodeURIComponent(currentReviewId), { cache: "no-store" });
    if (!response.ok) return;
    applyReviewServerState(await response.json());
    if (!modal.hidden) renderModal();
  } catch (error) {
    if (currentPersistenceStatus === "supabase") setDemoError(authClientErrorMessage(error));
  }
}

async function runReviewAction(action, note = "Human reviewer requested this action.") {
  const review = activeReview();
  if (!review || reviewActionInFlight) return;
  if (!currentReviewId || !Number.isInteger(currentReviewVersion)) {
    setDemoError("This saved review is from an older local session. Run the fictional test again before using review controls.");
    return;
  }
  reviewActionInFlight = true;
  renderOptimizerReview();
  try {
    if (currentPersistenceStatus === "fictional_demo_store") {
      const outcome = applyFictionalReviewAction(action, review.draftId, note);
      if (!outcome.ok) {
        setDemoError(outcome.message);
        return;
      }
      setDemoError();
      applyReviewServerState({ listingReview: outcome.listingReview, listingReviewVersion: currentReviewVersion + 1, persistenceStatus: "fictional_demo_store" });
      renderModal();
      return;
    }
    const response = await reviewFetch("/api/reviews/" + encodeURIComponent(currentReviewId) + "/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, draftId: review.draftId, note, expectedVersion: currentReviewVersion })
    });
    const payload = await response.json();
    if (!response.ok) {
      setDemoError(payload.message || "The review action could not be completed.");
      if (response.status === 409) await refreshReviewFromServer();
      return;
    }
    setDemoError();
    applyReviewServerState(payload);
    renderModal();
  } catch (error) {
    setDemoError(currentPersistenceStatus === "supabase"
      ? authClientErrorMessage(error)
      : "The local review store is not reachable. Your current browser copy was not changed.");
  } finally {
    reviewActionInFlight = false;
    renderOptimizerReview();
  }
}

async function runFictionalTest() {
  if (activeRequestController) return;
  const hadDrafts = currentDrafts.length > 0;
  const previousSummary = summary.textContent;
  currentWorkspaceAudience = isSupportedAudience(audienceValue.value)
    ? audienceValue.value
    : DEFAULT_RESEARCH_AUDIENCE;
  audienceValue.value = currentWorkspaceAudience;
  localStorage.setItem(AUDIENCE_SELECTION_STORAGE_KEY, currentWorkspaceAudience);
  const requestId = ++requestSequence;
  activeRequestController = new AbortController();
  setDemoError();
  setStatus("Creating drafts…", "muted");
  summary.textContent = "Running the fictional Content Creator test.";
  runTestButton.disabled = true;
  regenerateButton.disabled = true;
  audienceValue.disabled = true;

  try {
    const fixturePath = RESEARCH_FIXTURES[audienceValue.value] || RESEARCH_FIXTURES[DEFAULT_RESEARCH_AUDIENCE];
    const briefResponse = await fetch(fixturePath, { signal: activeRequestController.signal });
    if (!briefResponse.ok) throw new Error("fictional fixture unavailable");
    const brief = await briefResponse.json();
    brief.campaignAudienceMode = campaignAudienceMode.value;
    brief.startingFollowers = startingFollowers.value === "" ? null : Number(startingFollowers.value);
    brief.currentFollowers = currentFollowers.value === "" ? null : Number(currentFollowers.value);
    const response = await requestContentBrief(brief, activeRequestController.signal);
    const result = await response.json();
    if (requestId !== requestSequence) return;
    if (!response.ok) {
      if (hadDrafts) summary.textContent = previousSummary;
      setDemoError(result.message || "The local demo rejected the fictional brief.");
      setStatus("Request error", "error");
      return;
    }
    if (hadDrafts && (result.status !== "ready_for_review" || !Array.isArray(result.drafts) || !result.drafts.length)) {
      summary.textContent = previousSummary;
      setStatus("Previous drafts kept", "warning");
      setDemoError("Regeneration did not produce usable drafts. Your previous review is unchanged.");
      renderWriterDiagnostic(result);
      return;
    }
    if (Array.isArray(result.drafts) && result.drafts.length) archiveWorkspace();
    renderResult(result);
  } catch (error) {
    if (error?.name === "AbortError" || requestId !== requestSequence) return;
    if (hadDrafts) summary.textContent = previousSummary;
    setDemoError("Draft generation could not be reached. Your saved work is unchanged; please try again shortly.");
    setStatus("Demo unavailable", "error");
  } finally {
    if (requestId === requestSequence) {
      activeRequestController = null;
      runTestButton.disabled = false;
      regenerateButton.disabled = currentDrafts.length === 0;
      audienceValue.disabled = false;
    }
  }
}

themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
resetButton.addEventListener("click", requestReset);
resetCancel.addEventListener("click", () => {
  resetConfirmation.close();
  resetConfirmation.hidden = true;
  resetButton.focus();
});
resetConfirm.addEventListener("click", resetWorkspace);
updateGrowthPilot.addEventListener("click", () => renderGrowthPilot());
campaignAudienceMode.addEventListener("change", () => renderGrowthPilot());
audienceValue.addEventListener("change", () => {
  // Save the workspace that is being left before changing the active key.
  persistWorkspace();
  const nextAudience = isSupportedAudience(audienceValue.value)
    ? audienceValue.value
    : DEFAULT_RESEARCH_AUDIENCE;
  clearActiveWorkspace();
  currentWorkspaceAudience = nextAudience;
  audienceValue.value = currentWorkspaceAudience;
  localStorage.setItem(AUDIENCE_SELECTION_STORAGE_KEY, currentWorkspaceAudience);
  restoreWorkspace();
  restoreGrowthPilot();
});
startingFollowers.addEventListener("change", () => renderGrowthPilot());
currentFollowers.addEventListener("change", () => renderGrowthPilot());
authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAuthError();
  authSignIn.disabled = true;
  try {
    await authClient.signIn(authEmail.value, authPassword.value);
    authPassword.value = "";
    renderAuthState(authClient.session);
    if (currentPersistenceStatus === "supabase" && currentReviewId) await refreshReviewFromServer();
  } catch (error) {
    setAuthError(authClientErrorMessage(error));
  } finally {
    authSignIn.disabled = false;
  }
});
authRecoveryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAuthError();
  if (authRecoveryPassword.value !== authRecoveryConfirm.value) {
    setAuthError("The passwords do not match.");
    return;
  }
  authRecoverySubmit.disabled = true;
  try {
    await authClient.updatePassword(authRecoveryPassword.value);
    authRecoveryPassword.value = "";
    authRecoveryConfirm.value = "";
    recoveryMode = false;
    renderAuthState(authClient.session);
    await refreshTikTokStatus();
  } catch (error) {
    setAuthError(authClientErrorMessage(error));
  } finally {
    authRecoverySubmit.disabled = false;
  }
});
authSignOut.addEventListener("click", async () => {
  await authClient.signOut();
  renderAuthState(null);
  if (currentPersistenceStatus === "supabase") setDemoError("You are signed out. Sign in again to continue this saved review.");
  renderTikTokStatus({ status: "not_connected", scopes: [] });
});
connectTikTok.addEventListener("click", () => startTikTokAuthorization());
syncTikTokFollowers.addEventListener("click", syncTikTokFollowerCount);
openVideoViews.addEventListener("click", () => {
  viewsPanel.hidden = !viewsPanel.hidden;
  openVideoViews.setAttribute("aria-expanded", String(!viewsPanel.hidden));
  if (!viewsPanel.hidden && videoViewsAccess && !videoPages.length) void loadVideoViews();
});
authorizeVideoViews.addEventListener("click", () => startTikTokAuthorization({ includeVideoViews: true }));
refreshVideoViews.addEventListener("click", () => loadVideoViews());
previousVideoViews.addEventListener("click", () => {
  if (videoPageIndex > 0) { videoPageIndex -= 1; renderVideoViews(); }
});
nextVideoViews.addEventListener("click", () => {
  if (videoPages[videoPageIndex + 1]) { videoPageIndex += 1; renderVideoViews(); }
  else if (videoPages[videoPageIndex]?.hasMore) void loadVideoViews(videoPages[videoPageIndex].cursor, videoPageIndex + 1);
});

window.SellerSparkContentCreator = Object.freeze({
  requestBrief: requestContentBrief,
  getWorkspaceIdentity: () => ({ owner: authClient.session?.userId || "demo", audience: currentWorkspaceAudience }),
  getCalendarPrompts: () => createGrowthPilotView({ audienceMode: campaignAudienceMode.value }).calendar,
  getDraftSummaries: () => currentDrafts.map((draft, index) => ({ index, hook: draft.hook, angle: draft.angle, status: currentListingReview?.reviews?.[index]?.status || "pending" })),
  getCalendarDrafts: () => currentDrafts.map((draft, index) => ({
    index, ref: `${currentReviewId || "legacy"}:${currentListingReview?.reviews?.[index]?.draftId || index}`,
    status: currentListingReview?.reviews?.[index]?.status || "pending", draft: clone(draft)
  })),
  openReview: (index, mode = "approval") => {
    if (!Number.isInteger(index) || index < 0 || index >= currentDrafts.length) return false;
    setReviewMode(mode);
    openDraft(index);
    return true;
  }
});
runTestButton.addEventListener("click", runFictionalTest);
regenerateButton.addEventListener("click", runFictionalTest);
document.querySelector("#modal-close").addEventListener("click", closeDraft);
document.querySelector("#modal-close-footer").addEventListener("click", closeDraft);
document.querySelector(".modal-backdrop").addEventListener("click", closeDraft);
modalPrevious.addEventListener("click", () => {
  if (activeDraftIndex > 0) {
    activeDraftIndex -= 1;
    renderModal();
  }
});
modalNext.addEventListener("click", () => {
  if (activeDraftIndex < currentDrafts.length - 1) {
    activeDraftIndex += 1;
    renderModal();
  }
});
modalCopy.addEventListener("click", copyActiveDraft);
document.querySelector("#modal-next-step").addEventListener("click", closeDraft);
resetConfirmation.addEventListener("cancel", () => { resetConfirmation.hidden = true; });
optimizerAccept.addEventListener("click", () => runReviewAction("accept", "Human reviewer accepted this proposed revision for the next approval step."));
optimizerReject.addEventListener("click", () => runReviewAction("reject", "Human reviewer rejected this proposed revision; the original remains the working draft."));
optimizerRevision.addEventListener("click", () => runReviewAction("request_revision", "Human reviewer requested a revision."));
optimizerRestore.addEventListener("click", () => runReviewAction("restore_original", "Human reviewer restored the original draft."));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) closeDraft();
});

initializeTheme();
const savedAudience = localStorage.getItem(AUDIENCE_SELECTION_STORAGE_KEY);
currentWorkspaceAudience = isSupportedAudience(savedAudience) ? savedAudience : DEFAULT_RESEARCH_AUDIENCE;
audienceValue.value = currentWorkspaceAudience;
restoreGrowthPilot();
restoreWorkspace();
authClient.onAuthStateChange((session) => renderAuthState(session));
authClient.onAuthStateChange((session) => {
  if (session && currentReviewId && currentPersistenceStatus === "supabase") void refreshReviewFromServer();
});
authClient.onAuthStateChange(() => void refreshTikTokStatus());
authClient.onAuthStateChange((session) => {
  const nextOwner = session?.userId || null;
  if (nextOwner && nextOwner === videoViewsOwner) return;
  videoViewsOwner = nextOwner;
  videoViewsRequest += 1;
  videoViewsLoading = false;
  videoViewsAccess = false;
  videoPages = [];
  videoPageIndex = 0;
  videoViewsList.replaceChildren();
  viewsNote.textContent = "Connect TikTok and authorize video access to see views.";
  renderVideoViewControls();
});
void initializeAuth();

