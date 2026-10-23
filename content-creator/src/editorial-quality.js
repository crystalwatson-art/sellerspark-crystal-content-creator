const UNSUPPORTED_EDITORIAL_LANGUAGE = [
  /\bguarantee(?:d)?\b/i,
  /\btrending\b/i,
  /\b(?:median|average price)\b/i,
  /\bmarket is\b/i,
  /\bprices? (?:are|will|have)\b/i,
  /\$\s?\d/i,
  /\b\d+(?:\.\d+)?%/i
];

const INTERNAL_EDITORIAL_LANGUAGE = [
  /use the supplied brief/i,
  /human review required/i,
  /based on the research input/i,
  /this is a fictional topic/i
];

export const EDITORIAL_CRITERIA = Object.freeze([
  "hook_strength",
  "topic_distinctiveness",
  "homeowner_relevance",
  "natural_spoken_delivery",
  "practical_viewer_value",
  "reason_to_follow",
  "credibility_source_safety",
  "consultation_next_step_clarity"
]);

const EDITORIAL_STOP_WORDS = new Set([
  "a", "about", "after", "all", "and", "are", "as", "at", "be", "before", "but", "by",
  "can", "could", "do", "for", "from", "get", "has", "have", "how", "i", "if", "in",
  "is", "it", "its", "make", "me", "my", "not", "of", "on", "one", "or", "our", "should",
  "so", "some", "that", "the", "their", "there", "this", "to", "understand", "use", "want",
  "what", "when", "which", "who", "why", "with", "would", "you", "your"
]);

