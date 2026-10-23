import { verifyResearchBrief } from "./research-verification.js";

export const REQUIRED_DRAFT_COUNT = 3;

export const SUPPORTED_AUDIENCES = Object.freeze({
  lic_condo_owner: "Long Island City condo owners",
  brooklyn_townhouse_owner: "Brooklyn townhouse owners"
});

const CREATIVE_ANGLES = Object.freeze([
  {
    angle: "Seller education",
    hook: "Before you list your {property}, start with the question you want answered.",
    script: "If selling your {property} is on your mind, begin with one question: {question} Write it down before the first conversation. That gives you something concrete to ask and a way to tell whether the conversation was useful.",
    takeaway: "Bring one written question to a seller conversation so you can focus on the information you actually want to understand.",
    caption: "Clarity starts before the listing conversation. Save the question you want answered and bring it with you.",
    suggestedNextStep: "Contact Shalinthia with this question when you are ready for a respectful seller conversation about your home.",
    videoConcept: "Direct-to-camera explainer for {property} owners that turns one supplied question into a focused first conversation.",
    suggestedScenes: [
      "Opening: show the supplied seller question as large on-screen text.",
      "Middle: read the question and write one note about what you want to understand.",
      "Close: invite the viewer to save the question for a future seller conversation."
    ]
  },
  {
    angle: "Common seller mistakes",
    hook: "The seller mistake that can make a {property} conversation harder: arriving without a question list.",
    script: "A common seller mistake is showing up without one. Before discussing your {property}, write down this question: {question} Keep the list short so you can leave knowing what you still need to learn.",
    takeaway: "A short question list can keep the first seller conversation focused and easier to review afterward.",
    caption: "A first seller conversation does not need a perfect plan. Start with the question you already have.",
    suggestedNextStep: "Contact Shalinthia with the question you wrote down if you want help sorting out what to ask next.",
    videoConcept: "Checklist-style short for {property} owners that shows how one written question can prevent a rushed conversation.",
    suggestedScenes: [
      "Opening: hold up a simple checklist labeled before the seller conversation.",
      "Middle: put the supplied question on the list and leave room for one follow-up.",
      "Close: invite the viewer to save the checklist before choosing a next step."
    ]
  },
  {
    angle: "Decision-making questions",
    hook: "You do not need every answer before asking this about your {property}.",
    script: "You do not need every answer before the first conversation about your {property}. Ask yourself: {question} Then note what you still need to learn and decide what conversation would be useful next.",
    takeaway: "A useful first conversation can answer one clear question and help you name the next one.",
    caption: "You can ask for information before you decide. Save this prompt for a calmer next step.",
    suggestedNextStep: "Contact Shalinthia when you are ready to talk through this question and decide what information you still need.",
    videoConcept: "Question-led planning prompt for {property} owners that separates what they know from what they still want to learn.",
    suggestedScenes: [
      "Opening: use a calm title card with the supplied question.",
      "Middle: show two handwritten headings: know and still want to learn.",
      "Close: show a save reminder and an invitation to discuss the question without pressure."
    ]
  }
]);

const INTERNAL_VIEWER_LANGUAGE = [
  /use the supplied brief/i,
  /human review required/i,
  /based on the research input/i,
  /this is a fictional topic/i
];

