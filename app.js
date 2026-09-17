import { CHANNELS, STATUSES, todayKey, addDays, shiftMonth, monthGrid, weekRange, normalizePost, filterPosts, getStats } from './core.js';
import { createStore, STORAGE_KEY } from './store.js';
import { SEED_POSTS } from './seed.js';
import { CLOUD_CONFIG } from './cloud-config.js';
import { createPhotoCloud } from './photos.js';
import { mountPhotos } from './photo-ui.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const channel = id => CHANNELS.find(c => c.id === id);
const status = id => STATUSES.find(s => s.id === id);
const langs = {ko:'한국어',en:'English',zh:'中文',multi:'여러 언어'};
const dateLabel = (key, options = {}) => new Intl.DateTimeFormat('ko-KR', {timeZone:'UTC',month:'long',day:'numeric',weekday:'short',...options}).format(new Date(`${key}T12:00:00Z`));
let storage;
try { storage = window.localStorage; } catch { storage = {getItem(){throw new Error('브라우저 저장소에 접근할 수 없습니다.');},setItem(){throw new Error('브라우저 저장소에 접근할 수 없습니다.');}}; }
const store = createStore(storage);
const loaded = store.load(SEED_POSTS);
let data = {posts:loaded.posts,settings:loaded.settings};
let storageLocked = Boolean(loaded.warning);
let externalChange = false;
const ui = {today:todayKey(),month:todayKey().slice(0,7),selected:todayKey(),mode:'month',platform:'all',status:'all',query:'',sort:'updated',view:'calendar'};
let editingId = '', editorIntent = 'edit', initialForm = '', returnFocus = null, returnFocusSelector = '', toastTimer;
let confirmResolve = null;
const editor = $('post-dialog');
const confirmation = $('confirm-dialog');
let photoRecordId = '', saving = false;
const cloud = createPhotoCloud(CLOUD_CONFIG);
const photos = mountPhotos({cloud, storage, project:CLOUD_CONFIG.url || 'unconfigured',
  getStoredPosts:() => {const raw=storage.getItem(STORAGE_KEY); return raw===null?data.posts:store.parseImport(raw).posts;},
  canClean:() => !storageLocked && !externalChange && !editor.open,
  notify,
});
function setSaving(value) {
  saving=value; $('post-form').setAttribute('aria-busy',String(value));
  editor.querySelector('.dialog-body').inert=value;
  editor.querySelector('.secondary-actions').inert=value;
  editor.querySelectorAll('.dialog-head button,.primary-actions button').forEach(button=>{button.disabled=value;});
}


function notify(message, action = null) {
  clearTimeout(toastTimer); $('toast').hidden = false; requestAnimationFrame(() => {$('toast-message').textContent = message;});
  $('toast-action').hidden = !action; $('toast-action').onclick = action; $('toast').hidden = false;
  toastTimer = setTimeout(() => {$('toast').hidden = true;}, action ? 16000 : 5000);
}
function commit(next) {
  if (externalChange) throw new Error('다른 탭에서 기록이 변경됐어요. 본문을 복사해 둔 뒤 편집창을 닫고 다시 열어 주세요.');
  if (storageLocked) throw new Error('기존 저장 내용을 보호하고 있습니다. 설정에서 원본을 백업한 뒤 복구해 주세요.');
  try {store.save(next);} catch(error) {if(error.code==='STALE_STORAGE'){externalChange=editor.open;if(!editor.open)reloadStoredData();}throw error;} data = next;
  $('save-indicator').textContent = '저장됨';
  render();
}
function requestConfirm(title, message, label = '확인') {
  $('confirm-title').textContent = title; $('confirm-message').textContent = message; $('confirm-ok').textContent = label;
  confirmation.showModal(); $('confirm-cancel').focus();
  return new Promise(resolve => {confirmResolve = resolve;});
}
function resolveConfirm(value) { confirmation.close(); const resolve = confirmResolve; confirmResolve = null; resolve?.(value); }
$('confirm-ok').onclick = () => resolveConfirm(true);
$('confirm-cancel').onclick = () => resolveConfirm(false);
confirmation.addEventListener('cancel', e => {e.preventDefault();resolveConfirm(false);});
$('toast-close').onclick = () => {$('toast').hidden = true;};

