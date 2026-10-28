/* SellerSpark Studio navigation: presentation-only enhancement.
   Does not fetch, save, publish, or change authentication. */
const PAGES = new Set(["home","creator","optimizer","tiktok","approval"]);
const root = document.body;
const locationControl = document.querySelector("#studio-location");
const audienceControl = document.querySelector("#studio-audience");
const originalFixture = document.querySelector("#audience-value");
const liveCount = document.querySelector("#studio-live-count");
const tiktokStatus = document.querySelector("#tiktok-connection-heading");
const pages = {"studio":"home","overview":"home","creator":"creator","draft-queue":"creator","optimizer":"optimizer","tiktok":"tiktok","campaign":"tiktok","approval":"approval"};
function route() {
  const hash = decodeURIComponent(location.hash.slice(1));
  const next = pages[hash] || "home";
  root.classList.add("studio-active");
  root.dataset.studioPage = PAGES.has(next) ? next : "home";
  document.querySelectorAll(".sidebar-nav a").forEach((link)=>{
    link.classList.toggle("active",(pages[link.hash.slice(1)] || "home")===next);
  });
  if (hash && root.dataset.studioPage!== "home") window.scrollTo({top:0,behavior:"instant"});
}
function syncLocation() {
  if (!originalFixture) return;
  const desired = locationControl.value === "brooklyn" ? "brooklyn_townhouse_owner" : "lic_condo_owner";
  originalFixture.value = desired;
  originalFixture.dispatchEvent(new Event("change",{bubbles:true}));
  localStorage.setItem("sellerspark-studio-location",locationControl.value);
}
function syncAudience() {
  // Preview preference only: buyer-specific research has NOT been implemented.
  localStorage.setItem("sellerspark-studio-audience",audienceControl.value);
  const campaignAudience = document.querySelector("#campaign-audience-mode");
  if (campaignAudience) {
    campaignAudience.value = audienceControl.value.toLowerCase();
    campaignAudience.dispatchEvent(new Event("change",{bubbles:true}));
  }
}
function refreshTikTokCount() {
  if (!liveCount) return;
  const status = tiktokStatus?.textContent || "";
  if (!/connected/i.test(status) || /not connected/i.test(status)) {
    liveCount.textContent = "Not connected";
    return;
  }
  // Only report a count that the existing authenticated API has rendered;
  // never treat an unverified manual entry as a live follower total.
  const progress = document.querySelector("#growth-progress")?.textContent || "";
  liveCount.textContent = /^\d[\d,]*$/.test(progress.trim()) ? progress.trim() : "Connected · Sync needed";
}
if (locationControl && originalFixture) {
  const stored = localStorage.getItem("sellerspark-studio-location");
  locationControl.value = stored==="brooklyn" ? "brooklyn" : originalFixture.value==="brooklyn_townhouse_owner" ? "brooklyn" : "lic";
  locationControl.addEventListener("change",syncLocation);
  // Existing app has already initialized its fixture; don't overwrite on boot.
}
if (audienceControl) {
  audienceControl.value = localStorage.getItem("sellerspark-studio-audience")==="buyers" ? "buyers" : "sellers";
  audienceControl.addEventListener("change",syncAudience);
}
if (tiktokStatus && liveCount) {
  new MutationObserver(refreshTikTokCount).observe(tiktokStatus,{childList:true,characterData:true,subtree:true});
  refreshTikTokCount();
}
window.addEventListener("hashchange",route);
route();
