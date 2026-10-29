import './app.js';
import { resolveStudioPage, liveFollowerLabel } from './studio-navigation.js';
import { initializeCalendar } from './calendar-ui.js';

const app=window.SellerSparkContentCreator;
const locationControl=document.querySelector('#location');
const fixtureControl=document.querySelector('#audience-value');
const authStatus=document.querySelector('#auth-status');
const accountLink=document.querySelector('#studio-account-link');
const tiktokStatus=document.querySelector('#tiktok-connection-heading');
const modal=document.querySelector('#draft-modal');
let liveCount=null;
function refreshReviewLists() {
  const drafts=app.getDraftSummaries();
  for(const page of ['optimizer','approval']) {
    const list=document.querySelector(`#${page}-draft-list`);
    list.replaceChildren();document.querySelector(`#${page}-empty`).hidden=drafts.length>0;
    for(const draft of drafts) {
      const button=document.createElement('button');button.type='button';button.className='review-launch';
      const title=document.createElement('strong');title.textContent=draft.hook;
      const state=document.createElement('span');state.className='review-state';state.textContent=draft.status.replaceAll('_',' ');
      const action=document.createElement('span');action.textContent=page==='approval'?'Review & decide →':'Compare & improve →';
      button.append(title,state,action);button.addEventListener('click',()=>app.openReview(draft.index,page));list.append(button);
    }
  }
  window.dispatchEvent(new CustomEvent('sellerspark:workspace-changed'));
}
function route() {
  const page=resolveStudioPage(location.hash);
  if(!modal.hidden)document.querySelector("#modal-close").click();
  document.querySelectorAll('.route-view').forEach(view=>{view.hidden=view.id!==`view-${page}`;});
  document.querySelectorAll('[data-route]').forEach(link=>{
    if(link.dataset.route===page)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  });
  document.title=`SellerSpark — ${({home:'Penthouse Studio',creator:'Content Creator',optimizer:'Listing Optimizer',approval:'Review & Approve',growth:'TikTok Growth',account:'Account & Appearance'})[page]}`;
  refreshReviewLists();window.scrollTo(0,0);
}
function refreshLocation() {
  locationControl.value=fixtureControl.value==='brooklyn_townhouse_owner'?'brooklyn':'lic';
  locationControl.disabled=fixtureControl.disabled;refreshReviewLists();
}
locationControl.addEventListener('change',()=>{
  fixtureControl.value=locationControl.value==='brooklyn'?'brooklyn_townhouse_owner':'lic_condo_owner';
  fixtureControl.dispatchEvent(new Event('change',{bubbles:true}));
});
fixtureControl.addEventListener('change',refreshLocation);
new MutationObserver(refreshLocation).observe(fixtureControl,{attributes:true,attributeFilter:['disabled']});
new MutationObserver(refreshReviewLists).observe(document.querySelector('#drafts'),{childList:true});
function refreshAccount() {
  accountLink.textContent=authStatus.textContent.startsWith('Signed in')?'Account · Signed in':'Account';
  if(!document.querySelector('#auth-recovery-form').hidden || !document.querySelector('#auth-error').hidden) {
    if(resolveStudioPage(location.hash)!=='account')location.hash='account';
  }
  window.dispatchEvent(new CustomEvent('sellerspark:workspace-changed'));
}
new MutationObserver(refreshAccount).observe(document.querySelector('#auth-panel'),{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']});
function refreshFollowers() {
  if(tiktokStatus.textContent!=='Connected')liveCount=null;
  document.querySelector('#dashboard-followers').textContent=liveFollowerLabel(tiktokStatus.textContent,liveCount);
}
new MutationObserver(refreshFollowers).observe(tiktokStatus,{childList:true,subtree:true,characterData:true});
window.addEventListener('sellerspark:tiktok-metric',event=>{liveCount=event.detail.followerCount;refreshFollowers();});
window.addEventListener('hashchange',route);
for(const id of ['run-fictional-test','regenerate-drafts'])document.getElementById(id).addEventListener('click',()=>{location.hash='creator';});
document.querySelector('#theme-toggle').addEventListener('click',()=>{
  try {localStorage.setItem('sellerspark-penthouse-theme',document.documentElement.dataset.theme==='light'?'day':'night');} catch {}
});
// The custom draft viewer retains the existing controls and receives a focus trap.
document.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||modal.hidden)return;
  const nodes=[...modal.querySelectorAll('button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]')].filter(node=>node.getClientRects().length&&!node.hidden);
  if(!nodes.length)return;
  const first=nodes[0],last=nodes[nodes.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
initializeCalendar(app);
refreshAccount();refreshLocation();refreshFollowers();route();
