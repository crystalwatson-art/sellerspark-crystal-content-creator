import test from 'node:test';
import assert from 'node:assert/strict';
import { createFailoverAgentModel, createFreeAgentModel } from '../src/free-agent-model.js';

test('rate limits recover Groq to OpenRouter to Gemini while preserving task and role', async () => {
  const calls = [];
  const models = ['groq','openrouter','gemini'].map((provider, i) => ({ configured: true, provider, model: provider,
    async decide(input) { calls.push({ provider, input }); if(i < 2) throw Object.assign(new Error('limited'), {code:'rate_limited',httpStatus:429}); return {action:'read_brief',input:{}}; }
  }));
  const configured = createFailoverAgentModel({ models });
  const run = configured.forRun();
  const input = {role:'content_creator',context:{source:'supplied'}, observations:[],remainingMs:5000};
  assert.equal((await run.decide(input)).action,'read_brief');
  assert.deepEqual(calls.map(c=>c.provider),['groq','openrouter','gemini']);
  assert.ok(calls.every(c=>c.input.context===input.context && c.input.role===input.role));
  await run.decide(input);
  assert.equal(calls.at(-1).provider,'gemini');
  assert.equal(calls.length,4);
  await configured.forRun().decide(input);
  assert.equal(calls.length,7,'new generations retry the primary without sharing failure state');
});
test('invalid output cannot bypass validation by changing provider', async () => {
  let backupCalls=0;
  const run=createFailoverAgentModel({models:[{configured:true,provider:'groq',decide:async()=>{throw Object.assign(new Error('bad JSON'),{code:'parse_failure'});}}, {configured:true,provider:'gemini',decide:async()=>{backupCalls++;}}]});
  await assert.rejects(run.decide({remainingMs:5000}),{code:'parse_failure'});
  assert.equal(backupCalls,0);
});
test('missing credentials do not create configured free providers',()=>{
  assert.equal(createFreeAgentModel({env:{}}).configured,false);
});
test('three configured adapters recover across actual request envelopes without OpenAI calls', async()=>{
  const urls=[];
  const env={GROQ_API_KEY:'test-only',OPENROUTER_API_KEY:'test-only',GEMINI_API_KEY:'test-only'};
  const model=createFreeAgentModel({env,fetchImpl:async(url,init)=>{
    urls.push(url);
    const payload=JSON.parse(init.body);
    if(url.includes('api.groq.com')) {
      assert.equal(payload.response_format.type,'json_schema');
      assert.deepEqual(payload.response_format.json_schema.schema.properties.action.enum,['read_brief','stop']);
      assert.equal(payload.reasoning_effort,'low');
      assert.equal(payload.reasoning,undefined);
      assert.equal(payload.provider,undefined);
    }
    if(url.includes('googleapis.com')) {
      assert.equal(payload.response_format.mime_type,'application/json');
      assert.equal(payload.generation_config.thinking_level,'low');
      assert.equal(payload.generation_config.max_output_tokens,1024);
      assert.deepEqual(payload.response_format.schema.properties.action.enum,['read_brief','stop']);
      return {ok:true,status:200,json:async()=>({outputs:[{type:'text',text:'{"action":"read_brief","input":{}}'}]})};
    }
    return {ok:false,status:429,json:async()=>({})};
  }}).forRun();
  const result=await model.decide({role:'content_creator',instructions:'Read evidence.',context:{},observations:[],tools:{read_brief:'{}',stop:'{}'},remainingMs:10000});
  assert.equal(result.action,'read_brief');
  assert.deepEqual(model.attempts.map(attempt=>attempt.provider),['groq','openrouter','gemini']);
  assert.equal(urls.length,3);
  assert.ok(urls.every(url=>!url.includes('api.openai.com')));
});
