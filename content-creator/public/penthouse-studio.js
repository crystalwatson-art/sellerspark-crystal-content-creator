import "./app.js";
import { resolveStudioPage, liveFollowerLabel } from "./studio-navigation.js";

const app = window.SellerSparkContentCreator;
const locationControl = document.querySelector("#location");
const fixtureControl = document.querySelector("#audience-value");
const accountLink = document.querySelector("#studio-account-link");
const authStatus = document.querySelector("#auth-status");
const tiktokStatus = document.querySelector("#tiktok-connection-heading");
let liveCount = null;

function refreshReviewLists() {
  const summaries = app.getDraftSummaries();
  for (const page of ["optimizer", "approval"]) {
    const list = document.querySelector(`#${page}-draft-list`);
    list.replaceChildren();
    document.querySelector(`#${page}-empty`).hidden = summaries.length > 0;
    for (const draft of summaries) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "review-launch";
      const title = document.createElement("strong");
      title.textContent = draft.hook;
      const action = document.createElement("span");
      action.textContent = `${page === "approval" ? "Review & decide" : "Compare & improve"} · Draft ${draft.index + 1} →`;
      button.append(title, action);
      button.addEventListener("click", () => app.openReview(draft.index));
      list.append(button);
    }
  }
}

function route() {
  const page = resolveStudioPage(location.hash);
  document.querySelectorAll(".route-view").forEach(view => { view.hidden = view.id !== `view-${page}`; });
  document.querySelectorAll("[data-route]").forEach(link => {
    if (link.dataset.route === page) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.title = `SellerSpark — ${page === "home" ? "Penthouse Studio" : page[0].toUpperCase() + page.slice(1)}`;
  refreshReviewLists();
  window.scrollTo(0, 0);
}
function refreshLocation() {
  locationControl.value = fixtureControl.value === "brooklyn_townhouse_owner" ? "brooklyn" : "lic";
  locationControl.disabled = fixtureControl.disabled;
  refreshReviewLists();
}
locationControl.addEventListener("change", () => {
  fixtureControl.value = locationControl.value === "brooklyn" ? "brooklyn_townhouse_owner" : "lic_condo_owner";
  fixtureControl.dispatchEvent(new Event("change", { bubbles: true }));
});
fixtureControl.addEventListener("change", refreshLocation);
new MutationObserver(refreshLocation).observe(fixtureControl, { attributes: true, attributeFilter: ["disabled"] });
// Both supplied research fixtures target sellers. Buyer planning is separate.
document.querySelector("#audience").value = "sellers";

function refreshAccount() {
  accountLink.textContent = authStatus.textContent.startsWith("Signed in") ? "Account · Signed in" : "Sign in / Account";
  if (!document.querySelector("#auth-recovery-form").hidden || !document.querySelector("#auth-error").hidden) {
    if (resolveStudioPage(location.hash) !== "account") location.hash = "account";
  }
}
new MutationObserver(refreshAccount).observe(document.querySelector("#auth-panel"), {
  subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["hidden"]
});
function refreshFollowers() {
  if (tiktokStatus.textContent !== "Connected") liveCount = null;
  document.querySelector("#dashboard-followers").textContent = liveFollowerLabel(tiktokStatus.textContent, liveCount);
}
new MutationObserver(refreshFollowers).observe(tiktokStatus, { childList: true, subtree: true, characterData: true });
window.addEventListener("sellerspark:tiktok-metric", event => {
  liveCount = event.detail.followerCount;
  refreshFollowers();
});
new MutationObserver(refreshReviewLists).observe(document.querySelector("#drafts"), { childList: true });
window.addEventListener("hashchange", route);
document.querySelector("#reset-button").addEventListener("click", () => {
  // Expose the existing confirmation inside Creator without bypassing it.
  location.hash = "creator";
});
document.querySelector("#theme-toggle").addEventListener("click", () => {
  localStorage.setItem("sellerspark-penthouse-theme", document.documentElement.dataset.theme === "light" ? "day" : "night");
});
refreshAccount(); refreshLocation(); refreshFollowers(); route();

