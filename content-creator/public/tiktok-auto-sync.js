// Runs only while this signed-in browser is open. No background posting or OAuth.
export function createTikTokAutoSync({ refresh, hasSession, isVisible = () => true, schedule = setTimeout, cancel = clearTimeout, now = Date.now, intervalMs = 120000, minimumGapMs = 15000 }) {
  let active = false, generation = 0, timer = null, flight = null, lastStarted = -Infinity;
  function clearTimer() { if (timer !== null) cancel(timer); timer = null; }
  function queue() {
    clearTimer();
    if (!active) return;
    timer = schedule(() => { timer = null; void refreshNow(); }, intervalMs);
    timer?.unref?.();
  }
  async function refreshNow() {
    if (!active || !hasSession()) return;
    if (flight?.generation === generation) return flight.promise;
    if (!isVisible() || now() - lastStarted < minimumGapMs) { queue(); return; }
    clearTimer();
    const runGeneration = generation;
    const isCurrent = () => active && generation === runGeneration && hasSession();
    lastStarted = now();
    const promise = Promise.resolve().then(() => refresh({ isCurrent })).catch(() => {}).finally(() => {
      if (runGeneration === generation) { flight = null; queue(); }
    });
    flight = { generation: runGeneration, promise };
    return promise;
  }
  return {
    start() { if (!active) { active = true; generation++; lastStarted = -Infinity; } return refreshNow(); },
    stop() { active = false; generation++; flight = null; lastStarted = -Infinity; clearTimer(); },
    refreshNow
  };
}
