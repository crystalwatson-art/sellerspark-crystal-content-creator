const demoError = document.querySelector("#demo-error");
const statusValue = document.querySelector("#status-value");
const audienceValue = document.querySelector("#audience-value");
const audiencePill = document.querySelector("#audience-pill");
const summary = document.querySelector("#result-summary");
const resultDiagnostic = document.querySelector("#result-diagnostic");
const writerStatusValue = document.querySelector("#writer-status-value");
const writerExplanation = document.querySelector("#writer-explanation");
const writerNextStep = document.querySelector("#writer-next-step");
const drafts = document.querySelector("#drafts");
const emptyState = document.querySelector("#empty-state");
const themeToggle = document.querySelector("#theme-toggle");
const resetButton = document.querySelector("#reset-button");
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
const modalPosition = document.querySelector("#modal-position");
const modalPrevious = document.querySelector("#modal-prev");
const modalNext = document.querySelector("#modal-next");
const modalCopy = document.querySelector("#modal-copy");

let currentDrafts = [];
let activeDraftIndex = 0;
let previouslyFocusedElement = null;

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

function setStatus(text, kind = "muted") {
  statusValue.textContent = text === "ready_for_review" ? "Ready for review" : text;
  statusValue.className = "status-badge " + kind;
}

function renderWriterDiagnostic(result) {
  const isReady = result.status === "ready_for_review";
  resultDiagnostic.hidden = isReady;
  if (isReady) return;

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

function renderResult(result) {
  currentDrafts = result.drafts;
  drafts.replaceChildren();
  emptyState.hidden = currentDrafts.length > 0;
  setDemoError();

  const warningCount = currentDrafts.reduce((total, draft) => total + draft.warnings.length, 0);
  const writerLabel = result.writerLabel || result.writer || "Unidentified writer";
  summary.textContent = result.status === "ready_for_review"
    ? "Three distinct draft packages are ready for a future reviewer. Human approval is still required. Generated by " + writerLabel + "."
    : "The Content Creator stopped with information to resolve before review. Writer: " + writerLabel + ".";
  setStatus(result.status, result.status === "ready_for_review" ? "success" : "warning");
  renderWriterDiagnostic(result);
  audienceValue.textContent = result.audienceLabel || "Audience needs review";
  audiencePill.textContent = result.audienceLabel || "Audience needs review";

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

function resetWorkspace() {
  closeDraft();
  currentDrafts = [];
  drafts.replaceChildren();
  emptyState.hidden = false;
  audienceValue.textContent = "Awaiting brief";
  audiencePill.textContent = "Audience pending";
  summary.textContent = "Run fictional test mode to preview three compact, review-only draft packages.";
  setStatus("Ready to test", "muted");
  resultDiagnostic.hidden = true;
  setDemoError();
}

async function runFictionalTest() {
  setDemoError();
  setStatus("Creating drafts…", "muted");
  summary.textContent = "Running the fictional Content Creator test.";

  try {
    const briefResponse = await fetch("/fixtures/fictional-research-brief.json");
    if (!briefResponse.ok) throw new Error("fictional fixture unavailable");
    const brief = await briefResponse.json();
    const response = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brief)
    });
    const result = await response.json();
    if (!response.ok) {
      setDemoError(result.message || "The local demo rejected the fictional brief.");
      setStatus("Request error", "error");
      return;
    }
    renderResult(result);
  } catch {
    setDemoError("The fictional test mode is not reachable. Start it with npm run start.");
    setStatus("Demo unavailable", "error");
  }
}

themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
resetButton.addEventListener("click", resetWorkspace);
document.querySelector("#run-fictional-test").addEventListener("click", runFictionalTest);
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
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) closeDraft();
});

initializeTheme();
