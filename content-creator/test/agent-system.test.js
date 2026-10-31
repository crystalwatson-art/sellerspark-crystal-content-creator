import test from 'node:test';
import assert from 'node:assert/strict';
import brief from '../fixtures/fictional-research-brief.json' with { type: 'json' };
import { createContentDraft } from '../src/content-creator.js';
import { createAgentSystem } from '../src/agent-system.js';
import { createAgentModel } from '../src/agent-model.js';
import { createDraftHistory } from '../src/draft-history.js';

const clone = value => structuredClone(value);
function outputFor(input = brief) {
  return { drafts: createContentDraft(input).drafts.map(draft => ({ ...draft, supportingClaimIds: [] })) };
}
function modelWith({ output = outputFor(), corrections = 0, onCall = () => {} } = {}) {
  const counts = new Map();
  return { configured: true, provider: 'test_double', model: 'scripted-test-only', async decide(input) {
    onCall(input);
    const key = input.role + input.context.revision;
    const step = counts.get(key) || 0; counts.set(key, step + 1);
    if (input.role === 'content_creator') {
      if (step === 0) return { action: 'read_brief', input: {} };
      if (step === 1) {
        const next = clone(output);
        if (input.context.revision) next.drafts[0].script = (input.context.revision === 1 ? 'Pause and name your next question. ' : 'Make a note of the answer you need first. ') + next.drafts[0].script;
        return { action: 'check_drafts', input: next };
      }
      return { action: 'send_to_optimizer', input: { confidence: 0.8, uncertainties: ['Sources are fictional test data.'] } };
    }
    if (step === 0) return { action: 'inspect_handoff', input: {} };
    if (step === 1) return { action: 'check_drafts', input: {} };
    return corrections > input.context.revision
      ? { action: 'request_revision', input: { feedback: [{ draftIndex: 0, field: 'script', instruction: 'Make the first sentence clearer.' }], confidence: 0.7 } }
      : { action: 'finish', input: {} };
  } };
}

test('two model-directed agents pass identical complete handoffs and never approve or publish', async () => {
  const inputs = [];
  const result = await createAgentSystem({ model: modelWith({ onCall: input => inputs.push(clone(input)) }) }).generate(brief);
  assert.equal(result.status, 'ready_for_review');
  assert.equal(result.agentRun.modelCalls, 6);
  assert.equal(result.agentRun.orchestrator, 'bounded_task_coordinator');
  assert.deepEqual(result.agentRun.assignments.map(task => task.role), ['content_creator', 'listing_optimizer']);
  assert.ok(inputs.every(input => input.context.assignment.role === input.role));
  assert.ok(result.agentRun.trace.some(event => event.agent === 'orchestrator' && event.event === 'task_assigned'));
  assert.equal(result.humanApprovalRequired, true);
  assert.equal(result.automaticallyPublished, false);
  assert.equal(result.customerContacted, false);
  assert.deepEqual(result.drafts[0].sourceRefs, createContentDraft(brief).drafts[0].sourceRefs);
  assert.deepEqual(result.drafts[0].warnings, createContentDraft(brief).drafts[0].warnings);
  const sent = result.agentRun.trace.find(event => event.event === 'handoff_sent');
  const received = result.agentRun.trace.find(event => event.event === 'handoff_received');
  assert.equal(sent.payloadDigest, received.payloadDigest);
  assert.ok(sent.fields.includes('uncertainties'));
  assert.ok(sent.fields.includes('sourceRefs'));
  assert.ok(sent.fields.includes('confidence'));
  const observation = inputs.filter(input => input.role === 'listing_optimizer')[1].observations[0];
  assert.equal(observation.audience, brief.audience);
  assert.equal(observation.confidence, 0.8);
  assert.equal(Object.hasOwn(inputs.find(input => input.role === 'listing_optimizer').tools, 'send_to_optimizer'), false);
  assert.doesNotMatch(JSON.stringify(result.agentRun), /apiKey|Authorization|Sources are fictional test data/);
});

test('Optimizer chooses a revision, Creator receives corrections, and visible text changes before human review', async () => {
  const inputs = [];
  const result = await createAgentSystem({ model: modelWith({ corrections: 1, onCall: input => inputs.push(clone(input)) }) }).generate(brief);
  assert.equal(result.status, 'ready_for_review');
  assert.equal(result.agentRun.revisionHandoffs, 1);
  assert.deepEqual(result.agentRun.assignments.map(task => [task.role, task.revision]), [['content_creator',0],['listing_optimizer',0],['content_creator',1],['listing_optimizer',1]]);
  assert.match(result.drafts[0].script, /^Pause and name/);
  const revised = inputs.find(input => input.role === 'content_creator' && input.context.revision === 1);
  assert.equal(revised.context.feedback[0].instruction, 'Make the first sentence clearer.');
  assert.ok(result.agentRun.trace.some(event => event.event === 'handoff_sent' && event.to === 'content_creator'));
});

