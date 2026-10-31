# Verified live two-agent recovery fix — October 31, 2026

## Confirmed result

Source commit: `6bce698b9c81467c4d893eae793ad555a7a4ffd1`.
Verification deployment: `dpl_DeFqfFeRRTZit7HiJ4xqQhpNdQt5`, READY.
Assigned to the existing protected stable SellerSpark preview hostname.

A one-shot live verification ran in Vercel's build environment using the same provider-chain factory, agent implementation, existing server-only Preview credentials, fictional research fixture and 120-second budget as the app. No secret value was retrieved or logged. No template fallback is available in this verification script; a failed or template result fails the verification deployment.

The deployment log recorded:

```json
{
  "passed": true,
  "elapsedMs": 23508,
  "writer": "agent_system",
  "status": "ready_for_review",
  "draftCount": 3,
  "handoffsMatched": true,
  "roles": ["content_creator", "listing_optimizer"],
  "stopReason": "ready_for_human_review",
  "checks": [],
  "humanApprovalRequired": true,
  "automaticallyPublished": false
}
```

Actual provider sequence: Groq responded twice, then rate-limited; OpenRouter rate-limited; Gemini responded eleven times and the workflow completed. This proves actual live availability recovery and cooperation by both roles. It does not claim all providers independently completed the entire workflow or guarantee future free-tier availability.

## Changes

- Request schemas now state exactly three packages, at least three scene suggestions and at least one hashtag, matching existing validation.
- Gemini now defaults to stable `gemini-3.5-flash-lite`, with its documented minimal thinking mode. Google lists this model's input/output as free on the Free tier. No billing setting was changed.
- One provider-declared short quota cooldown can be honored only after all backups fail and only if it fits the remaining deadline. The exact current role, observations and task are resumed. At most one such cooldown occurs per generation; no unbounded retry loop.
- Compact, fixed-category validation diagnostics identify failures without logging draft text, credentials or raw provider errors.
- The OpenAI API remains disabled. Exactly three AI provider services remain: Groq, OpenRouter and Gemini. Template remains separately labeled fallback.

## Software checks

`node --test --test-concurrency=1`: **227 passed, zero failures**.
New checks cover schema/validator agreement and deadline-bounded cooldown recovery preserving the same decision context, without repeated waiting. Existing permission, claim/evidence, account isolation, card history, and human approval checks remain passing.

## Limits

This was a live server-side two-agent test, not a new signed-in browser-to-database test. The connected browser tool is unavailable in this turn, so no fresh rendered-browser or account-saving check is claimed for this commit. Earlier live signed-in review, approval, copying and reload-persistence checks remain recorded separately.

The fixture is fictional. This test does not establish live research, TikTok video-view consent, ten-case evaluation completion, peer red-team completion or semantic editorial grading. No publication, messages, paid services or local-computer installation occurred.

## Official provider references checked

- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
- https://ai.google.dev/gemini-api/docs/thought-signatures.md
- https://console.groq.com/docs/rate-limits

