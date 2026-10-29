# Studio repetition, regeneration and Views refinement

Crystal requested less repetition around Content Creator, TikTok and the calendar, a Regenerator control, and initially a Following button. She first clarified people following the account, then explicitly corrected the requested feature to Views: Followers already exists. The final change adds video Views, not a follower-name panel or automatic follow action.

The home calendar and duplicate home TikTok metric panel are removed; the calendar appears only in TikTok Growth. Existing live follower status is retained inside TikTok. The duplicate Creator hero text is removed while retaining its generation controls, and TikTok's inner section uses an account/plan subheading instead of repeating the page title.

Generate test drafts and Regenerate drafts are visible in Creator. Regeneration reuses the selected fictional fixture and existing provider routing; it does not pretend that offline templates necessarily produce different text. The prior fictional review is archived through the existing archive mechanism only after usable new drafts arrive; persistent reviews stay in their existing server records. Failed, blocked or empty regeneration keeps the current drafts. Existing archive retention remains unchanged.

Views opens a dedicated panel reading actual per-video view_count values for the authenticated user's public videos. Newer/older pagination uses TikTok's official cursor, up to 20 videos per page; no fabricated account total or profile-visit metric is shown. Tokens stay server-side, provider payloads are validated, titles are rendered with textContent, and cached pages clear when the signed-in owner changes. The endpoint requires verified Supabase identity and a token with video.list scope. Default TikTok authorization scopes are unchanged: only the deliberate Authorize video views action requests the additional read-only video.list permission. No automatic engagement or publishing is introduced.

Official references checked October 29:
- https://developers.tiktok.com/docs/en/tiktok-api-v2-video-list
- https://developers.tiktok.com/docs/en/tiktok-api-v2-video-object

Validation: 169 automated checks passed. Added cases cover optional scope consent, owner/permission gating before provider access, safe count/cursor responses, invalid/missing counts and provider errors, empty video pages, authenticated server route behavior, and the one-calendar/control-presence contract. These checks are not a live TikTok consent test or visual browser pass.

Live account connection, server credentials and TikTok app approval for video.list remain prerequisites. No secrets, account credentials, external permission grants, database policies or automatic posts were changed by this refinement.
