# Live recovery follow-up — October 31, 2026

Latest source: `4ee022e83bca1c212964ded56eb7d9b54851ecc2`.
Stable preview assigned to READY deployment `dpl_HdK8wpSANGsuh3tuYV3HRTMLSBHF`.

## Changes and checks

Reduced maximum requested output from 8,000 tokens on every decision to 1,024 for evidence reads and 2,048 for other control steps. Creator drafting retains 8,000. This reduces unnecessary output reservations; it does not guarantee quota availability. All 224 tests passed after this change.

The subsequent real browser test reached Creator handoff and Optimizer checks but stopped on an explicitly provider-declared output length cutoff. Corrected recovery so `truncated_response` advances to the next free provider. Partial output is never accepted. Other malformed-response, unsafe-output and evidence validation failures retain their existing stops. The regression suite now passes 225 tests, zero failures.

## Latest live result

Run `21956b87-2d4f-4443-9db9-966d23d1f0b5` on the stable preview:

1. Groq returned three responses, then rate-limited.
2. OpenRouter returned three responses, then explicitly reported a truncated response.
3. Recovery advanced to Gemini, which returned unavailable (HTTP 503).
4. The app produced three clearly labeled Offline template fallback drafts and saved them to the account for human review.

This verifies the repaired live cutoff-to-next-provider path and safe final fallback. It does not establish a complete AI-only generation or seamless ongoing free-provider availability. No paid model, billing upgrade, OpenAI connection, publication or external message was activated.

## CampaignFlow comparison requested by owner

Read `script.js` in `crystalwatson-art/campaignflow-ai` on both `main` (blob `22739bcbfdb87f236de67003484ac94e6fec8a2e`) and `campaignflow-commerce-upgrade` (blob `078b05e014038acf3fcea12138b5b6806efed056`). Both use local prewritten message arrays, substitute product/audience/store values, and shuffle selections; no live model API call powers generation. CampaignFlow code was not modified. SellerSpark's template fallback already implements the same broad no-model approach; substituting CampaignFlow would not repair live AI availability.
