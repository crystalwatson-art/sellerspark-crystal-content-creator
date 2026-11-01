// Explicit live verification using fictional data. Does not save account data.
import {readFile} from 'node:fs/promises';
import {createFreeAgentModel} from '../src/free-agent-model.js';
import {createAgentSystem} from '../src/agent-system.js';
import {createContentDraft} from '../src/content-creator.js';
const brief=JSON.parse(await readFile(new URL('../fixtures/fictional-research-brief.json',import.meta.url),'utf8'));
const current=createContentDraft(brief).drafts.map(d=>({...d,supportingClaimIds:[]}));
const start=Date.now();
const result=await createAgentSystem({model:createFreeAgentModel(),budgetMs:60000}).generate(brief,{currentDrafts:current,targetDraftId:current[1].id,instruction:'Rewrite only this card with shorter, warmer wording.'});
const siblingsPreserved=result.drafts.length===3 && [0,2].every(i=>['hook','script','caption','takeaway','suggestedScenes','hashtags'].every(k=>JSON.stringify(result.drafts[i][k])===JSON.stringify(current[i][k])));
const passed=result.status==='ready_for_review' && result.drafts[1].script!==current[1].script && siblingsPreserved && result.humanApprovalRequired===true && result.automaticallyPublished===false;
console.log('SELLERSPARK_SINGLE_CARD_VERIFICATION '+JSON.stringify({passed,elapsedMs:Date.now()-start,status:result.status,modelCalls:result.agentRun?.modelCalls,revisionHandoffs:result.agentRun?.revisionHandoffs,siblingsPreserved,humanApprovalRequired:result.humanApprovalRequired,stopReason:result.agentRun?.stopReason}));
if(!passed)process.exitCode=1;
