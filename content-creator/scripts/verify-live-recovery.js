// Explicit, one-shot build verification. Never runs during an ordinary build.
// Credentials stay in the deployment environment; no raw provider payload is logged.
import { readFile } from 'node:fs/promises';
import { createFreeAgentModel } from '../src/free-agent-model.js';
import { createAgentSystem } from '../src/agent-system.js';

const model = createFreeAgentModel();
if (!model.configured) throw new Error('Free providers are not configured.');
const brief = JSON.parse(await readFile(new URL('../fixtures/fictional-research-brief.json', import.meta.url), 'utf8'));
const started = Date.now();
const result = await createAgentSystem({model,budgetMs:120000}).generate(brief);
const trace=result.agentRun?.trace || [];
const sent=trace.filter(e=>e.event==='handoff_sent');
const received=trace.filter(e=>e.event==='handoff_received');
const handoffsMatched=sent.length>0 && sent.every(e=>received.some(r=>r.handoffId===e.handoffId && r.payloadDigest===e.payloadDigest));
const roles=[...new Set(trace.filter(e=>e.event==='tool_selected').map(e=>e.agent))];
const passed=result.writer==='agent_system' && result.status==='ready_for_review' && result.drafts.length===3 && handoffsMatched && roles.includes('content_creator') && roles.includes('listing_optimizer') && result.humanApprovalRequired===true && result.automaticallyPublished===false;
console.log('SELLERSPARK_LIVE_VERIFICATION '+JSON.stringify({passed,elapsedMs:Date.now()-started,writer:result.writer,status:result.status,draftCount:result.drafts.length,handoffsMatched,roles,providerAttempts:result.agentRun?.providerAttempts,stopReason:result.agentRun?.stopReason,checks:trace.filter(e=>e.reasonCode).map(e=>({agent:e.agent,reasonCode:e.reasonCode})),humanApprovalRequired:result.humanApprovalRequired,automaticallyPublished:result.automaticallyPublished}));
// This is a verification deployment: fail it instead of presenting fallback as AI success.
if(!passed) process.exitCode=1;
