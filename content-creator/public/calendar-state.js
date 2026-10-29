// Pure calendar model: local dates, bounded user content, and identity-scoped plans.
export const CALENDAR_VERSION = 1;
export const DAY_LABELS = ['Hook','Local','Proof','Tour','FAQ','Tips','Story','Value','Trends','Trust','Market','Behind','Recap','Review'];
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function parseLocalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y,m,d] = value.split('-').map(Number);
  if (y < 2000 || y > 2100) return null;
  const date = new Date(y,m-1,d,12);
  return localDateKey(date) === value ? date : null;
}
export function calendarDates(start, length = 14) {
  const date = parseLocalDate(start);
  if (!date || length !== 14) return [];
  return Array.from({length}, (_,i) => { const next = new Date(date); next.setDate(next.getDate()+i); return localDateKey(next); });
}
export function calendarStorageKey({ owner = 'demo', audience = 'lic_condo_owner' } = {}) {
  return `sellerspark-calendar-v1:${encodeURIComponent(owner)}:${encodeURIComponent(audience)}`;
}
const bounded = (value, max) => typeof value === 'string' ? value.slice(0,max) : '';
export function cleanPlan(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return { title:bounded(value.title,180),caption:bounded(value.caption,5000),notes:bounded(value.notes,2000),time:/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) ? value.time : '',draftRef:bounded(value.draftRef,250) };
}
export function readCalendar(storage, key, today = localDateKey()) {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null');
    if (value?.version !== CALENDAR_VERSION || !parseLocalDate(value.start)) throw Error('invalid');
    const entries = Object.create(null);
    for (const [date,plan] of Object.entries(value.entries || {}).slice(0,500)) {
      if (parseLocalDate(date)) { const clean = cleanPlan(plan); if (clean) entries[date] = clean; }
    }
    return {version:CALENDAR_VERSION,start:value.start,entries};
  } catch { return {version:CALENDAR_VERSION,start:today,entries:Object.create(null)}; }
}
export function saveCalendar(storage,key,state) {
  try { storage.setItem(key,JSON.stringify(state)); return true; } catch { return false; }
}
export function popupTint(value) {
  const number=Number(value); return Number.isFinite(number) ? Math.min(95,Math.max(25,Math.round(number/5)*5)) : 70;
}
