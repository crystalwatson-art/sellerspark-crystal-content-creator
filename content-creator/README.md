# SellerSpark — Crystal's Content Creator

Latest TikTok update: followers refresh automatically on signed-in startup and
every two minutes while the tab is visible. Authorized per-video views refresh
on the same schedule, preserving the selected video page. The follower goal is
editable and saved per owner on this device; the same goal follows the user
across audience locations. Current followers are read-only TikTok data. Video
views require the separate `video.list` consent. **213 automated tests pass.**
See [the automatic metrics report](reports/automatic-tiktok-metrics-20261030.md).

## Current independent build — October 30, 2026

The integrated studio now includes a model-directed **Content Creator** and
**Listing Optimizer**. Their local tools, structured feedback handoffs, separate
permissions, two-revision limit, stopping conditions and safe execution trace
are described in [agent/architecture.md](agent/architecture.md).
This is Crystal's independent implementation; it does not call a collaborator's
Research Agent or require shared repository integration.

The deployment currently remains in clearly labeled **sample mode** until its
owner configures the server-only `OPENROUTER_API_KEY` for Preview. With that
personal key present and no explicit legacy `CONTENT_CREATOR_PROVIDER` override,
the configured handler selects `agents` automatically. The default model is
`openrouter/free`; paid model IDs are rejected. Never put the key in browser code,
source control, a report or chat. Existing Groq/Gemini/OpenRouter writer adapters
remain intact for their earlier supported configurations.

AI generation requires SellerSpark sign-in. The agent roles have no account,
database, publishing or messaging tools; the authenticated server alone saves
the review after both agents finish. Human acceptance enables copying and does
not publish. A fictional input remains fictional even when a real model writes
the draft. Review text, decisions, versions and execution events persist with
the owner-scoped review. Calendar planning remains local to the browser.

Verification: 208 automated tests pass, including the model-decision protocol,
permission failures, bounded feedback loops and UI → API → simulated database
→ new browser session resume. Those tests use controlled model responses,
not a live-model or rendered-Chrome claim. See
[the implementation report](reports/two-agent-implementation-20261030.md).
Run `node scripts/evaluate-agents.js` in a privately configured environment for
the ten-case live evaluation; it preserves failures and reports `not_run` if no
provider is configured. Contribution ablation, human semantic grading and peer
red-team review remain separate required evidence, not inferred from unit tests.

Earlier component documentation below records the development history. Where
it describes unconfigured migrations or a future Optimizer, use the current
implementation report and architecture above for the latest state.

This local Content Creator component accepts a structured research brief and
turns it into exactly three TikTok draft packages for:

- Long Island City condo sellers
- Brooklyn townhouse sellers

It creates hooks, short scripts, clear viewer takeaways, written video
concepts, suggested scenes, captions, hashtags, and specific next steps. It
preserves supplied source references, source dates, and warnings. It does not
gather or live-check research, but it now requires a verification record before
using factual research for public-facing drafts.

The fixture and tests use clearly labeled fictional data. Nothing in them is
verified real-world research.

## Research verification gate

Public-facing drafts require `researchMode: "verified"`. Each topic must have
source references shaped like this:

    {
      "id": "source-1",
      "title": "Source title",
      "url": "<real HTTPS URL checked by the Research Agent>",
      "date": "YYYY-MM-DD",
      "verification": {
        "status": "verified",
        "checkedAt": "ISO timestamp"
      }
    }

Each factual claim must include `sourceId`, non-empty `text`, and:

    {
      "verification": {"status": "verified", "checkedAt": "ISO timestamp"},
      "evidence": {"quote": "Exact supporting excerpt", "locator": "Section or page"}
    }

The gate rejects reserved or malformed URLs, missing dates, stale sources,
missing verification records, and claims that only carry `supported: true`.
Its response separates `verifiedClaims`, `unsupportedClaims`, `warnings`, and
`missingEvidence`. It does not perform live URL checks, so the `verified`
status is an upstream Research Agent record, not a claim that this component
or an automated test checked the web.

`researchMode: "fictional"` is reserved for the labeled offline fixtures and
automated tests. It is never treated as verified research and is not allowed
for public-facing use.

### Research Agent handoff contract

Sha's Research Agent should provide the brief fields above without changing
this component. The minimum handoff is `researchMode`, `audience`, three
distinct `topics`, each topic's `sourceRefs`, and each claim's `sourceId`,
verification record, and evidence record. The Content Creator returns the
verification result and preserves the original source records for later human
review. Coordination is required before connecting the agents; this project
does not modify or call Sha's implementation.