test('two revision handoffs are the maximum, preserving the human gate on failure', async () => {
  const result = await createAgentSystem({ model: modelWith({ corrections: 3 }) }).generate(brief);
  assert.equal(result.status, 'needs_more_research');
  assert.equal(result.agentRun.stopReason, 'revision_limit');
  assert.equal(result.agentRun.revisionHandoffs, 2);
  assert.ok(result.agentRun.modelCalls <= 20);
  assert.equal(result.drafts.length, 0);
});

test('Creator cannot use publish or account tools and repeated actions stop', async () => {
  const model = { configured: true, async decide() { return { action: 'publish', input: { inheritPermissions: true } }; } };
  const result = await createAgentSystem({ model }).generate(brief);
  assert.equal(result.agentRun.stopReason, 'repeated_action');
  assert.ok(result.agentRun.trace.some(event => event.event === 'tool_denied'));
  assert.equal(result.agentRun.modelCalls, 2);
  assert.equal(result.drafts.length, 0);
});

test('Optimizer cannot inherit Creator tools through a handoff', async () => {
  const original = modelWith(); let optimizerCalls = 0;
  const model = { ...original, async decide(input) {
    if (input.role === 'listing_optimizer' && optimizerCalls++ === 0) return { action: 'send_to_optimizer', input: { role: 'content_creator' } };
    return original.decide(input);
  } };
  const result = await createAgentSystem({ model }).generate(brief);
  assert.equal(result.status, 'ready_for_review');
  assert.ok(result.agentRun.trace.some(event => event.agent === 'listing_optimizer' && event.event === 'tool_denied'));
});

test('missing configuration, malformed decisions and timeouts fail without returning templates as AI', async () => {
  const missing = await createAgentSystem({ model: createAgentModel() }).generate(brief);
  assert.equal(missing.agentRun.stopReason, 'not_configured');
  assert.equal(missing.agentRun.modelCalls, 0);
  const malformed = await createAgentSystem({ model: { configured: true, decide: async () => ({ foo: 'bad' }) } }).generate(brief);
  assert.equal(malformed.agentRun.stopReason, 'invalid_decision');
  const timedOut = await createAgentSystem({ budgetMs: 15, model: { configured: true, decide: () => new Promise(() => {}) } }).generate(brief);
  assert.equal(timedOut.agentRun.stopReason, 'time_limit');
  assert.deepEqual(timedOut.drafts, []);
});

test('an invalid candidate cannot be handed to the Optimizer or finished without independent checking', async () => {
  const output = outputFor(); output.drafts[0].supportingClaimIds = ['invented-reference'];
  const result = await createAgentSystem({ model: modelWith({ output }) }).generate(brief);
  assert.equal(result.drafts.length, 0);
  assert.ok(result.agentRun.trace.some(event => event.code === 'validation_failed'));
  assert.ok(!result.agentRun.trace.some(event => event.event === 'handoff_received'));
  const original = modelWith();
  const premature = await createAgentSystem({ model: { ...original, decide: input => input.role === 'listing_optimizer' ? { action: 'finish', input: {} } : original.decide(input) } }).generate(brief);
  assert.equal(premature.drafts.length, 0);
  assert.ok(premature.agentRun.trace.some(event => event.code === 'check_first'));
});

test('single-card generation changes its text while preserving sibling fields and source metadata', async () => {
  const current = outputFor().drafts;
  const output = clone({ drafts: current });
  output.drafts[0].hook = 'Which question will guide your first seller conversation?';
  output.drafts[0].script = 'Name the question you need answered most. Bring it to your first conversation and write down the explanation.';
  const result = await createAgentSystem({ model: modelWith({ output }) }).generate(brief, { currentDrafts: current, targetDraftId: current[0].id, instruction: 'A different idea.' });
  assert.equal(result.status, 'ready_for_review');
  assert.equal(result.drafts[0].hook, output.drafts[0].hook);
  assert.equal(result.drafts[1].script, current[1].script);
  output.drafts[1].script = 'Unauthorized sibling change.';
  const blocked = await createAgentSystem({ model: modelWith({ output }) }).generate(brief, { currentDrafts: current, targetDraftId: current[0].id });
  assert.equal(blocked.drafts.length, 0);
});

