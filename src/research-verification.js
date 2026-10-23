const FICTIONAL_MODE = "fictional";
const VERIFIED_MODE = "verified";
const DEFAULT_MAX_AGE_DAYS = 365;

const RESERVED_HOSTNAMES = new Set([
  "example.com",
  "example.org",
  "example.net",
  "fictional.example",
  "example.invalid",
  "localhost",
  "127.0.0.1",
  "::1"
]);

function asText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sourceId(source) {
  return source?.id ?? source?.sourceId ?? source?.referenceId ?? null;
}

function claimId(claim, fallback) {
  return claim?.id ?? claim?.claimId ?? claim?.referenceId ?? fallback;
}

function sourceDate(source) {
  return source?.date ?? source?.publishedDate ?? source?.publicationDate ?? null;
}

function refsFor(topic) {
  return Array.isArray(topic?.sourceRefs)
    ? topic.sourceRefs
    : Array.isArray(topic?.sources)
      ? topic.sources
      : [];
}

function claimsFor(topic) {
  return Array.isArray(topic?.claims) ? topic.claims : [];
}

function parseDate(value) {
  const text = asText(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(text)) return null;
  const parsed = new Date(text.length === 10 ? text + "T00:00:00.000Z" : text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  return value.toISOString().slice(0, 10);
}

function validHttpsUrl(value) {
  const text = asText(value);
  if (!text) return { ok: false, reason: "source needs an HTTPS URL" };

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return { ok: false, reason: "source URL is malformed" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "source URL must use HTTPS" };
  }
  if (!parsed.hostname || RESERVED_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
    return { ok: false, reason: "source URL uses a reserved or test hostname" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "source URL must not contain embedded credentials" };
  }
  return { ok: true, value: parsed.toString() };
}

function verificationRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function evidenceRecord(value) {
  if (typeof value === "string") return { quote: value, locator: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return {
    quote: value.quote ?? value.excerpt ?? value.text ?? null,
    locator: value.locator ?? value.section ?? value.page ?? value.paragraph ?? null
  };
}

function evidenceIssues(evidence, subject) {
  const record = evidenceRecord(evidence);
  const issues = [];
  if (!asText(record.quote) || record.quote.trim().length < 12) {
    issues.push(subject + " needs a clear evidence quote or excerpt");
  }
  if (!asText(record.locator)) {
    issues.push(subject + " evidence needs a locator such as a section, page, or paragraph");
  }
  return issues;
}

function dateIssues(source, today, maxAgeDays) {
  const value = sourceDate(source);
  const parsed = parseDate(value);
  if (!parsed) return ["source needs a valid publication date in YYYY-MM-DD or ISO format"];
  if (parsed > today) return ["source publication date cannot be in the future"];
  const ageDays = Math.floor((today.getTime() - parsed.getTime()) / 86400000);
  if (ageDays > maxAgeDays) {
    return ["source is stale: publication date is older than " + String(maxAgeDays) + " days"];
  }
  return [];
}

function checkedAtIssues(record, subject) {
  if (record.status !== "verified") {
    return [subject + " needs a verification record with status verified"];
  }
  if (!parseDate(record.checkedAt)) {
    return [subject + " verification record needs checkedAt"];
  }
  return [];
}

function warningValues(topic) {
  const values = [
    ...(Array.isArray(topic?.uncertaintyWarnings) ? topic.uncertaintyWarnings : []),
    ...(Array.isArray(topic?.uncertainties) ? topic.uncertainties : []),
    ...(Array.isArray(topic?.warnings) ? topic.warnings : [])
  ];
  return values
    .map((value) => typeof value === "string" ? value.trim() : value?.message ?? value?.text ?? null)
    .filter(Boolean);
}

function baseResult(status = "needs_more_research") {
  return {
    status,
    verifiedClaims: [],
    unsupportedClaims: [],
    warnings: [],
    missingEvidence: [],
    sourceRefsChecked: 0,
    claimsChecked: 0,
    liveVerificationPerformed: false,
    verificationAuthority: "upstream_research_agent_record"
  };
}

export function verifyResearchBrief(brief, { today = new Date(), maxAgeDays = DEFAULT_MAX_AGE_DAYS } = {}) {
  if (brief?.researchMode === FICTIONAL_MODE) {
    return {
      ...baseResult("fictional_test_only"),
      warnings: ["Fictional test data is not verified real-world research."],
      verificationAuthority: "offline_fixture_only"
    };
  }

  const result = baseResult();
  if (!brief || typeof brief !== "object" || Array.isArray(brief)) {
    result.missingEvidence.push("research brief must declare researchMode=verified and include verified source records");
    return result;
  }
  if (brief.researchMode !== VERIFIED_MODE) {
    result.missingEvidence.push("researchMode must be verified for public-facing drafts; fictional mode is offline-test only");
    return result;
  }
  if (!Array.isArray(brief.topics) || brief.topics.length === 0) {
    result.missingEvidence.push("verified research brief must include topics");
    return result;
  }

  const now = parseDate(formatDate(today)) ?? today;
  const maxAge = Number.isFinite(maxAgeDays) && maxAgeDays >= 0 ? maxAgeDays : DEFAULT_MAX_AGE_DAYS;
  const sourceById = new Map();

  for (const [topicIndex, topic] of brief.topics.entries()) {
    result.warnings.push(...warningValues(topic).map((warning) => "topic " + String(topicIndex + 1) + ": " + warning));
    const refs = refsFor(topic);
    if (refs.length === 0) {
      result.missingEvidence.push("topic " + String(topicIndex + 1) + " needs at least one source reference");
    }

    for (const [sourceIndex, source] of refs.entries()) {
      const id = sourceId(source);
      const label = "topic " + String(topicIndex + 1) + " source " + String(sourceIndex + 1);
      const issues = [];
      if (typeof id !== "string" || !id.trim()) issues.push(label + " needs an id");
      const url = validHttpsUrl(source?.url);
      if (!url.ok) issues.push(label + ": " + url.reason);
      issues.push(...dateIssues(source, now, maxAge).map((issue) => label + ": " + issue));
      issues.push(...checkedAtIssues(verificationRecord(source?.verification), label));
      if (id && !sourceById.has(id)) sourceById.set(id, { source, topicIndex, issues });
      result.sourceRefsChecked += 1;
      result.missingEvidence.push(...issues);
    }

    for (const [claimIndex, claim] of claimsFor(topic).entries()) {
      result.claimsChecked += 1;
      const id = claimId(claim, "topic-" + String(topicIndex + 1) + "-claim-" + String(claimIndex + 1));
      const claimLabel = "claim " + String(id);
      const explicitUnsupported = claim?.supported === false || claim?.status === "unsupported" || claim?.verification?.status === "unsupported";
      if (explicitUnsupported) {
        result.unsupportedClaims.push({ claim: claim ?? null, reason: claimLabel + " is marked unsupported" });
        continue;
      }

      const referencedSource = sourceById.get(claim?.sourceId ?? claim?.sourceRefId ?? claim?.referenceId);
      if (!referencedSource) {
        result.unsupportedClaims.push({ claim: claim ?? null, reason: claimLabel + " references no supplied source" });
        continue;
      }

      const claimIssues = [];
      if (!asText(claim?.text)) claimIssues.push(claimLabel + " needs claim text");
      if (referencedSource.issues.length) claimIssues.push(...referencedSource.issues);
      claimIssues.push(...checkedAtIssues(verificationRecord(claim?.verification), claimLabel));
      claimIssues.push(...evidenceIssues(claim?.evidence, claimLabel));
      if (claimIssues.length) {
        result.missingEvidence.push(...claimIssues);
        continue;
      }

      result.verifiedClaims.push({
        id,
        sourceId: claim.sourceId ?? claim.sourceRefId ?? claim.referenceId,
        text: asText(claim.text),
        sourceUrl: referencedSource.source.url,
        sourceDate: sourceDate(referencedSource.source),
        evidence: evidenceRecord(claim.evidence)
      });
    }
  }

  if (result.unsupportedClaims.length || result.missingEvidence.length) {
    result.status = "needs_more_research";
  } else {
    result.status = "verified";
  }
  return result;
}

export { DEFAULT_MAX_AGE_DAYS, FICTIONAL_MODE, VERIFIED_MODE };
