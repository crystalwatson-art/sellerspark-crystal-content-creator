import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createAgentSystem } from '../src/agent-system.js';
import { createAgentModel } from '../src/agent-model.js';

const cases = JSON.parse(await readFile(new URL('../fixtures/agent-evaluation-cases.json', import.meta.url),'utf8'));
const model = createAgentModel({ apiKey: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL || 'openrouter/free' });
const results = [];
const system = createAgentSystem({ model, budgetMs:55000 });
for (const scenario of cases) {
  if (!model.configured) {
    results.push({ id:scenario.id, status:'not_run', reason:'provider_not_configured', success:null });
    continue;
  }
  const fixture = scenario.audience === 'lic_condo_owner' ? 'fictional-research-brief.json' : 'fictional-brooklyn-townhouse-brief.json';
  const brief = JSON.parse(await readFile(new URL('../fixtures/' + fixture, import.meta.url),'utf8'));
  brief.id = 'evaluation-' + scenario.id;
  brief.topics.forEach((topic,index) => { topic.title = scenario.questions[index]; topic.question = scenario.questions[index]; });
  const result = await system.generate(brief);
  const sent = result.agentRun.trace.filter(event => event.event === 'handoff_sent');
  const received = result.agentRun.trace.filter(event => event.event === 'handoff_received');
  const matched = sent.filter(event => received.some(item => item.handoffId === event.handoffId && item.payloadDigest === event.payloadDigest));
  const success = result.status === 'ready_for_review' && result.drafts.length === 3 && result.humanApprovalRequired && !result.automaticallyPublished && matched.length === sent.length;
  results.push({ id:scenario.id, status:result.status, success, handoffsSent:sent.length, handoffsMatched:matched.length, agentRun:result.agentRun, output:result.drafts, researchVerification:result.researchVerification, humanEditorialReview:'pending' });
  // Retain each completed/failed run immediately; do not discard failures on interruption.
  await save();
}
async function save() {
  const completed = results.filter(result => result.success !== null);
  const succeeded = completed.filter(result => result.success);
  const report = { generatedAt:new Date().toISOString(), execution:model.configured ? 'live_model' : 'not_run', metric:'Automated contract checks, not semantic or real-world factual verification', totalCases:cases.length, completed:completed.length, successful:succeeded.length, successRate:completed.length ? succeeded.length / completed.length : null, peerRedTeam:'pending', agentContributionAblation:'pending', results };
  await writeFile(new URL('../reports/agent-live-evaluation.json',import.meta.url), JSON.stringify(report,null,2) + '\n');
  return report;
}
const report = await save();
console.log(JSON.stringify({ report:fileURLToPath(new URL('../reports/agent-live-evaluation.json',import.meta.url)), execution:report.execution, completed:report.completed, totalCases:report.totalCases, successful:report.successful }));
if (!model.configured || results.some(result => result.success === false)) process.exitCode = 1;
