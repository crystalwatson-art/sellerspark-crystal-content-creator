import test from "node:test";
import assert from "node:assert/strict";
import fictionalBrief from "../fixtures/fictional-research-brief.json" with { type: "json" };
import { createContentDraft } from "../src/content-creator.js";
import { verifyResearchBrief } from "../src/research-verification.js";

function verifiedBrief() {
  return {
    id: "mock-verified-brief",
    researchMode: "verified",
    audience: "lic_condo_owner",
    topics: [1, 2, 3].map((number) => ({
      id: "mock-topic-" + String(number),
      title: "Mock verified seller question " + String(number),
      question: "What should a seller ask before a first conversation about a Long Island City condo? Question " + String(number),
      sourceRefs: [{
        id: "mock-source-" + String(number),
        title: "Mock source " + String(number),
        url: "https://www.nyc.gov/mock-sellerspark/source-" + String(number),
        date: "2026-10-20",
        verification: {
          status: "verified",
          checkedAt: "2026-10-21T12:00:00Z"
        }
      }],
      claims: [{
        id: "mock-claim-" + String(number),
        text: "A seller can prepare one question before a first conversation.",
        sourceId: "mock-source-" + String(number),
        supported: true,
        verification: {
          status: "verified",
          checkedAt: "2026-10-21T12:00:00Z"
        },
        evidence: {
          quote: "Mock evidence says a seller can prepare one question before a first conversation.",
          locator: "Mock source section 1"
        }
      }]
    }))
  };
}

test("fictional fixtures are explicitly test-only and never marked verified", () => {
  const result = createContentDraft(fictionalBrief);

  assert.equal(result.status, "ready_for_review");
  assert.equal(result.researchVerification.status, "fictional_test_only");
  assert.equal(result.handoff.publicDraftsAllowed, false);
  assert.equal(result.researchVerification.liveVerificationPerformed, false);
  assert.match(result.researchVerification.warnings.join(" "), /not verified real-world research/i);
});

test("missing source references block public-facing drafts", () => {
  const brief = verifiedBrief();
  brief.topics[1].sourceRefs = [];

  const result = createContentDraft(brief);

  assert.equal(result.status, "needs_more_research");
  assert.deepEqual(result.drafts, []);
  assert.match(result.researchVerification.missingEvidence.join(" "), /topic 2 needs at least one source/i);
});

test("reserved or fabricated-looking URLs are rejected", () => {
  const brief = verifiedBrief();
  brief.topics[0].sourceRefs[0].url = "https://fictional.example/sellerspark/source-1";

  const result = verifyResearchBrief(brief, { today: new Date("2026-10-22T00:00:00Z") });

  assert.equal(result.status, "needs_more_research");
  assert.match(result.missingEvidence.join(" "), /reserved or test hostname/i);
});

test("supported true alone does not verify an unsupported statistic", () => {
  const brief = verifiedBrief();
  brief.topics[0].claims[0].text = "This fictional condo sells 40% faster than every other home.";
  delete brief.topics[0].claims[0].verification;

  const result = createContentDraft(brief);

  assert.equal(result.status, "needs_more_research");
  assert.deepEqual(result.drafts, []);
  assert.match(result.researchVerification.missingEvidence.join(" "), /claim mock-claim-1 needs a verification record/i);
  assert.equal(result.researchVerification.verifiedClaims.length, 2);
});

test("explicitly unsupported factual claims are separated from missing evidence", () => {
  const brief = verifiedBrief();
  brief.topics[0].claims[0].supported = false;
  brief.topics[0].claims[0].verification = { status: "unsupported", checkedAt: "2026-10-21T12:00:00Z" };

  const result = verifyResearchBrief(brief);

  assert.equal(result.status, "needs_more_research");
  assert.equal(result.unsupportedClaims.length, 1);
  assert.equal(result.missingEvidence.length, 0);
});

test("stale research is blocked before draft generation", () => {
  const brief = verifiedBrief();
  brief.topics[2].sourceRefs[0].date = "2020-01-01";

  const result = verifyResearchBrief(brief, { today: new Date("2026-10-22T00:00:00Z") });

  assert.equal(result.status, "needs_more_research");
  assert.match(result.missingEvidence.join(" "), /source is stale/i);
});

test("verified claims preserve exact source attribution", () => {
  const brief = verifiedBrief();

  const verification = verifyResearchBrief(brief, { today: new Date("2026-10-22T00:00:00Z") });
  const result = createContentDraft(brief);

  assert.equal(verification.status, "verified");
  assert.equal(verification.verifiedClaims.length, 3);
  assert.equal(verification.verifiedClaims[0].sourceId, "mock-source-1");
  assert.equal(verification.verifiedClaims[0].sourceUrl, "https://www.nyc.gov/mock-sellerspark/source-1");
  assert.equal(result.status, "ready_for_review");
  assert.equal(result.drafts[0].claimsUsed[0].sourceId, "mock-source-1");
  assert.equal(result.drafts[0].sourceRefs[0].url, "https://www.nyc.gov/mock-sellerspark/source-1");
  assert.equal(result.handoff.researchVerificationStatus, "verified");
  assert.equal(result.handoff.publicDraftsAllowed, true);
});
