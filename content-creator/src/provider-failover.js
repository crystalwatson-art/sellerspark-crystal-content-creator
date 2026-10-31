import { createContentDraft } from "./content-creator.js";

export const FAILOVER_ELIGIBLE_STATUSES = Object.freeze([
  "not_configured",
  "rate_limited",
  "provider_unavailable",
  "network_error",
  "authentication_failed",
  "access_denied",
  "endpoint_or_model_not_found",
  "request_rejected",
  "truncated_response",
  "provider_error"
]);

function safeFailure(result) {
  return {
    writer: result?.writer ?? "unknown",
    writerStatus: result?.writerStatus ?? result?.status ?? "unknown",
    category: result?.diagnostic?.category ?? result?.generation?.errorCategory ?? null,
    httpStatus: Number.isInteger(result?.diagnostic?.httpStatus)
      ? result.diagnostic.httpStatus
      : null,
    statusClass: result?.diagnostic?.statusClass ?? null
  };
}

function safeResult(writer, writerLabel, writerStatus = "provider_error") {
  return {
    agent: "content_creator",
    writer,
    writerLabel,
    writerStatus,
    status: "needs_more_research",
    drafts: [],
    missingInformation: ["The configured writer did not return an approved result."],
    unsupportedClaims: [],
    humanApprovalRequired: true,
    automaticallyPublished: false,
    customerContacted: false
  };
}

function annotate(result, failover) {
  return {
    ...result,
    failover,
    generation: result.generation
      ? { ...result.generation, failover }
      : {
        provider: result.writer ?? "unknown",
        attempts: 0,
        rewriteAttempts: 0,
        freshnessChecked: false,
        historyStorage: "process_memory",
        failover
      }
  };
}

export function isFailoverEligible(result) {
  return FAILOVER_ELIGIBLE_STATUSES.includes(result?.writerStatus);
}

/**
 * Try exactly one configured backup after a transport/configuration failure.
 * A provider's safety or freshness rejection is never bypassed by another
 * provider. Template mode is used only when the same brief independently
 * passes the existing Content Creator safety gate.
 */
export async function generateWithFailover({
  brief,
  primaryWriter,
  backupWriter = null,
  backupWriters = null,
  primaryLabel = "primary writer",
  backupLabel = "backup writer",
  templateFallback = true,
  logger = () => {}
} = {}) {
  let primaryResult;
  try {
    primaryResult = await primaryWriter.generate(brief);
  } catch {
    primaryResult = safeResult("primary", primaryLabel);
  }

  if (!isFailoverEligible(primaryResult)) return primaryResult;

  const primaryFailure = safeFailure(primaryResult);
  logger({ event: "provider_failure", provider: primaryLabel, ...primaryFailure });

  const baseFailover = {
    attempted: true,
    primary: primaryFailure,
    backup: null,
    outcome: "primary_failed"
  };

  let lastFailureResult = primaryResult;
  const backups = Array.isArray(backupWriters) ? backupWriters : backupWriter ? [{ writer: backupWriter, label: backupLabel }] : [];
  for (const { writer: nextWriter, label: nextLabel } of backups) {
    if (!nextWriter) continue;
    let backupResult;
    try {
      backupResult = await nextWriter.generate(brief);
    } catch {
      backupResult = safeResult("backup", nextLabel);
    }

    if (backupResult.status === "ready_for_review") {
      return annotate(backupResult, {
        ...baseFailover,
        backup: { writer: backupResult.writer ?? nextLabel, writerStatus: "generated" },
        outcome: "backup_succeeded"
      });
    }

    lastFailureResult = backupResult;
    const backupFailure = safeFailure(backupResult);
    logger({ event: "provider_failure", provider: nextLabel, ...backupFailure });
    baseFailover.backup = backupFailure;
    baseFailover.attempts = [...(baseFailover.attempts ?? []), backupFailure];

    // A backup that rejects its output for quality, evidence, or safety reasons
    // is not an unavailable provider. Preserve that result instead of quietly
    // replacing it with template content.
    if (!isFailoverEligible(backupResult)) {
      return annotate(backupResult, {
        ...baseFailover,
        outcome: "backup_rejected"
      });
    }
  }

  if (templateFallback) {
    const templateResult = createContentDraft(brief);
    if (templateResult.status === "ready_for_review") {
      return annotate({
        ...templateResult,
        writerStatus: "fallback_template",
        writerLabel: "Offline template fallback writer"
      }, {
        ...baseFailover,
        outcome: "template_succeeded"
      });
    }
  }

  return annotate(lastFailureResult, {
    ...baseFailover,
    outcome: "all_providers_unavailable"
  });
}

