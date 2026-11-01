# Cloudflare Workers AI - optional personal-account provider

Prepared November 1, 2026. Integration code is separate from live verification.

## What is connected in code

Cloudflare is an optional fourth transport in the existing two-agent chain:
Groq → OpenRouter → Gemini → Cloudflare. Missing Cloudflare credentials leave the
existing behavior unchanged. Both Content Creator and Listing Optimizer use the
same adapter, permissions, deadlines, and handoff validation. This also covers
single-card regeneration through the agent workflow. There is no new agent role,
paid OpenAI API connection, Pursuit key, new public deployment, or repository share.

The model is pinned to `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, a documented
JSON-mode model. The adapter calls only Cloudflare's native API and translates
its response into the existing validated action protocol. It does not call
Cloudflare AI Gateway or accept an arbitrary model/endpoint override.

## Private setup

1. In a personal Cloudflare account, stay on **Workers Free**. Do not enable a
   paid Workers plan, prepaid AI Gateway credits, or automatic payment.
2. Open Workers AI → Use REST API → Create a Workers AI API Token. Restrict it to
   the intended account. Copy the Account ID from the same screen.
3. In the existing SellerSpark Vercel project's Environment Variables, save:
   - `CLOUDFLARE_ACCOUNT_ID`: the 32-character Account ID (Config).
   - `CLOUDFLARE_API_TOKEN`: the API token (**Secret**, Preview only).
4. Do not paste the token in chat or commit it. Keep `CONTENT_CREATOR_PROVIDER`
   set to `agents`. A new deployment is required after the values are saved.
5. Run the Cloudflare-only one-shot verification before claiming it works live.
   Test content quality as well as workflow completion. Do not change the
   working preview alias to a failed verification build.

The code cannot determine the account's billing plan. The Free account setting
is essential: Cloudflare documents a 10,000-Neuron daily free allocation with a
hard stop on Free; Paid accounts can incur usage charges. Pinning this model
does not by itself guarantee zero charges on a Paid account.

Private GitHub code stays private. Like the existing AI services, Cloudflare
receives the writing instructions and draft text sent to its API; this is not
local-only processing. No repository, Supabase credential, or user access token
is included in the model request.

## Verification status

- No Cloudflare account ID or API token was configured when inspected.
- Tests simulate Cloudflare's HTTP responses, including quota errors and both
  agents completing their handoff. They do not prove live model behavior.
- Live Cloudflare generation, latency, and wording quality remain unverified
  until the user saves credentials and the real workflow is tested.
- Adding a provider does not repair the previously reported audience/factual
  quality issues or change the existing two-revision limit.

## Official sources

- https://developers.cloudflare.com/workers-ai/get-started/rest-api/
- https://developers.cloudflare.com/workers-ai/features/json-mode/
- https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/
- https://developers.cloudflare.com/workers-ai/platform/pricing/

Cloudflare is currently opt-in in the combined chain: `CLOUDFLARE_AGENT_ENABLED=true` is required after live acceptance. Its direct verification script does not need this flag. Credentials alone do not activate an unverified writer.
