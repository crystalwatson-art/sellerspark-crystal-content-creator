import { createHttpJsonRequest, MODEL_OUTPUT_SCHEMA } from './openai-writer.js';
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
      // Expose prerequisites before writing/review tools. A first-turn model
      // must read its evidence rather than spending output on an invalid draft.
      const firstTool = role === 'content_creator' ? 'read_brief' : role === 'listing_optimizer' ? 'inspect_handoff' : null;
      const needsEvidence = firstTool && !observations.some(observation => observation.tool === firstTool && observation.ok !== false);
      const latestCheck = observations.findLast(observation => observation.tool === 'check_drafts');
      const availableTools = needsEvidence
        ? Object.fromEntries(Object.entries(tools).filter(([name]) => name === firstTool || name === 'stop'))
        : Object.fromEntries(Object.entries(tools).filter(([name]) => {
          if (name === firstTool) return false;
          if (role === 'content_creator' && name === 'check_drafts') return latestCheck?.ok !== true;
          if (role === 'content_creator' && name === 'send_to_optimizer') return latestCheck?.ok === true;
          if (role === 'listing_optimizer') {
            if (name === 'finish') return latestCheck?.ok === true;
            if (name === 'request_revision') return Boolean(latestCheck);
            if (name === 'check_drafts') return !latestCheck;
          }
          return true;
        }));
      const inputProperties = {};
      if (role === 'content_creator' && availableTools.check_drafts) inputProperties.drafts = MODEL_OUTPUT_SCHEMA.properties.drafts;
      if (availableTools.send_to_optimizer) {
        inputProperties.confidence = { type:'number',minimum:0,maximum:1 };
        inputProperties.uncertainties = { type:'array',items:{type:'string'} };
      }
      if (availableTools.request_revision) {
        inputProperties.confidence = { type:'number',minimum:0,maximum:1 };
        inputProperties.feedback = {type:'array',items:{type:'object',properties:{draftIndex:{type:'integer',minimum:0,maximum:2},field:{type:'string'},instruction:{type:'string'}},required:['draftIndex','field','instruction'],additionalProperties:false}};
      }
      const send = request || createHttpJsonRequest({ apiKey, endpoint: OPENROUTER_CHAT_ENDPOINT, providerLabel: 'OpenRouter', fetchImpl, timeoutMs: Math.min(25000, remainingMs) });
      if (!send) throw Object.assign(new Error('Agent provider not configured'), { code: 'not_configured' });
      const result = await send({
        model,
        messages: [
          { role: 'system', content: 'RESPONSE PROTOCOL: return one JSON object with exactly two root keys: action (an available tool name) and input (an object containing that tool\'s arguments). The input object must contain the fields required by the chosen tool; it is empty only for tools whose contract says input {}. Drafts belong in input.drafts for check_drafts, never at the root. ' + instructions + ' Your response is ONE tool action, never the final drafts directly. The action value must exactly match an AVAILABLE tool key below. Return only the action JSON; no reasoning or commentary. Available tools and their input contracts: ' + JSON.stringify(availableTools) + (needsEvidence ? ' Evidence has not been read. Your next action must be ' + firstTool + ' with input {}, or stop with input {}.' : '') },
          { role: 'user', content: JSON.stringify({ context, observations }) + '\nReturn one action/input JSON object matching the response protocol.' }
        ],
        ...(model.startsWith('liquid/') ? { response_format: { type: 'json_object' } } : {
          response_format: { type: 'json_schema', json_schema: { name: 'agent_action', strict: false, schema: { type: 'object', properties: { action: { type: 'string', enum: Object.keys(availableTools) }, input: { type: 'object',properties:inputProperties,additionalProperties:false } }, required: ['action','input'], additionalProperties: false } } },
          provider: { require_parameters: true }
        }),
        // Only Creator drafting needs room for three full packages. Reserving
        // that allowance for evidence reads and empty review actions needlessly
        // consumes scarce free-tier token capacity. Use the advertised tool
        // set, not observation count, so a valid drafting turn stays untruncated.
        max_tokens: role === 'content_creator' && availableTools.check_drafts
          ? 8000 : needsEvidence ? 1024 : 2048,
        temperature: 0.2
      }, remainingMs);
      return parseOpenRouterResponse(result);
    }
  };
}
