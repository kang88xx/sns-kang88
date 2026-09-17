import { CHANNELS, STATUSES, todayKey, addDays, shiftMonth, monthGrid, weekRange, normalizePost, filterPosts, getStats } from './core.js';
import { createStore, STORAGE_KEY } from './store.js';
import { SEED_POSTS } from './seed.js';

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
const ui = {today:todayKey(),month:todayKey().slice(0,7),selected:todayKey(),mode:'month',platform:'all',status:'all',query:'',sort:'date-desc',view:'calendar'};
let editingId = '', initialForm = '', returnFocus = null, returnFocusSelector = '', toastTimer;
let confirmResolve = null;
const editor = $('post-dialog');
const confirmation = $('confirm-dialog');

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

function badge(p) {
  const c = channel(p.platform), s = status(p.status);
  return `<span class="channel-badge" style="--channel-color:${c.color}"><span class="channel-mark">${esc(c.short)}</span>${esc(c.label)}</span><span class="status-badge ${s.id}">${esc(s.label)}</span>`;
}
function card(p, compact = false) {
  return `<article class="${compact?'day-card':'post-card'}" style="--channel-color:${channel(p.platform).color}">
    <button type="button" class="card-open" data-edit="${esc(p.id)}" aria-label="${esc(p.title)} · ${esc(channel(p.platform).label)} 편집">
      <span class="post-top">${badge(p)}</span><span class="post-title">${esc(p.title)}</span>
      <span class="post-meta">${p.date?esc(dateLabel(p.date)):'날짜 미정'}${p.time?' · '+esc(p.time):''} · ${langs[p.language]}</span>
      ${!compact && (p.text||p.notes)?`<span class="post-excerpt">${esc((p.text||p.notes).slice(0,130))}</span>`:''}
    </button><div class="card-actions">${p.url?`<a class="text-link" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">발행한 글 ↗</a>`:'<span></span>'}<button class="text-link" data-edit="${esc(p.id)}">${p.status==='published'?'기록 보기':'이어서 작성'} →</button></div></article>`;
}
function empty(title, copy, action = '', label = '새 게시물') {
  return `<div class="empty-state"><span class="empty-icon" aria-hidden="true">＋</span><h3 class="empty-title">${esc(title)}</h3><p class="empty-copy">${esc(copy)}</p>${action?`<button class="btn btn-tonal" data-action="${action}">${esc(label)}</button>`:''}</div>`;
}
function filtered(forPosts = false) {
  return filterPosts(data.posts,{platform:ui.platform,status:forPosts?ui.status:'all',query:ui.query});
}
function renderChannels() {
  const base = filterPosts(data.posts,{query:ui.query});
  const markup = [{id:'all',label:'전체',short:'',color:'',count:base.length},...CHANNELS.map(c=>({...c,count:base.filter(p=>p.platform===c.id).length}))].map(c=>
    `<button class="channel-chip ${ui.platform===c.id?'active':''}" aria-pressed="${ui.platform===c.id}" data-channel="${c.id}">${c.short?`<span class="channel-mark" style="--channel-color:${c.color}">${esc(c.short)}</span>`:''}<span class="channel-label">${c.label}</span><span class="channel-count">${c.count}</span></button>`).join('');
  $('calendar-channels').innerHTML = markup; $('posts-channels').innerHTML = markup;
}
function renderSummary() {
  const stats = getStats(data.posts,ui.today), goal = data.settings.weeklyGoal;
  const pct = Math.min(100,Math.round(stats.weekPublished/goal*100));
  $('summary').innerHTML = `<div class="summary-card goal-card"><div class="goal-heading"><span class="stat-label">이번 주 발행</span><span class="goal-percent">${pct}%</span></div><div class="stat-value">${stats.weekPublished}<span> / ${goal}개</span></div><div class="goal-progress" role="progressbar" aria-label="주간 발행 목표" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(stats.weekPublished,goal)}"><span style="width:${pct}%"></span></div><span class="stat-note">${stats.weekPublished>=goal?'이번 주 목표를 채웠어요.':`목표까지 ${goal-stats.weekPublished}개 남았어요.`}</span></div>
  <div class="summary-card blue"><span class="stat-label">이번 주 계획</span><div class="stat-value">${stats.weekPlanned}<span>개</span></div><span class="stat-note">게시를 준비하는 일정</span></div>
  <div class="summary-card amber"><span class="stat-label">작성 중인 초안</span><div class="stat-value">${stats.draftCount}<span>개</span></div><span class="stat-note">나의 다음 이야기</span></div>
  <div class="summary-card green"><span class="stat-label">연속 발행</span><div class="stat-value">${stats.streak}<span>일</span></div><span class="stat-note">전체 발행 기록 ${stats.publishedCount}개</span></div>`;
}
function renderCalendar() {
  const week = weekRange(ui.selected);
  const dates = ui.mode==='month'?monthGrid(ui.month):Array.from({length:7},(_,i)=>addDays(week.start,i));
  $('month-label').textContent = ui.mode==='month'?`${Number(ui.month.slice(0,4))}년 ${Number(ui.month.slice(5))}월`:`${dateLabel(week.start,{weekday:undefined})} – ${dateLabel(week.end,{weekday:undefined})}`;
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===ui.mode)));
  const posts = filtered().filter(p=>p.status!=='idea');
  $('calendar-grid').classList.toggle('week-view',ui.mode==='week');
  $('calendar-grid').innerHTML = dates.map(date=>{
    const items = posts.filter(p=>p.date===date), current = date===ui.today;
    const classes = ['calendar-cell', date.slice(0,7)!==ui.month&&ui.mode==='month'?'outside':'',date===ui.selected?'selected':'',current?'is-today':'',items.length?'has-posts':''].join(' ');
    return `<button class="${classes}" data-date="${date}" tabindex="${date===ui.selected?0:-1}" aria-pressed="${date===ui.selected}" ${current?'aria-current="date"':''} aria-label="${esc(dateLabel(date,{year:'numeric'}))}, ${items.length?items.map(p=>`${channel(p.platform).label} ${p.title} ${status(p.status).label}`).map(esc).join(', '):'게시물 없음'}"><span class="date-number">${Number(date.slice(-2))}</span><span class="day-events">${items.slice(0,3).map(p=>`<span class="day-event ${p.status}" style="--channel-color:${channel(p.platform).color}"><span class="event-platform">${esc(channel(p.platform).short)}</span><span class="event-title">${esc(p.title)}</span></span>`).join('')}${items.length>3?`<span class="day-more">+${items.length-3}개</span>`:''}</span></button>`;
  }).join('');
  $('day-title').textContent = dateLabel(ui.selected);
  $('selected-day-label').textContent = ui.selected===ui.today?'오늘의 게시물':'선택한 날짜';
  const dayPosts = posts.filter(p=>p.date===ui.selected);
  $('day-posts').innerHTML = dayPosts.length?dayPosts.map(p=>card(p,true)).join(''):empty('아직 일정이 없어요','이 날짜에 올릴 이야기를 적어보세요.','new-selected','게시물 추가');
  const upcoming = posts.filter(p=>p.status!=='published' && (!p.date||p.date>=ui.today)).slice(0,3);
  $('upcoming-posts').innerHTML = upcoming.length?upcoming.map(p=>card(p)).join(''):empty('다음 게시물을 준비해볼까요?','아이디어가 떠오르면 제목만 먼저 남겨도 좋아요.','new','새 게시물');
}
function renderPosts() {
  $('status-filters').innerHTML = [{id:'all',label:'전체'},...STATUSES].map(s=>`<button data-status="${s.id}" class="status-filter ${ui.status===s.id?'active':''}" aria-pressed="${ui.status===s.id}">${s.label}</button>`).join('');
  let posts = filtered(true);
  if(ui.sort==='date-desc') posts.sort((a,b)=>(b.date||'0000').localeCompare(a.date||'0000')||b.time.localeCompare(a.time));
  if(ui.sort==='updated') posts.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  $('post-count').textContent = `${posts.length}개의 게시물${ui.query?` · “${ui.query}” 검색 결과`:''}`;
  $('post-list').innerHTML = posts.length?posts.map(p=>card(p)).join(''):empty('조건에 맞는 게시물이 없어요','다른 검색어를 입력하거나 필터를 초기화해 보세요.','reset-filters','필터 초기화');
  const ideas = filterPosts(data.posts,{query:ui.query}).filter(p=>p.status==='idea');
  $('idea-list').innerHTML = ideas.length?ideas.map(p=>card(p)).join(''):empty('생각이 떠오르면 이곳에','날짜를 정하기 전, 글감과 참고 자료를 모아두세요.','new-idea','첫 아이디어 남기기');
}
function showView(focus = false) {
  const candidate = location.hash.slice(1);
  ui.view = ['calendar','posts','ideas','settings'].includes(candidate)?candidate:candidate==='main-content'?ui.view:'calendar';
  document.querySelectorAll('.view').forEach(s=>{s.hidden=s.id!==`view-${ui.view}`;});
  document.querySelectorAll('.rail a').forEach(a=>{const active=a.dataset.view===ui.view;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  if(focus)$(`view-${ui.view}`).querySelector('h1').focus({preventScroll:true});
}
function render() {
  ui.today = todayKey(); $('today-pill').textContent = dateLabel(ui.today); $('clear-search').hidden=!ui.query;
  renderSummary(); renderChannels(); renderCalendar(); renderPosts();
  if(document.activeElement!==$('weekly-goal'))$('weekly-goal').value = data.settings.weeklyGoal;
  showView();
}
function formValue() {
  return {title:$('post-title').value,platform:$('post-platform').value,status:$('post-status').value,date:$('post-date').value,time:$('post-time').value,language:$('post-language').value,text:$('post-text').value,url:$('post-url').value,notes:$('post-notes').value};
}
function syncForm() {
  $('text-count').textContent=`${$('post-text').value.length.toLocaleString('ko-KR')}자`;
  const dated=['planned','published'].includes($('post-status').value);
  $('post-date').required=dated;
  $('schedule-hint').textContent=$('post-status').value==='published'?'발행한 날짜와 링크를 기록해 주세요. SNS에 게시하는 기능은 아닙니다.':'날짜와 시간은 계획용이며 SNS에 자동으로 게시되지 않습니다.';
}
function openEditor(record = null, overrides = {}) {
  returnFocus=document.activeElement;
  returnFocusSelector=returnFocus.id?`#${CSS.escape(returnFocus.id)}`:returnFocus.dataset.edit?`[data-edit="${CSS.escape(returnFocus.dataset.edit)}"]`:returnFocus.dataset.action?`[data-action="${CSS.escape(returnFocus.dataset.action)}"]`:'';
  if(returnFocus.closest('.view')&&returnFocusSelector)returnFocusSelector=`#${returnFocus.closest('.view').id} ${returnFocusSelector}`;
  editingId=record?.id||'';
  const p={title:'',platform:ui.platform==='all'?'linkedin':ui.platform,status:'draft',date:ui.selected,time:'',language:'ko',text:'',url:'',notes:'',...record,...overrides};
  for(const field of ['title','platform','status','date','time','language','text','url','notes'])$(`post-${field}`).value=p[field];
  $('post-id').value=editingId; $('editor-title').textContent=editingId?'게시물 기록':p.status==='idea'?'새 아이디어':'새 게시물';
  $('editor-eyebrow').textContent=editingId?`마지막 수정 ${dateLabel(todayKey(new Date(record.updatedAt)))}`:'콘텐츠 기록';
  $('delete-post').hidden=!editingId;$('duplicate-post').hidden=!editingId;$('form-error').hidden=true;
  syncForm();initialForm=JSON.stringify(formValue());editor.showModal();$('post-title').focus();
}
function closeEditor() {editor.close();}
editor.addEventListener('close',()=>{if(externalChange){externalChange=false;reloadStoredData();}const target=returnFocus?.isConnected?returnFocus:returnFocusSelector?document.querySelector(returnFocusSelector):null;(target||$(`view-${ui.view}`).querySelector('h1')).focus({preventScroll:true});});
async function tryCloseEditor() {
  if(JSON.stringify(formValue())!==initialForm && !await requestConfirm('저장하지 않고 닫을까요?','작성 중인 변경 사항은 저장되지 않습니다.','닫기'))return;
  closeEditor();
}
editor.addEventListener('cancel',e=>{e.preventDefault();tryCloseEditor();});
editor.addEventListener('keydown',e=>{if(e.key==='Escape'&&!confirmation.open){e.preventDefault();e.stopPropagation();tryCloseEditor();}});
$('post-form').addEventListener('input',syncForm);
$('post-form').addEventListener('change',syncForm);
$('post-form').addEventListener('submit',e=>{
  e.preventDefault();
  try {
    const old=data.posts.find(p=>p.id===editingId);
    const post=normalizePost({...old,...formValue(),updatedAt:new Date().toISOString()});
    const posts=old?data.posts.map(p=>p.id===old.id?post:p):[...data.posts,post];
    if(post.date){ui.selected=post.date;ui.month=post.date.slice(0,7);}
    commit({...data,posts});closeEditor();notify(old?'변경 내용을 저장했어요.':'게시물을 저장했어요.');
  } catch(error){$('form-error').textContent=error.message;$('form-error').hidden=false;}
});
$('delete-post').onclick=async()=>{
  const post=data.posts.find(p=>p.id===editingId);if(!post)return;
  if(!await requestConfirm('이 기록을 삭제할까요?',`“${post.title}”을 캘린더에서 지웁니다. SNS에 발행한 글은 그대로 유지됩니다.`,'기록 삭제'))return;
  try {commit({...data,posts:data.posts.filter(p=>p.id!==post.id)});closeEditor();notify('기록을 삭제했어요.',()=>{try{commit({...data,posts:[...data.posts.filter(p=>p.id!==post.id),post]});notify('기록을 복원했어요.');}catch(e){notify(e.message);}});}catch(e){$('form-error').textContent=e.message;$('form-error').hidden=false;}
};
$('duplicate-post').onclick=()=>{
  editingId='';$('post-id').value='';$('post-title').value=`${$('post-title').value.slice(0,154)} (복제)`;$('post-status').value='draft';$('post-url').value='';$('post-date').value=ui.today;
  $('editor-title').textContent='게시물 복제';$('editor-eyebrow').textContent='채널과 날짜를 바꿔 새 기록으로 저장하세요.';$('delete-post').hidden=true;$('duplicate-post').hidden=true;syncForm();$('post-platform').focus();
};
$('copy-post').onclick=async()=>{try{await navigator.clipboard.writeText($('post-text').value);notify('본문을 복사했어요.');}catch{$('post-text').focus();$('post-text').select();notify('본문을 선택했어요. 복사 단축키를 눌러 주세요.');}};

document.addEventListener('click',e=>{
  const edit=e.target.closest('[data-edit]');if(edit){const post=data.posts.find(p=>p.id===edit.dataset.edit);if(post)openEditor(post);return;}
  const date=e.target.closest('[data-date]');if(date){if(date.dataset.date<'1900-01-01'||date.dataset.date>'2100-12-31'){notify('1900년부터 2100년 사이의 날짜를 선택해 주세요.');return;}ui.selected=date.dataset.date;ui.month=ui.selected.slice(0,7);renderCalendar();document.querySelector(`[data-date="${ui.selected}"]`)?.focus({preventScroll:true});return;}
  const ch=e.target.closest('[data-channel]');if(ch){const container=ch.parentElement.id;ui.platform=ch.dataset.channel;render();$(container).querySelector(`[data-channel="${ui.platform}"]`)?.focus({preventScroll:true});return;}
  const st=e.target.closest('[data-status]');if(st){ui.status=st.dataset.status;renderPosts();$('status-filters').querySelector(`[data-status="${ui.status}"]`)?.focus({preventScroll:true});return;}
  const mode=e.target.closest('[data-mode]');if(mode){ui.mode=mode.dataset.mode;renderCalendar();return;}
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(action==='new'){ui.today=todayKey();openEditor(null,{date:ui.today});}
  if(action==='new-selected')openEditor();
  if(action==='new-idea')openEditor(null,{status:'idea',date:'',time:''});
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
$('global-search').addEventListener('input',e=>{ui.query=e.target.value;if(ui.query){history.replaceState(null,'','#posts');ui.view='posts';}render();});
$('clear-search').onclick=()=>{ui.query='';$('global-search').value='';render();$('global-search').focus();};
$('post-sort').onchange=e=>{ui.sort=e.target.value;renderPosts();};
window.addEventListener('hashchange',()=>{if(location.hash==='#main-content'){$('main-content').focus();return;}showView(true);});
function refreshDay(){if(todayKey()!==ui.today&&!editor.open){const wasToday=ui.selected===ui.today;ui.today=todayKey();if(wasToday){ui.selected=ui.today;ui.month=ui.today.slice(0,7);}render();}}
window.addEventListener('focus',refreshDay);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDay();});
window.addEventListener('beforeunload',e=>{if(editor.open&&JSON.stringify(formValue())!==initialForm){e.preventDefault();e.returnValue='';}});
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
    store.save(next);data=next;storageLocked=false;$('storage-warning').hidden=true;render();notify('백업을 가져왔어요.');
  }catch(error){notify(error.message);}finally{e.target.value='';}
};
$('post-platform').innerHTML=CHANNELS.map(c=>`<option value="${c.id}">${c.label}</option>`).join('');
$('post-status').innerHTML=STATUSES.map(s=>`<option value="${s.id}">${s.label}</option>`).join('');
$('weekly-goal').max='100';
$('channel-directory').innerHTML=CHANNELS.filter(c=>c.composeUrl).map(c=>`<a href="${esc(c.composeUrl)}" target="_blank" rel="noopener noreferrer"><span class="channel-mark" style="--channel-color:${c.color}">${esc(c.short)}</span><span>${c.label}</span><span aria-hidden="true">↗</span></a>`).join('');
if(loaded.warning){$('storage-warning').textContent=loaded.warning+' 설정에서 원본 백업과 가져오기를 사용할 수 있습니다.';$('storage-warning').hidden=false;}
render();
