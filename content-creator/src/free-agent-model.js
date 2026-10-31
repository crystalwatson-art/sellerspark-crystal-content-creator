import { createAgentModel } from './agent-model.js';
import { classifyProviderError, createHttpJsonRequest } from './openai-writer.js';
import { FAILOVER_ELIGIBLE_STATUSES } from './provider-failover.js';
import { DEFAULT_GROQ_MODEL, GROQ_CHAT_ENDPOINT } from './groq-writer.js';
import { createGeminiRequest, parseGeminiResponse, DEFAULT_GEMINI_MODEL } from './gemini-writer.js';

// Keep the same role, task, observations and permissions across transport recovery.
// Failed providers remain skipped for the remainder of this generation.
export function createFailoverAgentModel({ models, now = Date.now }) {
  const configured = models.filter(model => model?.configured);
  let failed = new Set();
  const attempts = [];
  return {
    configured: configured.length > 0,
    provider: 'free_provider_failover',
    model: configured.map(model => model.model).join(' → '),
    attempts,
    forRun() { return createFailoverAgentModel({ models, now }); },
    async decide(input) {
      const started = now(); let lastError;
      for (const model of configured) {
        if (failed.has(model)) continue;
        const remainingMs = input.remainingMs - (now() - started);
        if (remainingMs <= 0) throw Object.assign(new Error('time_limit'), { code: 'time_limit' });
        try {
          const result = await model.decide({ ...input, remainingMs });
          attempts.push({ provider: model.provider, status: 'responded' });
          return result;
        } catch (error) {
          const status = classifyProviderError(error).writerStatus;
          attempts.push({ provider: model.provider, status });
          // Evidence, malformed output, validation and safety failures never
          // become a reason to shop for a less restrictive provider.
          if (!FAILOVER_ELIGIBLE_STATUSES.includes(status)) throw error;
          failed.add(model); lastError = error;
        }
      }
      throw lastError || Object.assign(new Error('No free writer available'), { code: 'not_configured' });
    }
  };
}

export function createFreeAgentModel({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const groq = createAgentModel({ request: env.GROQ_API_KEY ? async (payload, remainingMs) => {
    const { reasoning, provider, ...body } = payload;
    return createHttpJsonRequest({ apiKey: env.GROQ_API_KEY, endpoint: GROQ_CHAT_ENDPOINT, providerLabel: 'Groq', fetchImpl, timeoutMs: Math.min(15000, remainingMs) })({ ...body, model: env.GROQ_MODEL || DEFAULT_GROQ_MODEL, reasoning_effort: 'low' });
  } : undefined });
  groq.provider = 'groq'; groq.model = env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const openrouter = createAgentModel({ apiKey: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL || 'openrouter/free', fetchImpl });
  const gemini = createAgentModel({ request: env.GEMINI_API_KEY ? async (payload, remainingMs) => {
    const result = await createGeminiRequest({ apiKey: env.GEMINI_API_KEY, fetchImpl, timeoutMs: Math.min(30000, remainingMs) })({
      model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
      input: payload.messages.map(message => message.content).join('\n\n'),
      generation_config: { thinking_level: 'low', max_output_tokens: payload.max_tokens, temperature: payload.temperature },
      response_format: { type: 'text', mime_type: 'application/json', schema: payload.response_format.json_schema?.schema || { type: 'object', properties: { action: { type: 'string' }, input: { type: 'object' } }, required: ['action', 'input'] } }
    });
    return { choices: [{ message: { content: JSON.stringify(parseGeminiResponse(result)) } }] };
  } : undefined });
  gemini.provider = 'gemini'; gemini.model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  return createFailoverAgentModel({ models: [groq, openrouter, gemini] });
}