test('recent writing is scoped to the authenticated owner, and no identity reaches the model', async () => {
  const history = createDraftHistory();
  const inputs = [];
  const system = createAgentSystem({ model: modelWith({ onCall: input => inputs.push(clone(input)) }), history });
  await system.generate(brief, { historyScope: 'owner-alpha' });
  const second = await createAgentSystem({ model: modelWith({ onCall: input => inputs.push(clone(input)) }), history }).generate(brief, { historyScope: 'owner-beta' });
  assert.equal(second.status, 'ready_for_review');
  assert.deepEqual(inputs.at(-1).context.research.recentDrafts, []);
  assert.doesNotMatch(JSON.stringify(inputs), /owner-alpha|owner-beta/);
});

test('free-only model adapter passes the current observation to the next decision without exposing keys', async () => {
  assert.throws(() => createAgentModel({ model: 'paid/model' }), /free models/);
  let payload;
  const model = createAgentModel({ request: async body => { payload = body; return { choices: [{ message: { content: '{"action":"stop","input":{}}' } }] }; } });
  assert.deepEqual(await model.decide({ instructions: 'Decide safely.', context: { audience: 'seller' }, observations: [{ ok: false, code: 'validation_failed' }], tools: { stop: '{}' }, remainingMs: 1000 }), { action: 'stop', input: {} });
  assert.match(payload.messages[1].content, /validation_failed/);
  assert.equal(payload.model, 'openrouter/free');
  assert.equal(payload.response_format.type, 'json_schema');
  assert.deepEqual(payload.response_format.json_schema.schema.properties.action.enum, ['stop']);
  assert.equal(payload.reasoning, undefined, 'the free router must not force an unsupported reasoning setting');
  assert.equal(payload.provider.require_parameters, true);
  assert.equal(payload.max_tokens, 8000);
  await model.decide({ role: 'content_creator', instructions: 'Decide safely.', context: {}, observations: [], tools: { check_drafts: '{}' }, remainingMs: 1000 });
  assert.equal(payload.max_tokens, 8000, 'first-turn writing must not be truncated by a control-only budget');
});

test('first decisions expose evidence-reading tools before drafting and review tools', async () => {
  let payload;
  const model = createAgentModel({ request: async body => { payload = body; return { choices: [{ message: { content: '{"action":"stop","input":{}}' } }] }; } });
  for (const [role, prerequisite] of [['content_creator', 'read_brief'], ['listing_optimizer', 'inspect_handoff']]) {
    await model.decide({ role, instructions: 'Use evidence.', context: {}, observations: [], tools: { [prerequisite]: '{}', check_drafts: 'draft schema', stop: '{}' }, remainingMs: 1000 });
    assert.deepEqual(payload.response_format.json_schema.schema.properties.action.enum, [prerequisite, 'stop']);
    assert.doesNotMatch(payload.messages[0].content, /draft schema/);
    await model.decide({ role, instructions: 'Use evidence.', context: {}, observations: [{ ok: false, code: 'invalid_decision' }], tools: { [prerequisite]: '{}', check_drafts: 'draft schema', stop: '{}' }, remainingMs: 1000 });
    assert.deepEqual(payload.response_format.json_schema.schema.properties.action.enum, [prerequisite, 'stop'], 'format corrections do not unlock drafting before evidence');
    await model.decide({ role, instructions: 'Use evidence.', context: {}, observations: [{ tool: prerequisite, ok: true }], tools: { [prerequisite]: '{}', check_drafts: 'draft schema', stop: '{}' }, remainingMs: 1000 });
    assert.ok(payload.response_format.json_schema.schema.properties.action.enum.includes('check_drafts'));
  }
});

test('one malformed action gets bounded feedback before evidence and all original checks still execute', async () => {
  const original = modelWith();
  let first = true;
  const calls = [];
  const result = await createAgentSystem({ model: { ...original, async decide(input) {
    calls.push(clone(input));
    if (first) { first = false; return outputFor(); }
    return original.decide(input);
  } } }).generate(brief);
  assert.equal(result.status, 'ready_for_review');
  assert.equal(result.agentRun.modelCalls, 7);
  assert.equal(calls[1].observations[0].code, 'invalid_decision');
  assert.equal(result.agentRun.trace.filter(event => event.event === 'tool_selected' && event.tool === 'read_brief').length, 1);
  assert.ok(result.agentRun.trace.some(event => event.agent === 'listing_optimizer' && event.tool === 'check_drafts'));
  assert.doesNotMatch(calls[0].instructions, /Return exactly three draft packages/);
  assert.equal(result.automaticallyPublished, false);
});

