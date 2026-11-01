// Explicit evaluation only. Ordinary app builds never execute this script.
// Uses existing free-provider credentials server-side; never prints keys or raw errors.
import { readFile, writeFile } from 'node:fs/promises';
import { createAgentSystem } from '../src/agent-system.js';
import { createFreeAgentModel } from '../src/free-agent-model.js';

const cases = JSON.parse(await readFile(new URL('../fixtures/agent-evaluation-cases.json', import.meta.url), 'utf8'));
const results = [];
const model = createFreeAgentModel();
const outputPath = new URL('../reports/agent-live-evaluation.json', import.meta.url);
const started = Date.now();
for (const scenario of cases) {
  if (!model.configured) {
    results.push({ id:scenario.id, status:'not_run', reason:'provider_not_configured', success:null });
    continue;
  }
  const fixture = scenario.audience === 'lic_condo_owner' ? 'fictional-research-brief.json' : 'fictional-brooklyn-townhouse-brief.json';
  const brief = JSON.parse(await readFile(new URL('../fixtures/' + fixture, import.meta.url), 'utf8'));
  brief.id = 'evaluation-' + scenario.id;
  brief.topics.forEach((topic,index) => { topic.title = scenario.questions[index]; topic.question = scenario.questions[index]; });
  const firstHandoffs = [];
  const correctionRequests = [];
  const observeModel = chain => ({
    configured:chain.configured, provider:chain.provider, model:chain.model, attempts:chain.attempts,
    async decide(input) {
      const decision = await chain.decide(input);
      if (input.role === 'content_creator' && decision.action === 'send_to_optimizer' && input.context.candidate) firstHandoffs.push(structuredClone(input.context.candidate));
      if (input.role === 'listing_optimizer' && decision.action === 'request_revision') correctionRequests.push(structuredClone(decision.input));
      return decision;
    }
  });
  const caseStarted = Date.now();
  console.log('SELLERSPARK_EVAL_START '+JSON.stringify({id:scenario.id,audience:scenario.audience}));
  const result = await createAgentSystem({model:observeModel(model.forRun()),budgetMs:120000}).generate(brief);
  const trace = result.agentRun?.trace || [];
  const sent = trace.filter(event => event.event === 'handoff_sent');
  const received = trace.filter(event => event.event === 'handoff_received');
  const matched = sent.filter(event => received.some(item => item.handoffId === event.handoffId && item.payloadDigest === event.payloadDigest));
  const roles = [...new Set(trace.filter(event => event.event === 'tool_selected').map(event => event.agent))];
  const success = result.writer === 'agent_system' && result.status === 'ready_for_review' && result.drafts.length === 3 && result.humanApprovalRequired === true && result.automaticallyPublished === false && result.customerContacted === false && sent.length > 0 && matched.length === sent.length && roles.includes('content_creator') && roles.includes('listing_optimizer');
  const entry = {id:scenario.id,audience:scenario.audience,questions:scenario.questions,status:result.status,success,elapsedMs:Date.now()-caseStarted,writer:result.writer,draftCount:result.drafts.length,handoffsSent:sent.length,handoffsMatched:matched.length,roles,stopReason:result.agentRun?.stopReason,modelCalls:result.agentRun?.modelCalls,revisionHandoffs:result.agentRun?.revisionHandoffs,providerAttempts:result.agentRun?.providerAttempts,humanApprovalRequired:result.humanApprovalRequired,automaticallyPublished:result.automaticallyPublished,customerContacted:result.customerContacted,output:result.drafts,researchVerification:result.researchVerification,editorialQuality:result.editorialQuality,trace,humanEditorialReview:'pending',contributionComparison:{method:'Observed first Creator handoff versus final two-agent output; not a randomized causal ablation',firstCreatorDrafts:firstHandoffs[0]?.drafts || [],optimizerCorrectionRequests:correctionRequests}};
  results.push(entry);
  await save();
  const {output,trace:omitTrace,contributionComparison,researchVerification,editorialQuality,...summary}=entry;
  console.log('SELLERSPARK_EVAL_CASE '+JSON.stringify(summary));
  for (let index=0;index<output.length;index++) console.log('SELLERSPARK_EVAL_DRAFT '+JSON.stringify({id:scenario.id,index,draft:output[index]}));
  if(contributionComparison.firstCreatorDrafts.length) for(let index=0;index<3;index++) console.log('SELLERSPARK_EVAL_CREATOR '+JSON.stringify({id:scenario.id,index,draft:contributionComparison.firstCreatorDrafts[index]}));
  for(const feedback of correctionRequests) console.log('SELLERSPARK_EVAL_FEEDBACK '+JSON.stringify({id:scenario.id,feedback}));
  for(const event of trace.filter(event=>['task_assigned','handoff_sent','handoff_received','tool_denied','stopped','ready_for_human_review'].includes(event.event))) console.log('SELLERSPARK_EVAL_TRACE '+JSON.stringify({id:scenario.id,event}));
}
async function save() {
  const completed = results.filter(result=>result.success !== null);
  const report = {generatedAt:new Date().toISOString(),sourceCommit:process.env.VERCEL_GIT_COMMIT_SHA || null,execution:model.configured?'live_model':'not_run',metric:'Automated contract checks, not human judgment or real-world research verification',totalCases:cases.length,completed:completed.length,successful:completed.filter(result=>result.success).length,successRate:completed.length?completed.filter(result=>result.success).length/completed.length:null,elapsedMs:Date.now()-started,peerRedTeam:'pending',humanEditorialReview:'pending',agentContributionComparison:'observational; results recorded per case',agentContributionAblation:'not_run',results};
  await writeFile(outputPath,JSON.stringify(report,null,2)+'\n');
  return report;
}
const report=await save();
console.log('SELLERSPARK_EVAL_COMPLETE '+JSON.stringify({execution:report.execution,totalCases:report.totalCases,completed:report.completed,successful:report.successful,elapsedMs:report.elapsedMs,peerRedTeam:report.peerRedTeam,humanEditorialReview:report.humanEditorialReview}));
// Record every failed case; never pass the verification build on partial success.
if(!model.configured || results.some(result=>result.success!==true)) process.exitCode=1;
