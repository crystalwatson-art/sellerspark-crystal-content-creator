# Integrated card workflow and TikTok save correction — October 30, 2026

## Preserved work
The previous prototype and its earlier immutable preview deployments remain intact. Existing saved reviews keep their original, proposed, working and revisionHistory fields. New per-card snapshots extend that format without migrating or deleting records. Guest archives retain existing entries. Temporary prototype interactions were in memory only; they are not claimed to have been recovered into an account.

## Working app changes
One visible Generate button; successive sample sets differ. Revise wording is inside the card, with Shorter, Warmer, More professional and Stronger opening suggestions, plus direct script editing. Changes appear immediately after a successful save, are highlighted and require acceptance again. Regenerate this card replaces only that sample card. Reject preserves its text and marks it unwanted. Undo and earlier versions preserve prior text/status. Copy is visible only after acceptance and checks acceptance before writing the clipboard. Authenticated changes use the existing owner-verified API and Supabase review store with version checks; guest changes remain local. Account history reopens saved sets. Low tray/left desk/right desk placement and card scaling are in the working app. Overview, remembered sign-in, account ownership and Day View remain. Night surfaces have stronger translucent navy frost, softer ivory text, smaller cards and a side draft panel without global background blur.

Generation is still labeled fictional/sample template generation. The suggestion buttons are deterministic wording edits; direct editing saves the user's script. There is no configured live AI provider, and no unlimited or custom-instruction AI writing is claimed. Real briefs do not receive fictional replacement ideas. Calendar and growth-plan settings remain browser-local.

## TikTok root cause and correction
Read-only Supabase log aggregates showed two successful state creates (201), two successful state consumes (200), and two failed connection inserts (400). PostgreSQL error-code aggregates showed two check-constraint violations (23514). Live schema inspection confirmed the CHECK(updated_at >= created_at). The previous save request supplied an app-generated updated_at before PostgreSQL assigned its default created_at on insertion. Both timestamps now use database defaults on insert; token refresh upserts preserve the existing timestamp metadata rather than assigning an earlier client time. No schema or authentication settings were changed.

A synthetic insert against the actual table, inside a transaction that was explicitly rolled back, confirmed timestamps_valid=true. No real token values were read, generated for testing, or exposed; no test connection was retained. Real TikTok consent must be repeated once after deployment because prior callback codes have been consumed and their token saves failed.

Callbacks now return to #growth, with an allowlisted failure code and a visible explanation that survives status refresh. Authorization codes, states, tokens and raw provider errors are excluded from return URLs. App-credential errors are distinguished from expired-code failures without exposing provider text.

## Verification
186 automated tests passed before the final expanded fresh-set/placement assertions; final run is recorded in the completion message. Coverage includes actual HTTP callback redirects, replay rejection, safe failures, owner-scoped review saves, serialized per-card undo/history, one-card regeneration preserving siblings, fresh-session account resume preserving rewritten script and versions, Copy gating, and complete studio interaction tests through JSDOM.

The connected browser tool is unavailable in this session (originating browser context required). No claim of a rendered Chromium or real-account OAuth success is made. Real TikTok approval and visual review remain the final browser checks. Deployment protection remains required; no public share or bypass links are used.
