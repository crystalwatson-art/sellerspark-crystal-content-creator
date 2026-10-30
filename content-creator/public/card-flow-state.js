// Shared by the browser demo and authenticated server review actions.
// These sample variants are templates, not live research or AI output.
const clone = value => JSON.parse(JSON.stringify(value));
const ideas = [
  ['What would a move make possible?', 'Write down two priorities for your next home and one thing you would prefer to keep. Use those notes to guide your next conversation.', 'Begin with what matters in your next chapter.'],
  ["Your home's story starts with everyday life.", 'What do you enjoy most about living in your home? Write down three everyday details you can personally confirm, such as the morning light or your favorite room.', 'Start with the details you know firsthand.'],
  ['A useful question for your first meeting.', 'Ask a real estate professional what information they need to understand your plans. Note anything you need to gather, then agree on a clear next step.', 'Leave the conversation with one clear next step.'],
  ['Tell the story behind your favorite room.', 'Choose one room and describe how you use it on an ordinary day. Focus on details you can personally confirm without making promises about what another owner will experience.', 'Everyday details give a description its character.'],
  ['Before deciding, ask what comes next.', 'List the information you need before deciding whether to sell. Bring your questions to a real estate professional and ask for an explanation of the next steps.', 'You can take one informed step at a time.'],
  ['Make room for a better conversation.', 'Gather your questions before your next real estate conversation. Separate the details you know from the things you still need explained.', 'A little preparation can help you ask better questions.']
];
export function sampleCardContent(current, variant = 0) {
  const idea = ideas[((variant % ideas.length) + ideas.length) % ideas.length];
  return { ...clone(current), hook: idea[0], script: idea[1], caption: idea[2], videoConcept: idea[2], takeaway: idea[2], reasonToFollow: 'Practical questions to help prepare for a real estate conversation.', suggestedNextStep: 'Save your question and bring it to your real estate professional when you are ready.' };
}
export const CARD_ACTIONS = new Set(['approve_current', 'reject_current', 'rewrite_current', 'regenerate_current', 'undo_current']);
export function applyCardFlowAction(state, { action, draftId, note = '' }, { fictional = false } = {}) {
  const next = clone(state);
  const review = next.reviews.find(item => item.draftId === draftId);
  const fail = reason => ({ ok: false, reason, state: clone(state) });
  if (!review) return fail('draft_not_found');
  if (!CARD_ACTIONS.has(action)) return fail('unknown_action');
  let working = clone(review.working);
  if (action === 'rewrite_current') {
    let input;
    try { input = JSON.parse(note); } catch { return fail('invalid_revision'); }
    if (input.preset === 'Shorter') working.script = working.script.match(/[^.!?]+[.!?]+/g)?.slice(0,1).join('').trim() || working.script.split(' ').slice(0,18).join(' ');
    else if (input.preset === 'Warmer') working.script = 'Take this one step at a time. ' + working.script;
    else if (input.preset === 'More professional') working.script = 'Prepare for your next real estate conversation. ' + working.script;
    else if (input.preset === 'Stronger opening') { working.hook = 'What matters most before you decide?'; working.script = 'Start with the question you need answered most. ' + working.script; }
    else if (typeof input.script === 'string' && input.script.trim() && input.script.length <= 10000) working.script = input.script.trim();
    else return fail('invalid_revision');
    if (working.script === review.working.script && working.hook === review.working.hook) return fail('no_change');
  }
  if (action === 'regenerate_current') {
    if (!fictional) return fail('revision_unavailable');
    let variant = review.sampleVariant ?? ((review.cardVersion || 1) - 1);
    do { variant++; working = sampleCardContent(review.working, variant); } while (working.hook === review.working.hook);
    review.sampleVariant = variant;
  }
  review.cardUndo ||= [];
  review.cardVersions ||= [];
  const snapshot = { working: clone(review.working), status: review.status, cardVersion: review.cardVersion || 1 };
  if (action === 'undo_current') {
    const previous = review.cardUndo.pop();
    if (!previous) return fail('nothing_to_undo');
    review.cardVersions.push({ ...snapshot, event: 'Before undo', at: new Date().toISOString() });
    Object.assign(review, previous);
  } else {
    review.cardUndo.push(snapshot);
    review.cardVersions.push({ ...snapshot, event: action, at: new Date().toISOString() });
    review.working = working;
    review.status = action === 'approve_current' ? 'accepted' : action === 'reject_current' ? 'rejected' : 'revision_requested';
    if (['rewrite_current', 'regenerate_current'].includes(action)) review.cardVersion = (review.cardVersion || 1) + 1;
  }
  review.lastCardAction = action;
  review.revisionHistory ||= [];
  review.revisionHistory.push({ action: review.status, note: ({approve_current:'Accepted the content shown on this card.',reject_current:'Marked as unwanted. Regenerate this card to try another idea.',rewrite_current:'Updated the wording shown on this card.',regenerate_current:'Replaced only this card with a different sample idea.',undo_current:'Restored the previous version.'})[action], at: new Date().toISOString() });
  return { ok: true, state: next };
}
