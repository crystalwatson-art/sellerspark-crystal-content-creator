import test from "node:test";
import assert from "node:assert/strict";
import { createContentDraft } from "../src/content-creator.js";
import { createGrowthPilot, buildFollowerTracker, createCampaignMetadata, normalizeAudienceMode } from "../src/growth-pilot.js";
import { getTikTokConnectionPlan, isTikTokConnectionReady } from "../src/tiktok-connection.js";
import fictionalLicBrief from "../fixtures/fictional-research-brief.json" with { type: "json" };

test("growth pilot supports Buyers, Sellers, and Both without changing the research audience", () => {
  assert.equal(normalizeAudienceMode("buyers"), "buyers");
  assert.equal(normalizeAudienceMode("sellers"), "sellers");
  assert.equal(normalizeAudienceMode("both"), "both");
  assert.equal(normalizeAudienceMode("unsupported"), "sellers");

  const result = createContentDraft({ ...fictionalLicBrief, campaignAudienceMode: "buyers" });
  assert.equal(result.audienceLabel, "Long Island City condo owners");
  assert.equal(result.campaignAudienceMode, "buyers");
  assert.equal(result.campaignAudienceLabel, "Buyers");
  assert.equal(result.drafts.length, 3);
});

test("follower tracker keeps unknown counts unknown and never promises growth", () => {
  const unknown = buildFollowerTracker();
  assert.equal(unknown.startingFollowers, null);
  assert.equal(unknown.currentFollowers, null);
  assert.equal(unknown.progressPercent, null);
  assert.match(unknown.note, /does not assume|promise growth/i);

  const measured = buildFollowerTracker({ startingFollowers: 12, currentFollowers: 37 });
  assert.equal(measured.netChange, 25);
  assert.equal(measured.progressPercent, 37);
  assert.equal(measured.goalReached, false);
  assert.equal(buildFollowerTracker({ currentFollowers: 100 }).goalReached, true);
});

test("invalid follower counts are surfaced instead of being coerced", () => {
  const result = buildFollowerTracker({ startingFollowers: "unknown", currentFollowers: -1 });
  assert.equal(result.startingFollowers, null);
  assert.equal(result.currentFollowers, null);
  assert.equal(result.errors.length, 2);
});

test("calendar creates fourteen draft-only, human-approved prompts", () => {
  const plan = createGrowthPilot({ audienceMode: "both" });
  assert.equal(plan.calendar.length, 14);
  assert.deepEqual(plan.calendar.map((item) => item.day), Array.from({ length: 14 }, (_, index) => index + 1));
  assert.ok(plan.calendar.every((item) => item.status === "draft_only" && item.requiresHumanApproval));
  assert.equal(plan.safety.automaticallyPublished, false);
  assert.equal(plan.safety.artificialEngagementDisabled, true);
});

test("research handoff preserves campaign questions, trends, and follower opportunities as upstream data", () => {
  const brief = {
    campaignAudienceMode: "both",
    audienceQuestions: ["Fictional buyer question"],
    realEstateTrends: [{ topic: "Fictional trend", sourceId: "fictional-source" }],
    followerAttractionOpportunities: ["Fictional save-worthy prompt"]
  };
  const metadata = createCampaignMetadata(brief);
  assert.deepEqual(metadata.growthResearchHandoff.audienceQuestions, brief.audienceQuestions);
  assert.deepEqual(metadata.growthResearchHandoff.realEstateTrends, brief.realEstateTrends);
  assert.deepEqual(metadata.growthResearchHandoff.followerAttractionOpportunities, brief.followerAttractionOpportunities);
  assert.equal(metadata.growthResearchHandoff.liveResearchPerformed, false);
  assert.match(metadata.growthResearchHandoff.status, /not_verified_here/);
});

test("content packages include an explicit follow reason without changing safety flags", () => {
  const result = createContentDraft(fictionalLicBrief);
  assert.equal(result.drafts.length, 3);
  assert.ok(result.drafts.every((draft) => typeof draft.reasonToFollow === "string" && draft.reasonToFollow.includes("Follow")));
  assert.equal(result.humanApprovalRequired, true);
  assert.equal(result.automaticallyPublished, false);
  assert.equal(result.customerContacted, false);
});

test("TikTok connection plan is official-API-only and not active", () => {
  const plan = getTikTokConnectionPlan();
  assert.equal(plan.status, "not_configured");
  assert.deepEqual(plan.readOnlyScopes, ["user.info.basic", "user.info.stats"]);
  assert.equal(plan.optionalDraftHandoffScope, "video.upload");
  assert.equal(plan.directPublishEnabled, false);
  assert.equal(plan.automaticEngagementEnabled, false);
  assert.equal(isTikTokConnectionReady({ clientKey: "x", clientSecret: "y", redirectUri: "https://example.test/callback", authorizedScopes: ["user.info.basic"] }), false);
});
