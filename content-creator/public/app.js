import { BrowserSupabaseAuth, authClientErrorMessage } from "./supabase-auth.js";

const demoError = document.querySelector("#demo-error");
const statusValue = document.querySelector("#status-value");
const audienceValue = document.querySelector("#audience-value");
const audiencePill = document.querySelector("#audience-pill");
const summary = document.querySelector("#result-summary");
const resultDiagnostic = document.querySelector("#result-diagnostic");
const runTestButton = document.querySelector("#run-fictional-test");
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
const authStatus = document.querySelector("#auth-status");
const authForm = document.querySelector("#auth-form");
const authEmail = document.querySelector("#auth-email");
const authPassword = document.querySelector("#auth-password");
const authSignIn = document.querySelector("#auth-sign-in");
const authSignOut = document.querySelector("#auth-sign-out");
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
const authClient = new BrowserSupabaseAuth();

const WORKSPACE_STORAGE_KEY = "sellerspark-listing-review-workspace-v1";
const REVIEW_ARCHIVE_STORAGE_KEY = "sellerspark-listing-review-archive-v1";
const REVIEWABLE_FIELDS = Object.freeze([
  ["hook", "Hook"],
  ["script", "Script"],
  ["takeaway", "Viewer takeaway"],
  ["videoConcept", "Video concept"],
  ["caption", "Caption"],
  ["hashtags", "Hashtags"],
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
}

function setAuthError(message = "") {
  authError.textContent = message;
  authError.hidden = !message;
}

function renderAuthState(session = authClient.session) {
  if (!authClient.enabled) {
    authForm.hidden = true;
    authSignOut.hidden = true;
    authStatus.textContent = "Fictional demo available without sign-in";
    return;
  }
  authForm.hidden = false;
  const signedIn = Boolean(session?.accessToken);
  authEmail.hidden = signedIn;
  authPassword.hidden = signedIn;
  authSignIn.hidden = signedIn;
  authSignOut.hidden = !signedIn;
  authStatus.textContent = signedIn
    ? "Signed in · saved reviews use your account"
    : "Sign in to save and review persistent records";
}

async function initializeAuth() {
  try {
    const response = await fetch("/api/auth-config", { cache: "no-store" });
    const config = await response.json();
    if (config?.enabled && config.url && config.anonKey) {
      authClient.configure({ url: config.url, anonKey: config.anonKey });
      const session = await authClient.getSession();
      renderAuthState(session);
    } else {
      authClient.configure({ url: "", anonKey: "" });
      authClient.saveSession(null);
      renderAuthState(null);
    }
  } catch {
    authStatus.textContent = "Fictional demo available without sign-in";
    authForm.hidden = true;
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
  themeToggle.querySelector(".theme-label").textContent = isDark ? "Light mode" : "Dark mode";
  themeToggle.querySelector(".theme-icon").textContent = isDark ? "☼" : "◐";
  localStorage.setItem("sellerspark-theme", isDark ? "dark" : "light");
}

function initializeTheme() {
  const savedTheme = localStorage.getItem("sellerspark-theme");
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  setTheme(savedTheme || (prefersDark ? "dark" : "light"));
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

function persistWorkspace() {
  if (currentPersistenceStatus === "supabase" || !currentDrafts.length || !currentListingReview) return;
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({
      drafts: clone(currentDrafts),
      editorialQuality: clone(currentEditorialQuality),
      listingReview: clone(currentListingReview),
      listingReviewId: currentReviewId,
      listingReviewVersion: currentReviewVersion,
      persistenceStatus: currentPersistenceStatus,
      audience: audienceValue.textContent,
      audiencePill: audiencePill.textContent,
      summary: summary.textContent,
      status: statusValue.textContent,
      savedAt: new Date().toISOString()
    }));
  } catch {
    // Persistence is a convenience; review controls remain usable in memory.
  }
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
  try {
    const saved = JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY) || "null");
    if (!saved || !Array.isArray(saved.drafts) || !saved.listingReview) return;
    if (saved.persistenceStatus === "supabase") {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
      return;
    }
    currentDrafts = saved.drafts;
    currentEditorialQuality = saved.editorialQuality || null;
    currentListingReview = saved.listingReview;
    currentReviewId = saved.listingReviewId || null;
    currentReviewVersion = Number.isInteger(saved.listingReviewVersion) ? saved.listingReviewVersion : null;
    currentPersistenceStatus = saved.persistenceStatus || "fictional_demo_store";
    emptyState.hidden = currentDrafts.length > 0;
    audienceValue.textContent = saved.audience || currentListingReview.audienceLabel || "Audience needs review";
    audiencePill.textContent = saved.audiencePill || currentListingReview.audienceLabel || "Audience needs review";
    summary.textContent = (saved.summary || "Saved review restored.") + " Saved locally for this browser.";
    setStatus(saved.status || "Ready for review", "success");
    renderDraftCards();
    if (currentReviewId) void refreshReviewFromServer();
  } catch {
    localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  }
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
      openDraft(index);
    });
    cardBottom.append(sourceCount, preview);

    card.append(cardTop, title, excerpt, cardBottom);
    card.addEventListener("click", () => openDraft(index));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDraft(index);
      }
    });
    drafts.append(card);
  });
}

