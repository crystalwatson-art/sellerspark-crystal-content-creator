import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import brief from '../fixtures/fictional-research-brief.json' with { type: 'json' };
import { createServer } from '../src/server.js';
import { createContentDraft } from '../src/content-creator.js';
import { createAgentSystem } from '../src/agent-system.js';
import { ReviewStore } from '../src/review-store.js';

test('authenticated API uses both agents, saves their trace, and regenerates only the selected card', async t => {
  let modelCalls = 0;
  const system = createAgentSystem({ model: { configured: true, provider: 'test_double', model: 'scripted-test-only', async decide(input) {
    modelCalls++;
    const actions = input.observations.length;
    if (input.role === 'listing_optimizer') return { action: ['inspect_handoff','check_drafts','finish'][actions], input: {} };
    if (!actions) return { action: 'read_brief', input: {} };
    if (actions === 1) {
      const drafts = structuredClone(input.context.task.currentDrafts || createContentDraft(brief).drafts).map(draft => ({ ...draft, supportingClaimIds: [] }));
      if (input.context.task.currentDrafts) {
        const target = drafts[input.context.task.targetIndex];
        target.hook = 'Which detail will guide your next conversation?';
        target.script = 'Write one clear question before you meet. Ask for the information you need and keep the explanation with your notes.';
      }
      return { action: 'check_drafts', input: { drafts } };
    }
    return { action: 'send_to_optimizer', input: { confidence: 0.8, uncertainties: ['Fictional source data.'] } };
  } } });
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sellerspark-agent-api-'));
  const reviewStore = await new ReviewStore({ filePath: path.join(dir,'reviews.json') }).init();
  const demoReviewStore = await new ReviewStore({ filePath: path.join(dir,'demo.json') }).init();
  const authVerifier = { async verify(request) { if (request.headers.authorization !== 'Bearer synthetic-owner') throw Object.assign(new Error('Sign in required'), { code: 'authorization_required' }); return { userId: 'owner', accessToken: 'synthetic-owner' }; } };
  const server = createServer({ providerMode: 'agents', agentSystem: system, reviewStore, demoReviewStore, authVerifier });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(dir,{recursive:true,force:true}); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const post = (route, body, authenticated = true) => fetch(base + route, { method:'POST', headers: { 'Content-Type':'application/json', ...(authenticated ? { Authorization:'Bearer synthetic-owner' } : {}) }, body:JSON.stringify(body) });
  const guest = await post('/api/content',brief,false);
  assert.equal(guest.status,401);
  assert.equal(modelCalls,0,'an unauthenticated request must not spend AI quota');
  const config = await (await fetch(base + '/api/agent-status')).json();
  assert.deepEqual(config,{ mode:'agents',configured:true,humanApprovalRequired:true });
  const response = await post('/api/content',{ ...brief, sampleSet: 123 });
  assert.equal(response.status,200);
  let saved = await response.json();
  assert.equal(saved.status,'ready_for_review');
  assert.equal(saved.drafts[0].hook,createContentDraft(brief).drafts[0].hook,'sampleSet must not overwrite actual AI output');
  assert.equal(saved.listingReview.agentRun.modelCalls,6);
  assert.equal(saved.persistenceStatus,'supabase');
  const first = saved.listingReview.reviews[0];
  const sibling = structuredClone(saved.listingReview.reviews[1]);
  const route = '/api/reviews/' + saved.listingReviewId + '/actions';
  const regenerated = await post(route,{ action:'regenerate_current', draftId:first.draftId, expectedVersion:saved.listingReviewVersion });
  assert.equal(regenerated.status,200);
  saved = await regenerated.json();
  assert.equal(saved.listingReview.reviews[0].working.hook,'Which detail will guide your next conversation?');
  assert.equal(saved.listingReview.reviews[0].status,'revision_requested');
  assert.equal(saved.listingReview.reviews[0].agentRuns[0].modelCalls,6);
  assert.deepEqual(saved.listingReview.reviews[1],sibling);
  const reopened = await (await fetch(base + '/api/reviews/' + saved.listingReviewId,{ headers:{ Authorization:'Bearer synthetic-owner' } })).json();
  assert.equal(reopened.listingReview.reviews[0].working.script,saved.listingReview.reviews[0].working.script);
  assert.equal(reopened.listingReview.reviews[0].agentRuns.length,1);
  assert.equal(reopened.listingReview.reviews[0].cardVersions.length,1);
  const stale = await post(route,{ action:'approve_current', draftId:first.draftId, expectedVersion:1 });
  assert.equal(stale.status,409);
  const rejected = await post(route,{ action:'reject_current', draftId:first.draftId, expectedVersion:saved.listingReviewVersion });
  const decision = await rejected.json();
  assert.equal(decision.listingReview.reviews[0].status,'rejected');
  assert.equal(decision.listingReview.reviews[0].working.script,saved.listingReview.reviews[0].working.script);
  assert.equal(modelCalls,12,'reject does not trigger an unwanted model call');
});
