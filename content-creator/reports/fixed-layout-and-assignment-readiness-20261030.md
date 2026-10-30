# Fixed presentation and school readiness — October 30, 2026

## Latest user direction
Card size and placement are design decisions, not user controls. Remove the opacity setting from Account as well. Open drafts in a compact centered panel. Preserve the room, Day View, revised card flow, saved work, optional remembered sign-in and ownership boundaries. No further layout decisions are requested from the user.

Implemented: removed placement/size controls and their preference listeners; fixed the row to 864px maximum, responsive on mobile, with a centered 570px maximum draft panel. Removed Account opacity controls and their handlers. Night dialog tint is fixed at .78 and Day View dialog tint remains .70. Old saved placement/scale/opacity preferences are ignored without touching draft/history storage. Motion preference and reset controls remain.

187 automated tests passed. Tests cover absence of removed controls and ignoring stale design preferences, together with the existing studio, card, auth, database adapter and callback tests. Live rendered-browser QA is still unavailable because the browser connector requires its originating browser context; this report does not claim visual Chromium verification.

## School sources read in full
- SellerSpark AI — Pursuit PRD Template Alignment — Review Draft.pdf, modified October 26, 2026, Library ID libfile_c96dc86b6b1481919636817f204c0444. This explicitly remains a joint-review draft, not an approved submission or exact class rubric.
- Crystal Watson Agent PRD Net New Build (1).pdf, modified October 26, 2026, Library ID libfile_3006521be1f08191949eb8509355f0bf. Four pages, including the two-revision stopping rule, human approval and three evaluation cases.
- Current agent/instructions.md, README.md and OPENROUTER-VERIFICATION.md. These preserve prior implementation and the user's reported prior live OpenRouter success; that earlier report is not a fresh verification of the deployed app.

## Requirement assessment
| Required behavior in the saved PRD | Current evidence | Remaining work |
| --- | --- | --- |
| Three packages with scripts, captions, hashtags, next steps and audience labels | Automated component and studio tests pass for both fictional audience fixtures | Live-model output still needs deployed verification |
| Structured research → Content Creator → Listing Optimizer handoff with sources, dates, uncertainty and IDs | Contract validation and review-adapter tests pass | The external Research Agent is not connected; do not claim that it is |
| Optimizer feedback, stopping rules, human review | Legacy review path retains two attempts; integrated suggestion controls now also stop at two; direct human text editing stays available | Demonstrate the actual AI agent feedback path after writer configuration |
| Block unsupported claims and missing evidence | Research verification tests pass; integrated Accept now rejects records containing unsupportedClaims or missingEvidence | Real-source case needs a verified input brief |
| Human final output and readable results history | Accepted-content Copy gating, per-card versions/Undo, owner-scoped account resume tests pass | Confirm in the signed-in deployed browser |
| Normal LIC, conflicting Brooklyn evidence, empty research evaluation cases | Corresponding verification and audience tests exist and pass | Run and record the final deployed agent evaluations |
| TikTok publication/analytics | PRD allows transparent sample data and manual publication; live analytics requires consent | Live TikTok connection is not a prerequisite for the PRD's sample-data class demo |

## Scope and remaining blocker
The latest user direction is a professional finished app before Sunday, not continued design experiments. Prioritize the required agent demonstration and final output before optional social analytics work.

The deployed project has TikTok/Supabase configuration, but no configured live AI writer. Existing Groq/OpenRouter/Gemini adapters and earlier reported live OpenRouter work must be preserved, not rebuilt or described as never completed. The immediate missing setup is private deployment configuration plus a fresh live agent-handoff check. Never request a key in chat, transfer a Pursuit-owned key into independent work, or claim templates/preset text edits satisfy a live AI-agent requirement. The original class rubric itself was not recovered; the two saved PRDs are the verified sources for this assessment. No school submission has been made.

The new acceptance guard and two-suggestion stopping rule extend the integrated card workflow without removing original/working/proposed content, earlier versions, manual edits, or saved reviews. Regenerating a fictional sample begins a new draft direction and resets its suggestion count; Undo restores the earlier count and content together.
