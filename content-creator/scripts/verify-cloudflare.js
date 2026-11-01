// Explicit one-shot verification only. Never an ordinary deployment build.
// Use a Workers Free account. Credentials remain inside Vercel's environment.
import { readFile } from 'node:fs/promises';
import { createCloudflareAgentModel } from '../src/cloudflare-agent-model.js';
import { createAgentSystem } from '../src/agent-system.js';

const model = createCloudflareAgentModel();
if (!model.configured) throw new Error('Cloudflare Account ID and API token are not configured.');
const brief = JSON.parse(await readFile(new URL('../fixtures/fictional-research-brief.json', import.meta.url), 'utf8'));
const started = Date.now();
const result = await createAgentSystem({model,budgetMs:60000}).generate(brief);
const trace = result.agentRun?.trace || [];
const sent = trace.filter(e=>e.event==='handoff_sent');
const received = trace.filter(e=>e.event==='handoff_received');
const handoffsMatched = sent.length>0 && sent.every(e=>received.some(r=>r.handoffId===e.handoffId && r.payloadDigest===e.payloadDigest));
const roles = [...new Set(trace.filter(e=>e.event==='tool_selected').map(e=>e.agent))];
const passed = result.status==='ready_for_review' && result.drafts.length===3 && handoffsMatched && roles.includes('content_creator') && roles.includes('listing_optimizer') && result.humanApprovalRequired===true && result.automaticallyPublished===false;
console.log('SELLERSPARK_CLOUDFLARE_VERIFICATION '+JSON.stringify({passed,provider:model.provider,model:model.model,elapsedMs:Date.now()-started,status:result.status,draftCount:result.drafts.length,handoffsMatched,roles,stopReason:result.agentRun?.stopReason,modelCalls:result.agentRun?.modelCalls,trace:trace.map(e=>({agent:e.agent,event:e.event,tool:e.tool,code:e.code})),humanApprovalRequired:result.humanApprovalRequired,automaticallyPublished:result.automaticallyPublished}));
// Fictional test copy only; inspect it for audience/factual quality separately.
for (const [index,draft] of (result.drafts||[]).entries()) console.log('SELLERSPARK_CLOUDFLARE_DRAFT '+JSON.stringify({index,hook:draft.hook,script:draft.script,caption:draft.caption}));
if (!passed) process.exitCode=1;