function channelIcon(id) {
  const paths = {
    linkedin:'<path d="M6 10h3v9H6zm1.5-5a1.7 1.7 0 1 0 0 3.4A1.7 1.7 0 0 0 7.5 5ZM11 10h2.8v1.2c.6-.9 1.6-1.5 2.8-1.5 2.5 0 3.4 1.6 3.4 4.2V19h-3v-4.5c0-1.3-.3-2.1-1.4-2.1-1.2 0-1.6.8-1.6 2.1V19h-3z" fill="white"/>',
    x:'<path d="M4 3h5l11 18h-5L4 3zm1.8 1.5L15.9 19.5h2.3L8.1 4.5z" fill="currentColor"/><path d="m19 3-6.5 7.5M4 21l7-8" stroke="currentColor" stroke-width="1.8"/>',
    threads:'<path d="M19 7c-1-3-4-4-7-4-5 0-8 3.5-8 9s3 9 8 9c4 0 7-2 7-5.5 0-3-3-5-6-5-3.5 0-5 1.4-5 3.2s1.6 3 3.5 3c3.5 0 4.8-2.1 4.8-5 0-3-1.4-5-4-5-1.6 0-2.8.5-3.8 1.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    instagram:'<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/>',
    youtube:'<path d="m10 8 7 4-7 4z" fill="white"/>',
    blog:'<rect x="5" y="2" width="14" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 7h8M8 11h8M8 15h5" stroke="currentColor" stroke-width="2"/>',
    other:'<circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[id]||paths.other}</svg>`;
}
function badge(p) {
  const c=channel(p.platform), st=status(p.status);
  return `<span class="channel-badge"><span class="channel-mark" style="--channel-color:${c.color}">${channelIcon(c.id)}</span>${esc(c.label)}</span><span class="status-badge ${st.id}">${esc(st.label)}</span>`;
}
function card(p, compact=false) {
  const actions=p.status==='published'?(p.url?`<a class="text-link" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">원문 열기 ↗</a>`:'<span></span>'):`<button class="text-link" data-schedule="${esc(p.id)}">${p.date?'날짜 변경':'일정 잡기'}</button><button class="text-link" data-publish="${esc(p.id)}">발행 기록</button>`;
  return `<article class="${compact?'day-card':'post-card'}" style="--channel-color:${channel(p.platform).color}"><button type="button" class="card-open" data-edit="${esc(p.id)}" aria-label="${esc(p.title)} · ${esc(channel(p.platform).label)} 편집"><span class="post-top">${badge(p)}</span><span class="post-title">${esc(p.title)}</span><span class="post-meta">${p.date?esc(dateLabel(p.date)):'날짜 미정'}${p.time?' · '+esc(p.time):''} · ${langs[p.language]}</span>${!compact&&(p.text||p.notes)?`<span class="post-excerpt">${esc((p.text||p.notes).slice(0,130))}</span>`:''}</button><div class="card-actions">${actions}${p.text?`<button class="text-link" data-copy="${esc(p.id)}">본문 복사</button>`:''}</div></article>`;
}
function empty(title, copy, action='',label='콘텐츠 저장') {
  return `<div class="empty-state"><h3 class="empty-title">${esc(title)}</h3>${copy?`<p class="empty-copy">${esc(copy)}</p>`:''}${action?`<button class="btn btn-tonal" data-action="${action}">${esc(label)}</button>`:''}</div>`;
}
function filtered() {return filterPosts(data.posts,{platform:ui.platform,query:ui.query});}
function calendarDates() {const w=weekRange(ui.selected);return ui.mode==='month'?monthGrid(ui.month,{compact:true}):Array.from({length:7},(_,i)=>addDays(w.start,i));}
function renderChannels() {
  const base=filterPosts(data.posts,{query:ui.query}), dates=calendarDates();
  const groups=[['calendar-channels',base.filter(p=>p.date>=dates[0]&&p.date<=dates.at(-1))],['library-channels',base.filter(p=>ui.query||p.status!=='published')],['published-channels',base.filter(p=>p.status==='published')]];
  for(const [id,posts] of groups)$(id).innerHTML=[{id:'all',label:'전체',count:posts.length},...CHANNELS.map(c=>({...c,count:posts.filter(p=>p.platform===c.id).length}))].map(c=>`<button class="channel-chip ${ui.platform===c.id?'active':''}" aria-pressed="${ui.platform===c.id}" data-channel="${c.id}">${c.id!=='all'?`<span class="channel-mark" style="--channel-color:${c.color}">${channelIcon(c.id)}</span>`:''}<span class="channel-label">${c.label}</span><span class="channel-count">${c.count}</span></button>`).join('');
}
function renderSummary() {
  const stats=getStats(data.posts,ui.today),goal=data.settings.weeklyGoal;
  const saved=data.posts.filter(p=>p.status!=='published').length;
  const planned=data.posts.filter(p=>p.status==='planned').length;
  const overdue=data.posts.filter(p=>p.status==='planned'&&p.date<ui.today).length;
  $('summary').innerHTML=`<button class="overview-item" data-open-library="all"><span>보관 중</span><strong>${saved}</strong></button><button class="overview-item" data-open-library="planned"><span>게시 예정</span><strong>${planned}</strong></button>${overdue?`<button class="overview-item overdue" data-open-library="overdue"><span>지난 일정</span><strong>${overdue}</strong></button>`:''}<a class="overview-item goal-overview" href="#published"><span>이번 주 발행</span><strong>${stats.weekPublished}<small> / ${goal}</small></strong></a>`;
}
function renderCalendar() {
  const week=weekRange(ui.selected),dates=calendarDates();
  $('month-label').textContent=ui.mode==='month'?`${Number(ui.month.slice(0,4))}년 ${Number(ui.month.slice(5))}월`:`${dateLabel(week.start,{weekday:undefined})} – ${dateLabel(week.end,{weekday:undefined})}`;
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===ui.mode)));
  const posts=filtered().filter(p=>p.date);
  $('calendar-grid').classList.toggle('week-view',ui.mode==='week');
  $('calendar-grid').innerHTML=dates.map(date=>{
    const items=posts.filter(p=>p.date===date),current=date===ui.today;
    const classes=['calendar-cell',date.slice(0,7)!==ui.month&&ui.mode==='month'?'outside':'',date===ui.selected?'selected':'',current?'is-today':'',items.length?'has-posts':''].join(' ');
    return `<button class="${classes}" data-date="${date}" tabindex="${date===ui.selected?0:-1}" aria-pressed="${date===ui.selected}" ${current?'aria-current="date"':''} aria-label="${esc(dateLabel(date,{year:'numeric'}))}, ${items.length?items.map(p=>`${channel(p.platform).label} ${p.title} ${status(p.status).label}`).map(esc).join(', '):'게시물 없음'}"><span class="date-number">${Number(date.slice(-2))}</span><span class="day-events">${items.map(p=>`<span class="calendar-post-icon ${p.status}" data-calendar-post="${esc(p.id)}" style="--channel-color:${channel(p.platform).color}" title="${esc(`${channel(p.platform).label} · ${p.title} · ${status(p.status).label}`)}">${channelIcon(p.platform)}</span>`).join('')}</span></button>`;
  }).join('');
  $('day-title').textContent=dateLabel(ui.selected);$('selected-day-label').textContent=ui.selected===ui.today?'오늘':'선택한 날짜';
  const dayPosts=posts.filter(p=>p.date===ui.selected);
  $('day-posts').innerHTML=dayPosts.length?dayPosts.map(p=>card(p,true)).join(''):empty('게시 일정이 없습니다.','','new-selected','이날에 추가');
  const upcoming=posts.filter(p=>p.status!=='published'&&p.date>=ui.today).slice(0,3);
  $('upcoming-section').hidden=!upcoming.length;
  $('upcoming-posts').innerHTML=upcoming.map(p=>card(p)).join('');
  renderChannels();
}
function renderCollections() {
  const searching=Boolean(ui.query), choices=[{id:'all',label:'전체'},...STATUSES.filter(s=>searching||s.id!=='published'),{id:'overdue',label:'지난 일정'}];
  $('library-title').textContent=searching?'콘텐츠 검색':'콘텐츠 보관함';
  $('library-description').textContent=searching?'보관 중인 콘텐츠와 발행 기록에서 검색합니다.':'원고를 저장하고, 준비되면 게시 날짜를 정하세요.';
  $('status-filters').innerHTML=choices.map(st=>`<button data-status="${st.id}" class="status-filter ${ui.status===st.id?'active':''}" aria-pressed="${ui.status===st.id}">${st.label}</button>`).join('');
  let posts=filtered().filter(p=>searching||p.status!=='published');
  if(ui.status==='overdue')posts=posts.filter(p=>p.status==='planned'&&p.date<ui.today);
  else if(ui.status!=='all')posts=posts.filter(p=>p.status===ui.status);
  if(ui.sort==='date-desc')posts.sort((a,b)=>(b.date||'0000').localeCompare(a.date||'0000')||b.time.localeCompare(a.time));
  if(ui.sort==='updated')posts.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  $('post-count').textContent=`${posts.length}개${ui.query?` · “${ui.query}”`:''}`;
  const narrowed=ui.query||ui.platform!=='all'||ui.status!=='all';
  $('post-list').innerHTML=posts.length?posts.map(p=>card(p)).join(''):narrowed?empty('조건에 맞는 콘텐츠가 없습니다.','','reset-filters','필터 초기화'):empty('저장한 콘텐츠가 없습니다.','게시글이나 영상 원고를 미리 보관하세요.','new','콘텐츠 저장');
  const published=filtered().filter(p=>p.status==='published').sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time));
  $('published-count').textContent=`${published.length}개 발행`;
  $('published-list').innerHTML=published.length?published.map(p=>card(p)).join(''):ui.platform!=='all'||ui.query?empty('조건에 맞는 발행 기록이 없습니다.','','reset-filters','필터 초기화'):empty('발행 기록이 없습니다.','발행한 콘텐츠의 날짜와 링크를 남기세요.','new-published','발행 기록 추가');
}
function showView(focus = false) {
  const raw=location.hash.slice(1);const candidate=({posts:'library',ideas:'library'})[raw]||raw;
  ui.view=['calendar','library','published','settings'].includes(candidate)?candidate:candidate==='main-content'?ui.view:'calendar';
  if(raw==='posts'||raw==='ideas')history.replaceState(null,'',`#${candidate}`);
  document.querySelectorAll('.view').forEach(s=>{s.hidden=s.id!==`view-${ui.view}`;});
  document.querySelectorAll('.rail a').forEach(a=>{const active=a.dataset.view===ui.view;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  if(focus)$(`view-${ui.view}`).querySelector('h1').focus({preventScroll:true});
}
function render() {
  ui.today = todayKey(); $('today-pill').textContent = dateLabel(ui.today); $('clear-search').hidden=!ui.query;
  showView(); renderSummary(); renderCalendar(); renderCollections();
  if(document.activeElement!==$('weekly-goal'))$('weekly-goal').value = data.settings.weeklyGoal;
}
function formValue() {
  return {title:$('post-title').value,platform:$('post-platform').value,status:$('post-status').value,date:$('post-date').value,time:$('post-time').value,language:$('post-language').value,text:$('post-text').value,url:$('post-url').value,notes:$('post-notes').value};
}
function syncForm() {
  $('text-count').textContent=`${$('post-text').value.length.toLocaleString('ko-KR')}자`;
  const dated=['planned','published'].includes($('post-status').value);
  $('post-date').required=dated;
  $('schedule-hint').textContent=$('post-status').value==='published'?'SNS에 발행한 날짜와 링크를 기록합니다.':$('post-date').value?'캘린더 일정만 저장합니다. SNS 게시·예약은 직접 진행하세요.':'날짜 없이 보관함에 저장할 수 있습니다.';
}
function openEditor(record = null, overrides = {}) {
  editorIntent='edit';returnFocus=document.activeElement;
  returnFocusSelector=returnFocus.id?`#${CSS.escape(returnFocus.id)}`:returnFocus.dataset.edit?`[data-edit="${CSS.escape(returnFocus.dataset.edit)}"]`:returnFocus.dataset.action?`[data-action="${CSS.escape(returnFocus.dataset.action)}"]`:returnFocus.dataset.schedule?`[data-schedule="${CSS.escape(returnFocus.dataset.schedule)}"]`:returnFocus.dataset.publish?`[data-publish="${CSS.escape(returnFocus.dataset.publish)}"]`:'';
  if(returnFocus.closest('.view')&&returnFocusSelector)returnFocusSelector=`#${returnFocus.closest('.view').id} ${returnFocusSelector}`;
  editingId=record?.id||''; photoRecordId=editingId||crypto.randomUUID();
  const p={title:'',platform:ui.platform==='all'?'linkedin':ui.platform,status:'draft',date:'',time:'',language:'ko',text:'',url:'',notes:'',...record,...overrides};
  for(const field of ['title','platform','status','date','time','language','text','url','notes'])$(`post-${field}`).value=p[field];
  $('post-id').value=editingId; $('editor-title').textContent=editingId?'콘텐츠 편집':'콘텐츠 저장';
  $('editor-eyebrow').textContent=editingId?`마지막 수정 ${dateLabel(todayKey(new Date(record.updatedAt)))}`:'콘텐츠 기록';
  $('delete-post').hidden=!editingId;$('duplicate-post').hidden=!editingId;$('form-error').hidden=true;
  syncForm();initialForm=JSON.stringify(formValue());editor.showModal();photos.open(photoRecordId,Boolean(record));$('post-title').focus();
}
function closeEditor() {editor.close();}
editor.addEventListener('close',()=>{photos.reset();photos.closed();if(externalChange){externalChange=false;reloadStoredData();}const target=returnFocus?.isConnected?returnFocus:returnFocusSelector?document.querySelector(returnFocusSelector):null;(target?.getClientRects().length?target:$(`view-${ui.view}`).querySelector('h1')).focus({preventScroll:true});});
async function tryCloseEditor() {
  if(saving)return;
  if((JSON.stringify(formValue())!==initialForm || photos.dirty || photos.selecting) && !await requestConfirm('저장하지 않고 닫을까요?','작성 중인 변경 사항은 저장되지 않습니다.','닫기'))return;
  closeEditor();
}
editor.addEventListener('cancel',e=>{e.preventDefault();tryCloseEditor();});
editor.addEventListener('keydown',e=>{if(e.key==='Escape'&&!confirmation.open){e.preventDefault();e.stopPropagation();tryCloseEditor();}});
$('post-form').addEventListener('input',syncForm);
$('post-form').addEventListener('change',syncForm);
$('post-form').addEventListener('submit',async e=>{
  e.preventDefault();if(saving)return;
  let savedLocally=false;
  setSaving(true);$('form-error').hidden=true;
  try {
    const old=data.posts.find(p=>p.id===editingId);
    const post=normalizePost({...old,...formValue(),id:old?.id||photoRecordId,updatedAt:new Date().toISOString()});
    photos.assertReady(post.status);
    const posts=old?data.posts.map(p=>p.id===old.id?post:p):[...data.posts,post];
    if(post.date){ui.selected=post.date;ui.month=post.date.slice(0,7);}
    commit({...data,posts});savedLocally=true;
    editingId=post.id;$('post-id').value=post.id;initialForm=JSON.stringify(formValue());
    $('delete-post').hidden=false;$('duplicate-post').hidden=false;
    await photos.save(post);
    const nextView=post.status==='published'?'published':editorIntent==='schedule'&&post.date?'calendar':!post.date||ui.view==='published'?'library':ui.view;
    ui.query='';ui.status='all';ui.platform='all';$('global-search').value='';history.replaceState(null,'',`#${nextView}`);render();closeEditor();notify(old?'변경 내용을 저장했습니다.':'콘텐츠를 저장했습니다.');
  } catch(error){$('form-error').textContent=(savedLocally?'원고는 저장됐습니다. 사진 작업을 다시 시도해 주세요. ':'')+error.message;$('form-error').hidden=false;}
  finally {setSaving(false);}
});
$('delete-post').onclick=async()=>{
  if(saving)return;
  const post=data.posts.find(p=>p.id===editingId);if(!post)return;
  if(!await requestConfirm('이 기록을 삭제할까요?',`“${post.title}”을 캘린더에서 지웁니다. SNS에 발행한 글은 그대로 유지됩니다.${cloud.configured?' 실행 취소 시간이 지나면 보관한 사진도 삭제됩니다.':''}`,'기록 삭제'))return;
  try {await photos.beforeDelete(post);commit({...data,posts:data.posts.filter(p=>p.id!==post.id)});closeEditor();notify('기록을 삭제했어요.',()=>{try{commit({...data,posts:[...data.posts.filter(p=>p.id!==post.id),post]});notify('기록을 복원했어요.');}catch(e){notify(e.message);}});}catch(e){$('form-error').textContent=e.message;$('form-error').hidden=false;}
};
$('duplicate-post').onclick=()=>{
  if(saving)return;
  photoRecordId=crypto.randomUUID();photos.open(photoRecordId,false);
  editorIntent='edit';
  editingId='';$('post-id').value='';$('post-title').value=`${$('post-title').value.slice(0,154)} (복제)`;$('post-status').value='draft';$('post-url').value='';$('post-date').value='';
  $('editor-title').textContent='콘텐츠 복제';$('editor-eyebrow').textContent='채널과 날짜를 바꿔 새 기록으로 저장하세요.';notify('원고를 복제했습니다. 사진은 새로 첨부해 주세요.');$('delete-post').hidden=true;$('duplicate-post').hidden=true;syncForm();$('post-platform').focus();
};
async function copyBody(post) {try{await navigator.clipboard.writeText(post.text);notify('본문을 복사했습니다.');}catch{openEditor(post);$('post-text').focus();$('post-text').select();notify('본문을 선택했습니다. 복사 단축키를 눌러 주세요.');}}
$('photo-open-settings').onclick=async()=>{await tryCloseEditor();if(!editor.open){location.hash='#settings';$('photo-email').focus();}};
$('copy-post').onclick=async()=>{try{await navigator.clipboard.writeText($('post-text').value);notify('본문을 복사했습니다.');}catch{$('post-text').focus();$('post-text').select();notify('본문을 선택했습니다. 복사 단축키를 눌러 주세요.');}};


document.addEventListener('click',e=>{
  const schedule=e.target.closest('[data-schedule]');if(schedule){const post=data.posts.find(p=>p.id===schedule.dataset.schedule);if(post){openEditor(post,{status:post.status==='published'?'published':'planned',date:post.date||todayKey()});editorIntent='schedule';$('post-date').focus();}return;}
  const publish=e.target.closest('[data-publish]');if(publish){const post=data.posts.find(p=>p.id===publish.dataset.publish);if(post){openEditor(post,{status:'published',date:todayKey()});$('post-url').focus();}return;}
  const copy=e.target.closest('[data-copy]');if(copy){const post=data.posts.find(p=>p.id===copy.dataset.copy);if(post)copyBody(post);return;}
  const overview=e.target.closest('[data-open-library]');if(overview){ui.status=overview.dataset.openLibrary;ui.platform='all';ui.query='';$('global-search').value='';history.pushState(null,'','#library');render();$('library-title').focus();return;}
  const edit=e.target.closest('[data-edit]');if(edit){const post=data.posts.find(p=>p.id===edit.dataset.edit);if(post)openEditor(post);return;}
  const date=e.target.closest('[data-date]');if(date){if(date.dataset.date<'1900-01-01'||date.dataset.date>'2100-12-31'){notify('1900년부터 2100년 사이의 날짜를 선택해 주세요.');return;}ui.selected=date.dataset.date;ui.month=ui.selected.slice(0,7);renderCalendar();document.querySelector(`[data-date="${ui.selected}"]`)?.focus({preventScroll:true});return;}
  const ch=e.target.closest('[data-channel]');if(ch){const container=ch.parentElement.id;ui.platform=ch.dataset.channel;render();$(container).querySelector(`[data-channel="${ui.platform}"]`)?.focus({preventScroll:true});return;}
  const st=e.target.closest('[data-status]');if(st){ui.status=st.dataset.status;renderCollections();$('status-filters').querySelector(`[data-status="${ui.status}"]`)?.focus({preventScroll:true});return;}
  const mode=e.target.closest('[data-mode]');if(mode){ui.mode=mode.dataset.mode;renderCalendar();return;}
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(action==='new')openEditor(null,{date:'',status:'draft'});
  if(action==='new-selected')openEditor(null,{date:ui.selected,status:'planned'});
  if(action==='new-published')openEditor(null,{status:'published',date:todayKey()});
  if(action==='close-editor')tryCloseEditor();
  if(action==='reset-filters'){ui.query='';ui.platform='all';ui.status='all';$('global-search').value='';render();}
});
$('calendar-grid').addEventListener('keydown',e=>{
  const target=e.target.closest('[data-date]');if(!target)return;
  const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
  let date;
  try {if(e.key in offsets)date=addDays(target.dataset.date,offsets[e.key]);else if(e.key==='Home')date=weekRange(target.dataset.date).start;else if(e.key==='End')date=weekRange(target.dataset.date).end;else return;}catch{return;}
  e.preventDefault();if(date<'1900-01-01'||date>'2100-12-31')return;ui.selected=date;ui.month=date.slice(0,7);renderCalendar();document.querySelector(`[data-date="${date}"]`)?.focus({preventScroll:true});
});
function changePeriod(n){try{const next=ui.mode==='month'?`${shiftMonth(ui.month,n)}-01`:addDays(ui.selected,n*7);if(next<'1900-01-01'||next>'2100-12-31'){notify('1900년부터 2100년까지 표시할 수 있어요.');return;}ui.selected=next;ui.month=next.slice(0,7);renderCalendar();}catch{notify('이 기간은 표시할 수 없습니다.');}}
$('prev-period').onclick=()=>changePeriod(-1);$('next-period').onclick=()=>changePeriod(1);
$('go-today').onclick=()=>{ui.today=todayKey();ui.selected=ui.today;ui.month=ui.today.slice(0,7);renderCalendar();};
$('global-search').addEventListener('input',e=>{ui.query=e.target.value;ui.status='all';ui.platform='all';if(ui.query){history.replaceState(null,'','#library');ui.view='library';}render();});
$('clear-search').onclick=()=>{ui.query='';ui.status='all';$('global-search').value='';render();$('global-search').focus();};
$('post-sort').onchange=e=>{ui.sort=e.target.value;renderCollections();};
window.addEventListener('hashchange',()=>{if(location.hash==='#main-content'){$('main-content').focus();return;}ui.status='all';ui.query='';$('global-search').value='';render();showView(true);});
function refreshDay(){if(todayKey()!==ui.today&&!editor.open){const wasToday=ui.selected===ui.today;ui.today=todayKey();if(wasToday){ui.selected=ui.today;ui.month=ui.today.slice(0,7);}render();}}
window.addEventListener('focus',refreshDay);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDay();});
window.addEventListener('beforeunload',e=>{if(editor.open&&(saving||photos.dirty||photos.selecting||JSON.stringify(formValue())!==initialForm)){e.preventDefault();e.returnValue='';}});
function reloadStoredData() {
  const next=store.load(SEED_POSTS);storageLocked=Boolean(next.warning);
  if(next.warning){$('storage-warning').textContent=next.warning;$('storage-warning').hidden=false;notify(next.warning);return;}
  data={posts:next.posts,settings:next.settings};$('storage-warning').hidden=true;render();
}
window.addEventListener('storage',e=>{
  if(e.key!==STORAGE_KEY&&e.key!==null)return;
  if(editor.open){externalChange=true;notify('다른 탭에서 기록이 변경됐어요. 본문을 복사해 두고 편집창을 닫은 뒤 다시 열어 주세요.');return;}
  reloadStoredData();
});
$('goal-form').onsubmit=e=>{e.preventDefault();try{const goal=Number($('weekly-goal').value);if(!Number.isInteger(goal)||goal<1||goal>100)throw new Error('목표는 1~100개로 입력해 주세요.');commit({...data,settings:{weeklyGoal:goal}});notify('주간 목표를 저장했어요.');}catch(err){notify(err.message);}};
function download(text,name){const blob=new Blob([text],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-data').onclick=()=>{
  try {if(storageLocked){const raw=storage.getItem(STORAGE_KEY);if(raw===null)throw new Error('내려받을 저장 내용이 없습니다.');download(raw,`sns-original-${ui.today}.json`);notify('보관된 원본 파일을 내려받았어요.');return;}
    download(store.export(data),`sns-calendar-${ui.today}.json`);$('backup-status').textContent=`최근 백업: ${new Date().toLocaleString('ko-KR')}`;notify('백업 파일을 내려받았어요.');
  }catch(e){notify(e.message);}
};
$('import-data').onclick=()=>$('import-file').click();
$('import-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try {
    if(file.size>10*1024*1024)throw new Error('10MB 이하의 백업 파일을 선택해 주세요.');
    const imported=store.parseImport(await file.text());
    const title=storageLocked?'백업으로 기록을 복구할까요?':'백업을 가져올까요?';
    const currentById=new Map(data.posts.map(p=>[p.id,p]));let added=0,updated=0,kept=0;for(const p of imported.posts){const old=currentById.get(p.id);if(!old)added++;else if(Date.parse(p.updatedAt)>Date.parse(old.updatedAt))updated++;else kept++;}
    const detail=storageLocked?`보관 중인 원본을 먼저 내려받아 두세요. 검증한 백업의 ${imported.posts.length}개 기록으로 복구합니다.`:`새 기록 ${added}개 추가, 기존 기록 ${updated}개 갱신, ${kept}개 유지합니다. 현재 주간 목표는 유지됩니다.`;
    if(!await requestConfirm(title,detail,storageLocked?'백업으로 복구':'병합하기'))return;
    const next=storageLocked?imported:store.merge(data,imported);
    store.save(next);data=next;storageLocked=false;$('storage-warning').hidden=true;render();notify('백업을 가져왔어요.');void photos.cleanup();
  }catch(error){notify(error.message);}finally{e.target.value='';}
};
$('post-platform').innerHTML=CHANNELS.map(c=>`<option value="${c.id}">${c.label}</option>`).join('');
$('post-status').innerHTML=STATUSES.map(s=>`<option value="${s.id}">${s.label}</option>`).join('');
$('weekly-goal').max='100';
$('channel-directory').innerHTML=CHANNELS.filter(c=>c.composeUrl).map(c=>`<a href="${esc(c.composeUrl)}" target="_blank" rel="noopener noreferrer"><span class="channel-mark" style="--channel-color:${c.color}">${channelIcon(c.id)}</span><span>${c.label}</span><span aria-hidden="true">↗</span></a>`).join('');
if(loaded.warning){$('storage-warning').textContent=loaded.warning+' 설정에서 원본 백업과 가져오기를 사용할 수 있습니다.';$('storage-warning').hidden=false;}
render();
