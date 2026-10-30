import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCardFlowAction } from '../public/card-flow-state.js';
const state = () => ({reviews:[{draftId:'one',status:'pending',working:{hook:'Original',script:'First sentence. Second sentence.',caption:'Caption',sourceRefs:['existing-ref']},revisionHistory:[]},{draftId:'two',status:'accepted',working:{hook:'Keep me',script:'Keep this script.'},revisionHistory:[]}]});
test('card changes survive serialization and undo restores accepted content without touching siblings', () => {
  let value=state(); const untouched=structuredClone(value.reviews[1]);
  for(const action of ['approve_current','regenerate_current','rewrite_current']) {
    const result=applyCardFlowAction(value,{action,draftId:'one',note:JSON.stringify({script:'My revised words.'})},{fictional:true});
    assert.equal(result.ok,true);value=JSON.parse(JSON.stringify(result.state));
  }
  assert.equal(value.reviews[0].working.script,'My revised words.');
  assert.equal(value.reviews[0].status,'revision_requested');
  assert.equal(value.reviews[0].cardVersions.length,3);
  value=applyCardFlowAction(value,{action:'undo_current',draftId:'one'}).state;
  value=applyCardFlowAction(value,{action:'undo_current',draftId:'one'}).state;
  assert.equal(value.reviews[0].working.hook,'Original');
  assert.equal(value.reviews[0].status,'accepted');
  assert.deepEqual(value.reviews[1],untouched);
});
test('reject marks the current text and preserves it; real briefs do not receive sample replacements', () => {
  const original=state();
  const rejected=applyCardFlowAction(original,{action:'reject_current',draftId:'one'});
  assert.deepEqual(rejected.state.reviews[0].working,original.reviews[0].working);
  assert.equal(rejected.state.reviews[0].status,'rejected');
  const unavailable=applyCardFlowAction(original,{action:'regenerate_current',draftId:'one'});
  assert.equal(unavailable.ok,false);assert.deepEqual(unavailable.state,original);
  assert.deepEqual(original,state(),'actions never mutate their input');
});

test('suggested rewrites stop at two while direct human editing remains available; missing evidence blocks acceptance', () => {
  let value = state();
  for (let i=0;i<2;i++) value=applyCardFlowAction(value,{action:'rewrite_current',draftId:'one',note:JSON.stringify({preset:'Warmer'})}).state;
  const stopped=applyCardFlowAction(value,{action:'rewrite_current',draftId:'one',note:JSON.stringify({preset:'Warmer'})});
  assert.equal(stopped.ok,false);assert.equal(stopped.reason,'revision_limit_reached');
  const manual=applyCardFlowAction(value,{action:'rewrite_current',draftId:'one',note:JSON.stringify({script:'My own reviewed script.'})});
  assert.equal(manual.ok,true);assert.equal(manual.state.reviews[0].automaticRevisionAttempts,2);
  manual.state.reviews[0].missingEvidence=['A source is required'];
  assert.equal(applyCardFlowAction(manual.state,{action:'approve_current',draftId:'one'}).reason,'unsupported_claims');
});
