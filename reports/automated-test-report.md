# Crystal's Content Creator — Automated Test Report

Date: 2026-10-23

## Final result

PASS — 94 tests passed, 0 failed, 0 skipped.

The preserved review package baseline had 83 passing tests. The additional
test covers the documented Gemini Interactions REST response shape.

Command:

    npm test

Coverage:

1. Normal fictional brief creates exactly three complete drafts for the Long
   Island City condo audience.
2. Separate fictional Brooklyn townhouse audience brief.
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
15. Each package has a distinct topic-driven hook and clear viewer takeaway.
16. Duplicate research topics are blocked instead of receiving fabricated
    creative variety.
17. Explicit uncertainty warnings remain attached to the review handoff.
18. OpenAI-shaped output returns exactly three structured drafts with writer
    identity and strict schema configuration.
19. Repetitive output triggers one bounded rewrite attempt.
20. Repeated freshness failure returns no drafts without template fallback.
21. Malformed model output is rejected safely.
22. Unsupported claim identifiers and internal viewer-facing language are
    rejected safely.
23. Missing research stops before any provider request.
24. Brooklyn history and audience metadata remain separate from LIC output.
25. Provider instructions treat the supplied brief as untrusted data and keep
    the no-publication contract.
26. Missing OpenAI configuration returns no drafts without a silent fallback.
27. Groq returns three structured drafts with preserved review safeguards.
28. Groq request payload keeps the research boundary and strict JSON schema.
29. The Groq adapter returns a safe rate-limit result without switching by itself.
30. Malformed Groq output is rejected without template fallback.
31. Missing Groq configuration returns no drafts.
32. Authentication failures expose only safe category and HTTP status metadata.
33. Network failures receive a safe diagnostic and next step.
34. Groq-generated takeaways survive validation and reach the popup contract.
35. Missing Groq takeaways are rejected without silently inventing replacement text.
36. Fictional fixtures are labeled test-only and never marked verified.
37. Missing source references block public-facing drafts.
38. Reserved or fabricated-looking URLs are rejected.
39. `supported: true` without verification does not prove a factual claim.
40. Explicitly unsupported claims are separated from missing evidence.
41. Stale research is blocked before draft generation.
42. Verified claims preserve exact claim-to-source attribution.
43. Fictional LIC drafts connect to three reviewable Listing Optimizer records.
44. Fictional Brooklyn townhouse review records keep the audience separate.
45. Listing review preserves factual warnings and missing evidence.
46. Accept, Reject, and Request revision actions create review history.
47. Automatic revision requests stop at the existing maximum of two.
48. Real-estate evaluation rules remain injectable and are not hardcoded here.
49. Blocked Content Creator results cannot create a reviewable optimizer queue.
50. Gemini returns three structured drafts through a mocked response.
51. Gemini request format keeps credentials out of the payload.
52. Gemini timeout handling returns a safe provider-unavailable result.
53. Missing Gemini configuration makes no request.
54. Groq rate limits fail over once to mocked Gemini.
55. Provider timeout with no backup uses templates only when the brief is safe.
56. Backup failure is bounded and safely falls back to templates.
57. Invalid AI output does not trigger availability failover.
58. Safe provider-failure logs contain no credentials or raw provider text.
59. Fictional Listing Optimizer records include proposed revisions, field-level
    reasons, and preserved source metadata.
60. Accept applies only the selected proposed revision; Reject and Restore
    original preserve the original working copy.
61. Request revision produces a new fictional candidate and remains bounded by
    the two-attempt limit.
62. Verified research without an injected revision provider reports the
    limitation truthfully instead of inventing copy.
63. The compact mobile breakpoint wraps the full audience label instead of
    truncating the intended homeowner group.
64. Review records receive stable IDs and survive a new server-store instance.
65. Stale review updates are rejected without overwriting newer work.
66. Corrupt review data is reported safely and is not overwritten.
67. AI revision generation preserves audience, citations, warnings, and human
    approval flags.
68. A mocked Groq revision failure uses one mocked Gemini backup.
69. Revision-provider failure reports unavailable instead of fabricating copy.
70. The review API persists actions and rejects stale versions.
71. The review API keeps the fictional Brooklyn audience separate.
72. Verified research calls a configured revision provider instead of using an
    unavailable placeholder.
73. Provider request input preserves source URLs, source dates, verification
    records, and claim evidence.
74. Conflicting source and claim records are blocked or separated instead of
    being treated as verified facts.
75. Customer-facing branding uses SellerSpark and the approved tagline without
    changing the internal provider compatibility identifiers.

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
  topic-driven hooks, viewer takeaways, and complementary captions. The
  offline templates use the supplied question and audience without inventing
  property or market facts.
- The fictional fixtures now include realistic, clearly labeled homeowner
  questions for both Long Island City condos and Brooklyn townhouses.
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
- Groq writing instructions now require seller-specific opening hooks, natural
  professional spoken language, minimal unnecessary emojis, and no invented
  building details or market claims.
- The popup now shows an explicit review warning if an older or malformed API
  response omits a takeaway; it never substitutes a fabricated takeaway.
- The mocked Groq regression test confirms all three takeaways reach the popup
  contract, while the missing-field test confirms the provider response is
  rejected with no template fallback.