function renderResult(result) {
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
    ? "Three distinct draft packages are ready for a future reviewer. Human approval is still required. Generated by " + writerLabel + "."
    : "The Content Creator stopped with information to resolve before review. Writer: " + writerLabel + ".";
  setStatus(result.status, result.status === "ready_for_review" ? "success" : "warning");
  renderWriterDiagnostic(result);
  audienceValue.textContent = result.audienceLabel || "Audience needs review";
  audiencePill.textContent = result.audienceLabel || "Audience needs review";
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
  resetConfirm.focus();
}

function resetWorkspace() {
  requestSequence += 1;
  activeRequestController?.abort();
  activeRequestController = null;
  runTestButton.disabled = false;
  archiveWorkspace();
  localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  closeDraft();
  currentDrafts = [];
  currentEditorialQuality = null;
  currentListingReview = null;
  currentReviewId = null;
  currentReviewVersion = null;
  currentPersistenceStatus = "fictional_demo_store";
  drafts.replaceChildren();
  emptyState.hidden = false;
  audienceValue.textContent = "Awaiting brief";
  audiencePill.textContent = "Audience pending";
  summary.textContent = "Active review reset. Saved review history remains on this browser.";
  setStatus("Ready to test", "muted");
  resultDiagnostic.hidden = true;
  setDemoError();
  resetConfirmation.hidden = true;
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
  const requestId = ++requestSequence;
  activeRequestController = new AbortController();
  setDemoError();
  setStatus("Creating drafts…", "muted");
  summary.textContent = "Running the fictional Content Creator test.";
  runTestButton.disabled = true;

  try {
    const briefResponse = await fetch("/fixtures/fictional-research-brief.json", { signal: activeRequestController.signal });
    if (!briefResponse.ok) throw new Error("fictional fixture unavailable");
    const brief = await briefResponse.json();
    const response = await requestContentBrief(brief, activeRequestController.signal);
    const result = await response.json();
    if (requestId !== requestSequence) return;
    if (!response.ok) {
      setDemoError(result.message || "The local demo rejected the fictional brief.");
      setStatus("Request error", "error");
      return;
    }
    renderResult(result);
  } catch (error) {
    if (error?.name === "AbortError" || requestId !== requestSequence) return;
    setDemoError("The fictional test mode is not reachable. Start it with npm run start.");
    setStatus("Demo unavailable", "error");
  } finally {
    if (requestId === requestSequence) {
      activeRequestController = null;
      runTestButton.disabled = false;
    }
  }
}

themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
resetButton.addEventListener("click", requestReset);
resetCancel.addEventListener("click", () => {
  resetConfirmation.hidden = true;
  resetButton.focus();
});
resetConfirm.addEventListener("click", resetWorkspace);
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
authSignOut.addEventListener("click", async () => {
  await authClient.signOut();
  renderAuthState(null);
  if (currentPersistenceStatus === "supabase") setDemoError("You are signed out. Sign in again to continue this saved review.");
});

window.SellerSparkContentCreator = Object.freeze({ requestBrief: requestContentBrief });
runTestButton.addEventListener("click", runFictionalTest);
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
optimizerAccept.addEventListener("click", () => runReviewAction("accept", "Human reviewer accepted this proposed revision for the next approval step."));
optimizerReject.addEventListener("click", () => runReviewAction("reject", "Human reviewer rejected this proposed revision; the original remains the working draft."));
optimizerRevision.addEventListener("click", () => runReviewAction("request_revision", "Human reviewer requested a revision."));
optimizerRestore.addEventListener("click", () => runReviewAction("restore_original", "Human reviewer restored the original draft."));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) closeDraft();
});

initializeTheme();
restoreWorkspace();
authClient.onAuthStateChange((session) => renderAuthState(session));
void initializeAuth();
