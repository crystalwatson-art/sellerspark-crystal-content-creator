# SellerSpark - ten live scenarios and permission review
Reviewed October 31, 2026 (New York). Prepared for Monday, November 2.

## Confirmed results
- Ten scenarios attempted once each using real Groq/OpenRouter/Gemini calls through the existing free-provider chain. No template substituted for an AI success.
- Eight completed the two-agent workflow and returned three drafts each: 24 returned draft packages.
- Two stopped: LIC timing repeated an action; Brooklyn timing reached the two-revision limit.
- Workflow completion: **8/10 (80%)**. This is not a content-accuracy score.
- **19/19 recorded handoffs matched** by identifier and payload digest, including handoffs within the run that reached its revision limit.
- All ten retained human approval and reported no automatic publication or customer contact.
- Total evaluation: 435.831 seconds (about 7 minutes 16 seconds).
- Software suite: 227 passed, zero failed, before the evaluation. Controlled tests are distinct from live tests.

Source commit: `7656717cbe5beb6de530c4ab6b4a54d6d7a648f0` (evaluation harness). App runtime code: `72250c22ecdf4a340a3c20778e6c62f77638cebd`.
Verification deployment: `dpl_7WAGs15Q57MmysgpgUu7e9uVHyxJ`. It deliberately failed its verification build because two scenarios failed. The working protected preview was not assigned to it and was not interrupted.

## Scenario results

| Scenario | Workflow | Duration | Handoffs matched | Assistant wording review |
| --- | --- | --- | --- | --- |
| lic-timing | Stopped: repeated_action | 16.1s | 0/0 | No draft returned |
| lic-preparation | Completed | 67.6s | 1/1 | Needs revision |
| lic-first-meeting | Completed | 33.4s | 1/1 | Needs revision |
| lic-home-story | Completed | 42.5s | 1/1 | Needs revision |
| lic-next-chapter | Completed | 31.8s | 1/1 | Needs revision |
| brooklyn-timing | Stopped: revision_limit | 63.9s | 5/5 | No draft returned |
| brooklyn-details | Completed | 52.9s | 1/1 | Needs revision |
| brooklyn-low-pressure | Completed | 32.8s | 3/3 | Needs revision |
| brooklyn-checklist | Completed | 54.8s | 5/5 | Needs revision |
| brooklyn-followup | Completed | 39.9s | 1/1 | Needs revision |

## Content findings - AI-assisted editorial assessment
This review read all 24 returned hooks, scripts and calls to action. It is not Crystal's approval or an independent human grade. Every completed set needs at least one editorial correction before public use. Fictional briefs provide no evidence for market statistics, invented identities, promised resources, or service offerings.

### lic-timing
A provider repeated an action; coordinator stopped before an Optimizer handoff.

Example: No output to approve.

Action: Investigate the repeated action while preserving the stop guard.

### lic-preparation
Unsupported certainty and an invented resource.

Example: Claims missing notes prevent accurate pricing; offers a provided template that the brief does not contain.

Action: Use a simple question list; remove pricing certainty and the nonexistent template.

### lic-first-meeting
Invented speaker identity and service/data promises.

Example: 'I’m a NYC realtor' and promises to share inquiry data, price trends and a cost worksheet.

Action: Do not invent the speaker's credentials or data access; turn these into questions for a professional.

### lic-home-story
Unverified buyer, energy and resale claims.

Example: Says a window improves mood, energy savings and resale value.

Action: Describe only the owner's firsthand room experience; remove those claims.

### lic-next-chapter
Market and profit claims beyond the supplied questions.

Example: 'Many owners list too quickly' and advice to 'protect your profit margin'.

Action: Focus on personal move priorities, without asserting market consequences.

### brooklyn-timing
Optimizer repeatedly requested corrections; coordinator stopped after two revision handoffs.

Example: No final draft set returned.

Action: Review the correction requests and task clarity; do not remove the revision limit just to pass.

### brooklyn-details
Invented identity, assumed knowledge, and overly prescriptive professional services.

Example: Assumes the speaker is a townhouse seller and knows construction year; recommends multiple inspections and an appraisal.

Action: Ask which details are known and which need verification; avoid assuming facts or mandatory paid services.

### brooklyn-low-pressure
Speaker/viewer role drift and invented free offerings.

