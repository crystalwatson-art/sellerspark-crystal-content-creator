import test from 'node:test';
import assert from 'node:assert/strict';
import { createTikTokAutoSync } from '../public/tiktok-auto-sync.js';
import { createGrowthPilotView } from '../public/growth-pilot.js';
import { buildFollowerTracker, createGrowthPilot } from '../src/growth-pilot.js';

function clock() {
  let time = 0, id = 0;
  const timers = new Map();
  return { timers, now: () => time, advance: amount => { time += amount; }, schedule: callback => { const timerId = ++id; timers.set(timerId, () => { timers.delete(timerId); callback(); }); return timerId; }, cancel: timer => timers.delete(timer) };
}
test('TikTok refresh starts automatically, deduplicates calls, and repeats every interval', async () => {
  const c = clock(); let calls = 0, finish;
  const auto = createTikTokAutoSync({ ...c, hasSession: () => true, refresh: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  const pending = auto.start();
  await Promise.resolve();
  const duplicate = auto.refreshNow();
  assert.equal(calls,1);
  finish(); await pending; await duplicate;
  assert.equal(c.timers.size,1);
  c.advance(120000);
  const callback = c.timers.values().next().value;
  callback(); await Promise.resolve();
  assert.equal(calls,2);
  finish(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.timers.size,1);
  auto.stop(); assert.equal(c.timers.size,0);
});
test('hidden tabs pause requests, focus resumes them, and transient failures schedule a retry', async () => {
  const c = clock(); let visible = false, calls = 0;
  const auto = createTikTokAutoSync({ ...c, hasSession: () => true, isVisible: () => visible, refresh: async () => { calls++; throw Error('network'); } });
  await auto.start();
  assert.equal(calls,0); assert.equal(c.timers.size,1);
  visible = true; await auto.refreshNow();
  assert.equal(calls,1); assert.equal(c.timers.size,1);
  await auto.refreshNow(); assert.equal(calls,1,'rapid focus events do not consume extra quota');
  c.advance(15001); await auto.refreshNow(); assert.equal(calls,2);
  auto.stop();
});
test('sign-out invalidates in-flight responses and a new session can start independently', async () => {
  const c = clock(); let signedIn = true;
  const checks = [], finishes = [];
  const auto = createTikTokAutoSync({ ...c, hasSession: () => signedIn, refresh: async ({ isCurrent }) => { checks.push(isCurrent); await new Promise(resolve => finishes.push(resolve)); } });
  const old = auto.start(); await Promise.resolve();
  signedIn = false; auto.stop(); assert.equal(checks[0](),false);
  signedIn = true; const next = auto.start(); await Promise.resolve();
  assert.equal(checks.length,2); assert.equal(checks[1](),true);
  finishes[0](); await old;
  assert.equal(c.timers.size,0,'old account completion must not schedule a new account request');
  finishes[1](); await next; assert.equal(c.timers.size,1);
  auto.stop();
});
test('editable follower goals calculate actual progress consistently and reject invalid targets', () => {
  for (const goal of [250,1000,1000000]) {
    const frontend = createGrowthPilotView({ currentFollowers:125, goal:String(goal) }).tracker;
    const backend = buildFollowerTracker({ currentFollowers:125, goal });
    assert.equal(frontend.goal,goal);
    assert.equal(frontend.progressPercent,Math.round(125 / goal * 100));
    assert.equal(frontend.progressPercent,backend.progressPercent);
    assert.equal(createGrowthPilot({ goal }).goal,goal);
  }
  assert.equal(createGrowthPilotView({ currentFollowers:500,goal:250 }).tracker.progressPercent,100);
  for (const goal of ['',0,-5,1.5,1000000001,'unknown']) assert.equal(createGrowthPilotView({goal}).tracker.errors.length,1);
});
