import { createAgentModel } from './agent-model.js';
import { createHttpJsonRequest } from './openai-writer.js';

// Pin one documented JSON-mode model. No gateway, paid-only model, or custom
// endpoint override: billing must remain on the user's Workers Free account.
export const CLOUDFLARE_AGENT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export function createCloudflareAgentModel({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const apiKey = env.CLOUDFLARE_API_TOKEN;
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const configured = Boolean(apiKey && accountId);
  if (configured && !/^[a-f0-9]{32}$/i.test(accountId)) {
    throw new Error('Cloudflare Account ID must contain 32 hexadecimal characters.');
  }
  const adapter = createAgentModel({ request: configured ? async (payload, remainingMs) => {
    const send = createHttpJsonRequest({
      apiKey,
      endpoint: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CLOUDFLARE_AGENT_MODEL}`,
      providerLabel: 'Cloudflare Workers AI',
      fetchImpl,
      timeoutMs: Math.min(30000, remainingMs)
    });
    const response = await send({
      messages: payload.messages,
      max_tokens: payload.max_tokens,
      temperature: payload.temperature,
      stream: false,
      response_format: {
        type: 'json_schema',
        // Cloudflare's native endpoint takes the schema directly, rather than
        // the name/strict/schema wrapper used by the other transports.
        json_schema: payload.response_format.json_schema.schema
      }
    });
    if (response?.success !== true || !response?.result) {
      throw Object.assign(new Error('Cloudflare did not return a successful model response.'), { code: 'provider_error' });
    }
    if (response.result.finish_reason === 'length') {
      throw Object.assign(new Error('Cloudflare model response was truncated.'), { code: 'truncated_response' });
    }
    const output = response.result.response;
    if (typeof output !== 'string' && (!output || typeof output !== 'object' || Array.isArray(output))) {
      throw Object.assign(new Error('Cloudflare model response was empty.'), { code: 'parse_failure' });
    }
    // Reuse the existing action parser and coordinator's validation. Provider
    // changes do not grant tools or relax factual/human-approval requirements.
    return { choices: [{ message: { content: typeof output === 'string' ? output : JSON.stringify(output) } }] };
  } : undefined });
  adapter.provider = 'cloudflare';
  adapter.localControlSteps = true;
  adapter.model = CLOUDFLARE_AGENT_MODEL;
  return adapter;
}
