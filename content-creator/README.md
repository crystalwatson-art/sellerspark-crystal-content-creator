# SellerSpark AI — Crystal's Content Creator

This local Content Creator component accepts a structured research brief and
turns it into exactly three TikTok draft packages for:

- Long Island City condo sellers
- Brooklyn townhouse sellers

It creates hooks, short scripts, clear viewer takeaways, written video
concepts, suggested scenes, captions, hashtags, and specific next steps. It
preserves supplied source references, source dates, and warnings. It does not
gather, validate, score, or fact-check research.

The fixture and tests use clearly labeled fictional data. Nothing in them is
verified real-world research.

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
with no drafts; it does not switch to OpenAI, templates, or any paid provider.

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