- The research verification gate now requires an explicit `verified` research
  mode, HTTPS source records, source dates, upstream verification timestamps,
  and claim-level evidence with a quote and locator. It does not fetch URLs or
  claim that local tests performed live verification.
- Research failures now distinguish `verifiedClaims`, `unsupportedClaims`,
  `warnings`, and `missingEvidence`; public-facing draft generation stops for
  missing or unverified factual research.
- The Listing Optimizer adapter now preserves original Content Creator fields,
  adds deterministic fictional proposed revisions with field-level reasons,
  carries factual-support warnings and missing evidence, and records human
  review history without publishing or contacting customers. Its evaluator seam
  is reserved for Sha's future rules.
- Accept, Reject, Request revision, and Restore original now update the
  selected working draft only. Verified research without an injected revision
  provider reports that no revision is available rather than fabricating one.
- The local server now persists active review state in an external JSON store;
  the browser keeps a convenience copy and small archive across refreshes.
  Reset requires confirmation and clears only the active view.
- The optional Gemini backup writer now uses the documented Interactions API
  JSON response format with server-side credentials and a bounded one-attempt
  failover chain. Mock tests cover rate limits, timeout-style unavailability,
  backup failure, safe template fallback, and refusal to mask invalid AI
  output. No live provider request was made.
- The mobile review exposed a truncated audience status value at the compact
  breakpoint. The audience value now wraps, and a focused interface contract
  test protects that behavior.
- Listing review persistence now uses a local server-side JSON store outside
  the project directory, with stable IDs, atomic writes, versions, stale-update
  protection, and safe corruption handling. The browser review controls now use
  the persisted review API rather than mutating only browser-local state.
- Verified-research Request Revision now has a server-side provider boundary;
  mocked AI output is validated and research metadata is restored from the
  original draft. One backup attempt is permitted, and no safe proposal means
  no fabricated revision.
- Provider request context now carries source URLs, dates, verification
  records, and claim evidence so downstream writers cannot lose attribution.
- The research gate now detects conflicting duplicate source or claim IDs and
  refuses to treat those records as a clean verified brief.
- Customer-facing dashboard and package documentation now use SellerSpark and
  the approved tagline; internal provider compatibility identifiers remain
  unchanged.

## Independent 83-test verification addendum

The extracted package was rerun on 2026-10-23. The eight additional cases
covered by this package confirm that:

- Invalid, unsafe, stale, or unsupported Gemini backup output never becomes
  offline template content.
- Exhausted providers report a safe final result when fallback is disabled.
- An unsafe brief cannot become template content even when both providers are
  unavailable.
- The HTTP content endpoint switches from a mocked exhausted Groq provider to
  mocked Gemini without interrupting the request.
- The HTTP content endpoint refuses to substitute offline drafts for rejected
  Gemini output.

The suite output included only safe provider categories and statuses. It made
no live Groq or Gemini request.

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
- three distinct hooks, scripts, takeaways, and creative angles

The API response also included a `listingReview` object with three reviewable
records, human-approval flags, and a two-attempt revision limit. The local
popup review controls were not part of this command-line demo; they were
checked separately in the safe browser preview.

The dashboard also keeps the external research handoff available through
`POST /api/content` while keeping raw JSON out of the everyday UI.

The fixture is explicitly fictional and not verified real-world research.

The failover tests use only fictional briefs and mocked provider responses.
They do not verify live Gemini availability or quota behavior.

## OpenRouter repair addendum — 2026-10-23

The OpenRouter adapter now records safe failure categories that distinguish
response parsing, truncated output, and strict draft validation. It accepts
only a single outer JSON fence or text parts from the documented chat
completion response; it does not accept arbitrary prose or bypass the
existing source, claim, audience, safety, or three-draft checks. The output
budget is 8,000 tokens to reduce incomplete three-draft responses, while the
prompt asks for concise, professional seller-facing copy.

OpenRouter-focused tests: 10 passed, 0 failed.
Full suite: 94 passed, 0 failed, 0 skipped, with temporary localhost listeners
allowed for the four HTTP tests.

Validation diagnostics now include a stable rule code such as `required_field`,
`creative_angle`, `claim_reference_shape`, or `unsafe_viewer_language` without
including model-generated text. The latest live report preserved only the
generic `validation_failure` category, so its exact violated rule cannot be
reconstructed from that run.

The OpenRouter prompt now requires hashtags as a 3–5 item array of short
strings beginning with `#`; the validator still rejects malformed shapes.
The prompt also caps each field and requires exactly three short scenes per
draft. The free-model output budget is 8,000 tokens after the live failover
reported a confirmed 5,000-token truncation.

The default is restored to `openrouter/free` after the pinned Apodex endpoint
returned `endpoint_or_model_not_found` in both live checks. The existing strict
schema remains in `response_format`; local tests confirm the schema is present.

The live OpenRouter key was absent from the Codex process, so no live request
was made during this repair. The earlier HTTP 200 basic test does not prove
that the full writer now produces three accepted drafts. A controlled live
writer test and Groq-failure to OpenRouter test remain pending in Crystal's
authenticated terminal.

## AI-provider test safety

All OpenAI-writer tests use injected fictional responses. No API key was read,
no live request was made, and no paid provider call was enabled. Groq tests use
mocked Chat Completions responses and a mocked rate limit. The default server
remains in offline template mode. Research-verification tests use mocked source
records and are not live source checks.
