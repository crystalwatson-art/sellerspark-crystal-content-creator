# SellerSpark AI — Crystal's Content Creator

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

The output is draft-only. Every result requires human approval, and there is no
publishing or customer-contact function. The structured handoff remains in the
API response for a future Listing Optimizer; it is intentionally not shown as
raw JSON in the everyday interface.

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

## Optional zero-cost backup writer

The optional backup is Google's Gemini Developer API using the default model
`gemini-3.8-flash`. Google's current pricing page lists free input and output
tokens for this model's Free tier, while its rate-limit page says limits vary
by model and project and are not guaranteed. Treat that as a limited
development tier, not a production capacity promise.

The backup is disabled unless all of these server-only settings are supplied:

    CONTENT_CREATOR_PROVIDER=groq
    CONTENT_CREATOR_BACKUP_PROVIDER=gemini
    GEMINI_MODEL=gemini-3.8-flash
    GEMINI_API_KEY=<server-only secret>

When enabled, Groq remains primary. A single backup attempt is made for safe
provider-availability failures such as rate limits, timeouts, network errors,
or configuration/authentication failures. If both AI writers fail, the
existing offline template writer is used only when the same research brief
passes the existing safety gate. The chain never switches because a model
returned unsafe, malformed, unsupported, or repetitive content; those results
remain stopped for review. Failover logs contain only provider names, safe
status categories, and HTTP status metadata—never keys, headers, or response
bodies. No provider is enabled in default template mode.

Gemini uses the documented Interactions API JSON response format and schema
validation. No live Gemini or Groq request is made by the test suite or local
demo.

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
