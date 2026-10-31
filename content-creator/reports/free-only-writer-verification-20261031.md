# Free-only writer verification — October 31, 2026

Source: `2ee0d4bc534484a71b045a02c03df1538227904e`.
READY deployment: `dpl_2JCGH5uSptQHzq1kJhETXk5DgKf4`, assigned to the existing stable preview hostname.

## Configuration

- Exactly three AI provider transports: Groq → OpenRouter → Gemini.
- Offline Template is the final no-API fallback, not a fourth AI provider.
- Removed the legacy OpenAI API startup and generation/revision wiring. Unsupported explicit provider modes fail closed before a request; an OpenAI key alone cannot enable generation.
- OpenRouter model validation permits `openrouter/free` or explicitly `:free` model IDs; paid IDs are rejected.
- Environment metadata confirms the three provider keys are configured for Preview, with no OpenAI key or legacy provider-mode override. Secret values were not revealed.
- Groq account Billing visibly identifies Free, $0, Current Plan. Google AI Studio's selected project identifies Free tier and Set up billing. These observations do not cryptographically establish which project an opaque deployed Gemini key belongs to. The app cannot prevent an account owner from later enabling provider billing; billing must remain disabled.
- No billing settings, purchases, upgrades, or provider keys were changed during verification.

## Tests and live checks

`node --test --test-concurrency=1`: 224 passed, zero failures. Includes rejection of OpenAI and unknown provider modes, mocked three-provider recovery, offline fallback, authenticated persistence and owner isolation.

On the stable deployed app, using a newly generated fictional template test queue:

- Shorter: version 1 → 2; script shortened; other two cards unchanged.
- Regenerate this card: version 3 contained a different sample idea.
- Undo restored version 2 and its shortened script.
- Reject displayed Rejected; Undo restored Revision Requested.
- Accept displayed Accepted and enabled Copy approved content.
- Copy displayed Copied. No publication occurred.
- Reload preserved version 2, shortened script and Accepted state.
- Overview navigation returned to the studio.

## Remaining limits

Live services have responded individually, but rate limits, unavailable responses and timeouts have prevented verification of a complete AI-only run through all agent stages. Template recovery succeeds; this does not prove complete AI-only success.

Repeated full Generate requests can return the same deterministic offline fallback wording. Per-card sample regeneration does change the idea. This report does not claim full-set template freshness.

The supplied research brief remains fictional. This change is not evidence of a connected live research service or renewed TikTok authorization. Prior TikTok metrics/consent limitations require separate current verification.
