import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { createServer } from '../src/server.js';
import { ReviewStore } from '../src/review-store.js';
import { SupabaseReviewStore } from '../src/supabase-review-store.js';
import { SupabaseAuthVerifier } from '../src/supabase-auth.js';

const owner = '11111111-1111-4111-8111-111111111111';
const reply = (status, value) => ({ ok: status < 400, status, json: async () => value });
async function waitFor(predicate) {
  const limit = Date.now() + 5000;
  while (Date.now() < limit) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  throw Error('Account-resume flow timed out');
}

test('signed-in Generate saves decisions and a fresh browser resumes them without local storage', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sellerspark-resume-'));
  const rows = [];
  const store = await new SupabaseReviewStore({ url: 'https://mock.supabase.co', anonKey: 'public-test-key', fetchImpl: async (input, options = {}) => {
    const url = new URL(input);
    if (options.method === 'POST') { const row = JSON.parse(options.body); rows.push(row); return reply(201, [row]); }
    const selected = rows.filter(row => url.searchParams.get('owner_id') === 'eq.' + row.owner_id && (!url.searchParams.has('id') || url.searchParams.get('id') === 'eq.' + row.id));
    if (options.method === 'PATCH') {
      const row = selected.find(item => url.searchParams.get('version') === 'eq.' + item.version);
      if (!row) return reply(200, []);
      Object.assign(row, JSON.parse(options.body)); return reply(200, [row]);
    }
    return reply(200, selected);
  } }).init();
  const demo = await new ReviewStore({ filePath: path.join(dir, 'demo.json') }).init();
  const verifier = new SupabaseAuthVerifier({ url: 'https://mock.supabase.co', anonKey: 'public-test-key', fetchImpl: async () => reply(200, { id: owner }) });
  const server = createServer({ reviewStore: store, demoReviewStore: demo, authVerifier: verifier, providerMode: 'template', authConfig: { enabled: true, url: 'https://mock.supabase.co', anonKey: 'public-test-key' } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const nativeFetch = globalThis.fetch;
  const original = Object.fromEntries(['window','document','location','localStorage','sessionStorage','MutationObserver','CustomEvent','Event'].map(key => [key, globalThis[key]]));
  let dom;
  function installBrowser() {
    dom = new JSDOM(html, { url: base + '/#creator', pretendToBeVisual: true });
    const w = dom.window;
    w.matchMedia = () => ({ matches: false });
    w.HTMLDialogElement.prototype.close = function () { this.open = false; };
    w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    for (const key of Object.keys(original)) globalThis[key] = key === 'window' ? w : w[key];
    globalThis.fetch = (url, options) => nativeFetch(new URL(url, base), options);
    w.sessionStorage.setItem('sellerspark-supabase-session-v1', JSON.stringify({ accessToken: 'synthetic-owner-session', userId: owner, expiresAt: Date.now() + 3600000 }));
    return id => w.document.getElementById(id);
  }
  t.after(async () => {
    dom?.window.close(); globalThis.fetch = nativeFetch;
    for (const [key, value] of Object.entries(original)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true });
  });
  let $ = installBrowser();
  await import('../public/app.js?account-resume-first');
  await waitFor(() => $('auth-status').textContent.startsWith('Signed in'));
  $('run-fictional-test').click();
  await waitFor(() => rows.length === 1 && $('drafts').children.length === 3);
  assert.equal(rows[0].owner_id, owner);
  assert.match($('result-summary').textContent, /Saved to your account/);
  window.SellerSparkContentCreator.openReview(0, 'approval');
  $('optimizer-accept').click();
  await waitFor(() => rows[0].listing_review.reviews[0].status === 'accepted' && $('optimizer-review-status').textContent === 'Accepted');
  const savedHook = rows[0].listing_review.reviews[0].working.hook;
  dom.window.close();
  $ = installBrowser();
  assert.equal(localStorage.length, 0, 'the second browser has no cached drafts');
  await import('../public/app.js?account-resume-second');
  await waitFor(() => $('drafts').children.length === 3);
  assert.equal(window.SellerSparkContentCreator.getDraftSummaries()[0].status, 'accepted');
  assert.equal(window.SellerSparkContentCreator.getDraftSummaries()[0].hook, savedHook);
  assert.match($('result-summary').textContent, /Saved to your account/);
  assert.equal(rows.length, 1, 'resuming must not create a duplicate review');
});
