export const AUDIENCE_MODES = Object.freeze({
  buyers: "Buyers",
  sellers: "Sellers",
  both: "Both"
});

const FOCUSES = Object.freeze([
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

function countValue(value) {
  if (value === "" || value === null || value === undefined) return null;
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

export function normalizeAudienceMode(value) {
  return Object.hasOwn(AUDIENCE_MODES, value) ? value : "sellers";
}

export function createGrowthPilotView({ audienceMode = "sellers", startingFollowers = "", currentFollowers = "", goal = 100 } = {}) {
  const mode = normalizeAudienceMode(audienceMode);
  const starting = countValue(startingFollowers);
  const current = countValue(currentFollowers);
  const errors = [];
  const validGoal = goal !== "" && Number.isSafeInteger(Number(goal)) && Number(goal) > 0 && Number(goal) <= 1000000000;
  const target = validGoal ? Number(goal) : 100;
  if (!validGoal) errors.push("Choose a follower goal from 1 to 1,000,000,000 using a whole number.");
  if (startingFollowers !== "" && startingFollowers !== null && startingFollowers !== undefined && starting === null) errors.push("Starting followers must be a non-negative whole number or left blank.");
  if (currentFollowers !== "" && currentFollowers !== null && currentFollowers !== undefined && current === null) errors.push("Current followers must be a non-negative whole number or left blank.");
  return {
    audienceMode: mode,
    tracker: {
      goal: target,
      startingFollowers: starting,
      currentFollowers: current,
      netChange: starting !== null && current !== null ? current - starting : null,
      progressPercent: current === null ? null : Math.min(100, Math.round((current / target) * 100)),
      goalReached: current !== null && current >= target,
      errors,
      note: current === null
        ? "Connect TikTok to load your follower count automatically. No growth is promised."
        : "Progress is a measurement only; it is not a forecast or guarantee of follower growth."
    },
    calendar: FOCUSES.map(([focus, format], index) => ({
      day: index + 1,
      focus,
      format,
      audienceLabel: AUDIENCE_MODES[mode],
      status: "draft_only",
      requiresHumanApproval: true
    }))
  };
}

