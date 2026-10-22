# Crystal's Content Creator — Automated Test Report

Date: 2026-10-22

## Final result

PASS — 32 tests passed, 0 failed, 0 skipped.

Command:

    npm test

Coverage:

1. Normal fictional brief creates exactly three complete drafts for the Long
   Island City condo audience.
2. Brooklyn townhouse audience.
3. Missing research.
4. Malformed topic input.
5. Fewer than three topics.
6. Missing source references.
7. Unsupported factual claims.
8. Source and source-date preservation.
9. Stable future-Listing-Optimizer handoff format.
10. Unsupported audience safety behavior.
11. No draft objects when required topics are malformed or incomplete.
12. Dashboard controls and removal of the everyday JSON editor.
13. Client wiring for popup navigation, reset, and theme switching.
14. Viewer-facing scripts use distinct, conversational language without the
    internal brief-handling phrase.
15. Duplicate research topics are blocked instead of receiving fabricated
    creative variety.
16. Explicit uncertainty warnings remain attached to the review handoff.
17. OpenAI-shaped output returns exactly three structured drafts with writer
    identity and strict schema configuration.
18. Repetitive output triggers one bounded rewrite attempt.
19. Repeated freshness failure returns no drafts without template fallback.
20. Malformed model output is rejected safely.
21. Unsupported claim identifiers and internal viewer-facing language are
    rejected safely.
22. Missing research stops before any provider request.
23. Brooklyn history and audience metadata remain separate from LIC output.
24. Provider instructions treat the supplied brief as untrusted data and keep
    the no-publication contract.
25. Missing OpenAI configuration returns no drafts without a silent fallback.
26. Groq returns three structured drafts with preserved review safeguards.
27. Groq request payload keeps the research boundary and strict JSON schema.
28. Groq rate limits return no drafts without switching providers.
29. Malformed Groq output is rejected without template fallback.
30. Missing Groq configuration returns no drafts.
31. Authentication failures expose only safe category and HTTP status metadata.
32. Network failures receive a safe diagnostic and next step.

## Corrections made during verification

- The original component accepted fewer than three topics; it now reports
  needs_more_research instead of padding content with invented research.
- Malformed topics and claims could throw; they now return structured warnings.
- Invalid audiences could reach draft generation; they now stop safely.
- Incomplete topic sets could still emit draft objects; they now stop safely
  with no drafts until the brief is complete.
- The output-shape test expected one key in the wrong sorted position; the test
  was corrected.
- Draft packages now use three distinct creative angles and include written
  video concepts and scene suggestions without adding factual claims.
- Viewer-facing scripts now use natural homeowner language and preserve the
  qualified-professional and human-review safeguards.
- The final UI pass adds a restrained coral accent and reduces headline and
  vertical spacing without changing the popup layout.
- The generation logic now uses three distinct creative approaches, creates
  topic-driven hooks and takeaways, and keeps captions complementary to the
  scripts.
- Weak briefs with duplicate topics now return needs_more_research instead of
  pretending they support three different drafts.
- Supplied uncertainty warnings now remain available in each draft's review
  metadata and visible warning list.
- The optional server-side OpenAI writer now uses the Responses API's strict
  Structured Outputs schema, preserves local research metadata, identifies its
  writer, and never silently falls back to templates.
- Draft history now checks hooks and scripts within the current batch and
  against recent same-audience drafts, with one bounded rewrite attempt and no
  persistence beyond the running process.
- The optional Groq adapter now reuses the same research validation, output
  validation, source preservation, safety checks, and freshness history as the
  OpenAI writer. Its selected default model is `openai/gpt-oss-120b`.
- Groq HTTP 429 responses become a safe `rate_limited` result with no drafts;
  the server never switches automatically to OpenAI, templates, or a paid
  provider.
- Provider failures now retain only safe diagnostic metadata: category, HTTP
  status/status class when available, plain-language explanation, and next
  step. Provider response bodies, headers, and credential values are not
  returned.

## Interim correction during this run

One focused assertion initially expected every script to repeat the
qualified-professional wording. The second approved angle intentionally gives
the viewer a preparation step instead. The assertion was corrected to test
useful action language in every script and the dedicated CTA field separately;
the final suite is fully passing. A second audience assertion was narrowed to
the hook and script, where the audience label is required; complementary
captions are allowed to avoid repeating the property label.

## Demo result

    npm run demo

PASS — the fictional LIC brief produced three drafts with:

- status: ready_for_review
- humanApprovalRequired: true
- automaticallyPublished: false
- customerContacted: false
- writer: offline_template
- writerLabel: Offline template writer

The dashboard also keeps the external research handoff available through
`POST /api/content` while keeping raw JSON out of the everyday UI.

The fixture is explicitly fictional and not verified real-world research.

## AI-provider test safety

All OpenAI-writer tests use injected fictional responses. No API key was read,
no live request was made, and no paid provider call was enabled. Groq tests use
mocked Chat Completions responses and a mocked rate limit. The default server
remains in offline template mode.
