import test from 'node:test';
import assert from 'node:assert/strict';
import { DATE_MIN, DATE_MAX, todayKey, isValidDate, addDays, shiftMonth, monthGrid, weekRange, normalizePost, filterPosts, getStats } from '../core.js';
import { STORAGE_KEY, createStore } from '../store.js';

const post = (overrides = {}) => normalizePost({ id: 'a', title: '한국어 中文 English', platform: 'linkedin', status: 'draft', language: 'multi', date: '', time: '', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', ...overrides });
const state = posts => ({ posts, settings: { weeklyGoal: 3 } });
function memory(initial = null) {
  let raw = initial;
  return { getItem: key => { assert.equal(key, STORAGE_KEY); return raw; }, setItem: (key, value) => { assert.equal(key, STORAGE_KEY); raw = value; }, raw: () => raw };
}

test('KST date crosses midnight independently of host timezone', () => {
  assert.equal(todayKey(new Date('2026-09-16T14:59:59Z')), '2026-09-16');
  assert.equal(todayKey(new Date('2026-09-16T15:00:00Z')), '2026-09-17');
});
test('date arithmetic handles leap dates and month/year rollover', () => {
  assert.equal(isValidDate('2024-02-29'), true);
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', 'x']) assert.equal(isValidDate(date), false);
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2024-02-29', 1), '2024-03-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.throws(() => shiftMonth('2026-13', 1));
});
test('calendar is six Monday-first weeks and weekly ranges cross years', () => {
  const grid = monthGrid('2026-02');
  assert.equal(grid.length, 42);
  assert.equal(grid[0], '2026-01-26');
  assert.equal(grid[41], '2026-03-08');
  assert.deepEqual(weekRange('2026-01-01'), { start: '2025-12-29', end: '2026-01-04' });
});
test('post validation preserves body and rejects unsafe links and invalid fields', () => {
  const text = '\n中文\n한국어 👋\n';
  assert.equal(post({ text }).text, text);
  assert.ok(normalizePost({ title: 'New', platform: 'x', status: 'idea', language: 'en' }).id);
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/a', '//example.com']) assert.throws(() => post({ url }), /링크/);
  assert.equal(post({ url: 'https://example.com/p' }).url, 'https://example.com/p');
  for (const override of [{ title: '' }, { title: 'x'.repeat(161) }, { platform: 'unknown' }, { status: 'bad' }, { language: 'bad' }, { date: '2026-02-30' }, { time: '24:00' }, { status: 'planned' }, { status: 'published' }, { text: 'x'.repeat(50001) }]) assert.throws(() => post(override));
});
test('record date bounds reject unsupported years while calendar arithmetic supports adjacent cells', () => {
  assert.equal(post({ date: DATE_MIN }).date, '1900-01-01');
  assert.equal(post({ date: DATE_MAX }).date, '2100-12-31');
  for (const date of ['0000-01-01', '1899-12-31', '2101-01-01', '9999-12-31']) {
    assert.throws(() => post({ date }), /1900년부터 2100년/);
  }
  assert.equal(addDays(DATE_MIN, -1), '1899-12-31');
  assert.equal(addDays(DATE_MAX, 1), '2101-01-01');
  assert.equal(monthGrid('1900-01').length, 42);
  const finalMonth = monthGrid('2100-12');
  assert.equal(finalMonth.length, 42);
  assert.equal(finalMonth.at(-1), '2101-01-09');
  const store = createStore(memory());
  assert.throws(() => store.parseImport(JSON.stringify({ version: 1, ...state([{ ...post(), date: '9999-12-31' }]) })), /1900년부터 2100년/);
});
test('filters support multilingual search, date bounds, chronological order without mutation', () => {
  const posts = [post({ id: 'undated' }), post({ id: 'later', date: '2026-09-19', platform: 'x' }), post({ id: 'early', date: '2026-09-17', notes: '메모 찾기' })];
  assert.deepEqual(filterPosts(posts).map(p => p.id), ['early', 'later', 'undated']);
  assert.deepEqual(posts.map(p => p.id), ['undated', 'later', 'early']);
  assert.deepEqual(filterPosts(posts, { query: '찾기', from: '2026-09-17', to: '2026-09-18' }).map(p => p.id), ['early']);
  assert.equal(filterPosts(posts, { platform: 'x', status: 'published' }).length, 0);
});
test('stats exclude future publications and count distinct publishing days for streak', () => {
  const posts = ['2026-09-15', '2026-09-16', '2026-09-16', '2026-09-18'].map((date, i) => post({ id: String(i), status: 'published', date }));
  posts.push(post({ id: 'plan', status: 'planned', date: '2026-09-20' }), post());
  assert.deepEqual(getStats(posts, '2026-09-17'), { weekPublished: 3, weekPlanned: 1, draftCount: 1, publishedCount: 3, streak: 2 });
  assert.equal(getStats(posts, '2026-09-21').streak, 0);
});
test('missing storage seeds but persisted empty list remains empty', () => {
  const storage = memory();
  const store = createStore(storage);
  assert.equal(store.load([post()]).posts.length, 1);
  store.save(state([]));
  assert.deepEqual(store.load([post()]), state([]));
});
test('corrupt stored data remains untouched and reports recovery warning', () => {
  const storage = memory('{broken');
  const loaded = createStore(storage).load([post()]);
  assert.equal(loaded.posts.length, 0);
  assert.match(loaded.warning, /원본은 유지/);
  assert.equal(storage.raw(), '{broken');
});
test('import validates the whole file atomically and round-trips valid backups', () => {
  const store = createStore(memory());
  const original = state([post()]);
  assert.deepEqual(store.parseImport(store.export(original)), original);
  for (const data of [null, {}, { version: 2, ...original }, { version: 1, ...original, posts: [post(), post()] }, { version: 1, ...original, posts: [post(), { ...post({ id: 'b' }), url: 'javascript:bad' }] }, { version: 1, ...original, posts: [{ title: 'missing id' }] }, { version: 1, ...original, settings: { weeklyGoal: 0 } }]) assert.throws(() => store.parseImport(JSON.stringify(data)));
  assert.throws(() => store.parseImport('{broken'), /JSON/);
  assert.equal(original.posts.length, 1);
});
test('storage quota and access failures are reported', () => {
  const store = createStore({ getItem() { throw Error('Denied'); }, setItem() { throw Error('QuotaExceededError'); } });
  assert.match(store.load().warning, /읽을 수 없습니다/);
  assert.throws(() => store.save(state([post()])), /저장하지 못했습니다/);
  const quotaStore = createStore({ getItem() { return null; }, setItem() { throw Error('QuotaExceededError'); } });
  assert.throws(() => quotaStore.save(state([post()])), /저장하지 못했습니다/);
});
test('stale save detects external changes before storage events and preserves external data', () => {
  const storage = memory();
  const store = createStore(storage);
  store.load();
  const external = store.export(state([post({ title: 'Other tab' })]));
  storage.setItem(STORAGE_KEY, external);
  assert.throws(() => store.save(state([post({ title: 'Stale edit' })])), { code: 'STALE_STORAGE' });
  assert.equal(storage.raw(), external);
  assert.throws(() => store.save(state([])), { code: 'STALE_STORAGE' });
  store.load();
  store.save(state([post({ title: 'Reloaded edit' })]));
  assert.equal(store.load().posts[0].title, 'Reloaded edit');
});
test('save initializes and refreshes snapshot and detects external deletion', () => {
  const storage = memory();
  const store = createStore(storage);
  store.save(state([post()]));
  store.save(state([post({ title: 'Second save' })]));
  assert.equal(store.load().posts[0].title, 'Second save');
  storage.setItem(STORAGE_KEY, null);
  assert.throws(() => store.save(state([])), { code: 'STALE_STORAGE' });
  assert.equal(storage.raw(), null);
});
test('explicit recovery can replace corrupt data after load', () => {
  const storage = memory('{broken');
  const store = createStore(storage);
  assert.ok(store.load().warning);
  store.save(state([post()]));
  assert.deepEqual(store.load(), state([post()]));
});
test('merge deduplicates by ID and replaces only newer updates, retaining current settings', () => {
  const store = createStore(memory());
  const current = { posts: [post()], settings: { weeklyGoal: 7 } };
  const newer = post({ title: 'New', updatedAt: '2026-09-02T00:00:00Z' });
  const merged = store.merge(current, state([newer, post({ id: 'b' })]));
  assert.equal(merged.posts.length, 2);
  assert.equal(merged.posts[0].title, 'New');
  assert.equal(merged.settings.weeklyGoal, 7);
  assert.equal(current.posts[0].title, '한국어 中文 English');
  assert.equal(store.merge(merged, state([post({ title: 'Older' })])).posts[0].title, 'New');
  assert.equal(store.merge(merged, state([{ ...newer, title: 'Same timestamp' }])).posts[0].title, 'New');
});
