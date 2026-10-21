export const SUPPORTED_AUDIENCES = Object.freeze({
  lic_condo_owner: "Long Island City condo sellers",
  brooklyn_townhouse_owner: "Brooklyn townhouse sellers"
});

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function topicLabel(topic, index) {
  if (typeof topic?.title === "string" && topic.title.trim()) return topic.title.trim();
  if (typeof topic?.question === "string" && topic.question.trim()) return topic.question.trim();
  return "seller question " + String(index + 1);
}

function sourceId(source) {
  if (!source || typeof source !== "object") return null;
  return source.id ?? source.sourceId ?? source.referenceId ?? null;
}

function normalizeSourceRefs(topic) {
  const refs = Array.isArray(topic?.sourceRefs)
    ? topic.sourceRefs
    : Array.isArray(topic?.sources)
      ? topic.sources
      : [];

  return refs.map((ref) => copy(ref));
}

function sourceIds(refs) {
  return refs.map(sourceId).filter((id) => typeof id === "string" && id.length > 0);
}

function analyzeClaims(topic, refs) {
  const knownIds = new Set(sourceIds(refs));
  const claims = Array.isArray(topic?.claims) ? topic.claims : [];
  const claimsUsed = [];
  const unsupportedClaims = [];

  for (const claim of claims) {
    const id = claim?.sourceId ?? claim?.sourceRefId ?? claim?.referenceId;
    const unsupported =
      claim?.supported === false ||
      claim?.status === "unsupported" ||
      typeof id !== "string" ||
      !knownIds.has(id);

    if (unsupported) {
      unsupportedClaims.push({
        claim: copy(claim),
        reason: typeof id !== "string"
          ? "claim has no source reference"
          : !knownIds.has(id)
            ? "claim references a source not included in this topic"
            : "brief marks claim as unsupported"
      });
    } else {
      claimsUsed.push(copy(claim));
    }
  }

  return { claimsUsed, unsupportedClaims };
}

function missingBriefInformation(brief) {
  const missing = [];

  if (!brief || typeof brief !== "object") {
    return ["structured research brief is missing"];
  }
  if (!SUPPORTED_AUDIENCES[brief.audience]) {
    missing.push("audience must be lic_condo_owner or brooklyn_townhouse_owner");
  }
  if (!Array.isArray(brief.topics) || brief.topics.length === 0) {
    missing.push("brief must include at least one topic");
  }

  return missing;
}

function createDraft(brief, topic, index) {
  const refs = normalizeSourceRefs(topic);
  const claims = analyzeClaims(topic, refs);
  const label = topicLabel(topic, index);
  const audienceLabel = SUPPORTED_AUDIENCES[brief.audience];
  const warnings = [];

  if (refs.length === 0) {
    warnings.push("topic has no supplied source references");
  }
  for (const item of claims.unsupportedClaims) {
    warnings.push("unsupported claim omitted: " + item.reason);
  }

  const question = typeof topic.question === "string" && topic.question.trim()
    ? topic.question.trim()
    : "What should a " + audienceLabel.toLowerCase() + " ask before deciding whether to sell?";

  return {
    id: "content-draft-" + String(index + 1).padStart(2, "0"),
    audience: brief.audience,
    audienceLabel,
    researchTopicId: topic.id ?? null,
    hook: "Thinking about selling your " + audienceLabel.replace(" sellers", "") + "? Start with this question.",
    script: "If selling has crossed your mind, consider this question: " + question +
      " Use the supplied brief as context and speak with a qualified professional about your situation.",
    caption: "A seller question for " + audienceLabel + ". Save this draft for a human review.",
    hashtags: [
      "#NYCRealEstate",
      "#HomeSelling",
      "#SellerQuestions",
      brief.audience === "lic_condo_owner" ? "#LIC" : "#Brooklyn"
    ],
    suggestedNextStep: "Invite the viewer to save the question and contact Shalinthia for a human conversation if they want to discuss selling.",
    sourceRefs: refs,
    claimsUsed: claims.claimsUsed,
    warnings,
    unsupportedClaims: claims.unsupportedClaims,
    humanApprovalRequired: true,
    automaticallyPublished: false,
    customerContacted: false
  };
}

export function createContentDraft(brief) {
  const missingInformation = missingBriefInformation(brief);
  if (missingInformation.length > 0) {
    return {
      agent: "content_creator",
      status: "needs_more_research",
      drafts: [],
      missingInformation,
      unsupportedClaims: [],
      humanApprovalRequired: true,
      automaticallyPublished: false,
      customerContacted: false
    };
  }

  const drafts = brief.topics.map((topic, index) => createDraft(brief, topic, index));
  const unsupportedClaims = drafts.flatMap((draft) => draft.unsupportedClaims);
  const hasWarnings = drafts.some((draft) => draft.warnings.length > 0);

  return {
    agent: "content_creator",
    status: hasWarnings ? "needs_more_research" : "ready_for_review",
    audience: brief.audience,
    audienceLabel: SUPPORTED_AUDIENCES[brief.audience],
    researchBriefId: brief.id ?? null,
    drafts,
    missingInformation: drafts.flatMap((draft) =>
      draft.sourceRefs.length === 0
        ? ["topic " + (draft.researchTopicId ?? draft.id) + " has no source references"]
        : []
    ),
    unsupportedClaims,
    handoff: {
      reviewStatus: hasWarnings ? "needs_more_research" : "ready_for_review",
      sourceRefsPreserved: true,
      warningsIncluded: true,
      claimsUsedHaveReferences: drafts.every((draft) =>
        draft.claimsUsed.every((claim) =>
          typeof (claim.sourceId ?? claim.sourceRefId ?? claim.referenceId) === "string"
        )
      )
    },
    humanApprovalRequired: true,
    automaticallyPublished: false,
    customerContacted: false
  };
}
