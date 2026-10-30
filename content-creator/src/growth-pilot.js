export const GROWTH_GOAL_FOLLOWERS = 100;
export const GROWTH_PILOT_DAYS = 14;

export const AUDIENCE_MODES = Object.freeze({
  buyers: "Buyers",
  sellers: "Sellers",
  both: "Both"
});

const CALENDAR_FOCUSES = Object.freeze([
  ["Start with a homeowner question", "Question-led education"],
  ["Explain one preparation step", "Seller education"],
  ["Answer a buyer consideration", "Buyer education"],
  ["Name a common decision mistake", "Common mistakes"],
  ["Show what to bring to a conversation", "Practical checklist"],
  ["Separate what is known from what is not", "Decision support"],
  ["Invite a thoughtful follow-up question", "Community prompt"],
  ["Clarify a supplied research topic", "Research-grounded explainer"],
  ["Share a calm next-step framework", "Decision support"],
  ["Address a homeowner question", "Audience Q&A"],
  ["Explain what needs evidence", "Trust-building"],
  ["Compare two ways to prepare", "Practical comparison"],
  ["Invite viewers to save a question", "Save-worthy prompt"],
  ["Review what the audience wants next", "Conversation prompt"]
]);

function clone(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

function countValue(value) {
  if (value === "" || value === null || value === undefined) return null;
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

export function normalizeAudienceMode(value) {
  return Object.hasOwn(AUDIENCE_MODES, value) ? value : "sellers";
}

export function audienceModeLabel(value) {
  return AUDIENCE_MODES[normalizeAudienceMode(value)];
}

export function buildFollowerTracker({ startingFollowers = null, currentFollowers = null, goal = GROWTH_GOAL_FOLLOWERS } = {}) {
  const starting = countValue(startingFollowers);
  const current = countValue(currentFollowers);
  const validGoal = Number.isSafeInteger(goal) && goal > 0 && goal <= 1000000000;
  const target = validGoal ? goal : GROWTH_GOAL_FOLLOWERS;
  const errors = [];
  if (!validGoal) errors.push("Choose a follower goal from 1 to 1,000,000,000 using a whole number.");
  if (startingFollowers !== null && startingFollowers !== undefined && starting === null) errors.push("Starting followers must be a non-negative whole number or left blank.");
  if (currentFollowers !== null && currentFollowers !== undefined && current === null) errors.push("Current followers must be a non-negative whole number or left blank.");

  return {
    goal: target,
    startingFollowers: starting,
    currentFollowers: current,
    netChange: starting !== null && current !== null ? current - starting : null,
    progressPercent: current === null ? null : Math.min(100, Math.round((current / target) * 100)),
    goalReached: current !== null && current >= target,
    status: current === null ? "current_count_unknown" : current >= target ? "goal_reached" : "in_progress",
    errors,
    note: current === null
      ? "Enter the current follower count to measure progress. SellerSpark does not assume a starting count or promise growth."
      : "Progress is a measurement only; it is not a forecast or guarantee of follower growth."
  };
}

export function create14DayCalendar({ audienceMode = "sellers" } = {}) {
  const mode = normalizeAudienceMode(audienceMode);
  return CALENDAR_FOCUSES.map(([focus, format], index) => ({
    day: index + 1,
    audienceMode: mode,
    audienceLabel: audienceModeLabel(mode),
    focus,
    format,
    status: "draft_only",
    requiresHumanApproval: true,
    publishing: "manual_only"
  }));
}

export function createGrowthPilot({ audienceMode = "sellers", startingFollowers = null, currentFollowers = null, goal = GROWTH_GOAL_FOLLOWERS } = {}) {
  const mode = normalizeAudienceMode(audienceMode);
  return {
    audienceMode: mode,
    audienceLabel: audienceModeLabel(mode),
    goal: buildFollowerTracker({ goal }).goal,
    tracker: buildFollowerTracker({ startingFollowers, currentFollowers, goal }),
    calendar: create14DayCalendar({ audienceMode: mode }),
    safety: {
      humanApprovalRequired: true,
      automaticallyPublished: false,
      customerContacted: false,
      artificialEngagementDisabled: true,
      persistence: "browser_local_only_until_an_authenticated_campaign_store_is_approved"
    }
  };
}

export function preserveGrowthResearchHandoff(brief = {}) {
  const safeBrief = brief && typeof brief === "object" ? brief : {};
  const list = (value) => Array.isArray(value) ? clone(value) : [];
  return {
    audienceQuestions: list(safeBrief.audienceQuestions),
    realEstateTrends: list(safeBrief.realEstateTrends),
    followerAttractionOpportunities: list(safeBrief.followerAttractionOpportunities),
    status: "supplied_by_research_agent_or_human_not_verified_here",
    liveResearchPerformed: false
  };
}

export function createCampaignMetadata(brief = {}) {
  const safeBrief = brief && typeof brief === "object" ? brief : {};
  const audienceMode = normalizeAudienceMode(safeBrief.campaignAudienceMode);
  return {
    campaignAudienceMode: audienceMode,
    campaignAudienceLabel: audienceModeLabel(audienceMode),
    growthResearchHandoff: preserveGrowthResearchHandoff(safeBrief),
    campaignSafety: {
      humanApprovalRequired: true,
      automaticallyPublished: false,
      customerContacted: false,
      artificialEngagementDisabled: true
    }
  };
}

