import { createHttpJsonRequest } from './openai-writer.js';
import { isFreeRouterModel, parseOpenRouterResponse, OPENROUTER_CHAT_ENDPOINT } from './openrouter-writer.js';

// A model selects a single whitelisted action each turn. The server executes it
// and returns an observation; the model never receives credentials or a network tool.
export function createAgentModel({ apiKey, model = 'openrouter/free', request, fetchImpl = globalThis.fetch } = {}) {
  if (!isFreeRouterModel(model)) throw new Error('SellerSpark agents permit only explicit OpenRouter free models.');
  return {
    configured: Boolean(request || apiKey),
    provider: 'openrouter',
    model,
    async decide({ instructions, context, observations, tools, remainingMs }) {
      const send = request || createHttpJsonRequest({ apiKey, endpoint: OPENROUTER_CHAT_ENDPOINT, providerLabel: 'OpenRouter', fetchImpl, timeoutMs: Math.min(15000, remainingMs) });
      if (!send) throw Object.assign(new Error('Agent provider not configured'), { code: 'not_configured' });
      const result = await send({
        model,
        messages: [
          { role: 'system', content: instructions + ' Return only JSON: {"action":"one permitted tool name","input":{}}. Do not return reasoning or commentary. Tools and their input contracts: ' + JSON.stringify(tools) },
          { role: 'user', content: JSON.stringify({ context, observations }) }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 6000
      });
      return parseOpenRouterResponse(result);
    }
  };
}
