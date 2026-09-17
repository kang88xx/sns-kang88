import test from 'node:test';
import assert from 'node:assert/strict';
import { CHANNELS, STATUSES, addDays, monthGrid, normalizePost } from '../core.js';
import { STORAGE_KEY, createStore } from '../store.js';

const post = (overrides = {}) => normalizePost({
  id: 'legacy-idea', title: '보관한 콘텐츠', platform: 'linkedin', status: 'idea', language: 'multi',
  text: '\n한국어 中文 English\n', notes: '기존 메모',
  createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', ...overrides,
});
function memory(initial = null) {
  let raw = initial;
  return {
    getItem(key) { assert.equal(key, STORAGE_KEY); return raw; },
    setItem(key, value) { assert.equal(key, STORAGE_KEY); raw = value; },
  };
}

test('legacy calendar calls retain six complete weeks', () => {
  for (const month of ['2027-02', '2026-09', '2026-03', '2024-02', '2026-12']) {
    const grid = monthGrid(month);
    assert.equal(grid.length, 42);
    assert.deepEqual(monthGrid(month, {}), grid);
    assert.deepEqual(monthGrid(month, { compact: false }), grid);
    assert.equal(new Date(`${grid[0]}T00:00:00Z`).getUTCDay(), 1);
    assert.equal(new Date(`${grid.at(-1)}T00:00:00Z`).getUTCDay(), 0);
  }
});

test('legacy idea records preserve IDs, content and status through storage and backup', () => {
  const original = { posts: [post()], settings: { weeklyGoal: 4 } };
  const storage = memory(JSON.stringify({ version: 1, ...original }));
  const store = createStore(storage);
  assert.deepEqual(store.load(), original);
  const restored = store.parseImport(store.export(store.load()));
  store.save(restored);
  assert.deepEqual(createStore(storage).load(), original);
  assert.deepEqual(STATUSES.map(status => status.id), ['idea', 'draft', 'ready', 'planned', 'published']);
});

test('compact months use only complete Monday-first weeks needed to cover the month', () => {
  for (const [month, length, first, last] of [
    ['2027-02', 28, '2027-02-01', '2027-02-28'],
    ['2026-09', 35, '2026-08-31', '2026-10-04'],
    ['2026-03', 42, '2026-02-23', '2026-04-05'],
    ['2024-02', 35, '2024-01-29', '2024-03-03'],
    ['2026-01', 35, '2025-12-29', '2026-02-01'],
    ['2026-12', 35, '2026-11-30', '2027-01-03'],
    ['1900-01', 35, '1900-01-01', '1900-02-04'],
    ['2100-12', 35, '2100-11-29', '2101-01-02'],
  ]) {
    const grid = monthGrid(month, { compact: true });
    assert.equal(grid.length, length, month);
    assert.equal(grid[0], first, month);
    assert.equal(grid.at(-1), last, month);
    assert.deepEqual(grid, Array.from({ length }, (_, i) => addDays(first, i)));
    assert.ok(grid.slice(0, 7).some(date => date.startsWith(month)));
    assert.ok(grid.slice(-7).some(date => date.startsWith(month)));
  }
  assert.ok(monthGrid('2024-02', { compact: true }).includes('2024-02-29'));
  assert.throws(() => monthGrid('2026-13', { compact: true }));
});

test('YouTube validates and survives saving, reloading, export and import alongside legacy records', () => {
  assert.deepEqual(CHANNELS.find(channel => channel.id === 'youtube'), {
    id: 'youtube', label: 'YouTube', short: 'YT', color: '#ff0000', composeUrl: 'https://studio.youtube.com/',
  });
  const video = post({ id: 'video', platform: 'youtube', status: 'planned', date: '2026-09-18' });
  const original = { posts: [post(), video], settings: { weeklyGoal: 5 } };
  const storage = memory();
  const store = createStore(storage);
  store.save(original);
  assert.deepEqual(createStore(storage).load(), original);
  const restored = createStore(memory());
  const incoming = restored.parseImport(store.export(store.load()));
  restored.save(restored.merge({ posts: [], settings: original.settings }, incoming));
  assert.deepEqual(restored.load(), original);
  assert.throws(() => post({ platform: 'youtube', status: 'planned' }), /날짜/);
  assert.throws(() => post({ platform: 'unknown' }), /채널/);
});

test('content workflow labels change without renaming stored status IDs', () => {
  assert.equal(STATUSES.find(status => status.id === 'idea').label, '보관');
  assert.equal(STATUSES.find(status => status.id === 'draft').label, '작성 중');
  assert.equal(STATUSES.find(status => status.id === 'planned').label, '게시 예정');
});
