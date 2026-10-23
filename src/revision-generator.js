import { generateWithFailover } from "./provider-failover.js";

const REVISION_FIELDS = Object.freeze([
  ["hook", "Hook", "Keeps the opening seller-specific and clear."],
  ["script", "Script", "Keeps the spoken guidance concise and grounded in the supplied brief."],
  ["takeaway", "Viewer takeaway", "Keeps one practical takeaway without promising an outcome."],
  ["videoConcept", "Video concept", "Keeps the scene direction aligned with the supplied audience."],
  ["caption", "Caption", "Adds complementary context without repeating unsupported claims."],
  ["hashtags", "Hashtags", "Keeps the tags relevant without claiming they are trending."],
  ["suggestedNextStep", "Suggested call to action", "Keeps the seller conversation invitation respectful and optional."]
]);

function clone(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

function changeList(original, proposed) {
  return REVISION_FIELDS
    .filter(([field]) => JSON.stringify(original?.[field]) !== JSON.stringify(proposed?.[field]))
    .map(([field, label, reason]) => ({
      field,
      label,
      before: clone(original?.[field]),
      after: clone(proposed?.[field]),
      reason
    }));
}

function safeUnavailable(result, reason = "No safe revision was returned by the configured providers.") {
  return {
    status: "unavailable",
    source: result?.writer || "none",
    draft: null,
    changes: [],
    reason
  };
}

function draftIndexFor(target, drafts) {
  const byTopic = drafts.findIndex((draft) => target?.researchTopicId && draft?.researchTopicId === target.researchTopicId);
  if (byTopic >= 0) return byTopic;
  const match = String(target?.id || "").match(/(\d+)$/);
  const index = match ? Number(match[1]) - 1 : -1;
  return index >= 0 && index < drafts.length ? index : -1;
}

function preserveResearchMetadata(original, generated) {
  return {
    ...clone(original),
    ...clone(generated),
    id: original.id,
    audience: original.audience,
    audienceLabel: original.audienceLabel,
    researchTopicId: original.researchTopicId,
    sourceRefs: clone(original.sourceRefs || []),
    uncertaintyWarnings: clone(original.uncertaintyWarnings || []),
    warnings: clone(original.warnings || []),
    unsupportedClaims: clone(original.unsupportedClaims || []),
    claimsUsed: clone(original.claimsUsed || []),
    humanApprovalRequired: true,
    automaticallyPublished: false,
    customerContacted: false
  };
}

/**
 * Create the real revision boundary used by Request Revision for verified
 * research. The writers already validate the research gate, structured shape,
 * audience, claim references, unsafe language, and freshness. This adapter
 * selects the requested draft and restores its original research metadata so
 * the proposal cannot replace citations or warnings.
 */
export function createRevisionGenerator({
  primaryWriter = null,
  backupWriter = null,
  logger = () => {}
} = {}) {
  return async function generateRevision(draft, { brief, attempt } = {}) {
    if (!brief || typeof brief !== "object") {
      return safeUnavailable(null, "The verified research brief was not available for revision.");
    }
    if (!primaryWriter || typeof primaryWriter.generate !== "function") {
      return safeUnavailable(null, "No configured AI revision provider is available for this research result.");
    }

    const result = await generateWithFailover({
      brief,
      primaryWriter,
      backupWriter,
      primaryLabel: "Groq revision writer",
      backupLabel: "Gemini revision writer",
      templateFallback: false,
      logger
    });

    if (result?.status !== "ready_for_review" || !Array.isArray(result.drafts)) {
      const reason = result?.diagnostic?.explanation
        || result?.missingInformation?.[0]
        || "The configured AI provider did not return a safe revision.";
      return safeUnavailable(result, reason);
    }

    const index = draftIndexFor(draft, result.drafts);
    if (index < 0) return safeUnavailable(result, "The AI response did not include the requested draft.");

    const proposed = preserveResearchMetadata(draft, result.drafts[index]);
    const changes = changeList(draft, proposed);
    if (!changes.length) {
      return {
        status: "no_change_needed",
        source: result.writer,
        draft: proposed,
        changes: [],
        attempt
      };
    }

    return {
      status: "available",
      source: result.writer,
      draft: proposed,
      changes,
      attempt
    };
  };
}

