import test from 'node:test';
import assert from 'node:assert/strict';
import brief from '../fixtures/fictional-research-brief.json' with { type: 'json' };
import { createCloudflareAgentModel, CLOUDFLARE_AGENT_MODEL } from '../src/cloudflare-agent-model.js';
import { createFreeAgentModel } from '../src/free-agent-model.js';
import { createAgentSystem } from '../src/agent-system.js';
import { createContentDraft } from '../src/content-creator.js';
import { resolveWriterMode } from '../src/server.js';

const env = { CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'fake-test-token' };
const input = { role:'content_creator', instructions:'Read the supplied brief.', context:{}, observations:[], tools:{read_brief:'{}',stop:'{}'}, remainingMs:5000 };
const response = output => ({ok:true,status:200,json:async()=>({success:true,result:{response:output}})});

test('Cloudflare remains inactive without both credentials; a configured pair selects agents',()=>{
  assert.equal(createCloudflareAgentModel({env:{}}).configured,false);
  assert.equal(createCloudflareAgentModel({env:{CLOUDFLARE_API_TOKEN:'test'}}).configured,false);
  assert.equal(createCloudflareAgentModel({env:{CLOUDFLARE_ACCOUNT_ID:env.CLOUDFLARE_ACCOUNT_ID}}).configured,false);
  assert.equal(resolveWriterMode(env),'agents');
  assert.throws(()=>createCloudflareAgentModel({env:{...env,CLOUDFLARE_ACCOUNT_ID:'../../other-account'}}),/Account ID/);
});

test('Cloudflare uses its pinned native endpoint and direct JSON schema, with credentials only in headers',async()=>{
  let call;
  const model=createCloudflareAgentModel({env,fetchImpl:async(url,init)=>{call={url,init,body:JSON.parse(init.body)};return response({action:'read_brief',input:{}});}});
  assert.deepEqual(await model.decide(input),{action:'read_brief',input:{}});
  assert.equal(model.provider,'cloudflare');
  assert.equal(call.url,`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${CLOUDFLARE_AGENT_MODEL}`);
  assert.equal(call.init.headers.Authorization,'Bearer fake-test-token');
  assert.equal(call.body.max_tokens,1024);
  assert.equal(call.body.stream,false);
  assert.deepEqual(call.body.response_format.json_schema.properties.action.enum,['read_brief','stop']);
  assert.equal(call.body.response_format.json_schema.schema,undefined);
  assert.equal(call.body.provider,undefined);
  assert.doesNotMatch(JSON.stringify(call.body),/fake-test-token/);
});

test('native string JSON responses are parsed without inventing an action',async()=>{
  const model=createCloudflareAgentModel({env,fetchImpl:async()=>response('{"action":"read_brief","input":{}}')});
  assert.equal((await model.decide(input)).action,'read_brief');
});

test('quota failures retain retry information without logging Cloudflare response bodies',async()=>{
  const model=createCloudflareAgentModel({env,fetchImpl:async()=>({ok:false,status:429,headers:{get:()=> '10'},json:async()=>{throw new Error('Do not read error body');}})});
  await assert.rejects(model.decide(input),error=>error.code==='rate_limited' && error.retryAfter==='10' && !error.message.includes('fake-test-token'));
});

test('unsuccessful and incomplete response envelopes cannot become agent success',async()=>{
  for(const body of [{success:false,errors:[{message:'private provider detail'}]}, {success:true,result:{}}, {success:true,result:{finish_reason:'length',response:'{}'}}]) {
    const model=createCloudflareAgentModel({env,fetchImpl:async()=>({ok:true,status:200,json:async()=>body})});
    await assert.rejects(model.decide(input));
  }
});

test('Cloudflare receives the same decision after three transport failures; no OpenAI endpoint is called',async()=>{
  const urls=[];
  const model=createFreeAgentModel({env:{...env,GROQ_API_KEY:'fake',OPENROUTER_API_KEY:'fake',GEMINI_API_KEY:'fake'},fetchImpl:async(url)=>{
    urls.push(url);
    return url.startsWith('https://api.cloudflare.com/') ? response({action:'read_brief',input:{}}) : {ok:false,status:503};
  }}).forRun();
  assert.equal((await model.decide(input)).action,'read_brief');
  assert.deepEqual(model.attempts.map(x=>x.provider),['groq','openrouter','gemini','cloudflare']);
  assert.equal(urls.length,4);
  assert.ok(urls.every(url=>!url.includes('api.openai.com')));
});

test('both agents complete a matched handoff over the Cloudflare adapter with simulated responses',async()=>{
  const drafts=createContentDraft(brief).drafts.map(draft=>({...draft,supportingClaimIds:[]}));
  const actions=[
    {action:'check_drafts',input:{drafts}},
    {action:'finish',input:{}}
  ];
  const model=createFreeAgentModel({env,fetchImpl:async()=>response(actions.shift())});
  const result=await createAgentSystem({model}).generate(brief);
  assert.equal(result.status,'ready_for_review');
  assert.equal(result.drafts.length,3);
  assert.equal(actions.length,0);
  assert.equal(result.agentRun.modelCalls,2,'writing and independent editorial judgment are the only network calls');
  assert.equal(result.humanApprovalRequired,true);
  assert.equal(result.automaticallyPublished,false);
  const sent=result.agentRun.trace.find(e=>e.event==='handoff_sent');
  const received=result.agentRun.trace.find(e=>e.event==='handoff_received');
  assert.equal(sent.payloadDigest,received.payloadDigest);
  assert.ok(result.agentRun.providerAttempts.every(x=>x.provider==='cloudflare'));
  assert.doesNotMatch(JSON.stringify(result),/fake-test-token/);
});
