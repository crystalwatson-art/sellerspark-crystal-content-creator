const aliases = Object.freeze({
  home: "home", studio: "home", overview: "home",
  creator: "creator", "draft-queue": "creator", workflow: "creator",
  optimizer: "optimizer", growth: "growth", tiktok: "growth", campaign: "growth",
  approval: "approval", account: "account"
});
export function resolveStudioPage(hash = "") {
  try {
    const key = decodeURIComponent(hash.replace(/^#/, "")).toLowerCase();
    return Object.hasOwn(aliases, key) ? aliases[key] : "home";
  } catch { return "home"; }
}
export function liveFollowerLabel(status, verifiedCount = null) {
  if (status !== "Connected") return status === "Not configured" ? "Setup needed" : "Not connected";
  return Number.isInteger(verifiedCount) && verifiedCount >= 0 ? verifiedCount.toLocaleString("en-US") : "Connected · Sync needed";
}