const GENERIC_TOPIC_WORDS = new Set([
  "ask", "asking", "answer", "answers", "conversation", "conversations", "home", "homeowner",
  "homeowners", "question", "questions", "seller", "sellers", "selling", "sell", "talk",
  "topic", "plan", "planning", "decision", "decisions", "information", "learn", "learning"
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
function normalized(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function words(value) {
  return text(value).split(/\s+/).filter(Boolean);
}

function token(value) {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!cleaned) return "";
  return cleaned.length > 4 && cleaned.endsWith("s") ? cleaned.slice(0, -1) : cleaned;
}

function meaningfulTokens(value) {
  return new Set(words(value)
    .map(token)
    .filter((word) => word.length >= 3 && !EDITORIAL_STOP_WORDS.has(word) && !GENERIC_TOPIC_WORDS.has(word)));
}

function hasAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

function criterion(pass, reason) {
  return { pass, reason };
}

function overlap(left, right) {
  const a = new Set(words(left).map(normalized).filter(Boolean));
  const b = new Set(words(right).map(normalized).filter(Boolean));
  if (!a.size || !b.size) return 0;
  const common = [...a].filter((word) => b.has(word)).length;
  return common / Math.max(a.size, b.size);
}

function meaningfulOverlap(left, right) {
  const a = meaningfulTokens(left);
  const b = meaningfulTokens(right);
  if (!a.size || !b.size) return 0;
  const common = [...a].filter((word) => b.has(word)).length;
  return common / Math.max(a.size, b.size);
}

function topicTokens(topic) {
  if (!topic || typeof topic !== "object") return new Set();
  return meaningfulTokens([topic.title, topic.question].filter(Boolean).join(" "));
}

function intersection(left, right) {
  return [...left].filter((word) => right.has(word));
}

function expectedAudience(audienceLabel) {
  return audienceLabel.includes("Brooklyn") ? /Brooklyn townhouse/i : /Long Island City condo/i;
}

function forbiddenAudience(audienceLabel) {
  return audienceLabel.includes("Brooklyn") ? /Long Island City condo/i : /Brooklyn townhouse/i;
}

function evaluateDraft(draft, index, drafts, audienceLabel, researchTopics) {
  const hook = text(draft?.hook);
  const script = text(draft?.script);
  const caption = text(draft?.caption);
  const takeaway = text(draft?.takeaway);
  const nextStep = text(draft?.suggestedNextStep);
  const allViewerText = [hook, script, caption, takeaway, nextStep].join(" ");
  const peerDrafts = drafts.filter((_, peerIndex) => peerIndex !== index);
  const duplicateHook = peerDrafts.some((peer) => normalized(peer?.hook) === normalized(hook));
  const adviceText = [script, takeaway].join(" ");
  const repeatedScript = peerDrafts.some((peer) =>
    overlap(script, peer?.script) >= 0.8 ||
    meaningfulOverlap(adviceText, [peer?.script, peer?.takeaway].join(" ")) >= 0.62 ||
    meaningfulOverlap(takeaway, peer?.takeaway) >= 0.72
  );
  const audienceMatch = expectedAudience(audienceLabel).test(allViewerText) &&
    !forbiddenAudience(audienceLabel).test(allViewerText);
  const assignedTopic = Array.isArray(researchTopics) ? researchTopics[index] : null;
  const assignedTopicTokens = topicTokens(assignedTopic);
  const viewerTokens = meaningfulTokens(allViewerText);
  const takeawayTokens = meaningfulTokens(takeaway);
  const topicEvidence = intersection(assignedTopicTokens, viewerTokens);
  const takeawayEvidence = intersection(assignedTopicTokens, takeawayTokens);
  const topicEvidenceAvailable = assignedTopicTokens.size > 0;
  const topicGrounded = topicEvidenceAvailable && topicEvidence.length >= 2 && takeawayEvidence.length >= 1;
  const followCopy = caption + " " + nextStep;
  const hasFollowReason = /\bfollow\b[\s\S]{0,80}\b(?:for|to)\b/i.test(followCopy) &&
    /\b(?:more|practical|calm|specific|useful|guidance|prompt|question|checklist|tips?)\b/i.test(followCopy);
  const sourceIds = new Set((Array.isArray(draft?.sourceRefs) ? draft.sourceRefs : [])
    .map((source) => source?.id ?? source?.sourceId ?? source?.referenceId)
    .filter((id) => typeof id === "string" && id.length > 0));
  const claimsHaveSources = !Array.isArray(draft?.claimsUsed) || draft.claimsUsed.every((claim) => {
    const id = claim?.sourceId ?? claim?.sourceRefId ?? claim?.referenceId;
    return typeof id === "string" && sourceIds.has(id);
  });

  const criteria = {
    hook_strength: criterion(
      words(hook).length >= 5 && words(hook).length <= 24 &&
        meaningfulTokens(hook).size >= 3 && /\?|\b(before|start|ask|avoid|not sure|selling)\b/i.test(hook),
      "The opening is concise, specific enough to orient a homeowner, and gives a recognizable question or concern."
    ),
    topic_distinctiveness: criterion(
      !duplicateHook && !repeatedScript && topicGrounded && typeof draft?.angle === "string" && draft.angle.trim().length > 0,
      topicGrounded
        ? "The angle, hook, and advice are distinct from the other supplied topics."
        : "The draft does not demonstrate distinct, supplied-topic-specific advice."
    ),
    homeowner_relevance: criterion(
      audienceMatch && topicGrounded,
      topicGrounded
        ? "The package names the intended homeowner context and addresses the assigned research topic."
        : "The package does not provide enough evidence that it addresses the assigned research topic."
    ),
    natural_spoken_delivery: criterion(
      words(script).length >= 15 && words(script).length <= 90 &&
        /[.!?]/.test(script) && !hasAny(allViewerText, INTERNAL_EDITORIAL_LANGUAGE),
      "The script is short, conversational copy without internal workflow language."
    ),
    practical_viewer_value: criterion(
      takeaway.length >= 40 &&
        /\b(write|note|list|pair|separate|gather|ask|bring|learn|identify|compare)\b/i.test(script + " " + takeaway) &&
        takeawayEvidence.length >= 1,
      takeawayEvidence.length >= 1
        ? "The viewer receives a concrete action or decision aid tied to the assigned topic."
        : "The takeaway is too vague or is not tied to the assigned research topic."
    ),
    reason_to_follow: criterion(
      hasFollowReason,
      "The copy gives a natural reason to follow for more seller guidance."
    ),
    credibility_source_safety: criterion(
      !hasAny(allViewerText, UNSUPPORTED_EDITORIAL_LANGUAGE) &&
        Array.isArray(draft?.sourceRefs) && draft.sourceRefs.length > 0 && claimsHaveSources,
      "The package avoids unsupported claims, retains supplied references, and keeps used claims linked to those references."
    ),
    consultation_next_step_clarity: criterion(
      /\b(?:contact|conversation|discuss|talk)\b/i.test(nextStep) &&
        !hasAny(nextStep, UNSUPPORTED_EDITORIAL_LANGUAGE),
      "The suggested seller conversation is specific, respectful, and not a promise of results."
    )
  };

  const passed = EDITORIAL_CRITERIA.filter((name) => criteria[name].pass).length;
  return {
    draftIndex: index + 1,
    score: passed + "/" + String(EDITORIAL_CRITERIA.length),
    passedCriteria: passed,
    totalCriteria: EDITORIAL_CRITERIA.length,
    criteria,
    warnings: EDITORIAL_CRITERIA.filter((name) => !criteria[name].pass).map((name) => criteria[name].reason),
    topicEvidence,
    takeawayEvidence,
    topicEvidenceAvailable
  };
}
export function evaluateDraftSetQuality(drafts, { audienceLabel = "", researchTopics = [] } = {}) {
  const safeDrafts = Array.isArray(drafts) ? drafts : [];
  const evaluatedDrafts = safeDrafts.map((draft, index) => evaluateDraft(draft, index, safeDrafts, audienceLabel, researchTopics));
  const angles = safeDrafts.map((draft) => normalized(draft?.angle)).filter(Boolean);
  const hooks = safeDrafts.map((draft) => normalized(draft?.hook)).filter(Boolean);
  const setChecks = {
    exactlyThreeDrafts: safeDrafts.length === 3,
    distinctAngles: new Set(angles).size === safeDrafts.length,
    distinctHooks: new Set(hooks).size === safeDrafts.length,
    audienceSeparated: safeDrafts.every((draft) => {
      const viewerText = [draft?.hook, draft?.script, draft?.caption].join(" ");
      return draft?.audienceLabel === audienceLabel && expectedAudience(audienceLabel).test(viewerText) && !forbiddenAudience(audienceLabel).test(viewerText);
    }),
    topicGrounded: evaluatedDrafts.length === 3 && evaluatedDrafts.every((draft) =>
      draft.topicEvidenceAvailable && draft.topicEvidence.length >= 2 && draft.takeawayEvidence.length >= 1
    )
  };
  const passedCriteria = evaluatedDrafts.reduce((sum, item) => sum + item.passedCriteria, 0);
  const totalCriteria = evaluatedDrafts.length * EDITORIAL_CRITERIA.length;

  return {
    assessment: "editorial_review",
    assessmentMethod: "heuristic_content_checks",
    score: totalCriteria ? passedCriteria + "/" + String(totalCriteria) : "0/0",
    scoreMeaning: "Heuristic checklist coverage only; it is not semantic judgment or a prediction of views, followers, leads, or sales.",
    uncertainty: "A human editor must review topic fit, usefulness, voice, and factual support before approval.",
    criteria: [...EDITORIAL_CRITERIA],
    setChecks,
    drafts: evaluatedDrafts,
    passedCriteria,
    totalCriteria,
    readyForHumanReview: setChecks.exactlyThreeDrafts && setChecks.distinctAngles && setChecks.distinctHooks && setChecks.audienceSeparated && setChecks.topicGrounded && evaluatedDrafts.every((item) => item.warnings.length === 0)
  };
}
