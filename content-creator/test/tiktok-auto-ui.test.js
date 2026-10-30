import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { JSDOM } from 'jsdom';
import { createServer } from '../src/server.js';
import { ReviewStore } from '../src/review-store.js';

async function waitFor(predicate) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve,10)); }
  throw Error('Automatic TikTok UI flow timed out');
}
test('signed-in studio automatically reads followers and video views, preserves editable goals, and respects video permission', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'sellerspark-auto-ui-'));
  const store = await new ReviewStore({filePath:path.join(dir,'reviews.json')}).init();
  let followerCalls = 0, viewCalls = 0, allowViews = true;
  const integration = {
    status: async () => ({ status:'connected',scopes:['user.info.stats',...(allowViews ? ['video.list'] : [])] }),
    followerCount: async () => { followerCalls++; return { followerCount:125,observedAt:new Date().toISOString(),source:'TikTok User Info API' }; },
    videoViews: async () => { viewCalls++; return { videos:[{ id:'video-one',title:'A seller question',viewCount:456 }],hasMore:false,cursor:null,observedAt:new Date().toISOString() }; }
  };
  const server = createServer({ reviewStore:store,providerMode:'template',tiktokIntegration:integration,authVerifier:{verify:async () => ({userId:'owner',accessToken:'synthetic-test-session'})},authConfig:{enabled:true,url:'https://mock.supabase.co',anonKey:'public-test-key'} });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const original=Object.fromEntries(['window','document','location','localStorage','sessionStorage','CustomEvent','Event'].map(key=>[key,globalThis[key]]));
  const nativeFetch=globalThis.fetch; let dom;
  let releaseConfig;
  const configGate = new Promise(resolve => { releaseConfig = resolve; });
  const install = saved => {
    dom=new JSDOM(html,{url:base+'/#growth',pretendToBeVisual:true});
    dom.window.matchMedia=()=>({matches:false});
    for(const key of Object.keys(original)) globalThis[key]=key==='window'?dom.window:dom.window[key];
    globalThis.fetch=async (url,options)=>{ const target = new URL(url,base); if (target.pathname === '/api/auth-config') await configGate; return nativeFetch(target,options); };
    sessionStorage.setItem('sellerspark-supabase-session-v1',JSON.stringify({accessToken:'synthetic-test-session',userId:'owner',expiresAt:Date.now()+3600000}));
    for(const [key,value] of saved || []) localStorage.setItem(key,value);
    return id=>document.getElementById(id);
  };
  t.after(async()=>{dom?.window.close();globalThis.fetch=nativeFetch;for(const [key,value] of Object.entries(original)) if(value===undefined)delete globalThis[key];else globalThis[key]=value;await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});
  let $=install();
  await import('../public/app.js?tiktok-auto-first');
  window.dispatchEvent(new Event('pageshow'));
  assert.equal(followerCalls,0,'page-show must not start metric refresh before auth configuration');
  releaseConfig();
  await waitFor(()=>followerCalls===1 && $('current-followers').value==='125' && $('video-views-list').textContent.includes('456 views'));
  assert.equal(viewCalls,1,'video counts load without a refresh button click');
  assert.equal($('current-followers').readOnly,true);
  assert.equal($('starting-followers').value,'125');
  assert.equal($('views-panel').hidden,false);
  assert.equal($('authorize-video-views').hidden,true);
  $('follower-goal').value='250';$('follower-goal').dispatchEvent(new Event('change'));
  assert.equal($('growth-goal').textContent,'250 total followers');
  assert.equal($('growth-progress').textContent,'50% of goal');
  $('audience-value').value='brooklyn_townhouse_owner';$('audience-value').dispatchEvent(new Event('change'));
  assert.equal($('follower-goal').value,'250','a TikTok account goal stays the same across locations');
  $('audience-value').value='lic_condo_owner';$('audience-value').dispatchEvent(new Event('change'));
  $('follower-goal').value='0';$('follower-goal').dispatchEvent(new Event('change'));
  assert.match($('growth-note').textContent,/Choose a follower goal/);
  const saved=Object.entries(localStorage);
  dom.window.close(); allowViews=false;
  $=install(saved);
  await import('../public/app.js?tiktok-auto-second');
  await waitFor(()=>followerCalls===2 && $('current-followers').value==='125');
  assert.equal($('follower-goal').value,'250','invalid goal did not replace the saved valid goal');
  assert.equal($('growth-progress').textContent,'50% of goal');
  assert.equal(viewCalls,1,'without video.list consent no video request is made');
  assert.equal($('authorize-video-views').hidden,false);
  assert.match($('views-note').textContent,/Allow TikTok video views once/);
});
