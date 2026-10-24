import { verifyResearchBrief } from "./research-verification.js";
import { evaluateDraftSetQuality } from "./editorial-quality.js";
import { createCampaignMetadata } from "./growth-pilot.js";

export const REQUIRED_DRAFT_COUNT = 3;

export const SUPPORTED_AUDIENCES = Object.freeze({
  lic_condo_owner: "Long Island City condo owners",
  brooklyn_townhouse_owner: "Brooklyn townhouse owners"
});

const CREATIVE_ANGLES = Object.freeze([
  {
    angle: "Seller education",
    hook: "Selling your {property} someday? Start with the question you want answered.",
    script: "If selling your {property} is on your mind, start with the question you want answered: {question} Write one sentence about why that answer matters to you, then bring it to a conversation. That turns a broad concern into one useful thing to discuss.",
    takeaway: "Writing the exact question — {question} — and why its answer matters can make a broad seller concern easier to discuss.",
    caption: "The first step can be a question, not a commitment. Follow for more practical NYC seller guidance.",
    reasonToFollow: "Follow for more practical NYC seller questions you can bring to a future conversation.",
    suggestedNextStep: "Contact Shalinthia with this question when you are ready for a respectful seller conversation about your home.",
    videoConcept: "Direct-to-camera explainer for {property} owners that turns one supplied question into a focused first conversation.",
    suggestedScenes: [
      "Opening: show the supplied seller question as large on-screen text.",
      "Middle: write one sentence about why the answer matters to you.",
      "Close: invite the viewer to follow for more practical seller questions."
    ]
  },
  {
    angle: "Common seller mistakes",
    hook: "Before a seller conversation about your {property}, avoid this prep mistake.",
    script: "A practical seller mistake for {property} owners is bringing a broad goal but no details to discuss. Use this question as a checklist prompt: {question} Note the one building, unit, or home detail you want explained, so the conversation has a clear starting point.",
    takeaway: "Pair the supplied seller question — {question} — with one property detail you want explained before the conversation.",
    caption: "A question becomes more useful when you pair it with one detail you want explained. Follow for more NYC seller prompts.",
    reasonToFollow: "Follow for more NYC seller prompts that turn broad concerns into useful questions.",
    suggestedNextStep: "Contact Shalinthia with the question you wrote down if you want help sorting out what to ask next.",
    videoConcept: "Checklist-style short for {property} owners that shows how one written question can prevent a rushed conversation.",
    suggestedScenes: [
      "Opening: hold up a simple checklist labeled before the seller conversation.",
      "Middle: add the supplied question and one building, unit, or home detail.",
      "Close: invite the viewer to follow for more practical seller guidance."
    ]
  },
  {
    angle: "Decision-making questions",
    hook: "Not sure what to do next with your {property}? Ask this before you decide.",
    script: "Before deciding whether to move forward with a seller conversation about your {property}, ask this question: {question} Then make two notes: what you know and what you still need to learn. Your next step can answer the open question, not promise to list.",
    takeaway: "One open question — {question} — can help you choose an informed next conversation without promising to list.",
    caption: "You can gather information before making a decision. Follow for more calm questions for NYC homeowners.",
    reasonToFollow: "Follow for more calm NYC homeowner questions before making a selling decision.",
    suggestedNextStep: "Contact Shalinthia when you are ready to talk through this question and decide what information you still need.",
    videoConcept: "Question-led planning prompt for {property} owners that separates what they know from what they still want to learn.",
    suggestedScenes: [
      "Opening: use a calm title card with the supplied question.",
      "Middle: show two handwritten headings: know and still need to learn.",
      "Close: invite the viewer to follow for more calm seller questions."
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
    takeaway: creativePackage.takeaway
      .replace("{property}", propertyLabel)
      .replace("{audience}", audienceLabel)
      .replace("{question}", question),
    videoConcept: creativePackage.videoConcept
      .replace("{property}", propertyLabel)
      .replace("{audience}", audienceLabel),
    suggestedScenes: creativePackage.suggestedScenes,
    caption: creativePackage.caption
      .replace("{property}", propertyLabel)
      .replace("{audience}", audienceLabel),
    reasonToFollow: creativePackage.reasonToFollow
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
  const campaignMetadata = createCampaignMetadata(brief);
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
      ...campaignMetadata,
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
    editorialQuality: evaluateDraftSetQuality(drafts, {
      audienceLabel: SUPPORTED_AUDIENCES[brief.audience],
      researchTopics: brief.topics.slice(0, REQUIRED_DRAFT_COUNT)
    }),
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
    ...campaignMetadata,
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
