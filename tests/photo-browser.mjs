// Optional browser acceptance suite. Uses an externally installed Playwright; no app dependency.
// QA_URL=http://127.0.0.1:8894 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROMIUM_PATH=/path/to/chrome node tests/photo-browser.mjs
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.QA_URL || 'http://127.0.0.1:8894';
const api = 'https://abcdefghijklmnopqrst.supabase.co';
const uid = '11111111-1111-4111-8111-111111111111';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1EAAAAASUVORK5CYII=', 'base64');
const file = name => ({name, mimeType:'image/png', buffer:png});
const output = 'artifacts/qa-supabase';
await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const results = [];
const key = 'sns-kang88:v1';
async function scenario(name, run) {
  if(process.env.QA_CASES&&!process.env.QA_CASES.split(',').includes(name))return;
  const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,route=>route.abort());
  const page = await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(30000);
  const objects = new Map(), events = [], errors = [];
  const state = {failUpload:0, failDelete:false, allowed:true, saveFailed:false};
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/cloud-config.js',route=>route.fulfill({contentType:'text/javascript',body:`export const CLOUD_CONFIG=${JSON.stringify({url:api,publishableKey:'sb_publishable_browser_fixture'})};`}));
  await context.route(`${api}/**`,async route=>{
    const request=route.request(), path=new URL(request.url()).pathname, method=request.method();
    const respond = (data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(path.endsWith('/token'))return respond({access_token:'fixture-user-token',refresh_token:'fixture-refresh',expires_in:3600,user:{id:uid,email:'qa@example.test'}});
    if(path.endsWith('/logout'))return respond({},200);
    assert.ok(request.headers().authorization?.startsWith('Bearer '),'private operation requires authenticated session');
    if(path==='/rest/v1/photo_owners')return respond(state.allowed?[{user_id:uid}]:[]);
    const json = method==='POST' && path.includes('/list/') || method==='DELETE' ? request.postDataJSON() : {};
    if(path.includes('/object/list/')) {
      const names=[...objects.keys()].filter(p=>p.startsWith(json.prefix)).map(p=>p.slice(json.prefix.length)).sort();
      return respond(names.slice(json.offset,json.offset+json.limit).map(name=>({name,id:name})));
    }
    if(method==='DELETE') {
      const stored = await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
      events.push({action:'delete',posts:stored?.posts||[],paths:json.prefixes});
      if(state.failDelete)return respond({error:'temporary'},503);
      for(const path of json.prefixes)objects.delete(path);
      return respond(json.prefixes.map(name=>({name})));
    }
    const objectPath = decodeURIComponent(path.replace(/^\/storage\/v1\/object\/(authenticated\/)?content-photos\//,''));
    if(method==='POST') {
      const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
      events.push({action:'upload',posts:stored?.posts||[],path:objectPath});
      if(state.failUpload>0){state.failUpload--;return respond({error:'temporary'},503);}
      objects.set(objectPath,request.postDataBuffer());return respond({Key:objectPath});
    }
    if(method==='GET'&&objects.has(objectPath))return route.fulfill({contentType:'image/png',body:objects.get(objectPath)});
    return respond({error:'missing'},404);
  });
  const ctx={page,context,objects,events,state};
  try {
    await page.goto(origin);await page.waitForSelector('.calendar-cell');
    await run(ctx);assert.deepEqual(errors,[]);results.push({name,status:'passed'});console.log('PASS',name);
  } catch(error) {results.push({name,status:'failed',error:error.stack});console.error('FAIL',name,error.message);await page.screenshot({path:`${output}/failure-${name}.png`,fullPage:true}).catch(()=>{});}
  finally {await context.close();}
}
async function login(page) {
  await page.locator('.rail [data-view="settings"]').click();
  await page.locator('#photo-email').fill('qa@example.test');await page.locator('#photo-password').fill('test-fixture-only');
  await page.locator('#photo-login').click();await page.waitForSelector('#photo-logout:visible');
}
async function create(page,title,files=[file('photo.png')]) {
  await page.locator('.appbar [data-action="new"]').click();await page.locator('#post-title').fill(title);
  await page.locator('#post-text').fill('사진 테스트 원고\n中文 Full body');
  if(files.length) {await page.locator('#photo-input').setInputFiles(files);await page.waitForFunction(()=>document.querySelectorAll('.photo-item').length>0&&!document.querySelector('#photo-status').textContent.includes('확인하고'));}
}
async function save(page) {await page.locator('#post-form [type="submit"]').click();await page.waitForSelector('#post-dialog',{state:'hidden'});}
async function edit(page,title) {await page.locator('.rail [data-view="library"]').click();await page.locator('#view-library .card-open').filter({hasText:title}).click();await page.waitForFunction(()=>!document.querySelector('#photo-status').textContent.includes('불러오고'));}
async function closeCancel(page) {await page.locator('[data-action="close-editor"]').first().click();if(await page.locator('#confirm-dialog').isVisible())await page.locator('#confirm-ok').click();await page.waitForSelector('#post-dialog',{state:'hidden'});}
const records=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key))?.posts||[],key);

