# SellerSpark checkpoint — October 30, 2026

## Accepted changes and why
Crystal found that revision and rejection changed status labels without showing a useful change in the card. She compared CampaignFlow's single Generate button and corrected our earlier suggestion to replace a rejected card automatically. Latest accepted behavior: Generate produces a new set; Revise asks what wording to change and updates one card; Regenerate lives inside an opened card and replaces only its idea; Reject marks it unwanted; Accept reveals Copy approved content. Earlier versions must remain available. Show mockups before deploying visual changes. Keep the approved Day view. Night view needs more smoked-glass frost and softer ivory text while preserving the room and skyline.

Crystal also questioned the reset warning about history staying in a browser. User-facing language must say where work is saved in plain English. All work is NOT currently synced: calendar plans and growth plan remain browser-local. Do not tell users that signing in by itself means everything is saved.

## Verified recovery and private source baseline
Lumen's receiver fix was independently verified in GitHub at b9f1f772c34b06d4cf2ba4075665af51507447b9 and Vercel protected Preview 7tal9713x, READY. It binds default native browser fetch to globalThis. Crystal corrected Supabase Site URL to that preview on October 30, then completed recovery and successfully signed out and back in. Do not repeat this setup.
Her name-removal request was implemented in private commit 4db8875a5d564d2a7e3da34fcd0fa79fbfe7dc49, covering the three template calls to action, OpenAI writer guidance and related fixtures/tests. 35 focused tests passed. Existing generated drafts in 7tal9713x still contain historical wording until replaced by new drafts.

## Account-saving root cause, confirmed by code and database
On October 30, a read-only count of sellerspark_listing_reviews for Crystal's verified account returned zero, despite successful sign-in and review interaction. Browser requestContentBrief omitted authorization for every fictional brief. Server POST /api/content always used demoReviewStore for those briefs. Therefore signing in did not make Generate persist to Supabase. This was an intentional demo-only path, not evidence of database data loss or another person's access.

## Implementation prepared in this change
- Signed-in generation sends its session. Server persists sample briefs with verified owner identity and bearer token using existing RLS policies; anonymous samples remain local demos.
- Invalid authorization never silently falls back to anonymous storage.
- GET /api/reviews returns up to 100 most recently updated owner-scoped sets in stable order. No service-role key is used for review storage.
- Account includes saved sets; reopening fetches current state instead of trusting a stale list copy.
- Empty workspaces can resume the latest saved set on sign-in/new browser.
- Local review caches are partitioned by verified account ID; legacy guest copies remain preserved separately.
- Reset confirmation distinguishes account-saved drafts from this-computer drafts and uses Keep working / Clear current drafts.
- Calendar/growth plans are not included in this account-saving change. Existing browser-only work on another preview origin has not been migrated. Do not claim it was uploaded.
- No schema, credentials, access settings, TikTok permissions, existing aliases or production deployment changed.

## Separate design preview
public/proposals/card-flow.html demonstrates the accepted button flow with synthetic example content, revision highlighting, version numbers, Undo, prior sets and a softer Night frost. It is not connected to account storage or a live AI writer. Preset rewrites are illustrative; custom requests are explicitly marked as needing a connected writer. The working app's generation/revision workflow and global styling are unchanged pending visual approval.

## Verification and limits
178 automated tests passed before final packaging. New server tests cover signed-in sample persistence, rejected sessions, authentication for history, spoofed-owner headers and cross-account isolation. New store test covers owner/token requirement, stable order and bound. New JSDOM + actual local HTTP server + mocked provider/database test creates drafts, accepts a revision and resumes it from a fresh browser with empty local storage. This is synthetic integration coverage, not rendered Chromium QA or a real live Supabase write/read.
Mockup tests cover replacing one card without changing its siblings, visible revision, copy gating, undo, rejection, earlier sets and theme toggle. Live account saving remains to be tested after the protected preview is ready.

## TikTok state and remaining blocker
October 30 screenshot reached the official TikTok sandbox consent page for crystal0858; a later screenshot showed SellerSpark Not connected. Read-only count of that owner's sellerspark_tiktok_connections returned zero. Do not mark OAuth complete.
Known origin mismatch remains: configured callback host is the stable main alias, while login/test happens on immutable 7tal9713x. The stable alias was intentionally held on the approved older design pending visual checks. This was a deliberate gate, not an unexplained alias change. Resolve callback and session origin coherently before another real consent attempt; do not weaken deployment protection, create public share links or promote the main alias silently.
Real fresh generation/custom rewriting still needs an enabled writer connection. Existing Preview has only the eight TikTok/Supabase environment variables verified previously. Do not fabricate live generation from finite example templates.

## Corrections to older checkpoint
reports/live-connection-checkpoint-20261029.md predates completion of the eight environment variables and confirmed recovery. Its missing-variable/account uncertainty is stale. The callback URI was later explicitly confirmed. Main alias was deliberately held; do not rediscover that as an accidental routing event.

