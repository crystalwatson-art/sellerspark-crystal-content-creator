import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDates, parseLocalDate, calendarStorageKey, readCalendar, saveCalendar, popupTint } from '../public/calendar-state.js';

test('calendar uses real consecutive dates across month/year and DST boundaries',()=>{
  assert.deepEqual(calendarDates('2026-12-28').slice(0,6),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02']);
  assert.equal(calendarDates('2026-10-29')[13],'2026-11-11');
  assert.equal(parseLocalDate('2026-02-30'),null);
  assert.equal(parseLocalDate('2026-11-01T00:00:00Z'),null);
  assert.deepEqual(calendarDates('invalid'),[]);
});
test('calendar storage separates identities/audiences and validates restored user content',()=>{
  assert.notEqual(calendarStorageKey({owner:'alice'}),calendarStorageKey({owner:'bob'}));
  assert.notEqual(calendarStorageKey({audience:'lic'}),calendarStorageKey({audience:'brooklyn'}));
  const value={version:1,start:'2026-10-29',entries:{'2026-10-29':{title:'a'.repeat(300),caption:'<script>visible text</script>',notes:'n',time:'25:61',draftRef:'r'},invalid:{title:'bad'}}};
  const state=readCalendar({getItem:()=>JSON.stringify(value)},'k');
  assert.equal(state.entries['2026-10-29'].title.length,180);
  assert.equal(state.entries['2026-10-29'].time,'');
  assert.equal(state.entries['2026-10-29'].caption,'<script>visible text</script>');
  assert.deepEqual(Object.keys(state.entries),['2026-10-29']);
  assert.equal(readCalendar({getItem:()=>'{oops'},'k','2026-10-29').start,'2026-10-29');
});
test('storage errors cannot be reported as successful saves and popup opacity is bounded',()=>{
  assert.equal(saveCalendar({setItem(){throw Error('quota');}},'k',{}),false);
  assert.equal(popupTint('bad'),70);assert.equal(popupTint(-100),25);assert.equal(popupTint(1000),95);assert.equal(popupTint(71),70);
});
