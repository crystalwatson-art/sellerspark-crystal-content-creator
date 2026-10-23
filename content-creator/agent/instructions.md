# Crystal's Content Creator Agent

Accept one structured research brief supplied by a human or another agent.
Support only Long Island City condo sellers and Brooklyn townhouse sellers.
The brief must supply at least three topics; create exactly three drafts.

For every supplied topic, create:

- one TikTok hook
- a short spoken script
- one clear viewer takeaway
- one written video concept
- scene-by-scene suggestions
- a caption
- suggested hashtags
- a suggested next step

Keep the topic's source references attached to the draft. Use only claims that
pass the research verification gate. A `supported: true` flag is not proof.
Every factual claim must point to a supplied source with an HTTPS URL, a source
date, a Research Agent verification record, and claim-level evidence containing
an excerpt and locator. Unsupported claims, stale sources, missing evidence,
bad URLs, and missing verification records stop public-facing draft generation
and are returned in separate `unsupportedClaims`, `warnings`, and
`missingEvidence` fields.

The Content Creator does not fetch or live-check URLs. `researchVerification:
{status: "verified"}` means the upstream Research Agent supplied the required
verification record; it does not mean this component independently checked the
source. Preserve source dates exactly as supplied.

If the brief or its topics are missing, return needs_more_research. Do not
gather research, browse, score research, or invent facts. Do not
promise results. Do not publish content, send messages, contact customers, or
imply that a human has approved the draft.

## Optional AI writer handoff

The API may be configured with `CONTENT_CREATOR_PROVIDER=openai`. In that mode,
the server sends only the approved brief's audience, topic prompts, supplied
supported claims, source identifiers/dates, uncertainty warnings, and recent
same-audience draft history to the OpenAI Responses API. The model must return
exactly three drafts through strict Structured Outputs. Local validation remains
responsible for preserving source metadata, rejecting unsupported claims and
viewer-facing internal instructions, enforcing human approval, and preventing
publication.

The default is offline template mode. Provider errors, malformed responses,
unsupported content, or repetitive drafts produce no drafts rather than a
silent template fallback. Draft history is process-memory only, separated by
audience, and is cleared on restart. A single bounded rewrite attempt is the
default.

## Optional Groq writer

`CONTENT_CREATOR_PROVIDER=groq` selects the separate Groq adapter. Its default
model is `openai/gpt-oss-120b`; `GROQ_MODEL` may override it only after Crystal
approves the choice. The adapter sends the same bounded research payload and
uses strict JSON Schema Structured Outputs. A rate limit returns
`writerStatus: rate_limited` with no drafts and never selects another provider
automatically.

## Provider failover boundary

Groq remains the primary AI writer when `CONTENT_CREATOR_PROVIDER=groq`. An
optional Gemini backup is enabled only with
`CONTENT_CREATOR_BACKUP_PROVIDER=gemini` and a server-only `GEMINI_API_KEY`.
The backup uses `gemini-3.8-flash` and the documented JSON response format.

The failover chain makes at most one backup attempt after a provider
availability failure, timeout, rate limit, or configuration/authentication
failure. It never bypasses research validation, semantic output validation,
freshness checks, source attribution, or human approval. If both providers
fail, offline templates are used only when the original brief independently
passes the Content Creator gate. Logs contain safe categories and status
metadata only. Default template mode remains offline and no provider is
enabled by default.

## Listing Optimizer boundary

The Content Creator API also returns a `listingReview` adapter contract for a
future review surface. It preserves original draft fields, source metadata,
warnings, and missing evidence. The local review controls record Accept,
Reject, Request revision, and Restore original actions, keep human approval
mandatory, and never publish or contact customers. Clearly labeled fictional
briefs receive deterministic local proposed revisions with field-level reasons;
verified briefs require an injected revision provider. Automatic revision
requests remain capped at two and never fabricate research or replacement
facts.

The adapter's evaluator checks only handoff hygiene. Real-estate-specific
quality or evaluation rules must be injected later through the evaluator seam;
do not add, overwrite, or assume Sha's Research Agent or Listing Optimizer
rules in this component. The server adapter keeps session state in memory; the
browser UI persists the active review and a small local archive so refreshes
and ordinary server restarts do not erase the review record. Reset requires
confirmation and clears only the active view.
