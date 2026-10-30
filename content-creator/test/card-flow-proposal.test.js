import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

test('proposed card flow replaces one idea, visibly revises, gates copy and preserves undo', async () => {
  const html = await readFile(new URL('../public/proposals/card-flow.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', beforeParse(window) {
    window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  } });
  try {
    const $ = id => dom.window.document.getElementById(id);
    const titles = () => [...$('queue').querySelectorAll('h3')].map(node => node.textContent);
    const original = titles();
    $('queue').querySelector('button').click();
    const script = $('script').textContent;
    assert.equal($('approved').hidden, true);
    $('revise').click();
    $('chips').firstElementChild.click(); $('rewrite').click();
    assert.notEqual($('script').textContent, script);
    assert.ok($('script').querySelector('mark'));
    assert.equal($('approved').hidden, true);
    $('accept').click(); assert.equal($('approved').hidden, false);
    $('regenerate').click(); assert.equal($('approved').hidden, true);
    assert.notEqual(titles()[0], original[0]);
    assert.deepEqual(titles().slice(1), original.slice(1), 'other cards are untouched');
    $('undo').click(); assert.equal($('approved').hidden, false);
    $('reject').click(); assert.equal($('approved').hidden, true);
    assert.equal($('status').textContent, 'Rejected');
    $('close').click(); const beforeSet = titles();
    $('generate').click(); assert.ok(titles().every((title, index) => title !== beforeSet[index]));
    assert.match($('sets').textContent, /Earlier set/);
    $('theme').click(); assert.ok(dom.window.document.body.classList.contains('day'));
  } finally { dom.window.close(); }
});
