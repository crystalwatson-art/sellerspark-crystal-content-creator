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
    async decide({ role, instructions, context, observations, tools, remainingMs }) {
      const writing = role === 'content_creator' && observations.length > 0;
      const send = request || createHttpJsonRequest({ apiKey, endpoint: OPENROUTER_CHAT_ENDPOINT, providerLabel: 'OpenRouter', fetchImpl, timeoutMs: Math.min(writing ? 30000 : 12000, remainingMs) });
      if (!send) throw Object.assign(new Error('Agent provider not configured'), { code: 'not_configured' });
      const result = await send({
        model,
        messages: [
          { role: 'system', content: instructions + ' Your response is ONE tool action, never the final drafts directly. The action value must exactly match a tool key below. For example, {"action":"read_brief","input":{}} reads the brief; {"action":"check_drafts","input":{"drafts":[...]}} checks writing. Return only the action JSON; no reasoning or commentary. Tools and their input contracts: ' + JSON.stringify(tools) },
          { role: 'user', content: JSON.stringify({ context, observations }) }
        ],
        ...(model.startsWith('liquid/') ? { response_format: { type: 'json_object' } } : {
          response_format: { type: 'json_schema', json_schema: { name: 'agent_action', strict: false, schema: { type: 'object', properties: { action: { type: 'string', enum: Object.keys(tools) }, input: { type: 'object' } }, required: ['action','input'], additionalProperties: false } } },
          reasoning: { effort: 'none', exclude: true }
        }),
        max_tokens: writing ? 3500 : 768
      });
      return parseOpenRouterResponse(result);
    }
  };
}
