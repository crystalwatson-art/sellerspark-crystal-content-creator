import { createAgentModel } from './agent-model.js';
import { classifyProviderError, createHttpJsonRequest } from './openai-writer.js';
import { FAILOVER_ELIGIBLE_STATUSES } from './provider-failover.js';
import { DEFAULT_GROQ_MODEL, GROQ_CHAT_ENDPOINT } from './groq-writer.js';
import { createGeminiRequest, parseGeminiResponse, DEFAULT_GEMINI_MODEL } from './gemini-writer.js';
import { createCloudflareAgentModel } from './cloudflare-agent-model.js';

// Keep the same role, task, observations and permissions across transport recovery.
// Failed providers are skipped, except for one bounded, provider-declared
// quota cooldown after every backup has failed.
export function createFailoverAgentModel({ models, now = Date.now, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const configured = models.filter(model => model?.configured);
  let failed = new Set();
  const attempts = [];
  const cooldowns = new Map();
  let cooldownUsed = false;
  return {
    configured: configured.length > 0,
    provider: 'free_provider_failover',
    model: configured.map(model => model.model).join(' → '),
    attempts,
    forRun() { return createFailoverAgentModel({ models, now, wait }); },
    async decide(input) {
      const started = now(); let lastError;
      for (let pass = 0; pass < 2; pass++) {
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
          const retrySeconds = Number(error.retryAfter);
          if (status === 'rate_limited' && Number.isFinite(retrySeconds) && retrySeconds > 0 && retrySeconds <= 60) cooldowns.set(model, now() + retrySeconds * 1000);
          failed.add(model); lastError = error;
        }
       }
       // Only after all backups are unavailable, honor one provider-declared
       // short cooldown. Resume the same decision, never restart either agent.
       const recoverable = !cooldownUsed && configured.find(model => cooldowns.has(model) && Math.max(0,cooldowns.get(model)-now()) + 5000 < input.remainingMs - (now()-started));
       if (!recoverable) break;
       cooldownUsed = true;
       const waitMs = Math.max(0,cooldowns.get(recoverable)-now());
       attempts.push({provider:recoverable.provider,status:'quota_cooldown',waitMs});
       await wait(waitMs);
       failed.delete(recoverable);
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
      generation_config: { thinking_level: (env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL) === 'gemini-3.5-flash-lite' ? 'minimal' : 'low', max_output_tokens: payload.max_tokens },
      response_format: { type: 'text', mime_type: 'application/json', schema: payload.response_format.json_schema?.schema || { type: 'object', properties: { action: { type: 'string' }, input: { type: 'object' } }, required: ['action', 'input'] } }
    });
    return { choices: [{ message: { content: JSON.stringify(parseGeminiResponse(result)) } }] };
  } : undefined });
  gemini.provider = 'gemini'; gemini.model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const cloudflare = createCloudflareAgentModel({ env, fetchImpl });
  return createFailoverAgentModel({ models: [groq, openrouter, gemini, cloudflare] });
}