test('completed evidence and check steps cannot be reselected through the advertised action schema', async () => {
  let payload, remaining;
  const model = createAgentModel({ request: async (body, budget) => {
    payload = body; remaining = budget;
    return { choices: [{ message: { content: '{"action":"stop","input":{}}' } }] };
  } });
  const input = { instructions: 'Use evidence.', context: {}, remainingMs: 3000 };
  const tools = { inspect_handoff: '{}', check_drafts: '{}', request_revision: '{}', finish: '{}', stop: '{}' };
  await model.decide({ ...input, role: 'listing_optimizer', tools, observations: [{ tool:'inspect_handoff',ok:true }] });
  assert.deepEqual(payload.response_format.json_schema.schema.properties.action.enum,['check_drafts','stop']);
  await model.decide({ ...input, role: 'listing_optimizer', tools, observations: [{ tool:'inspect_handoff',ok:true },{ tool:'check_drafts',ok:true }] });
  assert.deepEqual(payload.response_format.json_schema.schema.properties.action.enum,['request_revision','finish','stop']);
  await model.decide({ ...input, role: 'listing_optimizer', tools, observations: [{ tool:'inspect_handoff',ok:true },{ tool:'check_drafts',ok:false }] });
  assert.deepEqual(payload.response_format.json_schema.schema.properties.action.enum,['request_revision','stop']);
  await model.decide({ ...input, role:'content_creator', tools:{read_brief:'{}',check_drafts:'{}',send_to_optimizer:'{}',stop:'{}'}, observations:[{tool:'read_brief',ok:true}] });
  assert.deepEqual(payload.response_format.json_schema.schema.properties.action.enum,['check_drafts','stop']);
  assert.equal(remaining,3000,'custom provider adapters receive the remaining deadline');
});

// Protocol regressions are simulated model decisions, explicitly separate from live evaluations.
for (const scenario of [
  { name: 'missing audience', edit: b => delete b.audience, expected: 'research_gate' },
  { name: 'missing topics', edit: b => delete b.topics, expected: 'research_gate' },
  { name: 'insufficient topics', edit: b => b.topics.pop(), expected: 'research_gate' },
  { name: 'empty question and title', edit: b => { b.topics[0].title = ''; b.topics[0].question = ''; }, expected: 'research_gate' },
  { name: 'wrong property audience in response', output: o => o.drafts[0].script = 'Sell your Brooklyn townhouse tomorrow.', expected: 'repeated_action' },
  { name: 'unsupported financial promise', output: o => o.drafts[0].script = 'Prices will rise by 20% next month.', expected: 'repeated_action' },
  { name: 'missing takeaway', output: o => o.drafts[0].takeaway = '', expected: 'repeated_action' },
  { name: 'forged source citation', output: o => o.drafts[0].supportingClaimIds = ['forged'], expected: 'repeated_action' },
  { name: 'malformed hashtags', output: o => o.drafts[0].hashtags = 'not an array', expected: 'repeated_action' },
  { name: 'incomplete filmable scenes', output: o => o.drafts[0].suggestedScenes = [], expected: 'repeated_action' }
]) test('simulated adversarial case: ' + scenario.name, async () => {
  const input = clone(brief); scenario.edit?.(input);
  const output = outputFor(); scenario.output?.(output);
  const result = await createAgentSystem({ model: modelWith({ output }) }).generate(input);
  assert.equal(result.agentRun.stopReason, scenario.expected);
  assert.equal(result.drafts.length, 0);
  assert.equal(result.humanApprovalRequired, true);
  assert.equal(result.automaticallyPublished, false);
});

test('live provider failures retain safe status diagnostics without exposing raw errors', async () => {
  const model = { configured: true, async decide() {
    throw Object.assign(new Error('private provider payload must not escape'), { code: 'provider_error', httpStatus: 401 });
  } };
  const result = await createAgentSystem({ model }).generate(brief);
  assert.equal(result.writerStatus, 'authentication_failed');
  assert.equal(result.diagnostic.httpStatus, 401);
  assert.equal(result.agentRun.modelCalls, 1);
  assert.doesNotMatch(JSON.stringify(result), /private provider payload/);
});
