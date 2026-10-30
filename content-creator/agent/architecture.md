# SellerSpark independent two-agent system

## Goal and ownership

Crystal's Content Creator and Listing Optimizer cooperate on three short video
draft packages. Input is a structured, source-attributed brief. The final output
is checked draft text, preserved sources and warnings, visible history, and a
human decision. No third-party Research Agent code is connected.

## Five agent ingredients

| Ingredient | Content Creator | Listing Optimizer |
| --- | --- | --- |
| LLM | Free OpenRouter model via server adapter | Separate role/model decision context through the same free provider |
| Context | Audience, topics, allowed claims, source records, warnings, recent owner-scoped writing, revision feedback | Received candidate, task, sources, warnings, uncertainty and confidence; independent check results |
| Tools | read_brief, check_drafts, send_to_optimizer, stop | inspect_handoff, check_drafts, request_revision, finish, stop |
| Success | Three complete, distinct, grounded draft packages handed over intact | Candidate suitable for human editorial review; otherwise specific feedback or stop |
| Loop | Model chooses action → server executes permitted local tool → observation → model chooses again | Same observe/action/check loop, with distinct permissions and feedback to Creator |

The model returns a JSON action command, not hidden reasoning. The harness
validates its tool name and input, executes the tool, then supplies the result
to the next decision. There is no model-controlled network, file, database,
account, approval or publishing tool. A fixed harness routing the selected
handoffs does not choose the model's next action for it.

## Handoff and revision loop

The Creator may hand off only a successfully validated candidate. Its package
includes task, audience, three drafts, original source records, warnings,
per-topic uncertainty, confidence, unresolved uncertainty and revision number.
The Optimizer inspects this package and runs independent checks. It chooses to
finish for human review, stop, or request concrete corrections by draft index,
field and instruction. Feedback returns with the unchanged evidence context.
The Creator receives the feedback and candidate, makes a new decision, checks
the updated draft set, and sends it back.

Every sent/received pair has a common handoff ID and matching payload digest.
Trace events record role, sequence, selected tool, check success, handoff fields,
digests and stopping status. They do not record credentials or private reasoning.
The UI exposes readable events under **How the AI checked this draft**.

## Explicit bounds

- At most two Optimizer → Creator revision handoffs.
- At most six decisions per role invocation and twenty model calls per run.
- Two consecutive identical action/input commands stop the run.
- A deployment run has a 55-second total budget within a 60-second function;
  each provider request is bounded by the remaining budget and fifteen seconds.
- Malformed responses, invalid candidates, missing evidence, exhausted budgets,
  unavailable providers or an agent-selected stop produce no replacement output.
- No automatic template substitution is returned as AI when agent mode fails.

## Card actions and durable work

Generate runs the system for a fresh set. Preset wording changes and per-card
regeneration run it with an authenticated single-card task. Validation rejects
changes to either sibling; server-side replacement preserves references and
warnings. Manual human text editing remains available without a model call.
Reject marks the current content unwanted, retaining it for history. Undo
restores text, decision and revision count. Accept is a human operation and
Copy appears only after acceptance. Versions and new agent runs are saved in
the same owner-scoped review JSON; existing records require no migration.

Model history is namespaced by the server-verified owner and audience. That
namespace is not sent to the model. Requests without sign-in cannot spend AI
quota. Optimistic record versions reject stale writes. Handoff data never
transfers the sender's permissions to the receiver.

## Evidence and limits

208 automated tests pass, using explicit test doubles for model and database
responses. Ten additional realistic live evaluation inputs and a recording
runner are prepared. Live generation, semantic editorial grading, agent
contribution ablation and peer red-team findings must be recorded after private
provider setup. Heuristic checks do not independently verify real-world facts.
Sample sources remain clearly fictional. This architecture is implemented code,
not a claim of completed live-model classroom evaluation.