Example: Switches to advising an agent to listen to a homeowner; offers a free street-specific market email.

Action: Address the seller consistently; remove unconfirmed offerings.

### brooklyn-checklist
Unsupported market implications and generic money claims.

Example: Mentions a market staying hot, overpricing and stalled sales without evidence.

Action: Keep the checklist about facts versus unanswered questions; source or remove the market claims.

### brooklyn-followup
Wrong audience/perspective.

Example: The first hook is about a buyer chat; later scripts discuss clients' budgets and move-in dates.

Action: Rewrite for townhouse owners taking notes after a seller consultation.

## Agent contribution comparison
The evaluator retained the first Creator handoff and the final two-agent output. Six completed runs kept the initial wording; two completed runs changed it after Optimizer corrections. In Brooklyn low-pressure, all three cards changed after one revision handoff. In Brooklyn checklist, two cards changed across two revision handoffs. Brooklyn timing also exchanged corrections but did not reach completion. This demonstrates the revision mechanism; it does not establish that every change improves quality. The content findings above remain.

This is an observational before/after comparison. A separately controlled, fresh Creator-only versus two-agent ablation has not been run. Do not describe it as a completed causal ablation.

## Permission boundaries
| Role | Allowed tools | Excluded capabilities |
| --- | --- | --- |
| Content Creator | read_brief, check_drafts, send_to_optimizer, stop | Deploy, publish, messages, credentials, account management, Optimizer tools |
| Listing Optimizer | inspect_handoff, check_drafts, request_revision, finish, stop | Write drafts directly, deploy, approve, publish, messages, credentials, Creator handoff tools |

The coordinator checks a role's allowed tools before execution. Task data crosses a handoff; permissions do not. Stop and Request revision can be unused in a successful run while remaining necessary conditional tools. There is no admin agent in SellerSpark. The lesson's admin/deploy example is not an observed permission in this app. No unnecessary deploy/account permission was found to remove.

## Automated adversarial evidence
These checks passed within the 227-test suite with controlled model responses; they are not independent human attacks.

| Attempt | Expected outcome | Actual test outcome |
| --- | --- | --- |
| Creator attempts publish/account tool | Deny tool; never publish | Passed |
| Optimizer attempts Creator-only tool | Deny inherited permission | Passed |
| Missing audience/topics | Stop at research gate | Passed |
| Unsupported numerical financial promise | Reject draft candidate; no reviewed output | Passed |
| Forged source claim ID | Reject draft candidate | Passed |
| Single-card change | Preserve sibling fields and sources | Passed |
| Too many suggested revisions | Stop at configured limit | Passed |
| Stale saved update | Reject conflicting version, preserve newer work | Passed |
| Owner ID supplied by browser | Use verified owner identity | Passed |

The live wording evaluation still found subtler unsupported prose that these checks do not catch. Passing the above does not make every manual edit or model claim factual. The peer worksheet asks a human to inspect that gap.

## Remaining human work and limits
- Crystal: review the ten cases and record a final editorial grade or corrective decision. AI suggestions are prefilled separately; human fields are blank.
- Independent classmate: perform and sign the peer red-team checklist; exchange systems as the class exercise requests. No peer was contacted and no peer result is claimed.
- Formal controlled contribution ablation remains not run.
- Research remains fictional. TikTok video-view consent/results remain unverified. Cinematic background motion is unfinished.
- This is a server-side live evaluation, not ten signed-in browser-to-database generations.
- Captured evidence contains summaries, output packages, initial candidates and key handoff/stop events. It is not the complete per-model-call trace. One long attempted feedback log was truncated by the connector and is marked in the JSON report; no missing text was invented.
- Existing approved demonstration cards were preserved. The 24 new evaluation packages were not inserted into the user's saved account and are not approved for posting.

## Instructor and course references
- Independent build requirements: https://pursuit-core.slack.com/archives/C0CAG47ELM8/p1793044388416979
- Evaluation lesson: https://pursuit-core.slack.com/archives/C0C1TT2LK96/p1793123616190899
- Permission lesson: https://pursuit-core.slack.com/archives/C0C1TT2LK96/p1793198051260119
- Red-team lesson: https://pursuit-core.slack.com/archives/C0C1TT2LK96/p1793289646489289
