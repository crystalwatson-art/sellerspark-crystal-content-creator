import { DAY_LABELS, localDateKey, parseLocalDate, calendarDates, calendarStorageKey, readCalendar, saveCalendar, cleanPlan } from './calendar-state.js';

export function initializeCalendar(app) {
  const $ = id => document.getElementById(id);
  const grid=$('campaign-calendar'), start=$('calendar-start'), dialog=$('calendar-dialog');
  const form=$('calendar-form'), draftSelect=$('calendar-draft'), title=$('calendar-content-title');
  const caption=$('calendar-caption'), time=$('calendar-time'), notes=$('calendar-notes');
  const status=$('calendar-save-status'), error=$('calendar-error'), tooltip=$('calendar-hover-preview');
  let key=calendarStorageKey(app.getWorkspaceIdentity());
  let state=readCalendar(localStorage,key), activeDate=null, prompts=app.getCalendarPrompts();
  const weekday = new Intl.DateTimeFormat(undefined,{weekday:'short'});
  const monthDay = new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'});
  const longDate = new Intl.DateTimeFormat(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  let reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const hasPointer=window.matchMedia('(hover: hover) and (pointer: fine)');
  function saved(message='Plan saved in this browser. Nothing was published.') {
    if (!saveCalendar(localStorage,key,state)) {
      status.textContent='This browser could not save the plan. Keep this page open and try again.';
      return false;
    }
    status.textContent=message;
    return true;
  }
  function hidePreview() { tooltip.hidden=true; }
  function showPreview(button,date,prompt) {
    if (dialog.open) return;
    const plan=state.entries[date];
    tooltip.textContent=`${longDate.format(parseLocalDate(date))} · ${plan?.title || prompt?.focus || 'Plan your content'}${plan?.time ? ' · '+plan.time : ''}. Click to open details.`;
    tooltip.hidden=false;
    const rect=button.getBoundingClientRect();
    tooltip.style.left=`${Math.max(12,Math.min(rect.left,window.innerWidth-320))}px`;
    tooltip.style.top=`${Math.max(12,rect.top-tooltip.offsetHeight-10)}px`;
  }
  function render() {
    start.value=state.start;
    hidePreview();
    grid.replaceChildren();
    calendarDates(state.start).forEach((date,index) => {
      const plan=state.entries[date], prompt=prompts[index];
      const button=document.createElement('button');
      button.type='button'; button.className='calendar-card'; button.dataset.date=date;
      button.setAttribute('aria-haspopup','dialog');
      button.setAttribute('aria-controls','calendar-dialog');
      const dateLabel=document.createElement('span'); dateLabel.className='calendar-day';
      dateLabel.textContent=`${weekday.format(parseLocalDate(date))} · ${monthDay.format(parseLocalDate(date))}`;
      const heading=document.createElement('strong'); heading.textContent=plan?.title || DAY_LABELS[index];
      const stateLabel=document.createElement('span'); stateLabel.className='calendar-state';
      stateLabel.textContent=plan ? (plan.time ? `${plan.time} · Planned locally` : 'Planned locally') : 'Draft prompt';
      button.setAttribute('aria-label',`${longDate.format(parseLocalDate(date))}: ${heading.textContent}. ${stateLabel.textContent}. Open details.`);
      button.append(dateLabel,heading,stateLabel);
      button.addEventListener('click',()=>openDay(date,index));
      button.addEventListener('pointerenter',()=>{ if(hasPointer.matches)showPreview(button,date,prompt); });
      button.addEventListener('focus',()=>showPreview(button,date,prompt));
      button.addEventListener('blur',hidePreview);
      button.addEventListener('pointermove',event=>{
        if (!hasPointer.matches || reducedMotion.matches || document.documentElement.dataset.motion==='still') return;
        const rect=button.getBoundingClientRect();
        const x=Math.max(-1,Math.min(1,((event.clientX-rect.left)/rect.width-.5)*2));
        const y=Math.max(-1,Math.min(1,((event.clientY-rect.top)/rect.height-.5)*2));
        button.style.setProperty('--rx',`${-y*2.5}deg`);
        button.style.setProperty('--ry',`${x*2.5}deg`);
      });
      button.addEventListener('pointerleave',()=>{
        button.style.removeProperty('--rx'); button.style.removeProperty('--ry'); hidePreview();
      });
      grid.append(button);
    });
  }
  function draftByRef(ref) { return app.getCalendarDrafts().find(item=>item.ref===ref); }
  function showDraft(ref) {
    const selected=draftByRef(ref);
    const script=$('calendar-script'),sources=$('calendar-sources');
    sources.replaceChildren();
    if (!selected) {
      script.textContent='No current draft linked.';
      $('calendar-draft-status').textContent=ref ? 'The linked draft is outside the active queue. Your saved plan is kept; choose a current draft to relink it.' : 'Choose a generated draft, or write your own plan below.';
      return;
    }
    script.textContent=selected.draft.script || 'Script not supplied.';
    $('calendar-draft-status').textContent=`Draft ${selected.index+1} · ${selected.status.replaceAll('_',' ')} · Planning does not publish.`;
    for (const reference of selected.draft.sourceRefs || []) {
      const li=document.createElement('li');
      li.textContent=typeof reference==='string' ? reference : reference.title || reference.id || 'Supplied reference';
      sources.append(li);
    }
  }
  function openDay(date,index) {
    activeDate=date;
    hidePreview();
    const plan=state.entries[date];
    const empty=document.createElement('option'); empty.value=''; empty.textContent='No linked draft';
    draftSelect.replaceChildren(empty);
    for (const item of app.getCalendarDrafts()) {
      const option=document.createElement('option');option.value=item.ref;
      option.textContent=`Draft ${item.index+1} · ${item.draft.hook}`;
      draftSelect.append(option);
    }
    if (plan?.draftRef && !draftByRef(plan.draftRef)) {
      const old=document.createElement('option');old.value=plan.draftRef;old.textContent='Previously linked draft · outside active queue';draftSelect.append(old);
    }
    draftSelect.value=plan?.draftRef || '';
    title.value=plan?.title || prompts[index]?.focus || DAY_LABELS[index];
    caption.value=plan?.caption || '';time.value=plan?.time || '';notes.value=plan?.notes || '';
    $('calendar-detail-date').textContent=longDate.format(parseLocalDate(date));
    $('calendar-detail-title').textContent='Plan this day.';
    $('calendar-script-details').open=false;
    error.hidden=true;showDraft(draftSelect.value);
    if (!dialog.open) dialog.showModal();
  }
  function close() { if(dialog.open)dialog.close(); }
  dialog.addEventListener('close',()=>{
    if(activeDate) grid.querySelector(`[data-date="${activeDate}"]`)?.focus();
    activeDate=null;hidePreview();
  });
  $('calendar-close').addEventListener('click',close);
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();
  });
  draftSelect.addEventListener('change',()=>{
    const item=draftByRef(draftSelect.value);
    if(item) {title.value=item.draft.hook;caption.value=item.draft.caption || '';}
    showDraft(draftSelect.value);
  });
  form.addEventListener('submit',event=>{
    event.preventDefault();if(!activeDate)return;
    if(!title.value.trim()) {error.textContent='Give this day a short title before saving.';error.hidden=false;title.focus();return;}
    const previous=state.entries[activeDate];
    state.entries[activeDate]=cleanPlan({title:title.value.trim(),caption:caption.value,notes:notes.value,time:time.value,draftRef:draftSelect.value});
    if(!saved()) {
      if(previous)state.entries[activeDate]=previous;else delete state.entries[activeDate];
      error.textContent='The plan could not be saved. Your text remains here so you can copy it.';error.hidden=false;return;
    }
    render();close();
  });
  $('calendar-clear').addEventListener('click',()=>{
    if(!activeDate)return;
    const previous=state.entries[activeDate];delete state.entries[activeDate];
    if(!saved('This day is clear. No draft or review was deleted.')) {if(previous)state.entries[activeDate]=previous;error.textContent='The change could not be saved.';error.hidden=false;return;}
    render();close();
  });
  start.addEventListener('change',()=>{
    if(!parseLocalDate(start.value)) {start.value=state.start;return;}
    const previous=state.start;state.start=start.value;
    if(!saved('Calendar dates updated. Plans on other dates remain saved.'))state.start=previous;
    render();
  });
  function refreshWorkspace() {
    const nextKey=calendarStorageKey(app.getWorkspaceIdentity());
    if(nextKey!==key) {close();key=nextKey;state=readCalendar(localStorage,key);}
    prompts=app.getCalendarPrompts();render();
    if(dialog.open)showDraft(draftSelect.value);
  }
  window.addEventListener('sellerspark:calendar-prompts',event=>{prompts=event.detail;refreshWorkspace();});
  window.addEventListener('sellerspark:workspace-changed',refreshWorkspace);
  window.addEventListener('hashchange',()=>{close();hidePreview();});
  window.addEventListener('resize',hidePreview);
  window.addEventListener('scroll',hidePreview,{passive:true});
  let keepStill=false;
  try {keepStill=localStorage.getItem('sellerspark-still-cards-v1')==='true';} catch {}
  document.documentElement.dataset.motion=keepStill?'still':'gentle';
  render();
}
