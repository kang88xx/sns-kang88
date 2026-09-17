import { MAX_PHOTOS, validatePhoto } from './photos.js';

// Photos stay outside v1 records. Stable record IDs reconnect them after a JSON import.
export function mountPhotos({cloud, storage, project, getStoredPosts, canClean, notify}) {
  const $ = id => document.getElementById(id);
  const queueKey = `sns-kang88:photo-deletions:v1:${project}`;
  let recordId = '', remote = [], pending = [], removed = new Set(), generation = 0;
  let loading = false, selecting = false, loadFailed = false, message = '', cleaning = false;
  let retryTimer, scanAfterClose = false;
  const urls = new Set();
  const objectURL = blob => { const url = URL.createObjectURL(blob); urls.add(url); return url; };
  const release = () => {for (const url of urls) URL.revokeObjectURL(url); urls.clear();};
  function readQueue() {
    const raw = storage.getItem(queueKey);
    if (!raw) return [];
    const items = JSON.parse(raw);
    if (!Array.isArray(items) || items.some(p => !p || typeof p.id !== 'string' || typeof p.owner !== 'string' || !Number.isFinite(p.after))) {
      throw new Error('사진 정리 목록을 읽지 못했습니다. 브라우저 백업을 유지한 채 다시 시도해 주세요.');
    }
    return items;
  }
  function writeQueue(items) {storage.setItem(queueKey, JSON.stringify(items));}
  function forget(id) {writeQueue(readQueue().filter(p => p.id !== id));}
  function banner(text = '') {
    $('photo-cleanup-notice').hidden = !text;
    $('photo-cleanup-message').textContent = text;
  }
  function account() {
    $('photo-account-status').textContent = !cloud.configured ? '사진 저장소 연결을 준비 중입니다.' : cloud.user ? `${cloud.user.email} · 비공개 사진 보관` : '사진을 보관하려면 관리자 계정으로 로그인하세요.';
    $('photo-login-form').hidden = !cloud.configured || Boolean(cloud.user);
    $('photo-logout').hidden = !cloud.user;
    $('photo-retry').hidden = !cloud.configured;
  }
  function draw() {
    const published = $('post-status').value === 'published';
    $('photo-add').disabled = !cloud.user || published || loading || selecting || remote.length - removed.size + pending.length >= MAX_PHOTOS;
    $('photo-open-settings').hidden = !cloud.configured || Boolean(cloud.user);
    $('photo-reload').hidden = !cloud.user || (!loadFailed && !message);
    $('photo-hint').textContent = !cloud.configured ? '사진 저장소 연결을 준비 중입니다.' : published ? '발행 완료로 저장하면 보관된 사진을 삭제합니다. 새로 선택한 사진은 업로드하지 않습니다. SNS에 올린 사진은 유지됩니다.' : !cloud.user ? '로그인 후 사진을 첨부할 수 있습니다.' : 'JPG·PNG·WebP, 장당 6MB · 최대 10장. 저장 버튼을 누르면 비공개로 보관합니다.';
    $('photo-status').textContent = selecting ? '사진을 확인하고 있습니다…' : loading ? '보관된 사진을 불러오고 있습니다…' : message;
    const grid = $('photo-grid'); grid.replaceChildren();
    for (const item of [...remote, ...pending]) {
      const figure = document.createElement('figure'); figure.className = 'photo-item';
      if (removed.has(item.path)) figure.classList.add('photo-removed');
      if (item.url) {const img = document.createElement('img'); img.src = item.url; img.alt = item.file?.name || '보관된 사진'; figure.append(img);}
      else {const placeholder = document.createElement('div'); placeholder.className = 'photo-placeholder'; placeholder.textContent = item.previewFailed ? '미리보기 실패' : '불러오는 중'; figure.append(placeholder);}
      const caption = document.createElement('figcaption');
      const label = document.createElement('span'); label.textContent = removed.has(item.path) ? '저장 시 삭제' : item.file ? '저장 대기' : '보관 중'; caption.append(label);
      if (!published) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'text-link';
        button.textContent = removed.has(item.path) ? '되돌리기' : '제거'; button.setAttribute('aria-label', `${item.file?.name || '보관된 사진'} ${button.textContent}`);
        button.onclick = () => {
          if (item.file) {pending = pending.filter(p => p !== item); URL.revokeObjectURL(item.url); urls.delete(item.url);}
          else if (removed.has(item.path)) removed.delete(item.path); else removed.add(item.path);
          draw();
        }; caption.append(button);
      }
      if (!item.file && item.url) {
        const link = document.createElement('a'); link.className = 'text-link'; link.href = item.url; link.download = item.name; link.textContent = '다운로드'; caption.append(link);
      }
      figure.append(caption); grid.append(figure);
    }
  }
  async function previews(items, token) {
    await Promise.all(items.map(async item => {
      try {const blob = await cloud.read(item.path); if (token !== generation) return; item.url = objectURL(blob);}
      catch {if (token !== generation) return; item.previewFailed = true; message = '일부 사진을 표시하지 못했습니다. 다시 불러올 수 있습니다.';}
      if (token === generation) draw();
    }));
  }
  async function reload() {
    if (!recordId || !cloud.user) {draw(); return;}
    const token = generation;
    loading = true; loadFailed = false; message = ''; draw();
    try {
      const items = await cloud.list(recordId);
      if (token !== generation) return;
      for (const item of remote) {if (item.url) {URL.revokeObjectURL(item.url); urls.delete(item.url);}}
      remote = items;
      await previews(remote, token);
    } catch (error) {if (token === generation) {loadFailed = true; message = error.message;}}
    finally {if (token === generation) {loading = false; draw();}}
  }
  function reset() {generation++; release(); remote = []; pending = []; removed.clear(); loading = false; selecting = false; loadFailed = false; message = ''; recordId = ''; draw();}
  function open(id, exists) {reset(); recordId = id; if (exists) void reload(); else draw();}
  $('photo-add').onclick = () => $('photo-input').click();
  $('photo-input').onchange = async event => {
    const files = Array.from(event.target.files); event.target.value = ''; if (!files.length) return;
    const token = generation; selecting = true; message = ''; draw();
    try {
      if (remote.length - removed.size + pending.length + files.length > MAX_PHOTOS) throw new Error('사진은 최대 10장까지 첨부할 수 있습니다.');
      await Promise.all(files.map(validatePhoto));
      if (token !== generation) return;
      for (const file of files) {
        const extension = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
        pending.push({file, name:`${crypto.randomUUID()}.${extension}`, url:objectURL(file)});
      }
    } catch (error) {if (token === generation) message = error.message;}
    finally {if (token === generation) {selecting = false; draw();}}
  };
  $('photo-reload').onclick = reload;
  $('post-status').addEventListener('change', draw);
  $('photo-login-form').onsubmit = async event => {
    event.preventDefault(); const button = $('photo-login'); button.disabled = true;
    $('photo-login-error').hidden = true;
    try {
      await cloud.signIn($('photo-email').value.trim(), $('photo-password').value);
      $('photo-password').value = ''; account(); draw(); if (recordId) void reload(); notify('사진 보관함에 로그인했습니다.'); void cleanup();
    } catch (error) {$('photo-login-error').textContent = error.message; $('photo-login-error').hidden = false;}
    finally {button.disabled = false;}
  };
  $('photo-logout').onclick = async () => {
    try {await cloud.signOut(); notify('사진 보관함에서 로그아웃했습니다.');}
    catch {notify('이 탭에서 로그아웃했습니다. 서버 연결을 확인해 주세요.');}
    finally {account(); reset();}
  };
  async function cleanup() {
    if (cleaning || !cloud.configured || !canClean()) return;
    if (!cloud.user) {banner('사진 정리 확인이 필요합니다. 설정에서 로그인하면 발행한 기록의 사진을 정리합니다.'); return;}
    cleaning = true; clearTimeout(retryTimer);
    try {
      const posts = getStoredPosts();
      // A restored record cancels its deletion intent. Queue writes precede destructive work.
      const previous = readQueue();
      const queue = previous.filter(p => !posts.some(post => post.id === p.id));
      if (queue.length !== previous.length) writeQueue(queue);
      const candidates = [...posts.filter(p => p.status === 'published').map(p => ({id:p.id, published:true})), ...queue.filter(p => (!p.owner || p.owner === cloud.user.id) && p.after <= Date.now())];
      for (const item of candidates) {
        if (!canClean()) return;
        const current = getStoredPosts().find(p => p.id === item.id);
        if (item.published ? current?.status !== 'published' : current) continue;
        await cloud.clearRecord(item.id);
        if (!item.published) forget(item.id);
      }
      const remaining = readQueue();
      banner(remaining.length ? '삭제한 기록의 사진을 정리할 예정입니다. 실행 취소하면 사진도 유지됩니다.' : '');
      const next = remaining.filter(p => (!p.owner || p.owner === cloud.user?.id)).sort((a,b) => a.after - b.after)[0];
      if (next) retryTimer = setTimeout(cleanup, Math.max(1000, next.after - Date.now() + 100));
    } catch (error) {banner(`사진 정리 필요 · ${error.message} 원고와 발행 기록은 유지됩니다.`);}
    finally {cleaning = false; account();}
  }
  $('photo-retry').onclick = cleanup;
  $('photo-cleanup-retry').onclick = cleanup;
  window.addEventListener('online', cleanup);
  function assertCurrent(post) {
    const current = getStoredPosts().find(p => p.id === post.id);
    if (!current || current.status !== post.status || current.updatedAt !== post.updatedAt) throw new Error('다른 탭에서 기록이 바뀌어 사진 작업을 중단했습니다. 다시 열어 확인해 주세요.');
  }
  async function save(post) {
    if (!cloud.configured) return;
    assertCurrent(post);
    if (post.status === 'published') {
      // The caller has already committed the manual publication record.
      pending = []; removed.clear(); draw();
      if (!cloud.user) {banner('발행 기록을 저장했습니다. 설정에서 로그인하면 보관된 사진을 삭제합니다.'); return;}
      try {await cloud.clearRecord(post.id); scanAfterClose = true;}
      catch (error) {banner(`사진 정리 필요 · ${error.message} 발행 기록은 저장됐습니다.`);}
      return;
    }
    if (!pending.length && !removed.size) return;
    // Relist before retrying: a timed-out upload might already exist under its stable random name.
    const existing = await cloud.list(post.id);
    if (existing.length - removed.size + pending.filter(p => !existing.some(item => item.name === p.name)).length > MAX_PHOTOS) throw new Error('사진은 최대 10장까지 보관할 수 있습니다. 다시 불러온 뒤 확인해 주세요.');
    if (removed.size) {
      assertCurrent(post); await cloud.remove([...removed]);
      const remaining = await cloud.list(post.id);
      if (remaining.some(p => removed.has(p.path))) throw new Error('일부 사진이 삭제되지 않았습니다. 저장을 다시 눌러 정리해 주세요.');
      remote = remote.filter(p => !removed.has(p.path)); removed.clear(); draw();
    }
    for (const item of [...pending]) {
      assertCurrent(post);
      const saved = existing.find(p => p.name === item.name) || await cloud.upload(post.id, item.file, item.name);
      pending = pending.filter(p => p !== item); remote.push({...saved, url:item.url}); draw();
    }
    message = ''; draw();
  }
  async function beforeDelete(post) {
    if (!cloud.configured) return;
    // Reserve cleanup before deleting the local record; a failed commit leaves a record, so cleanup skips it.
    const queue = readQueue().filter(p => p.id !== post.id);
    writeQueue([...queue, {id:post.id, owner:cloud.user?.id || '', after:Date.now() + 20000}]);
  }
  account(); draw();
  if (cloud.configured) void cloud.restore().then(() => {account(); draw(); if (recordId) void reload(); void cleanup();}).catch(error => {account(); $('photo-account-status').textContent = error.message;});
  return {
    open, reset, draw, save, cleanup, beforeDelete,
    closed() {try {if (cloud.configured && (scanAfterClose || readQueue().length)) {scanAfterClose = false; void cleanup();}} catch (error) {banner(error.message);}},
    get dirty() {return Boolean(pending.length || removed.size);},
    get selecting() {return selecting;},
    assertReady(status) {
      if (selecting) throw new Error('사진 확인이 끝난 뒤 저장해 주세요.');
      if (status !== 'published' && (pending.length || removed.size) && !cloud.user) throw new Error('사진 보관함에 다시 로그인해 주세요.');
      if (status !== 'published' && (pending.length || removed.size) && (loading || loadFailed)) throw new Error('보관된 사진을 다시 불러온 뒤 저장해 주세요.');
    },
  };
}
