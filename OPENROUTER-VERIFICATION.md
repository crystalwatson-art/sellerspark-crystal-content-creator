# SellerSpark OpenRouter verification notes

Baseline: preserved archival commit cc4fb46 (84 tests).
This working copy adds an OpenRouter free-only adapter and extends failover from Groq to OpenRouter to Gemini. Existing feature files remain outside this patch.

## Verified offline
- `npm test`: 94 passed, 0 failed, 0 skipped after the repair addendum.
- Free model selection is restricted to `openrouter/free` or identifiers ending in `:free`.
- Unparseable/unsafe generated output remains rejected by the existing safety gate, without silently switching writers.
- Groq transport failure tries OpenRouter first; on provider unavailability it can try Gemini.
- Safe diagnostics now distinguish parse failure, truncated output, and strict validation failure without returning provider response bodies.
- Validation failures now include a stable non-content rule code for the next live check.
- The prompt now requires 3–5 hashtag strings beginning with `#`, exactly three concise scenes, and bounded field lengths; malformed hashtag shapes remain rejected.

## Verification notes
- Real three-draft generation using `OPENROUTER_API_KEY` (never display/store the key in logs or files).
- End-to-end Groq 429 -> real OpenRouter -> three valid drafts, with source citations and required human approval.
- The default is restored to `openrouter/free` after the pinned Apodex endpoint returned `endpoint_or_model_not_found` in both live checks. The strict JSON-schema request remains enabled; OpenRouter documents that its free router filters for models supporting structured outputs.
- Confirm free router usage with the account's $0 limit; no paid model fallback.
- Visual browser regression for the Listing Optimizer after integration.

Crystal's latest reported controlled live check passed: simulated Groq failure
switched to live OpenRouter, produced three drafts, returned `backup_succeeded`
and `ready_for_review`, and kept human approval required. Codex did not repeat
that live request during this preservation pass.

## Example local server configuration (environment variables, not literal credentials)
`CONTENT_CREATOR_PROVIDER=groq CONTENT_CREATOR_BACKUP_PROVIDER=openrouter OPENROUTER_MODEL=openrouter/free npm start`

The existing `GROQ_API_KEY` and `OPENROUTER_API_KEY` must already be exported privately to the terminal. Set `GEMINI_API_KEY` to enable the additional Gemini fallback. Never write keys to this project.

This note records the provider configuration and the remaining verification
boundaries; credentials remain server-side and are not part of this package.