function copy(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
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

function warningText(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  const message = value.message ?? value.text ?? value.reason;
  if (typeof message === "string" && message.trim()) return message.trim();
  return JSON.stringify(value);
}

function normalizeWarnings(topic, key) {
  const value = topic?.[key];
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return values.map(warningText).filter(Boolean);
}

function containsInternalViewerLanguage(value) {
  return INTERNAL_VIEWER_LANGUAGE.some((pattern) => pattern.test(value));
}

function topicKey(topic) {
  const value = typeof topic?.question === "string" && topic.question.trim()
    ? topic.question
    : topic?.title;
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    : "";
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

  if (!brief || typeof brief !== "object" || Array.isArray(brief)) {
    return ["structured research brief is missing or malformed"];
  }
  if (!SUPPORTED_AUDIENCES[brief.audience]) {
    missing.push("audience must be lic_condo_owner or brooklyn_townhouse_owner");
  }
  if (!Array.isArray(brief.topics)) {
    missing.push("brief topics must be an array");
    return missing;
  }
  if (brief.topics.length < REQUIRED_DRAFT_COUNT) {
    missing.push("brief must include at least three topics");
  }

  brief.topics.slice(0, REQUIRED_DRAFT_COUNT).forEach((topic, index) => {
    if (!topic || typeof topic !== "object" || Array.isArray(topic)) {
      missing.push("topic " + String(index + 1) + " is malformed");
      return;
    }
    if (
      (!("title" in topic) || typeof topic.title !== "string" || !topic.title.trim()) &&
      (!("question" in topic) || typeof topic.question !== "string" || !topic.question.trim())
    ) {
      missing.push("topic " + String(index + 1) + " needs a title or question");
    }
  });

  const topicKeys = brief.topics.slice(0, REQUIRED_DRAFT_COUNT).map(topicKey).filter(Boolean);
  if (topicKeys.length === REQUIRED_DRAFT_COUNT && new Set(topicKeys).size < REQUIRED_DRAFT_COUNT) {
    missing.push("brief needs three distinct research topics to support three distinct drafts");
  }

  return missing;
}

function createDraft(brief, topic, index) {
  const safeTopic = topic && typeof topic === "object" && !Array.isArray(topic) ? topic : {};
  const refs = normalizeSourceRefs(safeTopic);
  const claims = analyzeClaims(safeTopic, refs);
  const audienceLabel = SUPPORTED_AUDIENCES[brief.audience];
  const creativePackage = CREATIVE_ANGLES[index] ?? CREATIVE_ANGLES[0];
  const propertyLabel = audienceLabel.replace(" owners", "");
  const uncertaintyWarnings = [
    ...normalizeWarnings(safeTopic, "uncertaintyWarnings"),
    ...normalizeWarnings(safeTopic, "uncertainties")
  ];
  const suppliedWarnings = normalizeWarnings(safeTopic, "warnings");
  const warnings = [
    ...uncertaintyWarnings.map((warning) => "research uncertainty: " + warning),
    ...suppliedWarnings.map((warning) => "research warning: " + warning)
  ];

  if (refs.length === 0) {
    warnings.push("topic has no supplied source references");
  }
  for (const item of claims.unsupportedClaims) {
    warnings.push("unsupported claim omitted: " + item.reason);
  }

  const rawQuestion = typeof safeTopic.question === "string" && safeTopic.question.trim()
    ? safeTopic.question.trim()
    : "What would you want to understand about " + propertyLabel.toLowerCase() + " before deciding whether to sell?";
  const question = containsInternalViewerLanguage(rawQuestion)
    ? "What would you want to understand before deciding whether to sell?"
    : rawQuestion;

  if (question !== rawQuestion) {
    warnings.push("topic question contained internal language and was replaced with a neutral prompt");
  }

  return {
    id: "content-draft-" + String(index + 1).padStart(2, "0"),
    audience: brief.audience,
    audienceLabel,
    researchTopicId: safeTopic.id ?? null,
    angle: creativePackage.angle,
    hook: creativePackage.hook
      .replace("{property}", propertyLabel)
      .replace("{audience}", audienceLabel)
      .replace("{question}", question),
    script: creativePackage.script
      .replace("{property}", propertyLabel)
      .replace("{audience}", audienceLabel)
      .replace("{question}", question),
    takeaway: creativePackage.takeaway,
    videoConcept: creativePackage.videoConcept
      .replace("{property}", propertyLabel)
      .replace("{audience}", audienceLabel),
    suggestedScenes: creativePackage.suggestedScenes,
    caption: creativePackage.caption
      .replace("{property}", propertyLabel)
      .replace("{audience}", audienceLabel),
    hashtags: [
      "#NYCRealEstate",
      "#HomeSelling",
      "#SellerQuestions",
      brief.audience === "lic_condo_owner" ? "#LIC" : "#Brooklyn"
    ],
    suggestedNextStep: creativePackage.suggestedNextStep,
    sourceRefs: refs,
    uncertaintyWarnings: copy(uncertaintyWarnings),
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
  const researchVerification = verifyResearchBrief(brief);
  const verificationMissing = researchVerification.missingEvidence.map((item) => "research verification: " + item);
  const verificationUnsupported = researchVerification.unsupportedClaims;
  const verificationBlocked = researchVerification.status === "needs_more_research";
  if (
    !brief ||
    typeof brief !== "object" ||
    Array.isArray(brief) ||
    !SUPPORTED_AUDIENCES[brief.audience] ||
    !Array.isArray(brief.topics) ||
    missingInformation.length > 0 ||
    verificationBlocked
  ) {
    return {
      agent: "content_creator",
      writer: "offline_template",
      writerLabel: "Offline template writer",
      status: "needs_more_research",
      drafts: [],
      missingInformation: [...missingInformation, ...verificationMissing],
      unsupportedClaims: verificationUnsupported,
      researchVerification,
      humanApprovalRequired: true,
      automaticallyPublished: false,
      customerContacted: false
    };
  }

  const drafts = Array.isArray(brief.topics)
    ? brief.topics.slice(0, REQUIRED_DRAFT_COUNT).map((topic, index) => createDraft(brief, topic, index))
    : [];
  const unsupportedClaims = drafts.flatMap((draft) => draft.unsupportedClaims);
  const hasWarnings = missingInformation.length > 0 || drafts.some((draft) => draft.warnings.length > 0);

  return {
    agent: "content_creator",
    writer: "offline_template",
    writerLabel: "Offline template writer",
    status: hasWarnings ? "needs_more_research" : "ready_for_review",
    audience: brief.audience,
    audienceLabel: SUPPORTED_AUDIENCES[brief.audience] ?? null,
    researchBriefId: brief.id ?? null,
    drafts,
    missingInformation: [
      ...missingInformation,
      ...drafts.flatMap((draft) =>
        draft.sourceRefs.length === 0
          ? ["topic " + (draft.researchTopicId ?? draft.id) + " has no source references"]
          : []
      )
    ],
    unsupportedClaims,
    researchVerification,
    handoff: {
      reviewStatus: hasWarnings ? "needs_more_research" : "ready_for_review",
      sourceRefsPreserved: true,
      sourceDatesPreserved: true,
      warningsIncluded: true,
      researchVerificationStatus: researchVerification.status,
      publicDraftsAllowed: researchVerification.status === "verified",
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
