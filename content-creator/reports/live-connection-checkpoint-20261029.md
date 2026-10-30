# SellerSpark live-connection checkpoint — October 29, 2026

## Completed work to carry forward

The existing TikTok developer app is SellerSpark, with the SellerSpark-Staging sandbox. It was created previously; do not create another app or sandbox. Earlier records show Login Kit, Content Posting API, app icon, Terms and Privacy URLs and a Login Kit redirect were saved. Exact saved redirect URI has not been recovered; inspect it before changing server configuration.

During this conversation Crystal added user.info.stats and video.list alongside existing user.info.basic and video.upload. She was instructed to Apply changes; subsequent screenshots show the scopes and no unsaved-changes warning. Direct Post remains outside the approved flow.

Crystal then signed into regular TikTok account @crystal0858. The developer console confirmed this account was added as the sandbox target user at 9:10 PM Eastern, October 29. Its notice says changes may take up to an hour. This is sandbox test-user enrollment, not a completed authorization through SellerSpark's deployed OAuth flow. Do not ask her to enroll it again.

Personal email changes and successful Vercel account login testing are completed. Do not repeat those account changes.

## Directly verified configuration

Vercel project prj_tQmUCjYK6fYwh0fkdydPEW7g51qs, team team_J7jfbKbz5I4R42dWixoGZ7eX. Environment-variable metadata checked without decrypting or printing values. Preview has:
- SELLERSPARK_REVIEW_STORAGE
- SELLERSPARK_SUPABASE_URL
- SELLERSPARK_SUPABASE_ANON_KEY
- TIKTOK_TOKEN_ENCRYPTION_KEY

Missing in this project: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI, SELLERSPARK_SUPABASE_SERVICE_ROLE_KEY. Do not retrieve secrets into chat or source files. Guide private entry into Vercel when the sandbox and callback are verified.

Supabase sellerspark-development (pugipltbisdwkspgkbdu) is ACTIVE_HEALTHY. Listing-review, TikTok-connection and OAuth-state tables already exist with RLS enabled; each reports zero rows. Do not rerun their migrations.

## Address mismatch to resolve

The stable original address sellerspark-content-creator-preview-crystalwatson-ai.vercel.app currently resolves to deployment dpl_P8RAnVXDQi7s7wvALEv9HfBBBMmm, source 449f6dcf0e75f896b30c1889ac3d203d2e1c8533 (restored design). Latest activation preview dpl_BVKw7FHWFoRweMoBwvpEUjEqDGTN is READY at source 796ebbec014f091456f070ec5d5ba2798c5aaedc, hostname sellerspark-content-creator-preview-inkvcs8o3-crystalwatson-ai.vercel.app.

Browser Supabase session is stored per origin in sessionStorage. OAuth callback currently redirects to its own host root. Therefore starting on a different preview hostname and returning to the stable original host can return to a different version and an origin without the starting session. This is a verified architectural risk; no real failed OAuth attempt has yet proved it occurs.

Do not silently substitute an immutable preview hostname into TikTok. First inspect the existing saved Login Kit redirect, choose one stable origin for the tested flow, and arrange the matching deployed code and server configuration. Keep Vercel Authentication enabled.

## Work intentionally paused and verification limits

Crystal questioned the layout after repeated frosting patches. All further layout changes are paused; show a mockup before a new layout implementation. No alias promotion performed in this check.

Review testing already confirmed revision/rejection/acceptance badges. Repeated revision history clarity and Day/Night closing an open card remain reported issues, not verified fixes.

Real SellerSpark sign-in/save/refresh and real TikTok consent, follower reads, video reads remain unverified. Current account has no public videos; an authorized empty video list is a valid test outcome, not evidence of failure.

Connected local Browser still returns "Browser access requires the originating browser context." Do not claim to see or operate Crystal's local developer console. Next required user-visible evidence is Products > Login Kit > saved Redirect URI, without credentials. Public docs confirm redirect_uri must match a registered URI (https://developers.tiktok.com/doc/login-kit-web).

No source code, layout, credentials, database policies, access grants, or production aliases changed in this inspection. This checkpoint preserves the reasoning and completed actions for the next turn.