## Run

    npm test
    npm run demo
    npm run start

Then open http://127.0.0.1:3000 in a browser and choose Run fictional test mode.
The visible interface does not expose a JSON editor. External research briefs
remain accepted through the local `POST /api/content` handoff for a future
Research Agent or human-supplied integration.

The automated tests cover both clearly labeled fictional briefs:

    fixtures/fictional-research-brief.json
    fixtures/fictional-brooklyn-townhouse-brief.json

## Editorial quality checks

Each generated set includes an `editorialQuality` review report with eight
heuristic checks: hook strength, topic distinctiveness, homeowner relevance,
natural spoken delivery, practical viewer value, reason to follow, credibility
and source safety, and consultation next-step clarity. It also checks for three
distinct angles, three distinct hooks, audience separation, and evidence that
each package uses its assigned supplied topic. The score is a review aid only;
it is not semantic judgment or a prediction of views, followers, leads, or
sales. Human editorial review remains required.
Warnings remain visible for human review, and the checks never invent facts or
replace the research-verification gate.

The output is draft-only. Every result requires human approval, and there is no
publishing or customer-contact function. The structured handoff remains in the
API response for a future Listing Optimizer; it is intentionally not shown as
raw JSON in the everyday interface.

## 14-day TikTok growth pilot

The dashboard includes a planning-only 14-day pilot with Buyers, Sellers, and
Both audience modes. It creates fourteen written prompts, accepts optional
starting and current follower counts, and measures progress toward 100 without
assuming an unknown starting count or promising growth. The tracker and
calendar are browser-local planning data; they do not schedule posts or
replace human review. The existing seller research brief still controls the
audience of generated drafts, so buyer-facing content requires an appropriate
Research Agent brief before it can be generated.

The research handoff preserves optional `audienceQuestions`,
`realEstateTrends`, and `followerAttractionOpportunities` fields. They are
upstream inputs only: this component does not gather, verify, or invent those
facts. Each draft also exposes a separate reason a viewer may follow, while
keeping the existing source, warning, and approval safeguards.

### TikTok connection status

The server now contains a mockable, opt-in official TikTok connection flow.
Login Kit requests `user.info.basic`, `user.info.stats`, and `video.upload`; the
server exchanges the authorization code and keeps TikTok tokens encrypted at
rest in the prepared owner-scoped Supabase table. Browser requests use the
verified Supabase bearer identity; no browser-supplied user ID is trusted.

The dashboard can start authorization and sync a follower count when the
integration is configured. The fictional demo remains usable without sign-in.
Draft handoff requires an explicit human-approved HTTPS video URL and returns a
TikTok draft request only. Direct posting via `video.publish`, automatic
follows, unsolicited comments, messaging, and artificial engagement are
disabled. The migration is prepared but not applied, and no OAuth or TikTok API
call was made during local testing.

Activation requires a TikTok developer app, approved scopes, an HTTPS redirect
URI, the prepared migration, and server-only values:

    TIKTOK_CLIENT_KEY=<server-only configuration>
    TIKTOK_CLIENT_SECRET=<server-only secret>
    TIKTOK_REDIRECT_URI=https://<approved-host>/api/tiktok/oauth/callback
    TIKTOK_TOKEN_ENCRYPTION_KEY=<64-hex-character server-only secret>
    SELLERSPARK_SUPABASE_SERVICE_ROLE_KEY=<server-only secret>

The server routes are `POST /api/tiktok/oauth/start`, `GET
/api/tiktok/oauth/callback`, `GET /api/tiktok/status`, `GET
/api/tiktok/follower-count`, `POST /api/tiktok/draft-upload`, and `POST
/api/tiktok/disconnect`. Authenticated routes require a verified Supabase
bearer token. OAuth state is short-lived, stored only as a SHA-256 hash in the
prepared `sellerspark_tiktok_oauth_states` table, and consumed atomically once;
no Supabase access token or OAuth state is placed in browser cookies. The
server-side adapter uses the dedicated Supabase service-role key only from
server configuration, while ordinary `anon` and `authenticated` clients have
no table grants for TikTok token or OAuth-state records. The callback never
accepts a browser-supplied owner ID, and the durable state table makes replay
protection work across Vercel instances after the prepared migration is
applied.

## Listing Optimizer review adapter

