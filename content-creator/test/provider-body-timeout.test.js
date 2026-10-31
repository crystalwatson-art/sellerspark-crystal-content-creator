import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpJsonRequest } from '../src/openai-writer.js';

test('provider timeout covers a slow response body after headers arrive', async () => {
  const request = createHttpJsonRequest({apiKey:'synthetic-test-key',endpoint:'https://example.invalid',providerLabel:'Test',timeoutMs:20,fetchImpl:async (_url,{signal}) => ({ok:true,status:200,json:() => new Promise((_resolve,reject) => {
    signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});
  })})});
  await assert.rejects(request({}),error=>error.code==='provider_timeout');
});
