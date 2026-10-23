const DEFAULT_HISTORY_LIMIT = 12;
const REPETITION_THRESHOLD = 0.84;

function normalizeText(value) {
  return typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    : "";
}

function wordSet(value) {
  return new Set(normalizeText(value).split(/\s+/).filter(Boolean));
}

function overlapScore(left, right) {
  const a = wordSet(left);
  const b = wordSet(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const word of a) {
    if (b.has(word)) shared += 1;
  }
  return shared / Math.min(a.size, b.size);
}

function isNearDuplicate(left, right) {
  const leftHook = normalizeText(left?.hook);
  const rightHook = normalizeText(right?.hook);
  const leftScript = normalizeText(left?.script);
  const rightScript = normalizeText(right?.script);

  return (leftHook && leftHook === rightHook) ||
    (leftScript && leftScript === rightScript) ||
    overlapScore(leftHook, rightHook) >= REPETITION_THRESHOLD ||
    overlapScore(leftScript, rightScript) >= REPETITION_THRESHOLD;
}

export function createDraftHistory({ limit = DEFAULT_HISTORY_LIMIT } = {}) {
  const entriesByAudience = new Map();
  const maxEntries = Math.max(1, Number(limit) || DEFAULT_HISTORY_LIMIT);

  return {
    get(audience) {
      return (entriesByAudience.get(audience) ?? []).map((entry) => ({ ...entry }));
    },

    add(audience, drafts) {
      const current = entriesByAudience.get(audience) ?? [];
      const next = [
        ...current,
        ...drafts.map((draft) => ({
          hook: draft.hook,
          script: draft.script,
          createdAt: new Date().toISOString()
        }))
      ];
      entriesByAudience.set(audience, next.slice(-maxEntries));
    },

    clear(audience) {
      if (audience === undefined) entriesByAudience.clear();
      else entriesByAudience.delete(audience);
    },

    storage: "process_memory"
  };
}

export function findRepetition(drafts, recentDrafts = []) {
  const comparisons = [];
  const candidates = drafts.map((draft, index) => ({
    draft,
    label: "new draft " + String(index + 1)
  }));
  const recent = recentDrafts.map((draft, index) => ({
    draft,
    label: "recent draft " + String(index + 1)
  }));

  for (let index = 0; index < candidates.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < candidates.length; otherIndex += 1) {
      comparisons.push([candidates[index], candidates[otherIndex]]);
    }
    for (const previous of recent) {
      comparisons.push([candidates[index], previous]);
    }
  }

  const match = comparisons.find(([left, right]) => isNearDuplicate(left.draft, right.draft));
  return match
    ? { repetitive: true, pair: [match[0].label, match[1].label] }
    : { repetitive: false, pair: [] };
}

export { REPETITION_THRESHOLD };