await scenario('cancel-stages-files-without-network-writes',async({page,objects,events})=>{
  await login(page);await create(page,'cancelled');await closeCancel(page);
  assert.equal(objects.size,0);assert.equal(events.length,0);assert.equal((await records(page)).filter(p=>p.title==='cancelled').length,0);
});
await scenario('private-upload-reload-remove-and-publish',async({page,objects,events})=>{
  await login(page);await create(page,'with photos',[file('one.png'),file('two.png')]);assert.equal(objects.size,0);await save(page);
  const post=(await records(page)).find(p=>p.title==='with photos');assert.ok(post.id);assert.equal(objects.size,2);
  assert.ok(events.filter(e=>e.action==='upload').every(e=>e.posts.some(p=>p.id===post.id)),'record saved before upload');
  await page.reload();await edit(page,'with photos');await page.waitForFunction(()=>document.querySelectorAll('.photo-item img').length===2&&[...document.querySelectorAll('.photo-item img')].every(img=>img.complete&&img.naturalWidth>0));
  await page.locator('.photo-item button').first().click();assert.equal(objects.size,2);await closeCancel(page);assert.equal(objects.size,2);
  await edit(page,'with photos');await page.locator('.photo-item button').first().click();await save(page);assert.equal(objects.size,1);
  await edit(page,'with photos');await page.locator('#post-status').selectOption('published');await page.locator('#post-date').fill('2026-09-17');await save(page);
  assert.equal(objects.size,0);assert.equal((await records(page)).find(p=>p.id===post.id).status,'published');
  assert.ok(events.at(-1).posts.some(p=>p.id===post.id&&p.status==='published'),'publication commit precedes cloud deletion');
});
await scenario('failed-local-save-never-uploads-or-deletes',async({page,objects,events})=>{
  await login(page);await create(page,'local failure');
  await page.evaluate(key=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('quota','QuotaExceededError');return set.call(this,k,v);};},key);
  await page.locator('#post-form [type="submit"]').click();await page.waitForSelector('#form-error:visible');
  assert.equal(objects.size,0);assert.equal(events.length,0);assert.match(await page.locator('#post-title').inputValue(),/local failure/);
});
await scenario('upload-failure-retry-keeps-one-record',async({page,objects,state})=>{
  await login(page);await create(page,'retry');state.failUpload=1;
  await page.locator('#post-form [type="submit"]').click();await page.waitForSelector('#form-error:visible');
  const first=(await records(page)).find(p=>p.title==='retry');assert.ok(first);assert.equal(objects.size,0);
  await save(page);assert.equal(objects.size,1);assert.equal((await records(page)).filter(p=>p.title==='retry').length,1);assert.equal((await records(page)).find(p=>p.title==='retry').id,first.id);
});
await scenario('published-cleanup-failure-is-visible-and-retryable',async({page,objects,state})=>{
  await login(page);await create(page,'cleanup');await save(page);await edit(page,'cleanup');state.failDelete=true;
  await page.locator('#post-status').selectOption('published');await page.locator('#post-date').fill('2026-09-17');await save(page);
  await page.waitForSelector('#photo-cleanup-notice:visible');assert.equal(objects.size,1);assert.equal((await records(page)).find(p=>p.title==='cleanup').status,'published');
  state.failDelete=false;await page.locator('#photo-cleanup-retry').click();await page.waitForFunction(()=>document.querySelector('#photo-cleanup-notice').hidden);assert.equal(objects.size,0);
});
await scenario('duplicate-has-independent-photos',async({page,objects})=>{
  await login(page);await create(page,'original');await save(page);await edit(page,'original');await page.locator('#duplicate-post').click();
  assert.equal(await page.locator('.photo-item').count(),0);await save(page);assert.equal(objects.size,1);
  const rows=(await records(page)).filter(p=>p.title.startsWith('original'));assert.equal(rows.length,2);assert.notEqual(rows[0].id,rows[1].id);
});
await scenario('delete-undo-preserves-photos',async({page,objects})=>{
  await page.clock.install();await login(page);await create(page,'undo photos');await save(page);await edit(page,'undo photos');
  await page.locator('#delete-post').click();await page.locator('#confirm-ok').click();await page.waitForSelector('#post-dialog',{state:'hidden'});
  await page.locator('#toast-action').click();await page.clock.fastForward(22000);assert.equal(objects.size,1);assert.ok((await records(page)).some(p=>p.title==='undo photos'));
});
await scenario('delete-grace-expiry-cleans-photos',async({page,objects})=>{
  await page.clock.install();await login(page);await create(page,'delete photos');await save(page);await edit(page,'delete photos');
  await page.locator('#delete-post').click();await page.locator('#confirm-ok').click();await page.waitForSelector('#post-dialog',{state:'hidden'});
  assert.equal(objects.size,1);await page.waitForSelector('#photo-cleanup-notice:visible');await page.clock.fastForward(23000);
  await page.waitForFunction(()=>document.querySelector('#photo-cleanup-notice').hidden);assert.equal(objects.size,0);
});

