/**
 * Crystal's adapter between Content Creator output and a future Listing
 * Optimizer review surface. Real-estate evaluation rules are injected through
 * evaluateDraft so Sha's rules can be added later without replacing this
 * review contract.
 */

export const MAX_AUTOMATIC_REVISIONS = 2;

const REVIEWABLE_FIELDS = Object.freeze([
  "hook",
  "script",
  "takeaway",
  "videoConcept",
  "caption",
  "hashtags",
  "suggestedNextStep"
]);

const REVIEWABLE_FIELD_LABELS = Object.freeze({
  hook: "Hook",
  script: "Script",
  takeaway: "Viewer takeaway",
  videoConcept: "Video concept",
  caption: "Caption",
  hashtags: "Hashtags",
  suggestedNextStep: "Suggested call to action"
});

function clone(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sourceLabel(reference) {
  if (!reference || typeof reference !== "object") return "supplied source";
  return reference.title || reference.id || reference.sourceId || "supplied source";
}

function defaultSuggestion(field, recommendation, reason) {
  return { field, recommendation, reason };
}

function propertyLabel(audienceLabel) {
  const label = asText(audienceLabel) || "home seller";
  return label.replace(/\s+owners?$/i, "").trim() || "home seller";
}

function revisionChange(field, before, after, reason) {
  return {
    field,
    label: REVIEWABLE_FIELD_LABELS[field] || field,
    before: clone(before),
    after: clone(after),
    reason
  };
}

function unavailableRevision(reason = "No configured revision provider is available for this research result.") {
  return {
    status: "unavailable",
    source: "none",
    draft: null,
    changes: [],
    reason
  };
}

function localRevision(draft, attempt = 0) {
  const property = propertyLabel(draft?.audienceLabel);
  const source = clone(draft);
  const angle = asText(draft?.angle);
  const alternatives = {
    "Seller education": [
      {
        hook: "Thinking of selling your " + property + "? Start with your timing, not a deadline.",
        script: "If selling your " + property + " is on your mind, you can start gathering information before you commit. Think about your ideal timing and the questions you would need answered. Bring those questions to an initial conversation when you are ready.",
        caption: "Thinking about timing is a first step, not a promise to list.",
        suggestedNextStep: "Make a short list of timing questions to discuss when you feel ready."
      },
      {
        hook: "You can explore selling your " + property + " without deciding today.",
        script: "Start with the timeline that works for you. What would you need to learn before choosing a date? Write down your questions and use a first conversation to explore possible next steps without committing.",
        caption: "Take your time. Information comes before a listing decision.",
        suggestedNextStep: "Write down your ideal timeline and one thing you need clarified."
      },
      {
        hook: "When might you sell your " + property + "? Begin with a plan.",
        script: "You don't need a firm listing date to start planning. Note what matters to your timing, list what you still need to know, and take your questions to a seller consultation when it feels useful.",
        caption: "A little planning can make the first conversation clearer.",
        suggestedNextStep: "Save your timing questions for a future conversation."
      }
    ],
    "Common seller mistakes": [
      {
        hook: "One seller prep mistake: showing up without your " + property + " details.",
        script: "Before discussing a possible sale, make a simple checklist of the property details you know and the ones you want clarified. For a condo, that could mean questions about the building or unit. The point is to arrive prepared, not to know every answer.",
        caption: "Bring a property checklist, not just a general goal.",
        suggestedNextStep: "List three property details to confirm before your first seller conversation."
      },
      {
        hook: "Before discussing your " + property + ", gather these basics.",
        script: "Don't rush into a seller conversation with only a general goal. Collect the basic details about your home and make a note of anything unclear. That gives you a practical starting point for a more focused conversation.",
        caption: "A few notes can make your next conversation more useful.",
        suggestedNextStep: "Create a short home-details checklist you can bring with you."
      },
      {
        hook: "Preparing to discuss your " + property + "? Skip the guesswork.",
        script: "Write down the home details you can confirm, and mark the questions you still have. Use that checklist when you speak with a real estate professional. You don't need to fill in the blanks by guessing.",
        caption: "Know what you know, and ask about the rest.",
        suggestedNextStep: "Check your property notes and flag anything that needs an answer."
      }
    ],
    "Decision-making questions": [
      {
        hook: "Not ready to list your " + property + "? That's a valid next step.",
        script: "You can have an information-gathering conversation without committing to sell. Ask yourself what would make that first discussion useful and low-pressure. Separate what you already know from what you'd like to learn, then decide whether a conversation would help.",
        caption: "Getting answers and making a listing decision are two different things.",
        suggestedNextStep: "Write down what would make an initial conversation feel useful to you."
      },
      {
        hook: "Unsure about your " + property + "? Find clarity before commitment.",
        script: "Make two short lists: what you know and what you're still unsure about. A seller conversation can help answer those questions. You remain free to decide later whether listing is right for you.",
        caption: "The first conversation can be about learning, not listing.",
        suggestedNextStep: "Choose one unanswered question for a low-pressure consultation."
      },
      {
        hook: "Your " + property + " decision can wait while you gather facts.",
        script: "Before you commit to any next step, think about the information that would help you feel prepared. Ask those questions first, take notes on the answers, and decide what happens next on your own timeline.",
        caption: "Clarity first. The decision stays yours.",
        suggestedNextStep: "Keep a list of outstanding questions and revisit your decision when ready."
      }
    ]
  };
  const variants = alternatives[angle] || alternatives["Seller education"];
  const variant = variants[Math.min(Math.max(Number(attempt) || 0, 0), variants.length - 1)];
  const proposed = { ...source, ...variant };
  const reasons = {
    hook: "Makes this draft's particular angle clear without inventing market facts.",
    script: "Uses a natural spoken sequence that differs from the other draft angles.",
    caption: "Complements the spoken message with a separate takeaway.",
    suggestedNextStep: "Offers a specific, low-pressure step while leaving the choice with the homeowner."
  };
  const changes = ["hook", "script", "caption", "suggestedNextStep"]
    .filter((field) => JSON.stringify(source[field]) !== JSON.stringify(proposed[field]))
    .map((field) => revisionChange(field, source[field], proposed[field], reasons[field]));
  return { status: changes.length ? "available" : "no_change_needed", source: "local_fictional_demo", draft: proposed, changes };
}

function revisionProposal(draft, contentResult, options = {}, attempt = 0) {
  if (typeof options.revisionGenerator === "function") {
    const generated = options.revisionGenerator(clone(draft), {
      contentResult: clone(contentResult),
      brief: clone(options.brief),
      attempt
    });
    if (generated && typeof generated.then === "function") {
      return generated.then((value) => value && typeof value === "object" ? clone(value) : unavailableRevision());
    }
    if (generated && typeof generated === "object") return clone(generated);
  }

  if (contentResult?.researchVerification?.status === "fictional_test_only") {
    return localRevision(draft, attempt);
  }

  return unavailableRevision();
}

/**
 * This evaluator intentionally checks only content handoff hygiene. It does
 * not score property quality, market conditions, pricing, or legal claims.
 * Those rules belong to a future injected evaluator owned by Sha's work.
 */
export function evaluateContentDraft(draft, context = {}) {
  const suggestions = [];
  const factualSupportWarnings = [];
  const missingEvidence = [];
  const audienceLabel = asText(draft?.audienceLabel) || "the intended homeowner audience";

  if (!asText(draft?.hook)) {
    suggestions.push(defaultSuggestion(
      "hook",
      "Add a concise seller question that names the intended audience.",
      "A clear opening helps a reviewer confirm who the draft is for."
    ));
  } else {
    suggestions.push(defaultSuggestion(
      "hook",
      "Confirm the opening stays specific to " + audienceLabel + ".",
      "Audience-specific language helps prevent the draft from being reused for the wrong homeowner group."
    ));
  }

  if (!asText(draft?.script)) {
    suggestions.push(defaultSuggestion(
      "script",
      "Add a short spoken explanation with one practical next step.",
      "A reviewer needs a usable spoken draft before approving content."
    ));
  }

  if (!asText(draft?.takeaway)) {
    suggestions.push(defaultSuggestion(
      "takeaway",
      "Add one concrete viewer takeaway supported by the supplied brief.",
      "The takeaway makes the practical value visible without promising an outcome."
    ));
  }

  if (!asText(draft?.caption)) {
    suggestions.push(defaultSuggestion(
      "caption",
      "Add a caption that complements the script instead of repeating it.",
      "A separate caption gives the reviewer another place to clarify the viewer action."
    ));
  } else if (draft.caption.trim() === asText(draft?.script)) {
    suggestions.push(defaultSuggestion(
      "caption",
      "Rewrite the caption so it adds context rather than copying the script.",
      "Repeated copy gives the viewer no additional reason to save or review the post."
    ));
  }

  const sourceRefs = Array.isArray(draft?.sourceRefs) ? draft.sourceRefs : [];
  if (sourceRefs.length === 0) {
    missingEvidence.push("No source reference is attached to this draft.");
  }

  if (Array.isArray(draft?.unsupportedClaims) && draft.unsupportedClaims.length > 0) {
    draft.unsupportedClaims.forEach((item) => {
      factualSupportWarnings.push("Unsupported claim requires review: " + (item.reason || "source support is incomplete."));
    });
  }

  if (Array.isArray(draft?.warnings)) factualSupportWarnings.push(...draft.warnings);
  if (context.researchVerification?.status === "needs_more_research") {
    missingEvidence.push(...(context.researchVerification.missingEvidence || []));
    factualSupportWarnings.push(...(context.researchVerification.warnings || []));
  }
  if (context.researchVerification?.status === "fictional_test_only") {
    factualSupportWarnings.push("Fictional test data is not verified real-world research.");
  }

  const references = sourceRefs.map(sourceLabel).join(", ");
  if (references) {
    suggestions.push(defaultSuggestion(
      "sources",
      "Confirm the attached references and dates before any human approval.",
      "The adapter preserves supplied attribution but does not independently verify sources."
    ));
  }

  return { suggestedImprovements: suggestions, factualSupportWarnings, missingEvidence };
}

function reviewForDraft(draft, contentResult, evaluateDraft, options = {}) {
  const evaluation = evaluateDraft(draft, {
    researchVerification: contentResult.researchVerification,
    audience: contentResult.audience
  }) || {};
  const original = {};
  REVIEWABLE_FIELDS.forEach((field) => { original[field] = clone(draft[field]); });
  original.sourceRefs = clone(draft.sourceRefs || []);
  original.warnings = clone(draft.warnings || []);
  original.unsupportedClaims = clone(draft.unsupportedClaims || []);
  const proposal = contentResult?.researchVerification?.status === "fictional_test_only"
    ? localRevision(draft, 0)
    : unavailableRevision();
  const revisionCandidates = contentResult?.researchVerification?.status === "fictional_test_only"
    ? [0, 1, 2].map((attempt) => revisionProposal(draft, contentResult, options, attempt))
    : [proposal];

  return {
    draftId: draft.id,
    audience: draft.audience,
    audienceLabel: draft.audienceLabel,
    original,
    working: clone(original),
    sourceRefs: clone(draft.sourceRefs || []),
    warnings: clone(draft.warnings || []),
    unsupportedClaims: clone(draft.unsupportedClaims || []),
    proposed: clone(proposal.draft),
    proposedSource: proposal.source,
    revisionStatus: proposal.status,
    revisionUnavailableReason: proposal.reason || null,
    changes: clone(proposal.changes || []),
    revisionCandidates: clone(revisionCandidates),
    suggestedImprovements: clone(evaluation.suggestedImprovements || []),
    factualSupportWarnings: clone(evaluation.factualSupportWarnings || []),
    missingEvidence: clone(evaluation.missingEvidence || []),
    status: "pending",
    automaticRevisionAttempts: 0,
    revisionHistory: []
  };
}

/**
 * Convert a Content Creator response into the stable review contract used by
 * the dashboard and future optimizer work. No content is published here.
 */
export function adaptContentResultToListingReview(contentResult, options = {}) {
  const evaluateDraft = options.evaluateDraft || evaluateContentDraft;
  const drafts = Array.isArray(contentResult?.drafts) ? contentResult.drafts : [];
  const canReview = contentResult?.status === "ready_for_review" && drafts.length > 0;
  const blockedEvidence = [
    ...(contentResult?.missingInformation || []),
    ...(contentResult?.researchVerification?.missingEvidence || [])
  ];

  return {
    agent: "listing_optimizer",
    status: canReview ? "ready_for_human_review" : "blocked",
    audience: contentResult?.audience || null,
    audienceLabel: contentResult?.audienceLabel || null,
    reviews: canReview ? drafts.map((draft) => reviewForDraft(draft, contentResult, evaluateDraft, options)) : [],
    blockedEvidence: [...new Set(blockedEvidence)],
    factualSupportWarnings: [...new Set(contentResult?.researchVerification?.warnings || [])],
    revisionLimit: MAX_AUTOMATIC_REVISIONS,
    humanApprovalRequired: true,
    automaticallyPublished: false,
    customerContacted: false,
    publicationDisabled: true,
    evaluator: options.evaluatorName || "handoff_hygiene_only"
  };
}

function findReview(state, draftId) {
  return state.reviews.find((review) => review.draftId === draftId) || null;
}

function record(review, action, note) {
  review.revisionHistory.push({
    action,
    note: note || null,
    at: new Date().toISOString()
  });
}

function revisionDraft(review) {
  return {
    ...review.original,
    ...review.working,
    id: review.draftId,
    audience: review.audience,
    audienceLabel: review.audienceLabel
  };
}

function commitRevision(state, review, proposal, note) {
  if (!proposal?.draft) {
    review.status = "revision_unavailable";
    review.proposed = null;
    review.proposedSource = proposal?.source || "none";
    review.revisionStatus = "unavailable";
    review.revisionUnavailableReason = proposal?.reason || "The configured revision provider did not return a safe proposal.";
    review.changes = [];
    record(review, "revision_unavailable", review.revisionUnavailableReason);
    return { ok: false, reason: "revision_unavailable", state: clone(state) };
  }

  review.proposed = clone(proposal.draft);
  review.proposedSource = proposal.source;
  review.revisionStatus = proposal.status;
  review.revisionUnavailableReason = proposal.reason || null;
  review.changes = clone(proposal.changes || []);
  review.status = "revision_requested";
  review.suggestedImprovements.push(defaultSuggestion(
    "review",
    note,
    "A human reviewer supplied this revision request; the candidate remains subject to human approval."
  ));
  record(review, "revision_requested", note);
  return { ok: true, state: clone(state) };
}

/**
 * Apply one human review action to a review state. The revision path may be
 * asynchronous when a configured Groq/Gemini generator is used; all other
 * actions remain synchronous for the local adapter and existing tests.
 */
export function applyListingReviewAction(state, {
  action,
  draftId,
  note = "Human reviewer requested a revision."
} = {}, options = {}) {
  const review = findReview(state, draftId);
  if (!review) return { ok: false, reason: "draft_not_found", state: clone(state) };

  if (action === "accept") {
    if (!review.proposed) return { ok: false, reason: "revision_unavailable", state: clone(state) };
    review.working = clone(review.proposed);
    review.status = "accepted";
    record(review, "accepted", "Human reviewer accepted this proposed revision for the next approval step.");
    return { ok: true, state: clone(state) };
  }

  if (action === "reject") {
    review.working = clone(review.original);
    review.status = "rejected";
    record(review, "rejected", note || "Human reviewer rejected this proposed revision; the original remains the working draft.");
    return { ok: true, state: clone(state) };
  }

  if (action === "restore_original") {
    review.working = clone(review.original);
    review.status = "original_restored";
    record(review, "original_restored", "Human reviewer restored the original draft.");
    return { ok: true, state: clone(state) };
  }

  if (action !== "request_revision") {
    return { ok: false, reason: "unknown_action", state: clone(state) };
  }

  const limit = options.maxAutomaticRevisions ?? MAX_AUTOMATIC_REVISIONS;
  if (review.automaticRevisionAttempts >= limit) {
    review.status = "revision_limit_reached";
    record(review, "revision_limit_reached", "No more automatic revision attempts are allowed.");
    return { ok: false, reason: "revision_limit_reached", state: clone(state) };
  }

  const attempt = review.automaticRevisionAttempts + 1;
  const hasConfiguredGenerator = typeof options.revisionGenerator === "function";
  const candidate = review.revisionCandidates?.[attempt];
  const usableCandidate = candidate && candidate.status !== "unavailable" ? candidate : null;
  if (review.revisionStatus === "unavailable" && !hasConfiguredGenerator && !usableCandidate) {
    review.status = "revision_unavailable";
    record(review, "revision_unavailable", review.revisionUnavailableReason || "No revision provider is configured.");
    return { ok: false, reason: "revision_unavailable", state: clone(state) };
  }

  review.automaticRevisionAttempts = attempt;
  const nextProposal = usableCandidate || revisionProposal(
    revisionDraft(review),
    options.contentResult || null,
    options,
    attempt
  );
  if (nextProposal && typeof nextProposal.then === "function") {
    return nextProposal.then((proposal) => commitRevision(state, review, proposal, note));
  }
  return commitRevision(state, review, nextProposal, note);
}

/**
 * Small in-memory review session for the local UI and tests. A revision is a
 * human request recorded for later work; this adapter never invents revised
 * copy or calls a provider. State is intentionally not persisted.
 */
export function createListingReviewSession(contentResult, options = {}) {
  const state = clone(adaptContentResultToListingReview(contentResult, options));

  return {
    getState() {
      return clone(state);
    },
    accept(draftId) {
      return applyListingReviewAction(state, { action: "accept", draftId });
    },
    reject(draftId, note = "Human reviewer rejected this draft for revision.") {
      return applyListingReviewAction(state, { action: "reject", draftId, note });
    },
    requestRevision(draftId, note = "Human reviewer requested a revision.") {
      return applyListingReviewAction(state, { action: "request_revision", draftId, note }, {
        ...options,
        brief: options.brief
      });
    },
    restoreOriginal(draftId) {
      return applyListingReviewAction(state, { action: "restore_original", draftId });
    }
  };
}
