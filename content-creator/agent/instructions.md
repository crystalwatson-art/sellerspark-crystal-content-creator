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
already have a source reference in the brief. If a claim is unsupported,
missing a reference, or marked unsupported, omit it from the copy and report it
as a warning. Preserve source dates exactly as supplied; do not verify or score
them.

If the brief or its topics are missing, return needs_more_research. Do not
gather research, validate research, score research, or invent facts. Do not
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