await scenario('logged-out-record-delete-queues-cleanup',async({page,objects})=>{
  await login(page);await create(page,'offline delete');await save(page);
  await page.locator('.rail [data-view="settings"]').click();await page.locator('#photo-logout').click();
  await page.waitForSelector('#photo-login:visible');await edit(page,'offline delete');
  await page.locator('#delete-post').click();await page.locator('#confirm-ok').click();await page.waitForSelector('#post-dialog',{state:'hidden'});
  assert.ok(!(await records(page)).some(p=>p.title==='offline delete'));assert.equal(objects.size,1);
  assert.ok(await page.evaluate(()=>Object.entries(localStorage).some(([k,v])=>k.includes('photo-deletions:')&&JSON.parse(v).length===1)));
});
await scenario('replace-photo-at-ten-file-limit',async({page,objects})=>{
  await login(page);await create(page,'ten photos',Array.from({length:10},(_,i)=>file(`photo-${i}.png`)));await save(page);assert.equal(objects.size,10);
  await edit(page,'ten photos');await page.locator('.photo-item button').first().click();
  await page.locator('#photo-input').setInputFiles(file('replacement.png'));await page.waitForFunction(()=>document.querySelectorAll('.photo-item').length===11);
  await save(page);assert.equal(objects.size,10);
});

await scenario('mobile-photo-editor-and-settings',async({page})=>{
  await page.setViewportSize({width:360,height:740});await login(page);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await create(page,'모바일 사진',[file('one.png'),file('two.png')]);await page.locator('#photo-title').scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await page.locator('#photo-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2);
  await page.screenshot({path:`${output}/photos-360.png`});
  await page.setViewportSize({width:360,height:500});await page.locator('#photo-title').scrollIntoViewIfNeeded();
  const rect=await page.locator('#post-form [type="submit"]').boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=500);
  await page.screenshot({path:`${output}/photos-360-short.png`});
  await save(page);await page.locator('.rail [data-view="settings"]').click();await page.screenshot({path:`${output}/settings-360.png`,fullPage:true});
});
await browser.close();await writeFile(`${output}/photo-browser-results${process.env.QA_CASES?'-targeted':''}.json`,JSON.stringify(results,null,2));
if(results.some(r=>r.status==='failed'))process.exitCode=1;