The server adds a `listingReview` object to each Content Creator API response.
It preserves each draft's original hook, script, takeaway, concept, caption,
hashtags, and suggested next step, then adds review suggestions, reasons,
factual-support warnings, missing evidence, and a per-draft review history.
For clearly labeled fictional test briefs, the adapter also creates a
deterministic local proposed revision that uses only the supplied audience and
question-led meaning. It records field-level changes and reasons. The local
popup compares original and proposed content, and Accept, Reject, Request
revision, and Restore original update the selected working draft only. These
controls never publish or contact a customer. Request revision is capped at
the existing two automatic attempts. For verified research, a configured
revision provider must return a safe structured result; otherwise the adapter
reports that a revision is unavailable instead of inventing copy.

The evaluator is intentionally modular and limited to handoff hygiene. Sha's
future real-estate evaluation rules can be injected through `evaluateDraft`
without overwriting this contract. Review records are stored locally by the
server in a small JSON file outside the project directory (by default
`~/.sellerspark/listing-review-store.json`). Records have stable IDs, versions,
atomic writes, and stale-update protection. A corrupt store is reported safely
and is not overwritten. The browser keeps a convenience copy and archive, but
the server record is the source used by review controls. Reset clears only the
active browser view and does not delete the server archive.

The server exposes `GET /api/reviews/:id` and `POST /api/reviews/:id/actions`
for the dashboard. Request Revision uses the configured AI provider boundary
for verified research, preserving original audience, citations, evidence, and
warnings. The existing fictional test mode continues to use its deterministic
local candidate and never calls an AI provider.

## Vercel preview

The `api/index.js` entry point reuses the same request handler for a Vercel
preview. Set the Vercel project root to `content-creator/` in the team
repository. The preview defaults to template mode and fictional data; it does
not require provider keys. Review records use Vercel's temporary writable
`/tmp` storage, so they are suitable for a demonstration but are not durable
across cold starts or deployments. Do not treat the preview as production
storage or enable publishing from it.

## Optional AI writer

Offline template mode is the default and is the only mode used by the automated
tests and local demo. The opt-in OpenAI writer is server-side and uses the
Responses API with strict Structured Outputs. It is not enabled unless Crystal
explicitly approves it and configures all of the following server environment
variables:

    CONTENT_CREATOR_PROVIDER=openai
    OPENAI_MODEL=<approved model name>
    OPENAI_API_KEY=<server-only secret>

For the optional Groq free-tier writer, use a separate provider selection and
server-only key:

    CONTENT_CREATOR_PROVIDER=groq
    GROQ_MODEL=openai/gpt-oss-120b
    GROQ_API_KEY=<server-only secret>

The selected Groq model is `openai/gpt-oss-120b`. Its adapter uses Groq's
OpenAI-compatible Chat Completions endpoint and strict JSON Schema Structured
Outputs. A Groq `429` rate-limit response returns a safe `rate_limited` result
and can trigger the optional backup chain described below.

## Verified free backup writer

Groq is the primary AI writer. The verified free backup is OpenRouter's free
router, not a paid model or paid fallback. Configure the chain only on the
server with:

    CONTENT_CREATOR_PROVIDER=groq
    GROQ_MODEL=openai/gpt-oss-120b
    GROQ_API_KEY=<server-only secret>
    CONTENT_CREATOR_BACKUP_PROVIDER=openrouter
    OPENROUTER_MODEL=openrouter/free
    OPENROUTER_API_KEY=<server-only secret>

OpenRouter is restricted in code to `openrouter/free` or an explicitly free
model identifier ending in `:free`. When Groq has a safe availability failure
such as a rate limit, timeout, network error, or configuration/authentication
failure, the server makes one bounded OpenRouter backup attempt. If both AI
writers fail, the existing offline template writer is used only when the same
research brief passes the safety gate. Unsafe, malformed, unsupported, stale,
or repetitive provider output is stopped for review rather than replaced.

The Gemini adapter and earlier Gemini verification notes remain preserved as
historical, optional code, but Gemini is not the current configured backup in
this verified setup. Failover logs contain only provider names, safe status
categories, and HTTP status metadata—never keys, headers, or response bodies.
No provider is enabled in default template mode. No mode publishes content or
contacts customers automatically, and human approval is always required.

No live provider request is made by the test suite or local demo.

Never put the API key in browser code or commit it to this folder. When the
OpenAI writer is unavailable, returns malformed output, produces unsupported
claims, or fails the freshness check, the app returns no drafts and does not
silently substitute offline templates. The result identifies the writer that
produced it.

Draft freshness uses process-memory history keyed by audience. It compares
hooks and scripts within the current batch and against recent drafts, then
allows at most one automatic rewrite by default. History is not persisted and
is cleared when the server restarts; no database or external storage is used.

Automated tests inject mocked Responses API results. No live or paid OpenAI
or Groq request is made by the tests, demo, or default server mode.

